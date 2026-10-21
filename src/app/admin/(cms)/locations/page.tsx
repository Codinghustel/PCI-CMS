import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { StatusBadge } from "@/components/admin/ui";
import { requirePermissionPage } from "@/lib/auth/session";
import { listLocations } from "@/server/services/content";
import { can } from "@/lib/auth/permissions";

export default async function LocationsList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("content.read");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listLocations({ q: sp.q, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Locations" description="Locations and developments with overview, map, landmarks and linked projects." actions={can(actor, "content.write") ? <Button asChild size="sm"><Link href="/admin/locations/new"><Plus /> New location</Link></Button> : null} />
      <ListToolbar q={sp.q} />
      <SimpleTable
        rows={items}
        href={(r) => `/admin/locations/${r.id}`}
        columns={[
          { header: "Name", cell: (r) => r.name },
          { header: "City", cell: (r) => r.city },
          {
            header: "Projects",
            cell: (r) => (
              <span title="Live projects appear on the public location page. Drafts, projects in review, archived and scheduled projects do not.">
                {r.projectCounts.live} live
                {r.projectCounts.notLive ? <span className="text-muted-foreground"> · {r.projectCounts.notLive} not live</span> : null}
              </span>
            ),
          },
          { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q }} />
    </>
  );
}
