import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHero } from "@/components/site/page-hero";
import { ArticleCard, EmptyState } from "@/components/site/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { listPublishedArticles } from "@/server/public-data";
import { buildMetadata } from "@/lib/seo";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABELS, ARTICLE_CATEGORY_SLUGS, type ArticleCategoryValue } from "@/lib/content-labels";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: "News & Media", description: "News, press releases, events and insights from Premier Choice International.", path: "/media" });
}

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function MediaPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHero eyebrow="Media centre" title="News & media" intro="Announcements, press releases, events and insights." crumbs={[{ name: "Media", path: "/media" }]} />
      <Suspense fallback={<div className="container-site section-y grid gap-6 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/2] rounded-none" />)}</div>}>
        <Articles searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Articles({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const category = (Object.entries(ARTICLE_CATEGORY_SLUGS) as [ArticleCategoryValue, string][]).find(([, s]) => s === sp.category)?.[0];
  // Whole page numbers only, capped (e.g. ?page=2.5 or ?page=1e300 broke the query).
  const page = typeof sp.page === "string" ? Math.min(1000, Math.max(1, Math.floor(Number(sp.page)) || 1)) : 1;
  const { items, total, pageSize } = await listPublishedArticles({ category, page });
  const pages = Math.ceil(total / pageSize);
  const href = (c?: ArticleCategoryValue, p?: number) => {
    const q = new URLSearchParams();
    if (c) q.set("category", ARTICLE_CATEGORY_SLUGS[c]);
    if (p && p > 1) q.set("page", String(p));
    return `/media${q.size ? `?${q}` : ""}`;
  };
  const chip = (active: boolean) => cn("border px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary");
  return (
    <section className="section-y">
      <div className="container-site">
        <nav aria-label="Media categories" className="mb-12 flex flex-wrap gap-2">
          <Link scroll={false} href="/media" className={chip(!category)}>All</Link>
          {ARTICLE_CATEGORIES.map((c) => <Link scroll={false} key={c} href={href(c)} className={chip(category === c)}>{ARTICLE_CATEGORY_LABELS[c]}</Link>)}
        </nav>
        {items.length ? (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{items.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        ) : (
          <EmptyState title="Nothing here yet" text="There are no published articles in this category." />
        )}
        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-12 flex justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={href(category, n)} aria-current={n === page ? "page" : undefined} className={chip(n === page)}>{n}</Link>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
