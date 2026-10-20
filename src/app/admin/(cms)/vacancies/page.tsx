import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { StatusBadge } from "@/components/admin/ui";
import { requirePermissionPage } from "@/lib/auth/session";
import { listVacancies } from "@/server/services/content";
import { can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/text";

export default async function VacanciesList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("content.read");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listVacancies({ q: sp.q, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader
        title="Careers"
        description="Job vacancies. 'Life at PCI' content is edited on the Careers page (Pages → careers). Applications are stored privately and visible under Job applications."
        actions={can(actor, "content.write") ? <Button asChild size="sm"><Link href="/admin/vacancies/new"><Plus /> New vacancy</Link></Button> : null}
      />
      <ListToolbar q={sp.q} />
      <SimpleTable
        rows={items}
        href={(r) => `/admin/vacancies/${r.id}`}
        columns={[
          { header: "Title", cell: (r) => r.title },
          { header: "Location", cell: (r) => r.location || "—", className: "hidden md:table-cell" },
          { header: "Closes", cell: (r) => formatDate(r.closesAt, "short") || "—", className: "hidden md:table-cell" },
          { header: "Applications", cell: (r) => r._count.applications },
          { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q }} />
    </>
  );
}
