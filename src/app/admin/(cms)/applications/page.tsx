import { Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow, PageHeader, Pagination } from "@/components/admin/page-header";
import { requirePermissionPage } from "@/lib/auth/session";
import { listApplications } from "@/server/services/content";

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("applications.read");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listApplications(actor, { page: Number(sp.page) || 1, vacancyId: sp.vacancyId });
  return (
    <>
      <PageHeader title="Job applications" description="Applications submitted through the careers pages. CVs are private files, downloadable only by administrators; every download is audited." />
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Vacancy</TableHead><TableHead className="hidden md:table-cell">Received</TableHead><TableHead>CV</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? <EmptyRow colSpan={4}>No applications yet.</EmptyRow> : null}
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell><span className="font-medium">{a.name}</span><span className="block text-xs text-muted-foreground">{a.email} · {a.phone}</span>{a.coverLetter ? <p className="mt-1 line-clamp-2 max-w-md text-xs text-muted-foreground">{a.coverLetter}</p> : null}</TableCell>
                <TableCell className="text-sm">{a.vacancy?.title ?? "General application"}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{a.createdAt.toLocaleString("en-GB")}</TableCell>
                <TableCell><a href={`/api/admin/applications/${a.id}/cv`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><Download className="size-4" /> {a.cvName}</a></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} params={{ vacancyId: sp.vacancyId }} />
    </>
  );
}
