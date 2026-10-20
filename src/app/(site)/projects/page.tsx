import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard, EmptyState } from "@/components/site/cards";
import { SiteButtonLink } from "@/components/site/site-button";
import { OpenFinderButton } from "@/components/site/project-finder";
import { siteButtonClass } from "@/components/site/site-button";
import { listPublishedProjects } from "@/server/public-data";
import { buildMetadata } from "@/lib/seo";
import {
  CONSTRUCTION_STATUS_LABELS,
  CONSTRUCTION_STATUS_SLUGS,
  CONSTRUCTION_STATUSES,
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  PROJECT_CATEGORY_SLUGS,
  type ConstructionStatusValue,
  type ProjectCategoryValue,
} from "@/lib/content-labels";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Projects",
    description: "Explore Premier Choice International's residential, commercial and mixed-use developments in the UAE and Pakistan.",
    path: "/projects",
  });
}

const fromSlug = <T extends string>(map: Record<T, string>, slug?: string) =>
  (Object.entries(map) as [T, string][]).find(([, s]) => s === slug)?.[0];

export default function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <PageHero
        eyebrow="Our portfolio"
        title="Projects"
        intro="Residential, commercial and mixed-use developments across the UAE and Pakistan."
        crumbs={[{ name: "Projects", path: "/projects" }]}
      >
        <OpenFinderButton className={siteButtonClass("accent", "md", "mt-8")}>Help me find a property</OpenFinderButton>
      </PageHero>
      <Suspense fallback={<ResultsSkeleton />}>
        <ProjectResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProjectResults({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const category = fromSlug(PROJECT_CATEGORY_SLUGS, typeof sp.category === "string" ? sp.category : undefined) as ProjectCategoryValue | undefined;
  const status = fromSlug(CONSTRUCTION_STATUS_SLUGS, typeof sp.status === "string" ? sp.status : undefined) as ConstructionStatusValue | undefined;
  const [projects, all] = await Promise.all([listPublishedProjects({ category, status }), listPublishedProjects()]);
  const availableCategories = PROJECT_CATEGORIES.filter((c) => all.some((p) => p.category === c));

  const link = (next: { category?: ProjectCategoryValue; status?: ConstructionStatusValue }) => {
    const params = new URLSearchParams();
    if (next.category) params.set("category", PROJECT_CATEGORY_SLUGS[next.category]);
    if (next.status) params.set("status", CONSTRUCTION_STATUS_SLUGS[next.status]);
    const q = params.toString();
    return `/projects${q ? `?${q}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn("border px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase transition", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary");

  return (
    <section className="section-y">
      <div className="container-site">
        <nav aria-label="Browse projects" className="mb-12 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Link href={link({ status })} className={chip(!category)} aria-current={!category ? "page" : undefined}>All types</Link>
            {availableCategories.map((c) => (
              <Link key={c} href={link({ category: c, status })} className={chip(category === c)} data-track="category_browse" data-track-label={c} aria-current={category === c ? "page" : undefined}>
                {PROJECT_CATEGORY_LABELS[c]}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={link({ category })} className={chip(!status)}>Any status</Link>
            {CONSTRUCTION_STATUSES.map((s) => (
              <Link key={s} href={link({ category, status: s })} className={chip(status === s)}>{CONSTRUCTION_STATUS_LABELS[s]}</Link>
            ))}
          </div>
        </nav>
        <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </p>
        {projects.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => <ProjectCard key={p.id} project={p} priority={i < 3} />)}
          </div>
        ) : (
          <EmptyState
            title="No projects in this view yet"
            text="Try another category or status, or ask our team about upcoming launches."
            action={<SiteButtonLink href="/projects">View all projects</SiteButtonLink>}
          />
        )}
      </div>
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div className="container-site section-y grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-none" />)}
    </div>
  );
}
