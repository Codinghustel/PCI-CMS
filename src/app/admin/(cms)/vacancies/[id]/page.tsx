import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { MediaRegistryProvider } from "@/components/admin/admin-context";
import { ContentEditor } from "@/components/admin/content-editor";
import { requirePermissionPage } from "@/lib/auth/session";
import { getVacancyForEdit } from "@/server/services/content";
import { saveVacancyAction } from "@/app/admin/actions/content";
import { toDateInput, vacancyFields } from "@/lib/admin-fields";
import { can } from "@/lib/auth/permissions";

export default async function EditVacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermissionPage("content.read");
  const { id } = await params;
  const item = id === "new" ? null : await getVacancyForEdit(id).catch(() => notFound());
  return (
    <MediaRegistryProvider initial={[]}>
      <PageHeader title={item?.title ?? "New vacancy"} back={{ href: "/admin/vacancies", label: "Careers" }} />
      <ContentEditor
        id={item?.id ?? null}
        status={item?.status ?? "NEW"}
        publishedAt={item?.publishedAt?.toISOString() ?? null}
        fields={vacancyFields}
        save={saveVacancyAction}
        deleteKind="vacancy"
        liveHref={item ? `/careers/${item.slug}` : undefined}
        canEdit={can(actor, "content.write")}
        initial={
          item
            ? { title: item.title, slug: item.slug, department: item.department, location: item.location, employmentType: item.employmentType, summary: item.summary, description: item.description, closesAt: toDateInput(item.closesAt) }
            : { title: "", slug: "", department: "", location: "", employmentType: "Full-time", summary: "", description: "", closesAt: "" }
        }
      />
    </MediaRegistryProvider>
  );
}
