import { notFound } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/ui";
import { CrmBadge } from "@/components/admin/crm-badge";
import { requirePermissionPage } from "@/lib/auth/session";
import { getLead } from "@/server/services/leads";
import { resendLeadAction } from "@/app/admin/actions/site";
import { can } from "@/lib/auth/permissions";
import { LEAD_FORM_TYPE_LABELS } from "@/lib/content-labels";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermissionPage("leads.read");
  const { id } = await params;
  const lead = await getLead(actor, id).catch(() => notFound());
  const extra = Object.entries((lead.extra ?? {}) as Record<string, unknown>).filter(([, v]) => v !== "" && v != null);
  const rows: [string, string][] = [
    ["Name", lead.name],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Country", lead.country],
    ["Form", LEAD_FORM_TYPE_LABELS[lead.formType]],
    ["Project", lead.projectName],
    ["Message", lead.message],
    ...extra.map(([k, v]) => [k, String(v)] as [string, string]),
    ["Page", lead.pageUrl],
    ["Landing page", lead.landingPage],
    ["Referrer", lead.referrer],
    ["UTM source / medium", [lead.utmSource, lead.utmMedium].filter(Boolean).join(" / ")],
    ["UTM campaign / content / term", [lead.utmCampaign, lead.utmContent, lead.utmTerm].filter(Boolean).join(" / ")],
    ["Click IDs", [lead.gclid && `gclid ${lead.gclid}`, lead.fbclid && `fbclid ${lead.fbclid}`].filter(Boolean).join(" · ")],
    ["Consent", `${lead.consent ? "Given" : "Not given"} — “${lead.consentText}”`],
    ["Reference", lead.correlationId],
    ["Received", lead.createdAt.toLocaleString("en-GB")],
  ];
  return (
    <>
      <PageHeader
        title={lead.name}
        description={`${LEAD_FORM_TYPE_LABELS[lead.formType]}${lead.projectName ? ` · ${lead.projectName}` : ""}`}
        back={{ href: "/admin/leads", label: "Leads" }}
        actions={can(actor, "leads.resend") && lead.crmStatus !== "DELIVERED" ? <ActionButton action={resendLeadAction.bind(null, lead.id)}><RefreshCw /> Re-send to Bitrix24</ActionButton> : null}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Submission</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {rows.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2 sm:grid-cols-3"><dt className="text-muted-foreground">{k}</dt><dd className="break-words whitespace-pre-line sm:col-span-2">{v}</dd></div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Bitrix24 delivery</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2"><CrmBadge status={lead.crmStatus} />{lead.crmLeadId ? <span>Lead #{lead.crmLeadId}</span> : null}</p>
            {lead.crmLastError ? <p className="rounded bg-red-50 p-2 text-xs text-red-900">{lead.crmLastError}</p> : null}
            {lead.crmNextAttemptAt && lead.crmStatus === "FAILED" ? <p className="text-xs text-muted-foreground">Next automatic retry: {lead.crmNextAttemptAt.toLocaleString("en-GB")}</p> : null}
            <ul className="divide-y text-xs">
              {lead.attempts.map((a) => (
                <li key={a.id} className="py-2">
                  Attempt {a.attemptNo} · {a.success ? "succeeded" : "failed"}{a.httpStatus ? ` (HTTP ${a.httpStatus})` : ""} · {a.durationMs} ms
                  <span className="block text-muted-foreground">{a.createdAt.toLocaleString("en-GB")}{a.error ? ` — ${a.error}` : ""}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
