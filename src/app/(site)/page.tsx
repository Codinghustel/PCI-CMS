import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderSections } from "@/components/site/sections";
import { getPublicSettings, getPublishedPage } from "@/server/public-data";
import { buildMetadata } from "@/lib/seo";

// The homepage is the CMS page with slug "home", built from page-builder blocks.

export async function generateMetadata(): Promise<Metadata> {
  const [data, { settings }] = await Promise.all([getPublishedPage("home"), getPublicSettings()]);
  return buildMetadata({
    title: data?.page.seoTitle || settings.seo.defaultTitle || settings.general.siteName,
    description: data?.page.seoDescription,
    path: "/",
    image: data?.page.ogImage ? { ...data.page.ogImage, url: `/uploads/${data.page.ogImage.storageKey}` } : null,
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const data = await getPublishedPage("home");
  if (!data) notFound();
  return <RenderSections sections={data.sections} ctx={{ media: data.media }} />;
}
