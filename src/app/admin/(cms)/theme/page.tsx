import { PageHeader } from "@/components/admin/page-header";
import { ThemeEditor } from "./theme-editor";
import { requirePermissionPage } from "@/lib/auth/session";
import { getTheme, getThemeMeta } from "@/server/services/site";

export default async function ThemePage() {
  await requirePermissionPage("theme.manage");
  const [theme, meta] = await Promise.all([getTheme(), getThemeMeta()]);
  return (
    <>
      <PageHeader
        title="Theme & branding"
        description={`Colours, typography and button styles for the public website. Changes are previewed here and only go live when you publish.${meta ? ` Last published ${meta.updatedAt.toLocaleString("en-GB")}${meta.updatedBy ? ` by ${meta.updatedBy.name}` : ""}.` : ""}`}
      />
      <ThemeEditor initial={theme} />
    </>
  );
}
