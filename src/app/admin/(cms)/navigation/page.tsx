import { PageHeader } from "@/components/admin/page-header";
import { MenuEditor } from "./menu-editor";
import { requirePermissionPage } from "@/lib/auth/session";
import { getMenu, MENU_KEYS, type MenuKey } from "@/server/services/site";

export default async function NavigationPage() {
  await requirePermissionPage("navigation.manage");
  const keys = Object.keys(MENU_KEYS) as MenuKey[];
  const menus = await Promise.all(keys.map(async (k) => ({ key: k, name: MENU_KEYS[k], items: await getMenu(k) })));
  return (
    <>
      <PageHeader title="Menus" description="Header navigation (with one level of dropdowns), footer links and legal links." />
      <div className="space-y-6">
        {menus.map((m) => <MenuEditor key={m.key} menuKey={m.key} name={m.name} initial={m.items} allowChildren={m.key === "header"} />)}
      </div>
    </>
  );
}
