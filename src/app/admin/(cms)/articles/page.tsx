import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { StatusBadge } from "@/components/admin/ui";
import { requirePermissionPage } from "@/lib/auth/session";
import { listArticles } from "@/server/services/content";
import { can } from "@/lib/auth/permissions";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABELS, PUBLISH_STATUSES, PUBLISH_STATUS_LABELS } from "@/lib/content-labels";
import { formatDate } from "@/lib/text";

export default async function ArticlesList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("content.read");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listArticles({ q: sp.q, status: sp.status, category: sp.category, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="News & media" description="News, press releases, events and insights." actions={can(actor, "content.writeOwn") ? <Button asChild size="sm"><Link href="/admin/articles/new"><Plus /> New article</Link></Button> : null} />
      <ListToolbar
        q={sp.q}
        filters={[
          { name: "category", label: "Category", value: sp.category, options: ARTICLE_CATEGORIES.map((c) => ({ value: c, label: ARTICLE_CATEGORY_LABELS[c] })) },
          { name: "status", label: "Status", value: sp.status, options: PUBLISH_STATUSES.map((s) => ({ value: s, label: PUBLISH_STATUS_LABELS[s] })) },
        ]}
      />
      <SimpleTable
        rows={items}
        href={(r) => `/admin/articles/${r.id}`}
        columns={[
          { header: "Title", cell: (r) => r.title },
          { header: "Category", cell: (r) => ARTICLE_CATEGORY_LABELS[r.category], className: "hidden md:table-cell" },
          { header: "Published", cell: (r) => formatDate(r.publishedAt, "short") || "—", className: "hidden md:table-cell" },
          { header: "Status", cell: (r) => <StatusBadge status={r.status} publishedAt={r.publishedAt} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, status: sp.status, category: sp.category }} />
    </>
  );
}
