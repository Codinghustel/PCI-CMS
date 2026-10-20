import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { MediaRegistryProvider, ProjectOptionsProvider } from "@/components/admin/admin-context";
import { ProjectEditor, type ProjectEditorInput } from "./project-editor";
import { requirePermissionPage } from "@/lib/auth/session";
import { getProjectForEdit, listProjectOptions, projectPublishIssues } from "@/server/services/projects";
import { listLocationOptions } from "@/server/services/content";
import { getMediaByIds, toMediaSummary } from "@/server/services/media";
import { canEditItem } from "@/lib/auth/permissions";
import { NotFoundError } from "@/server/errors";

export default async function EditProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("content.read");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await getProjectForEdit(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const mediaIds = [
    p.heroImageId, p.cardImageId, p.dldQrImageId,
    ...p.gallery.map((g) => g.mediaId),
    ...p.floorPlans.flatMap((f) => [f.imageId, f.documentId]),
    ...p.documents.map((d) => d.mediaId),
    ...p.vrTours.map((v) => v.thumbnailId),
  ].filter((x): x is string => !!x);
  const [media, projects, locations] = await Promise.all([getMediaByIds(mediaIds), listProjectOptions(), listLocationOptions()]);

  const input: ProjectEditorInput = {
    name: p.name,
    slug: p.slug,
    category: p.category,
    constructionStatus: p.constructionStatus,
    market: p.market,
    city: p.city,
    address: p.address,
    locationId: p.locationId,
    latitude: p.latitude,
    longitude: p.longitude,
    tagline: p.tagline,
    overview: p.overview,
    heroImageId: p.heroImageId,
    cardImageId: p.cardImageId,
    heroYoutubeId: p.heroYoutubeId,
    keyFacts: p.keyFacts as Record<string, unknown>[],
    unitTypes: p.unitTypes as Record<string, unknown>[],
    amenities: p.amenities as Record<string, unknown>[],
    videos: p.videos as Record<string, unknown>[],
    connectivity: p.connectivity as Record<string, unknown>[],
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
    priceFrom: p.priceFrom,
    currency: p.currency,
    handover: p.handover,
    paymentPlanSummary: p.paymentPlanSummary,
    paymentPlan: p.paymentPlan as Record<string, unknown>[],
    showPrice: p.showPrice,
    showPaymentPlan: p.showPaymentPlan,
    showHandover: p.showHandover,
    dldPermitNumber: p.dldPermitNumber,
    dldQrImageId: p.dldQrImageId,
    regulatoryApprovals: p.regulatoryApprovals,
    bitrixProjectId: p.bitrixProjectId,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    noindex: p.noindex,
    gallery: p.gallery.map((g) => ({ mediaId: g.mediaId, caption: g.caption })),
    floorPlans: p.floorPlans.map((f) => ({ title: f.title, unitType: f.unitType, size: f.size, imageId: f.imageId, documentId: f.documentId, gated: f.gated })),
    documents: p.documents.map((d) => ({ mediaId: d.mediaId, title: d.title, kind: d.kind, gated: d.gated })),
    vrTours: p.vrTours.map((v) => ({ title: v.title, provider: v.provider, embedUrl: v.embedUrl, unitType: v.unitType, thumbnailId: v.thumbnailId, isActive: v.isActive })),
    relatedProjectIds: p.related.map((r) => r.id),
  };

  return (
    <MediaRegistryProvider initial={media.map(toMediaSummary)}>
      <ProjectOptionsProvider options={projects.filter((x) => x.id !== p.id)}>
        <PageHeader title={p.name} description={`/projects/${p.slug}`} back={{ href: "/admin/projects", label: "Projects" }} />
        <ProjectEditor
          id={p.id}
          status={p.status}
          publishedAt={p.publishedAt?.toISOString() ?? null}
          input={input}
          locations={locations}
          publishIssues={projectPublishIssues(p)}
          commercial={{
            status: p.commercialStatus,
            asOf: p.commercialAsOf?.toISOString() ?? null,
            approvedBy: p.commercialApprovedBy?.name ?? null,
            note: p.commercialNote,
            editedBySelf: p.updatedById === actor.id,
          }}
          latestUpdate={p.updates[0] ? { date: p.updates[0].date.toISOString(), title: p.updates[0].title } : null}
          canEdit={canEditItem(actor, p)}
          initialTab={sp.tab}
        />
      </ProjectOptionsProvider>
    </MediaRegistryProvider>
  );
}
