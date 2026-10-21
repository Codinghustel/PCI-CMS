import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { MediaImage } from "@/components/site/media-image";
import { EmptyState } from "@/components/site/cards";
import { listPublishedLocations } from "@/server/public-data";
import { buildMetadata } from "@/lib/seo";
import { MARKET_LABELS } from "@/lib/content-labels";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: "Locations", description: "Where Premier Choice International develops — locations and communities in the UAE and Pakistan.", path: "/locations" });
}

export default async function LocationsPage() {
  const locations = await listPublishedLocations();
  return (
    <>
      <PageHero eyebrow="Where we build" title="Locations" intro="Discover the communities and cities that are home to PCI developments." crumbs={[{ name: "Locations", path: "/locations" }]} />
      <section className="section-y">
        <div className="container-site">
          {locations.length ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((l) => (
                <li key={l.id}>
                  <Link href={`/locations/${l.slug}`} className="group on-dark relative flex aspect-[4/5] items-end overflow-hidden bg-dark p-6 text-white">
                    <MediaImage media={l.image} fill sizes="(min-width: 1024px) 33vw, 50vw" className="transition-transform duration-700 group-hover:scale-105" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <span className="relative">
                      <span className="eyebrow block">{l.city}, {MARKET_LABELS[l.market]}</span>
                      <span className="heading mt-2 line-clamp-2 text-3xl">{l.name}</span>
                      {l.summary ? <span className="mt-2 line-clamp-2 text-sm text-white/80">{l.summary}</span> : null}
                      <span className="mt-3 block text-xs font-semibold tracking-wider uppercase">{l.projectCount} project{l.projectCount === 1 ? "" : "s"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Locations are coming soon" text="Browse our projects to see where we build." />
          )}
        </div>
      </section>
    </>
  );
}
