import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { StatusBadge } from "@/components/admin/ui";
import { requirePermissionPage } from "@/lib/auth/session";
import { listProjectUpdates } from "@/server/services/content";
import { listProjectOptions } from "@/server/services/projects";
import { can } from "@/lib/auth/permissions";
import { PUBLISH_STATUSES, PUBLISH_STATUS_LABELS } from "@/lib/content-labels";
import { formatDate } from "@/lib/text";

export default async function UpdatesList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("content.read");
  const sp = await searchParams;
  const [{ items, total, page, pageSize }, projects] = await Promise.all([
    listProjectUpdates({ q: sp.q, status: sp.status, projectId: sp.projectId, page: Number(sp.page) || 1 }),
    listProjectOptions(),
  ]);
  return (
    <>
      <PageHeader
        title="Construction updates"
        description="Dated progress updates linked to projects. The latest published update appears on its project page automatically; older updates stay in the archive."
        actions={can(actor, "content.writeOwn") ? <Button asChild size="sm"><Link href="/admin/updates/new"><Plus /> New update</Link></Button> : null}
      />
      <ListToolbar
        q={sp.q}
        filters={[
          { name: "projectId", label: "Project", value: sp.projectId, options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "status", label: "Status", value: sp.status, options: PUBLISH_STATUSES.map((s) => ({ value: s, label: PUBLISH_STATUS_LABELS[s] })) },
        ]}
      />
      <SimpleTable
        rows={items}
        href={(r) => `/admin/updates/${r.id}`}
        columns={[
          { header: "Title", cell: (r) => r.title },
          { header: "Project", cell: (r) => r.project.name, className: "hidden md:table-cell" },
          { header: "Date", cell: (r) => formatDate(r.date, "short") },
          { header: "Progress", cell: (r) => (r.progressPercent != null ? `${r.progressPercent}%` : "—"), className: "hidden md:table-cell" },
          { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, status: sp.status, projectId: sp.projectId }} />
    </>
  );
}
