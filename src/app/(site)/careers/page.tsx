import type { Metadata } from "next";
import { RenderSections } from "@/components/site/sections";
import { PageHero } from "@/components/site/page-hero";
import { getPublishedPage } from "@/server/public-data";
import { buildMetadata } from "@/lib/seo";
import { newSection } from "@/lib/sections/registry";

// Careers: "Life at PCI" content comes from the CMS page with slug "careers"
// (editable blocks); if it has no vacancies block, the vacancy list is appended.

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublishedPage("careers");
  return buildMetadata({
    title: data?.page.seoTitle || "Careers at PCI",
    description: data?.page.seoDescription || "Life at Premier Choice International and current job vacancies.",
    path: "/careers",
  });
}

export default async function CareersPage() {
  const data = await getPublishedPage("careers");
  const sections = data?.sections ?? [];
  const withVacancies = sections.some((s) => s.type === "vacancies")
    ? sections
    : [...sections, { ...newSection("vacancies"), id: "auto-vacancies", data: { heading: "Open vacancies", eyebrow: "Join us", intro: "", background: "default" } }];
  const startsWithHero = withVacancies.find((s) => !s.hidden)?.type === "hero";
  return (
    <>
      {startsWithHero ? null : <PageHero eyebrow="Careers" title={data?.page.title || "Life at PCI"} intro={data?.page.excerpt} crumbs={[{ name: "Careers", path: "/careers" }]} />}
      <RenderSections sections={withVacancies} ctx={{ media: data?.media ?? {} }} />
    </>
  );
}
