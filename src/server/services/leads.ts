import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { getSettings } from "@/server/services/site";
import { createLead, findExistingLead, type BitrixConfig } from "@/server/integrations/bitrix24";
import { IntegrationError } from "@/server/integrations/http";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { normalizeList, parseInput, type ListParams } from "@/server/services/helpers";
import { leadInputSchema, paymentRequestExtraSchema } from "@/lib/validation/leads";
import { can, type Actor } from "@/lib/auth/permissions";
import { serverEnv } from "@/lib/env";
import type { LeadFormTypeValue } from "@/lib/content-labels";

// Lead capture pipeline:
//  1. validate + normalise → 2. anti-spam (rate limit, honeypot, timing)
//  3. store in PCI-Orbit FIRST (a CRM outage never loses a lead)
//  4. deliver to Bitrix24 (after the response, plus a retry job)
//  5. idempotent retries with backoff; failures visible and re-sendable in the CMS.

const MAX_AUTOMATIC_ATTEMPTS = 6;
const BACKOFF_SECONDS = [60, 5 * 60, 30 * 60, 2 * 3600, 6 * 3600, 12 * 3600];
const LEASE_SECONDS = 120;
const MIN_FILL_MS = 2500;

export interface SubmissionMeta {
  ipAddress: string;
  userAgent: string;
}

export async function submitLead(input: unknown, meta: SubmissionMeta) {
  await enforceRateLimit(`lead:${meta.ipAddress}`, 8, 10 * 60);
  const data = parseInput(leadInputSchema, input);

  // Bots typically fill hidden fields or submit instantly.
  if (data.website || (data.startedAt && Date.now() - data.startedAt < MIN_FILL_MS)) {
    throw new ValidationError("We could not process this submission. Please try again.");
  }

  let extra: Record<string, unknown> = data.extra;
  if (data.formType === "PAYMENT_REQUEST") {
    extra = { ...extra, ...parseInput(paymentRequestExtraSchema, data.extra) };
  }

  const project = data.projectId
    ? await db.project.findFirst({ where: { id: data.projectId, status: "PUBLISHED" }, select: { id: true, name: true } })
    : null;
  const settings = await getSettings();

  const lead = await db.lead.create({
    data: {
      correlationId: crypto.randomUUID(),
      formType: data.formType,
      name: data.name,
      email: data.email,
      phone: data.phone,
      country: data.country,
      message: data.message,
      projectId: project?.id ?? null,
      projectName: project?.name ?? "",
      pageUrl: data.pageUrl,
      ...data.attribution,
      extra: extra as Prisma.InputJsonValue,
      consent: data.consent,
      consentText: settings.forms.consentText,
      userAgent: meta.userAgent.slice(0, 300),
    },
  });
  return lead;
}

function bitrixConfig(): BitrixConfig | null {
  const env = serverEnv();
  if (!env.BITRIX24_WEBHOOK_URL) return null;
  return {
    webhookUrl: env.BITRIX24_WEBHOOK_URL,
    projectField: env.BITRIX24_PROJECT_FIELD,
    defaultAssigneeId: env.BITRIX24_DEFAULT_ASSIGNEE_ID,
  };
}

/**
 * Attempts delivery of one lead. Safe to call concurrently: a short lease
 * prevents two workers delivering the same lead, and retries first check
 * Bitrix24 for an existing lead with the same correlation id (ORIGIN_ID).
 */
export async function deliverLead(leadId: string, opts: { manual?: boolean } = {}) {
  const config = bitrixConfig();
  const now = new Date();

  if (!config) {
    await db.lead.updateMany({
      where: { id: leadId, crmStatus: { in: ["PENDING", "FAILED", "NOT_CONFIGURED"] } },
      data: { crmStatus: "NOT_CONFIGURED", crmLastError: "BITRIX24_WEBHOOK_URL is not configured", crmNextAttemptAt: null },
    });
    return { status: "NOT_CONFIGURED" as const };
  }

  const claimed = await db.lead.updateMany({
    where: {
      id: leadId,
      crmStatus: { in: ["PENDING", "FAILED", "NOT_CONFIGURED"] },
      ...(opts.manual ? {} : { OR: [{ crmNextAttemptAt: null }, { crmNextAttemptAt: { lte: now } }] }),
    },
    data: { crmNextAttemptAt: new Date(now.getTime() + LEASE_SECONDS * 1000) },
  });
  if (claimed.count === 0) return { status: "SKIPPED" as const };

  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { project: { select: { bitrixProjectId: true } } } });
  const attemptNo = lead.crmAttempts + 1;
  const started = Date.now();

  try {
    let crmId = lead.crmAttempts > 0 ? await findExistingLead(config, lead.correlationId) : null;
    if (!crmId) {
      crmId = await createLead(config, {
        ...lead,
        formType: lead.formType as LeadFormTypeValue,
        bitrixProjectId: lead.project?.bitrixProjectId ?? "",
        extra: (lead.extra ?? {}) as Record<string, unknown>,
      });
    }
    await db.$transaction([
      db.lead.update({
        where: { id: leadId },
        data: { crmStatus: "DELIVERED", crmLeadId: crmId, crmAttempts: attemptNo, crmLastError: "", crmNextAttemptAt: null, crmDeliveredAt: new Date() },
      }),
      db.crmDeliveryAttempt.create({ data: { leadId, attemptNo, success: true, httpStatus: 200, durationMs: Date.now() - started } }),
    ]);
    return { status: "DELIVERED" as const, crmId };
  } catch (e) {
    const err = e instanceof IntegrationError ? e : new IntegrationError("Unexpected delivery error", true);
    if (!(e instanceof IntegrationError)) console.error("[crm] unexpected delivery error", e);
    const retry = err.transient && attemptNo < MAX_AUTOMATIC_ATTEMPTS;
    const delay = BACKOFF_SECONDS[Math.min(attemptNo - 1, BACKOFF_SECONDS.length - 1)];
    await db.$transaction([
      db.lead.update({
        where: { id: leadId },
        data: {
          crmStatus: "FAILED",
          crmAttempts: attemptNo,
          crmLastError: err.message.slice(0, 500),
          crmNextAttemptAt: retry ? new Date(Date.now() + delay * 1000) : null,
        },
      }),
      db.crmDeliveryAttempt.create({
        data: { leadId, attemptNo, success: false, httpStatus: err.httpStatus ?? null, error: err.message.slice(0, 500), durationMs: Date.now() - started },
      }),
    ]);
    console.warn(`[crm] delivery failed for lead ${lead.correlationId} (attempt ${attemptNo}): ${err.message}`);
    return { status: "FAILED" as const, error: err.message, willRetry: retry };
  }
}

