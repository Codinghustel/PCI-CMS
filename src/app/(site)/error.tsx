"use client";

import { useEffect } from "react";
import { SiteButton, SiteButtonLink } from "@/components/site/site-button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="container-site flex min-h-[60vh] flex-col items-center justify-center gap-6 py-32 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="text-4xl">We couldn&apos;t load this page</h1>
      <p className="max-w-md text-muted-foreground">Please try again. If the problem continues, contact us and we&apos;ll help.</p>
      <div className="flex gap-3">
        <SiteButton onClick={reset}>Try again</SiteButton>
        <SiteButtonLink href="/contact" variant="outline">Contact us</SiteButtonLink>
      </div>
    </section>
  );
}
