import { Suspense } from "react";
import { RouteFallback } from "@/components/site/route-fallback";
import type { Metadata } from "next";
import { CalendarDays, MapPin } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ArticleCard } from "@/components/site/cards";
import { YoutubeEmbed } from "@/components/site/youtube-embed";
import { MediaImage } from "@/components/site/media-image";
import { ShareButton } from "@/components/site/project-widgets";
import { JsonLd } from "@/components/site/json-ld";
import { getPublicSettings, getPublishedArticle, publishedSlugs } from "@/server/public-data";
import { buildMetadata, redirectOrNotFound } from "@/lib/seo";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/content-labels";
import { formatDate } from "@/lib/text";
import { sanitizeRichText } from "@/lib/sanitize";
import { siteUrl } from "@/lib/env";

export async function generateStaticParams() {
  const slugs = await publishedSlugs("articles");
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticle(slug);
  if (!a) return { title: "Article not found", robots: { index: false } };
  return buildMetadata({ title: a.seoTitle || a.title, description: a.seoDescription || a.excerpt, path: `/media/${a.slug}`, image: a.coverImage, type: "article" });
}

async function ArticlePageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [a, { settings }] = await Promise.all([getPublishedArticle(slug), getPublicSettings()]);
  if (!a) return redirectOrNotFound(`/media/${slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": a.category === "EVENT" ? "Event" : "NewsArticle",
    ...(a.category === "EVENT"
      ? { name: a.title, startDate: a.eventDate?.toISOString(), location: a.eventLocation ? { "@type": "Place", name: a.eventLocation } : undefined }
      : { headline: a.title, datePublished: a.publishedAt?.toISOString(), dateModified: a.updatedAt.toISOString(), publisher: { "@type": "Organization", name: settings.general.siteName } }),
    image: a.coverImage ? siteUrl(a.coverImage.url) : undefined,
    url: siteUrl(`/media/${a.slug}`),
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero
        eyebrow={`${ARTICLE_CATEGORY_LABELS[a.category]}${a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ""}`}
        title={a.title}
        intro={a.excerpt}
        crumbs={[{ name: "Media", path: "/media" }, { name: a.title, path: `/media/${a.slug}` }]}
      >
        <div className="mt-8"><ShareButton title={a.title} /></div>
      </PageHero>
      <article className="section-y">
        <div className="container-site max-w-3xl space-y-10">
          {a.category === "EVENT" && (a.eventDate || a.eventLocation) ? (
            <p className="flex flex-wrap gap-6 border-y border-border py-4 text-sm">
              {a.eventDate ? <span className="flex items-center gap-2"><CalendarDays className="size-4 text-accent" aria-hidden />{formatDate(a.eventDate)}</span> : null}
              {a.eventLocation ? <span className="flex items-center gap-2"><MapPin className="size-4 text-accent" aria-hidden />{a.eventLocation}</span> : null}
            </p>
          ) : null}
          {a.coverImage ? <MediaImage media={a.coverImage} sizes="(min-width: 768px) 768px, 100vw" className="h-auto w-full" priority /> : null}
          {a.youtubeId ? <YoutubeEmbed videoId={a.youtubeId} title={a.title} /> : null}
          <div className="prose-cms text-lg" dangerouslySetInnerHTML={{ __html: sanitizeRichText(a.body) }} />
        </div>
      </article>
      {a.related.length ? (
        <section className="section-y bg-muted">
          <div className="container-site">
            <h2 className="mb-10 text-4xl">More {ARTICLE_CATEGORY_LABELS[a.category].toLowerCase()}</h2>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{a.related.map((r) => <ArticleCard key={r.id} article={r} />)}</div>
          </div>
        </section>
      ) : null}
    </>
  );
}

// Params are read inside Suspense so the route always has a static shell;
// the proxy has already returned real 404/301 statuses for unknown or moved URLs.
export default function ArticlePage(props: Parameters<typeof ArticlePageContent>[0]) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ArticlePageContent {...props} />
    </Suspense>
  );
}