/** Processes leads due for (re)delivery. Called by the scheduled job endpoint. */
export async function deliverDueLeads(limit = 25) {
  const config = bitrixConfig();
  const due = await db.lead.findMany({
    where: config
      ? {
          OR: [
            { crmStatus: "PENDING", OR: [{ crmNextAttemptAt: null }, { crmNextAttemptAt: { lte: new Date() } }] },
            { crmStatus: "FAILED", crmNextAttemptAt: { lte: new Date() } },
            { crmStatus: "NOT_CONFIGURED" },
          ],
        }
      : { crmStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results = [];
  for (const { id } of due) results.push(await deliverLead(id));
  return { processed: results.length, delivered: results.filter((r) => r.status === "DELIVERED").length };
}

export async function resendLead(actor: Actor, id: string) {
  if (!can(actor, "leads.resend")) throw new ForbiddenError();
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) throw new NotFoundError("Lead not found");
  if (lead.crmStatus === "DELIVERED") throw new ValidationError("This lead has already been delivered to Bitrix24.");
  await audit(actor, { action: "lead.resend", entityType: "Lead", entityId: id, summary: `Manual CRM re-send for ${lead.correlationId}` });
  return deliverLead(id, { manual: true });
}

export async function listLeads(actor: Actor, params: ListParams & { formType?: string; crmStatus?: string; from?: Date; to?: Date }) {
  if (!can(actor, "leads.read")) throw new ForbiddenError();
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where = leadWhere(params, q);
  const [items, total] = await Promise.all([
    db.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.lead.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

function leadWhere(params: { formType?: string; crmStatus?: string; from?: Date; to?: Date }, q?: string): Prisma.LeadWhereInput {
  return {
    ...(params.formType ? { formType: params.formType as LeadFormTypeValue } : {}),
    ...(params.crmStatus ? { crmStatus: params.crmStatus as Prisma.LeadWhereInput["crmStatus"] & string } : {}),
    ...(params.from || params.to ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { projectName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function getLead(actor: Actor, id: string) {
  if (!can(actor, "leads.read")) throw new ForbiddenError();
  const lead = await db.lead.findUnique({ where: { id }, include: { attempts: { orderBy: { attemptNo: "desc" } } } });
  if (!lead) throw new NotFoundError("Lead not found");
  return lead;
}

function csvCell(value: unknown): string {
  let s = value instanceof Date ? value.toISOString() : String(value ?? "");
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportLeadsCsv(actor: Actor, params: { formType?: string; crmStatus?: string; from?: Date; to?: Date; q?: string }) {
  if (!can(actor, "leads.export")) throw new ForbiddenError("You do not have permission to export leads.");
  const leads = await db.lead.findMany({ where: leadWhere(params, params.q), orderBy: { createdAt: "desc" }, take: 10_000 });
  const columns = [
    "createdAt", "correlationId", "formType", "name", "email", "phone", "country", "projectName", "message",
    "pageUrl", "landingPage", "referrer", "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm",
    "crmStatus", "crmLeadId", "crmAttempts", "crmLastError",
  ] as const;
  const lines = [columns.join(",")];
  for (const l of leads) lines.push(columns.map((c) => csvCell(l[c])).join(","));
  await audit(actor, { action: "lead.export", entityType: "Lead", summary: `Exported ${leads.length} leads`, metadata: { count: leads.length } });
  return lines.join("\r\n");
}

export async function leadStats() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [last30, failed, notConfigured, pending] = await Promise.all([
    db.lead.count({ where: { createdAt: { gte: since } } }),
    db.lead.count({ where: { crmStatus: "FAILED" } }),
    db.lead.count({ where: { crmStatus: "NOT_CONFIGURED" } }),
    db.lead.count({ where: { crmStatus: "PENDING" } }),
  ]);
  return { last30, failed, notConfigured, pending };
}
