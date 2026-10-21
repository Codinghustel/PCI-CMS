import { Suspense } from "react";
import type { Metadata } from "next";
import { Building2, Navigation } from "lucide-react";
import { RouteFallback } from "@/components/site/route-fallback";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard } from "@/components/site/cards";
import { SectionHeading, SectionShell } from "@/components/site/section-shell";
import { LocationExplorer } from "@/components/site/location-explorer";
import { getPublishedLocation, publishedSlugs } from "@/server/public-data";
import { buildMetadata, redirectOrNotFound } from "@/lib/seo";
import { mapEmbedUrl } from "@/lib/settings";
import { sanitizeRichText } from "@/lib/sanitize";
import { CONSTRUCTION_STATUS_LABELS, MARKET_LABELS, PROJECT_CATEGORY_LABELS } from "@/lib/content-labels";
import { htmlToText } from "@/lib/text";

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

  // Map centre: the location's coordinates, else the first project with coordinates.
  const pinned = l.projects.find((p) => p.latitude != null && p.longitude != null);
  const center =
    l.latitude != null && l.longitude != null
      ? { lat: l.latitude, lng: l.longitude }
      : pinned
        ? { lat: pinned.latitude!, lng: pinned.longitude! }
        : null;
  const overviewText = htmlToText(l.overview);
  const showOverview = overviewText && overviewText !== htmlToText(l.summary);
  const ongoing = l.projects.filter((p) => p.constructionStatus === "ONGOING").length;

  return (
    <>
      <PageHero
        eyebrow={`${l.city}, ${MARKET_LABELS[l.market]}`}
        title={l.name}
        intro={l.summary}
        image={l.heroImage}
        crumbs={[{ name: "Locations", path: "/locations" }, { name: l.name, path: `/locations/${l.slug}` }]}
      >
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
          <div>
            <dt className="text-dark-foreground/60">PCI projects</dt>
            <dd className="heading text-3xl">{l.projects.length}</dd>
          </div>
          {ongoing ? (
            <div>
              <dt className="text-dark-foreground/60">Under construction</dt>
              <dd className="heading text-3xl">{ongoing}</dd>
            </div>
          ) : null}
        </dl>
      </PageHero>

      <SectionShell className="py-12 md:py-16">
        <div className="container-site space-y-10">
          {showOverview ? <div className="prose-cms max-w-3xl" dangerouslySetInnerHTML={{ __html: sanitizeRichText(l.overview) }} /> : null}
          {center ? (
            <LocationExplorer
              center={center}
              locationName={l.name}
              pins={l.projects.map((p) => ({
                id: p.id,
                name: p.name,
                href: `/projects/${p.slug}`,
                subtitle: `${PROJECT_CATEGORY_LABELS[p.category]} · ${CONSTRUCTION_STATUS_LABELS[p.constructionStatus]}`,
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
            />
          ) : (
            <iframe title={`Map of ${l.name}`} src={mapEmbedUrl(`${l.name}, ${l.city}`) ?? undefined} loading="lazy" className="h-[420px] w-full border-0" referrerPolicy="no-referrer-when-downgrade" />
          )}
          {l.landmarks.length ? (
            <div>
              <h2 className="mb-4 text-3xl">Landmarks & connectivity</h2>
              <ul className="grid gap-x-10 border-t border-border sm:grid-cols-2">
                {l.landmarks.map((lm) => (
                  <li key={lm.name} className="flex justify-between gap-4 border-b border-border py-3 text-sm">
                    <span className="flex items-center gap-2"><Navigation className="size-4 text-accent" aria-hidden />{lm.name}</span>
                    <span className="font-semibold whitespace-nowrap">{lm.distance}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SectionShell>

      {l.projects.length ? (
        <SectionShell background="muted">
          <div className="container-site">
            <SectionHeading eyebrow="In this location" heading={`PCI projects in ${l.name}`} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{l.projects.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
          </div>
        </SectionShell>
      ) : (
        <SectionShell background="muted">
          <p className="container-site flex items-center gap-2 text-muted-foreground"><Building2 className="size-5" aria-hidden /> New PCI projects in {l.name} will appear here.</p>
        </SectionShell>
      )}
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
