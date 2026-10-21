import { PageHero } from "@/components/site/page-hero";
import { SiteButtonLink } from "@/components/site/site-button";

export default function SiteNotFound() {
  return (
    <>
      {/* Segment not-found files can't export metadata; React hoists this into <head>. */}
      <title>Page not found</title>
      <PageHero eyebrow="Error 404" title="We couldn't find that page" intro="The page may have moved, been unpublished or the address may be mistyped." />
      <section className="section-y">
        <div className="container-site flex flex-wrap justify-center gap-3">
          <SiteButtonLink href="/">Go to homepage</SiteButtonLink>
          <SiteButtonLink href="/projects" variant="outline">Browse projects</SiteButtonLink>
          <SiteButtonLink href="/contact" variant="outline">Contact us</SiteButtonLink>
        </div>
      </section>
    </>
  );
}
