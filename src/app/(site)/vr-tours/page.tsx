import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { VrTourGrid } from "@/components/site/vr-tour-viewer";
import { EmptyState } from "@/components/site/cards";
import { SiteButtonLink } from "@/components/site/site-button";
import { listActiveVrTours } from "@/server/public-data";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: "VR & 360° Tours", description: "Explore Premier Choice International projects remotely with virtual reality and 360° tours.", path: "/vr-tours" });
}

export default async function VrToursPage() {
  const tours = await listActiveVrTours();
  return (
    <>
      <PageHero eyebrow="Virtual experiences" title="VR & 360° tours" intro="Walk through PCI developments from anywhere in the world." crumbs={[{ name: "VR tours", path: "/vr-tours" }]} />
      <section className="section-y">
        <div className="container-site">
          {tours.length ? (
            <VrTourGrid tours={tours.map((t) => ({ ...t, projectName: t.project.name }))} enquireHref="/contact" />
          ) : (
            <EmptyState title="Virtual tours are on the way" text="Our immersive tours are being prepared. In the meantime, explore our project galleries." action={<SiteButtonLink href="/projects">Browse projects</SiteButtonLink>} />
          )}
        </div>
      </section>
    </>
  );
}
