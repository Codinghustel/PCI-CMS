import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { MediaRegistryProvider } from "@/components/admin/admin-context";
import { ContentEditor } from "@/components/admin/content-editor";
import { requirePermissionPage } from "@/lib/auth/session";
import { getProjectUpdateForEdit } from "@/server/services/content";
import { listProjectOptions } from "@/server/services/projects";
import { getMediaByIds, toMediaSummary } from "@/server/services/media";
import { saveUpdateAction } from "@/app/admin/actions/content";
import { toDateInput, updateFields } from "@/lib/admin-fields";
import { canEditItem } from "@/lib/auth/permissions";

export default async function EditUpdatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("content.read");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const isNew = id === "new";
  const [item, projects] = await Promise.all([isNew ? null : getProjectUpdateForEdit(id).catch(() => notFound()), listProjectOptions()]);
  const media = item ? await getMediaByIds(item.images.map((i) => i.mediaId)) : [];
  const today = toDateInput(new Date());
  return (
    <MediaRegistryProvider initial={media.map(toMediaSummary)}>
      <PageHeader title={item?.title ?? "New construction update"} back={{ href: "/admin/updates", label: "Construction updates" }} />
      <ContentEditor
        id={item?.id ?? null}
        status={item?.status ?? "NEW"}
        publishedAt={item?.publishedAt?.toISOString() ?? null}
        fields={updateFields(projects)}
        save={saveUpdateAction}
        deleteKind="update"
        liveHref={item ? `/project-updates/${item.slug}` : undefined}
        canEdit={canEditItem(actor, item)}
        initial={
          item
            ? {
                projectId: item.projectId,
                title: item.title,
                slug: item.slug,
                date: toDateInput(item.date),
                summary: item.summary,
                body: item.body,
                progressPercent: item.progressPercent,
                milestone: item.milestone,
                youtubeId: item.youtubeId,
                images: item.images.map((i) => ({ mediaId: i.mediaId, caption: i.caption })),
              }
            : { projectId: sp.projectId ?? "", title: "", slug: `update-${today}`, date: today, summary: "", body: "", progressPercent: null, milestone: "", youtubeId: "", images: [] }
        }
      />
    </MediaRegistryProvider>
  );
}
