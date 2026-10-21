"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  caption?: string;
}

/** Responsive image grid with a keyboard-accessible full-screen viewer. */
export function Gallery({ images, layout = "grid", onOpen }: { images: GalleryImage[]; layout?: "grid" | "mosaic"; onOpen?: () => void }) {
  const [index, setIndex] = useState<number | null>(null);
  // The viewer opens from code, so Radix has no trigger to return focus to on close.
  const opener = useRef<HTMLButtonElement | null>(null);
  const count = images.length;
  const go = useCallback((delta: number) => setIndex((i) => (i === null ? i : (i + delta + count) % count)), [count]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(document.dir === "rtl" ? -1 : 1);
      if (e.key === "ArrowLeft") go(document.dir === "rtl" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  if (!count) return null;
  const current = index !== null ? images[index] : null;

  return (
    <>
      <ul className={cn("grid gap-3", layout === "mosaic" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
        {images.map((img, i) => (
          <li key={`${img.url}-${i}`} className={cn(layout === "mosaic" && i % 5 === 0 && "md:col-span-2 md:row-span-2")}>
            <button
              type="button"
              onClick={(e) => {
                opener.current = e.currentTarget;
                setIndex(i);
                onOpen?.();
              }}
              className="group relative block aspect-[4/3] h-full w-full overflow-hidden bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Open image ${i + 1} of ${count}${img.alt ? `: ${img.alt}` : ""}`}
            >
              <Image src={img.url} alt={img.alt} fill sizes="(min-width: 768px) 33vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={index !== null} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent
          className="max-w-[96vw] border-none bg-black/95 p-0 text-white sm:max-w-[96vw]"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Image viewer</DialogTitle>
          {current ? (
            <figure className="relative flex h-[85dvh] w-full items-center justify-center">
              <Image src={current.url} alt={current.alt} fill sizes="96vw" className="object-contain" />
              {count > 1 ? (
                <>
                  <button type="button" onClick={() => go(-1)} className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 hover:bg-white/30" aria-label="Previous image">
                    <ChevronLeft className="size-6 rtl:rotate-180" />
                  </button>
                  <button type="button" onClick={() => go(1)} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 hover:bg-white/30" aria-label="Next image">
                    <ChevronRight className="size-6 rtl:rotate-180" />
                  </button>
                </>
              ) : null}
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-4 text-center text-sm">
                {current.caption || current.alt} <span className="ms-2 text-white/60">{(index ?? 0) + 1} / {count}</span>
              </figcaption>
            </figure>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
