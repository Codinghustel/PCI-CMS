import { Suspense } from "react";
import { RouteFallback } from "@/components/site/route-fallback";
import type { Metadata } from "next";
import { Navigation } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard } from "@/components/site/cards";
import { SectionHeading, SectionShell } from "@/components/site/section-shell";
import { getPublishedLocation, publishedSlugs } from "@/server/public-data";
import { buildMetadata, redirectOrNotFound } from "@/lib/seo";
import { mapEmbedUrl } from "@/lib/settings";
import { sanitizeRichText } from "@/lib/sanitize";
import { MARKET_LABELS } from "@/lib/content-labels";

export async function generateStaticParams() {
  const slugs = await publishedSlugs("locations");
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const l = await getPublishedLocation(slug);
  if (!l) return { title: "Location not found", robots: { index: false } };
  return buildMetadata({ title: l.seoTitle || `${l.name}, ${l.city}`, description: l.seoDescription || l.summary, path: `/locations/${l.slug}`, image: l.heroImage });
}

async function LocationPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = await getPublishedLocation(slug);
  if (!l) return redirectOrNotFound(`/locations/${slug}`);
  const map = mapEmbedUrl(l.latitude != null && l.longitude != null ? `${l.latitude},${l.longitude}` : `${l.name}, ${l.city}`);
  return (
    <>
      <PageHero eyebrow={`${l.city}, ${MARKET_LABELS[l.market]}`} title={l.name} intro={l.summary} image={l.heroImage} crumbs={[{ name: "Locations", path: "/locations" }, { name: l.name, path: `/locations/${l.slug}` }]} />
      <SectionShell>
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div>
            <div className="prose-cms" dangerouslySetInnerHTML={{ __html: sanitizeRichText(l.overview) }} />
            {l.landmarks.length ? (
              <>
                <h2 className="mt-10 mb-4 text-3xl">Landmarks & connectivity</h2>
                <ul className="divide-y divide-border border-y border-border">
                  {l.landmarks.map((lm) => (
                    <li key={lm.name} className="flex justify-between gap-4 py-3 text-sm">
                      <span className="flex items-center gap-2"><Navigation className="size-4 text-accent" aria-hidden />{lm.name}</span>
                      <span className="font-semibold">{lm.distance}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          {map ? <iframe title={`Map of ${l.name}`} src={map} loading="lazy" className="aspect-square w-full border-0 lg:aspect-[4/5]" referrerPolicy="no-referrer-when-downgrade" /> : null}
        </div>
      </SectionShell>
      {l.projects.length ? (
        <SectionShell background="muted">
          <div className="container-site">
            <SectionHeading eyebrow="In this location" heading={`PCI projects in ${l.name}`} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{l.projects.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
          </div>
        </SectionShell>
      ) : null}
    </>
  );
}

// Params are read inside Suspense so the route always has a static shell;
// the proxy has already returned real 404/301 statuses for unknown or moved URLs.
export default function LocationPage(props: Parameters<typeof LocationPageContent>[0]) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <LocationPageContent {...props} />
    </Suspense>
  );
}
