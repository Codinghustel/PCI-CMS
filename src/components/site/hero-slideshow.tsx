"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Cross-fading background images for the hero. Pauses for reduced-motion users. */
export function HeroSlideshow({ images }: { images: { url: string; alt: string }[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), 6500);
    return () => clearInterval(t);
  }, [images.length]);
  return (
    <>
      {images.map((img, i) => (
        <Image
          key={img.url}
          src={img.url}
          alt={i === 0 ? img.alt : ""}
          fill
          priority={i === 0}
          sizes="100vw"
          className={cn("object-cover transition-opacity duration-[1500ms]", i === index ? "opacity-100" : "opacity-0")}
        />
      ))}
    </>
  );
}
