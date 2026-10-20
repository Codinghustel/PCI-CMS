import { Suspense } from "react";
import { RouteFallback } from "@/components/site/route-fallback";
import type { Metadata } from "next";
import { RenderSections } from "@/components/site/sections";
import { PageHero } from "@/components/site/page-hero";
import { getPublishedPage, publishedSlugs, toPublicMedia } from "@/server/public-data";
import { buildMetadata, redirectOrNotFound } from "@/lib/seo";

// CMS pages (About, Invest with PCI, legal pages, landing pages, …).
// Unknown paths fall through to the redirect map, then a 404.

export async function generateStaticParams() {
  const slugs = (await publishedSlugs("pages")).filter((s) => s !== "home");
  return (slugs.length ? slugs : ["__none__"]).map((s) => ({ slug: s.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const path = slug.join("/");
  const data = path === "home" ? null : await getPublishedPage(path);
  if (!data) return { title: "Page not found", robots: { index: false } };
  const { page } = data;
  return buildMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.excerpt,
    path: `/${page.slug}`,
    image: toPublicMedia(page.ogImage ?? page.featuredImage),
    noindex: page.noindex,
    canonical: page.canonicalUrl || undefined,
  });
}

async function CmsPageContent({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const data = path === "home" ? null : await getPublishedPage(path);
  if (!data) return redirectOrNotFound(`/${path}`);

  const startsWithHero = data.sections.find((s) => !s.hidden)?.type === "hero";
  return (
    <>
      {startsWithHero ? null : <PageHero title={data.page.title} intro={data.page.excerpt} image={toPublicMedia(data.page.featuredImage)} crumbs={[{ name: data.page.title, path: `/${data.page.slug}` }]} />}
      <RenderSections sections={data.sections} ctx={{ media: data.media }} />
    </>
  );
}

// Params are read inside Suspense so the route always has a static shell;
// the proxy has already returned real 404/301 statuses for unknown or moved URLs.
export default function CmsPage(props: Parameters<typeof CmsPageContent>[0]) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <CmsPageContent {...props} />
    </Suspense>
  );
}
