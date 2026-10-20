import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { MediaRegistryProvider } from "@/components/admin/admin-context";
import { ContentEditor } from "@/components/admin/content-editor";
import { requirePermissionPage } from "@/lib/auth/session";
import { getLocationForEdit } from "@/server/services/content";
import { getMediaByIds, toMediaSummary } from "@/server/services/media";
import { saveLocationAction } from "@/app/admin/actions/content";
import { locationFields } from "@/lib/admin-fields";
import { can } from "@/lib/auth/permissions";

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermissionPage("content.read");
  const { id } = await params;
  const item = id === "new" ? null : await getLocationForEdit(id).catch(() => notFound());
  const media = item?.heroImageId ? await getMediaByIds([item.heroImageId]) : [];
  return (
    <MediaRegistryProvider initial={media.map(toMediaSummary)}>
      <PageHeader title={item?.name ?? "New location"} back={{ href: "/admin/locations", label: "Locations" }} />
      <ContentEditor
        id={item?.id ?? null}
        status={item?.status ?? "NEW"}
        publishedAt={item?.publishedAt?.toISOString() ?? null}
        fields={locationFields}
        save={saveLocationAction}
        deleteKind="location"
        liveHref={item ? `/locations/${item.slug}` : undefined}
        canEdit={can(actor, "content.write")}
        initial={
          item
            ? { name: item.name, slug: item.slug, market: item.market, city: item.city, summary: item.summary, overview: item.overview, heroImageId: item.heroImageId, latitude: item.latitude, longitude: item.longitude, landmarks: item.landmarks, seoTitle: item.seoTitle, seoDescription: item.seoDescription }
            : { name: "", slug: "", market: "PAKISTAN", city: "", summary: "", overview: "", heroImageId: null, latitude: null, longitude: null, landmarks: [], seoTitle: "", seoDescription: "" }
        }
      />
    </MediaRegistryProvider>
  );
}
