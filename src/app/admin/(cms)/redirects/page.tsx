import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { RedirectManager } from "./redirect-manager";
import { requirePermissionPage } from "@/lib/auth/session";
import { listRedirects } from "@/server/services/site";

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("redirects.manage");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listRedirects({ q: sp.q, page: Number(sp.page) || 1, pageSize: 50 });
  return (
    <>
      <PageHeader title="Redirects" description="301/302 redirects for moved or retired URLs (e.g. old WordPress pages). A redirect takes priority over any page at the same address and applies within about 15 seconds." />
      <ListToolbar q={sp.q} placeholder="Search paths" />
      <RedirectManager items={items.map((r) => ({ id: r.id, fromPath: r.fromPath, toPath: r.toPath, permanent: r.permanent, note: r.note }))} />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q }} />
    </>
  );
}
