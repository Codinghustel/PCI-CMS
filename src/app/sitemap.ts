import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/server/public-data";
import { siteUrl } from "@/lib/env";

/** XML sitemap of published, indexable content. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const e = await getSitemapEntries();
  const fixedPaths = ["/projects", "/project-updates", "/locations", "/vr-tours", "/media", "/careers"];
  const fixed = fixedPaths.map((p) => ({ url: siteUrl(p) }));
  return [
    // A CMS page may share a fixed route's URL (e.g. "careers"); list it once.
    ...e.pages.filter((p) => !fixedPaths.includes(`/${p.slug}`)).map((p) => ({ url: siteUrl(p.slug === "home" ? "/" : `/${p.slug}`), lastModified: p.updatedAt, priority: p.slug === "home" ? 1 : 0.6 })),
    ...fixed,
    ...e.projects.map((p) => ({ url: siteUrl(`/projects/${p.slug}`), lastModified: p.updatedAt, priority: 0.9 })),
    ...e.updates.map((u) => ({ url: siteUrl(`/project-updates/${u.slug}`), lastModified: u.updatedAt, priority: 0.5 })),
    ...e.locations.map((l) => ({ url: siteUrl(`/locations/${l.slug}`), lastModified: l.updatedAt })),
    ...e.articles.map((a) => ({ url: siteUrl(`/media/${a.slug}`), lastModified: a.updatedAt })),
    ...e.vacancies.map((v) => ({ url: siteUrl(`/careers/${v.slug}`), lastModified: v.updatedAt })),
  ];
}
