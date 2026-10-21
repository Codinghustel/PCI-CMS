import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { bitrixConfig, deliverDueLeads, leadStats } from "@/server/services/leads";
import { paymentMode } from "@/server/services/payments";
import { purgeExpiredRateLimits } from "@/server/services/rate-limit";
import { purgeExpiredSessions } from "@/server/services/auth";
import { getSettings } from "@/server/services/site";
import { testConnection } from "@/server/integrations/bitrix24";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { serverEnv } from "@/lib/env";
import { can, type Actor } from "@/lib/auth/permissions";

// Status and operations for external integrations, shown in Settings →
// Integrations. Secret values are never returned — only whether they are set
// and a masked hint (e.g. the webhook host).

export const LEAD_JOB = "crm-delivery";

function maskUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/••••`;
  } catch {
    return "••••";
  }
}

export type IntegrationState = "connected" | "configured" | "attention" | "not_configured" | "info";

export async function integrationStatus(actor: Actor) {
  if (!can(actor, "settings.manage")) throw new ForbiddenError();
  const env = serverEnv();
  const [settings, stats, lastRun, lastDelivered, resolved] = await Promise.all([
    getSettings(),
    leadStats(),
    db.jobRun.findFirst({ where: { job: LEAD_JOB }, orderBy: { startedAt: "desc" } }),
    db.lead.findFirst({ where: { crmStatus: "DELIVERED" }, orderBy: { crmDeliveredAt: "desc" }, select: { crmDeliveredAt: true } }),
    bitrixConfig(),
  ]);
  const mode = paymentMode();

  const bitrixState: IntegrationState = !env.BITRIX24_WEBHOOK_URL
    ? "not_configured"
    : !settings.integrations.crmEnabled || stats.failed > 0
      ? "attention"
      : "configured";

  return {
    bitrix: {
      state: bitrixState,
      webhook: maskUrl(env.BITRIX24_WEBHOOK_URL),
      enabled: settings.integrations.crmEnabled,
      blockedReason: resolved.config ? null : "reason" in resolved ? resolved.reason : null,
      projectField: resolved.config?.projectField || settings.integrations.bitrixProjectField || env.BITRIX24_PROJECT_FIELD || "",
      assignee: resolved.config?.defaultAssigneeId || settings.integrations.bitrixAssigneeId || env.BITRIX24_DEFAULT_ASSIGNEE_ID || "",
      stats,
      lastDeliveredAt: lastDelivered?.crmDeliveredAt ?? null,
    },
    payment: {
      state: (mode === "service" ? "configured" : "info") as IntegrationState,
      mode,
      service: maskUrl(env.PAYMENT_SERVICE_URL),
    },
    scheduler: {
      state: (!env.CRON_SECRET ? "not_configured" : lastRun && !lastRun.success ? "attention" : "configured") as IntegrationState,
      secretSet: !!env.CRON_SECRET,
      lastRun: lastRun ? { startedAt: lastRun.startedAt, trigger: lastRun.trigger, success: lastRun.success, summary: lastRun.summary } : null,
    },
    indexing: {
      state: (env.SITE_ENV === "production" ? "configured" : "info") as IntegrationState,
      siteEnv: env.SITE_ENV,
      indexable: env.SITE_ENV === "production",
      siteUrl: env.NEXT_PUBLIC_SITE_URL,
    },
    analytics: {
      state: (settings.analytics.gtmId ? "configured" : "not_configured") as IntegrationState,
      gtmId: settings.analytics.gtmId,
    },
  };
}
export type IntegrationStatus = Awaited<ReturnType<typeof integrationStatus>>;

export async function testBitrix(actor: Actor) {
  if (!can(actor, "settings.manage")) throw new ForbiddenError();
  const env = serverEnv();
  if (!env.BITRIX24_WEBHOOK_URL) throw new ValidationError("Set BITRIX24_WEBHOOK_URL in the environment first.");
  const result = await testConnection({ webhookUrl: env.BITRIX24_WEBHOOK_URL });
  await audit(actor, { action: "integration.test", entityType: "Integration", entityId: "bitrix24", summary: `Bitrix24 connection test: ${result.ok ? "ok" : "failed"}` });
  return result;
}

/** Runs the CRM delivery job and housekeeping, recording the run. */
export async function runLeadDeliveryJob(trigger: "schedule" | "manual", actor?: Actor) {
  if (trigger === "manual" && (!actor || !can(actor, "settings.manage"))) throw new ForbiddenError();
  const run = await db.jobRun.create({ data: { job: LEAD_JOB, trigger } });
  try {
    const result = await deliverDueLeads(50);
    await Promise.all([purgeExpiredRateLimits(), purgeExpiredSessions()]);
    const summary = `${result.processed} processed, ${result.delivered} delivered`;
    await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), success: true, summary } });
    if (actor) await audit(actor, { action: "integration.run", entityType: "Integration", entityId: LEAD_JOB, summary: `Ran CRM delivery job manually: ${summary}` });
    // Keep the history short.
    const old = await db.jobRun.findMany({ where: { job: LEAD_JOB }, orderBy: { startedAt: "desc" }, skip: 200, select: { id: true } });
    if (old.length) await db.jobRun.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return result;
  } catch (e) {
    await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), success: false, summary: (e as Error).message.slice(0, 300) } });
    throw e;
  }
}
