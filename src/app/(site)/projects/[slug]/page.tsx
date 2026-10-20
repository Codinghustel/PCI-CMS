import { Suspense } from "react";
import { RouteFallback } from "@/components/site/route-fallback";
import type { Metadata } from "next";
import { ProjectDetail } from "@/components/site/project-detail";
import { getPublicSettings, getPublishedProject, publishedSlugs } from "@/server/public-data";
import { buildMetadata, redirectOrNotFound } from "@/lib/seo";
import { CONSTRUCTION_STATUS_LABELS, PROJECT_CATEGORY_LABELS } from "@/lib/content-labels";

export async function generateStaticParams() {
  const slugs = await publishedSlugs("projects");
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublishedProject(slug);
  if (!p) return { title: "Project not found", robots: { index: false } };
  return buildMetadata({
    title: p.seo.title || `${p.name} — ${PROJECT_CATEGORY_LABELS[p.category]} in ${p.city}`,
    description: p.seo.description || p.tagline || `${p.name}: ${CONSTRUCTION_STATUS_LABELS[p.constructionStatus]} ${PROJECT_CATEGORY_LABELS[p.category].toLowerCase()} development by Premier Choice International in ${p.city}.`,
    path: `/projects/${p.slug}`,
    image: p.heroImage,
    noindex: p.seo.noindex,
  });
}

async function ProjectPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, { settings }] = await Promise.all([getPublishedProject(slug), getPublicSettings()]);
  if (!project) return redirectOrNotFound(`/projects/${slug}`);
  return <ProjectDetail project={project} settings={settings} />;
}

// Params are read inside Suspense so the route always has a static shell;
// the proxy has already returned real 404/301 statuses for unknown or moved URLs.
export default function ProjectPage(props: Parameters<typeof ProjectPageContent>[0]) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ProjectPageContent {...props} />
    </Suspense>
  );
}
