import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { MediaRegistryProvider } from "@/components/admin/admin-context";
import { ContentEditor } from "@/components/admin/content-editor";
import { requirePermissionPage } from "@/lib/auth/session";
import { getArticleForEdit } from "@/server/services/content";
import { getMediaByIds, toMediaSummary } from "@/server/services/media";
import { saveArticleAction } from "@/app/admin/actions/content";
import { articleFields, toDateInput, toDateTimeInput } from "@/lib/admin-fields";
import { canEditItem } from "@/lib/auth/permissions";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermissionPage("content.read");
  const { id } = await params;
  const item = id === "new" ? null : await getArticleForEdit(id).catch(() => notFound());
  const media = item?.coverImageId ? await getMediaByIds([item.coverImageId]) : [];
  return (
    <MediaRegistryProvider initial={media.map(toMediaSummary)}>
      <PageHeader title={item?.title ?? "New article"} back={{ href: "/admin/articles", label: "News & media" }} />
      <ContentEditor
        id={item?.id ?? null}
        status={item?.status ?? "NEW"}
        publishedAt={item?.publishedAt?.toISOString() ?? null}
        fields={articleFields}
        save={saveArticleAction}
        deleteKind="article"
        liveHref={item ? `/media/${item.slug}` : undefined}
        canEdit={canEditItem(actor, item)}
        initial={
          item
            ? { title: item.title, slug: item.slug, category: item.category, excerpt: item.excerpt, body: item.body, coverImageId: item.coverImageId, youtubeId: item.youtubeId, eventDate: toDateInput(item.eventDate), eventLocation: item.eventLocation, publishedAt: toDateTimeInput(item.publishedAt), seoTitle: item.seoTitle, seoDescription: item.seoDescription }
            : { title: "", slug: "", category: "NEWS", excerpt: "", body: "", coverImageId: null, youtubeId: "", eventDate: "", eventLocation: "", publishedAt: "", seoTitle: "", seoDescription: "" }
        }
      />
    </MediaRegistryProvider>
  );
}
