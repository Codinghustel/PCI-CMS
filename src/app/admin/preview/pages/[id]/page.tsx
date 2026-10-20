import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderSections } from "@/components/site/sections";
import { PageHero } from "@/components/site/page-hero";
import { requirePermissionPage } from "@/lib/auth/session";
import { getPageForEdit } from "@/server/services/pages";
import { getMediaMap } from "@/server/public-data";
import { sectionMediaIds, type Section } from "@/lib/sections/registry";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("content.read");
  const { id } = await params;
  const page = await getPageForEdit(id).catch(() => notFound());
  const sections = (page.sections as unknown as Section[]) ?? [];
  const media = await getMediaMap([...sectionMediaIds(sections), page.featuredImageId].filter((x): x is string => !!x));
  const startsWithHero = sections.find((s) => !s.hidden)?.type === "hero";
  return (
    <main>
      {startsWithHero ? null : <PageHero title={page.title} intro={page.excerpt} image={page.featuredImageId ? media[page.featuredImageId] : null} />}
      <RenderSections sections={sections} ctx={{ media, preview: true }} />
    </main>
  );
}
