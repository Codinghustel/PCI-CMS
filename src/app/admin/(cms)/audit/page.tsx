import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow, ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { requirePermissionPage } from "@/lib/auth/session";
import { listAuditLogs } from "@/server/services/audit";

const TYPES = ["Page", "Project", "ProjectUpdate", "Article", "Location", "Vacancy", "Media", "Menu", "Redirect", "SiteSettings", "ThemeSettings", "User", "Lead", "JobApplication"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("audit.read");
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const pageSize = 50;
  const { items, total } = await listAuditLogs({ page, pageSize, entityType: sp.entityType, q: sp.q });
  return (
    <>
      <PageHeader title="Audit log" description="Who changed what, and when — sign-ins, publishing, approvals, settings, user and lead actions." />
      <ListToolbar q={sp.q} filters={[{ name: "entityType", label: "Type", value: sp.entityType, options: TYPES.map((t) => ({ value: t, label: t })) }]} />
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? <EmptyRow colSpan={4}>No entries.</EmptyRow> : null}
            {items.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{e.createdAt.toLocaleString("en-GB")}</TableCell>
                <TableCell className="text-sm">{e.actor?.name ?? "System"}</TableCell>
                <TableCell className="font-mono text-xs">{e.action}</TableCell>
                <TableCell className="text-sm">{e.summary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, entityType: sp.entityType }} />
    </>
  );
}
