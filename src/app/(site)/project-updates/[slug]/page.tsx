import { Suspense } from "react";
import { RouteFallback } from "@/components/site/route-fallback";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Gallery } from "@/components/site/gallery";
import { YoutubeEmbed } from "@/components/site/youtube-embed";
import { SiteButtonLink } from "@/components/site/site-button";
import { getPublishedUpdate, publishedSlugs } from "@/server/public-data";
import { buildMetadata, redirectOrNotFound } from "@/lib/seo";
import { formatDate } from "@/lib/text";
import { sanitizeRichText } from "@/lib/sanitize";

export async function generateStaticParams() {
  const slugs = await publishedSlugs("updates");
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const u = await getPublishedUpdate(slug);
  if (!u) return { title: "Update not found", robots: { index: false } };
  return buildMetadata({
    title: `${u.title} — ${u.project.name}`,
    description: u.summary || `${u.project.name} construction update, ${formatDate(u.date, "month")}.`,
    path: `/project-updates/${u.slug}`,
    image: u.images[0]?.media,
    type: "article",
  });
}

async function UpdatePageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await getPublishedUpdate(slug);
  if (!u) return redirectOrNotFound(`/project-updates/${slug}`);
  return (
    <>
      <PageHero
        eyebrow={`${u.project.name} · ${formatDate(u.date, "month")}`}
        title={u.title}
        intro={u.summary}
        image={u.images[0]?.media}
        crumbs={[{ name: "Project updates", path: "/project-updates" }, { name: u.title, path: `/project-updates/${u.slug}` }]}
      />
      <article className="section-y">
        <div className="container-site grid gap-12 lg:grid-cols-3">
          <div className="space-y-10 lg:col-span-2">
            {u.youtubeId ? <YoutubeEmbed videoId={u.youtubeId} title={u.title} project={u.project.name} /> : null}
            {u.body ? <div className="prose-cms" dangerouslySetInnerHTML={{ __html: sanitizeRichText(u.body) }} /> : null}
            <Gallery images={u.images.map((i) => ({ ...i.media, caption: i.caption }))} />
          </div>
          <aside className="space-y-6">
            <dl className="border border-border p-6 text-sm">
              <dt className="text-xs text-muted-foreground uppercase">Update date</dt>
              <dd className="heading mb-4 text-2xl"><time dateTime={u.date.toISOString()}>{formatDate(u.date)}</time></dd>
              {u.progressPercent != null ? (
                <>
                  <dt className="text-xs text-muted-foreground uppercase">Overall progress</dt>
                  <dd className="heading mb-4 text-2xl">{u.progressPercent}%</dd>
                </>
              ) : null}
              {u.milestone ? (
                <>
                  <dt className="text-xs text-muted-foreground uppercase">Milestone</dt>
                  <dd className="font-semibold">{u.milestone}</dd>
                </>
              ) : null}
            </dl>
            <div className="grid gap-3">
              <SiteButtonLink href={`/projects/${u.project.slug}`}>View {u.project.name}</SiteButtonLink>
              <SiteButtonLink href={`/projects/${u.project.slug}#enquire`} variant="outline">Enquire about this project</SiteButtonLink>
              <SiteButtonLink href={`/project-updates?project=${u.project.slug}`} variant="link">All {u.project.name} updates</SiteButtonLink>
            </div>
          </aside>
        </div>
        <nav aria-label="More updates" className="container-site mt-16 flex justify-between gap-4 border-t border-border pt-8 text-sm">
          {u.previous ? <Link href={`/project-updates/${u.previous.slug}`} className="flex items-center gap-2 hover:text-primary"><ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {u.previous.title}</Link> : <span />}
          {u.next ? <Link href={`/project-updates/${u.next.slug}`} className="flex items-center gap-2 text-end hover:text-primary">{u.next.title} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link> : <span />}
        </nav>
      </article>
    </>
  );
}

// Params are read inside Suspense so the route always has a static shell;
// the proxy has already returned real 404/301 statuses for unknown or moved URLs.
export default function UpdatePage(props: Parameters<typeof UpdatePageContent>[0]) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <UpdatePageContent {...props} />
    </Suspense>
  );
}
