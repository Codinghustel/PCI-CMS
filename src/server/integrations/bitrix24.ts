import { z } from "zod";
import { fetchJson, IntegrationError, isTransientStatus } from "@/server/integrations/http";
import { LEAD_FORM_TYPE_LABELS, type LeadFormTypeValue } from "@/lib/content-labels";

// Bitrix24 CRM lead delivery through an inbound webhook (REST API).
//   Method used: crm.lead.add  — and crm.lead.list for idempotency checks.
//   Webhook URL format: https://<portal>.bitrix24.<tld>/rest/<user>/<code>/
// Field names (TITLE, NAME, PHONE, EMAIL, SOURCE_ID, UTM_*, ORIGINATOR_ID,
// ORIGIN_ID, ASSIGNED_BY_ID, COMMENTS) are standard lead fields; confirm the
// final mapping, pipelines and custom fields with PCI Sales Ops (open decision #8).

export const ORIGINATOR_ID = "pci-orbit-website";

export interface BitrixConfig {
  webhookUrl: string;
  projectField?: string; // custom field code (e.g. UF_CRM_PROJECT) for the project id
  defaultAssigneeId?: string;
}

export interface LeadForCrm {
  correlationId: string;
  formType: LeadFormTypeValue;
  name: string;
  email: string;
  phone: string;
  country: string;
  message: string;
  projectName: string;
  bitrixProjectId: string;
  pageUrl: string;
  landingPage: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  fbclid: string;
  consent: boolean;
  extra: Record<string, unknown>;
  createdAt: Date;
}

/** Builds the crm.lead.add `fields` object. Pure function — unit tested. */
export function buildLeadFields(lead: LeadForCrm, config: Pick<BitrixConfig, "projectField" | "defaultAssigneeId">) {
  const [firstName, ...rest] = lead.name.trim().split(/\s+/);
  const formLabel = LEAD_FORM_TYPE_LABELS[lead.formType];
  const extraLines = Object.entries(lead.extra ?? {})
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${String(v)}`);
  const comments = [
    lead.message,
    "",
    `Form: ${formLabel}`,
    lead.projectName ? `Project: ${lead.projectName}` : "",
    lead.country ? `Country: ${lead.country}` : "",
    `Page: ${lead.pageUrl}`,
    lead.landingPage ? `Landing page: ${lead.landingPage}` : "",
    lead.referrer ? `Referrer: ${lead.referrer}` : "",
    lead.gclid ? `gclid: ${lead.gclid}` : "",
    lead.fbclid ? `fbclid: ${lead.fbclid}` : "",
    ...extraLines,
    `Consent: ${lead.consent ? "yes" : "no"} (${lead.createdAt.toISOString()})`,
    `Reference: ${lead.correlationId}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const fields: Record<string, unknown> = {
    TITLE: `${formLabel}${lead.projectName ? ` – ${lead.projectName}` : ""} – ${lead.name}`.slice(0, 255),
    NAME: firstName ?? lead.name,
    LAST_NAME: rest.join(" "),
    PHONE: [{ VALUE: lead.phone, VALUE_TYPE: "WORK" }],
    EMAIL: [{ VALUE: lead.email, VALUE_TYPE: "WORK" }],
    SOURCE_ID: "WEB",
    SOURCE_DESCRIPTION: `Website – ${formLabel}`,
    COMMENTS: comments,
    OPENED: "Y",
    UTM_SOURCE: lead.utmSource,
    UTM_MEDIUM: lead.utmMedium,
    UTM_CAMPAIGN: lead.utmCampaign,
    UTM_CONTENT: lead.utmContent,
    UTM_TERM: lead.utmTerm,
    ORIGINATOR_ID: ORIGINATOR_ID,
    ORIGIN_ID: lead.correlationId,
  };
  if (config.projectField && lead.bitrixProjectId) fields[config.projectField] = lead.bitrixProjectId;
  if (config.defaultAssigneeId) fields.ASSIGNED_BY_ID = config.defaultAssigneeId;
  return fields;
}

const addResponse = z.object({ result: z.union([z.number(), z.string()]) });
const errorResponse = z.object({ error: z.string(), error_description: z.string().optional() });
const listResponse = z.object({ result: z.array(z.object({ ID: z.union([z.string(), z.number()]) })) });

function endpoint(config: BitrixConfig, method: string) {
  const base = config.webhookUrl.endsWith("/") ? config.webhookUrl : `${config.webhookUrl}/`;
  return `${base}${method}.json`;
}

function interpretError(status: number, body: unknown): IntegrationError {
  const err = errorResponse.safeParse(body);
  const code = err.success ? err.data.error : "";
  const description = err.success ? (err.data.error_description ?? "") : "";
  const transient = isTransientStatus(status) || code === "QUERY_LIMIT_EXCEEDED" || code === "INTERNAL_SERVER_ERROR";
  return new IntegrationError(`Bitrix24 ${status}${code ? ` ${code}` : ""}${description ? `: ${description}` : ""}`.slice(0, 500), transient, status);
}

/** Returns the existing lead id if this submission was already delivered (idempotency). */
export async function findExistingLead(config: BitrixConfig, correlationId: string): Promise<string | null> {
  const { status, body } = await fetchJson(endpoint(config, "crm.lead.list"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filter: { ORIGINATOR_ID, ORIGIN_ID: correlationId }, select: ["ID"] }),
  });
  if (status !== 200) throw interpretError(status, body);
  const parsed = listResponse.safeParse(body);
  if (!parsed.success) throw new IntegrationError("Unexpected Bitrix24 response to crm.lead.list", true, status);
  return parsed.data.result[0] ? String(parsed.data.result[0].ID) : null;
}

export async function createLead(config: BitrixConfig, lead: LeadForCrm): Promise<string> {
  const { status, body } = await fetchJson(endpoint(config, "crm.lead.add"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: buildLeadFields(lead, config), params: { REGISTER_SONET_EVENT: "Y" } }),
  });
  if (status !== 200) throw interpretError(status, body);
  const parsed = addResponse.safeParse(body);
  if (!parsed.success) {
    const err = errorResponse.safeParse(body);
    if (err.success) throw interpretError(status, body);
    throw new IntegrationError("Unexpected Bitrix24 response to crm.lead.add", true, status);
  }
  return String(parsed.data.result);
}
