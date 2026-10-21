import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHero } from "@/components/site/page-hero";
import { EmptyState, UpdateCard } from "@/components/site/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjectsWithUpdates, listPublishedUpdates } from "@/server/public-data";
import { buildMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Project & Construction Updates",
    description: "Dated construction progress updates, photos and videos for Premier Choice International projects.",
    path: "/project-updates",
  });
}

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function UpdatesPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHero eyebrow="Progress" title="Project updates" intro="Follow construction progress across PCI developments, month by month." crumbs={[{ name: "Project updates", path: "/project-updates" }]} />
      <Suspense fallback={<div className="container-site section-y grid gap-6 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-none" />)}</div>}>
        <UpdatesList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function UpdatesList({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const project = typeof sp.project === "string" ? sp.project.slice(0, 100) : undefined;
  const year = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : undefined;
  // Whole page numbers only, capped (e.g. ?page=2.5 or ?page=1e300 broke the query).
  const page = typeof sp.page === "string" ? Math.min(1000, Math.max(1, Math.floor(Number(sp.page)) || 1)) : 1;
  const [{ items, total, pageSize, years }, projects] = await Promise.all([
    listPublishedUpdates({ projectSlug: project, year, page }),
    listProjectsWithUpdates(),
  ]);
  const pages = Math.ceil(total / pageSize);
  const href = (next: { project?: string; year?: number; page?: number }) => {
    const p = new URLSearchParams();
    if (next.project) p.set("project", next.project);
    if (next.year) p.set("year", String(next.year));
    if (next.page && next.page > 1) p.set("page", String(next.page));
    const q = p.toString();
    return `/project-updates${q ? `?${q}` : ""}`;
  };
  const chip = (active: boolean) => cn("border px-3 py-1.5 text-xs font-semibold tracking-wider uppercase", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary");

  return (
    <section className="section-y">
      <div className="container-site">
        <nav aria-label="Filter updates" className="mb-10 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Link scroll={false} href={href({ year })} className={chip(!project)}>All projects</Link>
            {projects.map((p) => <Link scroll={false} key={p.slug} href={href({ project: p.slug, year })} className={chip(project === p.slug)}>{p.name}</Link>)}
          </div>
          {years.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Link scroll={false} href={href({ project })} className={chip(!year)}>Any year</Link>
              {years.map((y) => <Link scroll={false} key={y} href={href({ project, year: y })} className={chip(year === y)}>{y}</Link>)}
            </div>
          ) : null}
        </nav>
        {items.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map((u) => <UpdateCard key={u.id} update={u} />)}</div>
        ) : (
          <EmptyState title="No updates found" text="There are no published updates for this selection yet." />
        )}
        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-12 flex justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={href({ project, year, page: n })} aria-current={n === page ? "page" : undefined} className={chip(n === page)}>{n}</Link>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
