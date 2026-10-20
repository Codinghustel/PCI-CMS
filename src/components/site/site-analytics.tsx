"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution, consentStore, track, writeConsent, type ConsentValue, type TrackEvent } from "@/lib/analytics-client";
import { siteButtonClass } from "@/components/site/site-button";

/**
 * Consent banner, consent-gated Google Tag Manager, attribution capture and
 * declarative click tracking: any element with data-track="<event>" (plus
 * optional data-track-label / data-track-project) emits a data-layer event.
 */
export function SiteAnalytics({ gtmId, bannerText }: { gtmId: string; bannerText: string }) {
  const consent = useSyncExternalStore(consentStore.subscribe, consentStore.getSnapshot, consentStore.getServerSnapshot);
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      track(el.dataset.track as TrackEvent, {
        label: el.dataset.trackLabel,
        project: el.dataset.trackProject,
        page_path: window.location.pathname,
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    captureAttribution();
  }, [pathname]);

  const decide = (value: ConsentValue) => writeConsent(value);

  return (
    <>
      {gtmId && consent === "all" ? (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtmId)});`}
        </Script>
      ) : null}
      {consent === "none" ? (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Cookie preferences"
          className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-2xl border border-border bg-background p-5 shadow-2xl md:bottom-6"
        >
          <p className="text-sm text-foreground/90">
            {bannerText ||
              "We use essential cookies to run this website and, with your consent, analytics and advertising cookies to understand visits and improve our marketing."}{" "}
            <Link href="/cookies" className="underline underline-offset-4">
              Cookie policy
            </Link>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={siteButtonClass("primary", "sm")} onClick={() => decide("all")}>
              Accept all
            </button>
            <button type="button" className={siteButtonClass("outline", "sm")} onClick={() => decide("necessary")}>
              Essential only
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
