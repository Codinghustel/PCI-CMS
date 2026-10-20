import "server-only";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getPublicSettings, getRedirectMap, type PublicMedia } from "@/server/public-data";
import { isIndexingAllowed, siteUrl } from "@/lib/env";
import { normalizePath } from "@/lib/validation/content";
import { truncate } from "@/lib/text";

interface SeoInput {
  title: string;
  description?: string;
  path: string;
  image?: PublicMedia | null;
  noindex?: boolean;
  canonical?: string;
  type?: "website" | "article";
  /** Use the title as-is without the site suffix. */
  absoluteTitle?: boolean;
}

/** Builds page metadata: title, description, canonical, Open Graph, Twitter and robots. */
export async function buildMetadata(input: SeoInput): Promise<Metadata> {
  const { settings, media } = await getPublicSettings();
  const suffix = settings.seo.titleSuffix ? ` ${settings.seo.titleSuffix}` : "";
  const title = input.absoluteTitle ? input.title : `${input.title}${suffix}`;
  const description = truncate(input.description || settings.seo.defaultDescription || "", 300);
  const fallbackImage = settings.seo.defaultOgImage ? media[settings.seo.defaultOgImage] : null;
  const image = input.image ?? fallbackImage;
  const canonical = input.canonical || siteUrl(input.path);
  const index = isIndexingAllowed() && !input.noindex;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: input.type ?? "website",
      title,
      description,
      url: canonical,
      siteName: settings.general.siteName,
      images: image ? [{ url: siteUrl(image.url), width: image.width ?? undefined, height: image.height ?? undefined, alt: image.alt }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [siteUrl(image.url)] : undefined },
  };
}

/** For an unmatched path: follow a CMS redirect if one exists, otherwise 404. */
export async function redirectOrNotFound(path: string): Promise<never> {
  const map = await getRedirectMap();
  const hit = map[normalizePath(path)];
  if (hit) {
    if (hit.permanent) permanentRedirect(hit.to);
    redirect(hit.to);
  }
  notFound();
}

export async function organizationJsonLd() {
  const { settings, media } = await getPublicSettings();
  const logo = settings.general.logo ? media[settings.general.logo] : null;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.general.siteName,
    url: siteUrl("/"),
    ...(logo ? { logo: siteUrl(logo.url) } : {}),
    sameAs: Object.values(settings.social).filter(Boolean),
    address: settings.contact.offices.filter((o) => o.address).map((o) => ({ "@type": "PostalAddress", streetAddress: o.address.replace(/\s+/g, " ") })),
    ...(settings.contact.phone ? { telephone: settings.contact.phone } : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: siteUrl(item.path) })),
  };
}
