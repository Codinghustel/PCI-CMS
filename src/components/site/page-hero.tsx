import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MediaImage } from "@/components/site/media-image";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";
import type { PublicMedia } from "@/server/public-data";

export interface Crumb {
  name: string;
  path: string;
}

/** Banner used at the top of inner pages (listing and detail templates). */
export function PageHero({
  title,
  eyebrow,
  intro,
  image,
  crumbs = [],
  children,
}: {
  title: string;
  eyebrow?: string;
  intro?: string;
  image?: PublicMedia | null;
  crumbs?: Crumb[];
  children?: React.ReactNode;
}) {
  const trail = [{ name: "Home", path: "/" }, ...crumbs];
  return (
    <section className="on-dark relative overflow-hidden bg-dark text-dark-foreground">
      {image ? <MediaImage media={image} fill priority sizes="100vw" className="opacity-40" /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/60 to-dark/30" />
      <div className="container-site relative pt-36 pb-14 md:pt-44 md:pb-20">
        {crumbs.length ? (
          <>
            <nav aria-label="Breadcrumb">
              <ol className="mb-6 flex flex-wrap items-center gap-1.5 text-xs tracking-wide text-dark-foreground/70">
                {trail.map((c, i) => (
                  <li key={c.path} className="flex items-center gap-1.5">
                    {i > 0 ? <ChevronRight className="size-3 rtl:rotate-180" aria-hidden /> : null}
                    {i < trail.length - 1 ? (
                      <Link href={c.path} className="hover:text-accent">{c.name}</Link>
                    ) : (
                      <span aria-current="page">{c.name}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <JsonLd data={breadcrumbJsonLd(trail)} />
          </>
        ) : null}
        {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
        <h1 className="max-w-4xl text-5xl text-balance md:text-6xl">{title}</h1>
        {intro ? <p className="mt-5 max-w-2xl text-lg text-dark-foreground/80">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}
