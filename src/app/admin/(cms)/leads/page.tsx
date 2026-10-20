import Link from "next/link";
import { Download } from "lucide-react";
import { CrmBadge } from "@/components/admin/crm-badge";
import { Button } from "@/components/ui/button";
import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { requirePermissionPage } from "@/lib/auth/session";
import { listLeads } from "@/server/services/leads";
import { can } from "@/lib/auth/permissions";
import { CRM_STATUS_LABELS, LEAD_FORM_TYPES, LEAD_FORM_TYPE_LABELS } from "@/lib/content-labels";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("leads.read");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listLeads(actor, { q: sp.q, formType: sp.formType, crmStatus: sp.crmStatus, page: Number(sp.page) || 1, pageSize: 25 });
  const exportParams = new URLSearchParams(Object.entries({ q: sp.q, formType: sp.formType, crmStatus: sp.crmStatus }).filter(([, v]) => v) as [string, string][]);
  return (
    <>
      <PageHeader
        title="Leads"
        description="Every website enquiry is stored here first, then delivered to Bitrix24. Failed deliveries retry automatically and can be re-sent manually."
        actions={can(actor, "leads.export") ? <Button asChild variant="outline" size="sm"><a href={`/api/admin/leads/export?${exportParams}`}><Download /> Export CSV</a></Button> : null}
      />
      <ListToolbar
        q={sp.q}
        placeholder="Search name, email, phone or project"
        filters={[
          { name: "formType", label: "Form", value: sp.formType, options: LEAD_FORM_TYPES.map((t) => ({ value: t, label: LEAD_FORM_TYPE_LABELS[t] })) },
          { name: "crmStatus", label: "CRM", value: sp.crmStatus, options: Object.entries(CRM_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
        ]}
      />
      <SimpleTable
        rows={items}
        href={(r) => `/admin/leads/${r.id}`}
        empty="No leads yet."
        columns={[
          { header: "Name", cell: (r) => r.name },
          { header: "Form", cell: (r) => LEAD_FORM_TYPE_LABELS[r.formType], className: "hidden md:table-cell" },
          { header: "Project", cell: (r) => r.projectName || "—", className: "hidden lg:table-cell" },
          { header: "Source", cell: (r) => [r.utmSource, r.utmCampaign].filter(Boolean).join(" / ") || "—", className: "hidden lg:table-cell" },
          { header: "Received", cell: (r) => r.createdAt.toLocaleString("en-GB") },
          { header: "Bitrix24", cell: (r) => <CrmBadge status={r.crmStatus} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, formType: sp.formType, crmStatus: sp.crmStatus }} />
      <p className="mt-4 text-xs text-muted-foreground"><Link href="/admin/settings" className="underline">Integration status</Link> · Lead data is personal data — export only when needed and store exports securely.</p>
    </>
  );
}
