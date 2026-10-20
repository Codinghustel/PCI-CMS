import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { MediaLibrary } from "./media-library";
import { requirePermissionPage } from "@/lib/auth/session";
import { listMedia, toMediaSummary } from "@/server/services/media";

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("media.read");
  const sp = await searchParams;
  const kind = sp.kind === "IMAGE" || sp.kind === "DOCUMENT" ? sp.kind : undefined;
  const { items, total, page, pageSize } = await listMedia({ q: sp.q, kind, page: Number(sp.page) || 1, pageSize: 40 });
  return (
    <>
      <PageHeader title="Media library" description="Images and documents used across the website. Images are optimised automatically; alt text is required for accessibility." />
      <ListToolbar q={sp.q} placeholder="Search title, alt text or tag" filters={[{ name: "kind", label: "Type", value: sp.kind, options: [{ value: "IMAGE", label: "Images" }, { value: "DOCUMENT", label: "Documents" }] }]} />
      <MediaLibrary
        items={items.map((m) => ({ ...toMediaSummary(m), originalName: m.originalName, tags: m.tags, createdAt: m.createdAt.toISOString() }))}
      />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, kind: sp.kind }} />
    </>
  );
}
