import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SiteButtonLink } from "@/components/site/site-button";

export const metadata: Metadata = { title: "Thank you", robots: { index: false, follow: false } };

export default function ThankYouPage() {
  return (
    <>
      <PageHero title="Thank you" />
      <section className="section-y">
        <div className="container-site max-w-xl text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
          <p className="heading mt-4 text-3xl">We have received your request.</p>
          <p className="mt-3 text-muted-foreground">A member of our team will contact you shortly.</p>
          <div className="mt-8 flex justify-center gap-3">
            <SiteButtonLink href="/projects">Explore projects</SiteButtonLink>
            <SiteButtonLink href="/" variant="outline">Back to home</SiteButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
