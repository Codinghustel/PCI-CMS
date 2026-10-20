import Link from "next/link";
import Image from "next/image";
import { Plus, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyRow, ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { ApprovalBadge, StatusBadge } from "@/components/admin/ui";
import { requirePermissionPage } from "@/lib/auth/session";
import { listProjects } from "@/server/services/projects";
import { can } from "@/lib/auth/permissions";
import {
  CONSTRUCTION_STATUS_LABELS,
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  PUBLISH_STATUSES,
  PUBLISH_STATUS_LABELS,
} from "@/lib/content-labels";

type SP = Promise<Record<string, string | undefined>>;

export default async function ProjectsList({ searchParams }: { searchParams: SP }) {
  const actor = await requirePermissionPage("content.read");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listProjects({ q: sp.q, status: sp.status, category: sp.category, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project is one structured record: facts, commercial details (with Sales approval), media, floor plans, VR tours, compliance and SEO."
        actions={can(actor, "content.writeOwn") ? <Button asChild size="sm"><Link href="/admin/projects/new"><Plus /> New project</Link></Button> : null}
      />
      <ListToolbar
        q={sp.q}
        placeholder="Search name or city"
        filters={[
          { name: "status", label: "Status", value: sp.status, options: PUBLISH_STATUSES.map((s) => ({ value: s, label: PUBLISH_STATUS_LABELS[s] })) },
          { name: "category", label: "Category", value: sp.category, options: PROJECT_CATEGORIES.map((c) => ({ value: c, label: PROJECT_CATEGORY_LABELS[c] })) },
        ]}
      />
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="hidden md:table-cell">Type / status</TableHead>
              <TableHead>Publishing</TableHead>
              <TableHead className="hidden lg:table-cell">Commercial</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? <EmptyRow colSpan={4}>No projects found.</EmptyRow> : null}
            {items.map((p) => {
              const img = p.cardImage ?? p.heroImage;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/admin/projects/${p.id}`} className="flex items-center gap-3 hover:underline">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
                        {img ? <Image src={`/uploads/${img.storageKey}`} alt="" fill sizes="48px" className="object-cover" /> : null}
                      </span>
                      <span>
                        <span className="flex items-center gap-1 font-medium">{p.name}{p.isFeatured ? <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="Featured" /> : null}</span>
                        <span className="block text-xs text-muted-foreground">{p.city}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{PROJECT_CATEGORY_LABELS[p.category]}<span className="block text-xs text-muted-foreground">{CONSTRUCTION_STATUS_LABELS[p.constructionStatus]}</span></TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="hidden lg:table-cell"><ApprovalBadge status={p.commercialStatus} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, status: sp.status, category: sp.category }} />
    </>
  );
}
