import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { MediaRegistryProvider, ProjectOptionsProvider } from "@/components/admin/admin-context";
import { PageEditor } from "./page-editor";
import { requirePermissionPage } from "@/lib/auth/session";
import { getPageForEdit, listRevisions } from "@/server/services/pages";
import { listProjectOptions } from "@/server/services/projects";
import { getMediaByIds, toMediaSummary } from "@/server/services/media";
import { sectionMediaIds, type Section } from "@/lib/sections/registry";
import { canEditItem } from "@/lib/auth/permissions";
import { NotFoundError } from "@/server/errors";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermissionPage("content.read");
  const { id } = await params;
  const page = await getPageForEdit(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const sections = (page.sections as unknown as Section[]) ?? [];
  const [revisions, projects, media] = await Promise.all([
    listRevisions(id),
    listProjectOptions(),
    getMediaByIds([...sectionMediaIds(sections), page.featuredImageId, page.ogImageId].filter((x): x is string => !!x)),
  ]);
  return (
    <MediaRegistryProvider initial={media.map(toMediaSummary)}>
      <ProjectOptionsProvider options={projects}>
        <PageHeader title={page.title} description={`/${page.slug === "home" ? "" : page.slug}`} back={{ href: "/admin/pages", label: "Pages" }} />
        <PageEditor
          page={{
            id: page.id,
            status: page.status,
            publishedAt: page.publishedAt?.toISOString() ?? null,
            isHome: page.slug === "home",
            input: {
              title: page.title,
              slug: page.slug,
              excerpt: page.excerpt,
              sections,
              featuredImageId: page.featuredImageId,
              ogImageId: page.ogImageId,
              seoTitle: page.seoTitle,
              seoDescription: page.seoDescription,
              canonicalUrl: page.canonicalUrl,
              noindex: page.noindex,
            },
          }}
          revisions={revisions.map((r) => ({ id: r.id, note: r.note, createdAt: r.createdAt.toISOString(), by: r.createdBy?.name ?? "—" }))}
          canEdit={canEditItem(actor, page)}
        />
      </ProjectOptionsProvider>
    </MediaRegistryProvider>
  );
}
