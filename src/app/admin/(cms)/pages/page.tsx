import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow, ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/ui";
import { NewPageButton } from "./new-page-button";
import { requirePermissionPage } from "@/lib/auth/session";
import { listPages } from "@/server/services/pages";
import { can } from "@/lib/auth/permissions";
import { PUBLISH_STATUSES, PUBLISH_STATUS_LABELS } from "@/lib/content-labels";
import { formatDate } from "@/lib/text";

type SP = Promise<Record<string, string | undefined>>;

export default async function PagesList({ searchParams }: { searchParams: SP }) {
  const actor = await requirePermissionPage("content.read");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listPages({ q: sp.q, status: sp.status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader
        title="Pages"
        description="Website pages built from reusable blocks — homepage, About, Invest with PCI, legal pages and landing pages."
        actions={can(actor, "content.writeOwn") ? <NewPageButton /> : null}
      />
      <ListToolbar
        q={sp.q}
        placeholder="Search title or URL"
        filters={[{ name: "status", label: "Status", value: sp.status, options: PUBLISH_STATUSES.map((s) => ({ value: s, label: PUBLISH_STATUS_LABELS[s] })) }]}
      />
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Last edited</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? <EmptyRow colSpan={4}>No pages match your search.</EmptyRow> : null}
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium"><Link href={`/admin/pages/${p.id}`} className="hover:underline">{p.title}</Link></TableCell>
                <TableCell className="text-muted-foreground">/{p.slug === "home" ? "" : p.slug}</TableCell>
                <TableCell><StatusBadge status={p.status} publishedAt={p.publishedAt} /></TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(p.updatedAt, "short")}{p.updatedBy ? ` · ${p.updatedBy.name}` : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, status: sp.status }} />
    </>
  );
}
