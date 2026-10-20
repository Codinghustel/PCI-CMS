"use client";

import { useState } from "react";
import Image from "next/image";
import { Expand, Rotate3d } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics-client";
import { siteButtonClass } from "@/components/site/site-button";

export interface VrTourItem {
  id: string;
  title: string;
  unitType: string;
  provider: string;
  embedUrl: string;
  image: { url: string; alt: string } | null;
  projectName?: string;
}

/**
 * VR / 360° tour launcher. Tours are hosted by the third-party VR provider and
 * embedded in a full-screen dialog only when opened (no heavy iframe on load).
 * A direct link is offered as the fallback for devices that block embedding.
 */
export function VrTourGrid({ tours, enquireHref }: { tours: VrTourItem[]; enquireHref?: string }) {
  const [active, setActive] = useState<VrTourItem | null>(null);
  if (!tours.length) return null;
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tours.map((tour) => (
          <button
            key={tour.id}
            type="button"
            onClick={() => {
              setActive(tour);
              track("vr_start", { label: tour.title, project: tour.projectName });
            }}
            className="group relative aspect-[4/3] overflow-hidden bg-dark text-start text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {tour.image ? (
              <Image src={tour.image.url} alt={tour.image.alt} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover opacity-70 transition duration-700 group-hover:scale-105 group-hover:opacity-90" />
            ) : null}
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <span className="absolute start-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 backdrop-blur-sm transition group-hover:scale-110 rtl:translate-x-1/2">
              <Rotate3d className="size-7" aria-hidden />
            </span>
            <span className="absolute inset-x-0 bottom-0 p-5">
              {tour.projectName ? <span className="eyebrow block">{tour.projectName}</span> : null}
              <span className="heading mt-1 block text-2xl">{tour.title}</span>
              {tour.unitType ? <span className="mt-1 block text-sm text-white/80">{tour.unitType}</span> : null}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="h-[92dvh] w-[96vw] max-w-[96vw] gap-0 overflow-hidden p-0 sm:max-w-[96vw]">
          {active ? (
            <div className="flex h-full flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 pe-12">
                <div>
                  <DialogTitle className="text-base">{active.title}</DialogTitle>
                  <DialogDescription className="text-xs">
                    {[active.projectName, active.unitType, active.provider && `Tour by ${active.provider}`].filter(Boolean).join(" · ")}
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  <a href={active.embedUrl} target="_blank" rel="noopener noreferrer" className={siteButtonClass("outline", "sm")}>
                    <Expand aria-hidden /> Open full screen
                  </a>
                  {enquireHref ? (
                    <a href={enquireHref} onClick={() => setActive(null)} className={siteButtonClass("primary", "sm")}>
                      Enquire
                    </a>
                  ) : null}
                </div>
              </div>
              <iframe
                src={active.embedUrl}
                title={active.title}
                className="w-full flex-1 bg-black"
                allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
