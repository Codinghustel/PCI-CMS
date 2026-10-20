import { after } from "next/server";
import { deliverLead, submitLead } from "@/server/services/leads";
import { clientIp, forbiddenOrigin, isSameOrigin, jsonError, readJson } from "@/lib/http";

/**
 * POST /api/leads — website enquiry forms.
 * Body: LeadInput (see src/lib/validation/leads.ts).
 * 201 { id, reference } — stored; CRM delivery continues after the response.
 * 422 validation errors, 429 rate limited, 403 cross-site.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  try {
    const body = await readJson(request);
    const lead = await submitLead(body, { ipAddress: clientIp(request), userAgent: request.headers.get("user-agent") ?? "" });
    // Deliver to Bitrix24 after responding; failures are retried by the job.
    after(() => deliverLead(lead.id).catch((e) => console.error("[crm] post-response delivery error", e)));
    return Response.json({ id: lead.id, reference: lead.correlationId }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
