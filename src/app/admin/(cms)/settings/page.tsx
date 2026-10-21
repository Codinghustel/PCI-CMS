import { PageHeader } from "@/components/admin/page-header";
import { MediaRegistryProvider } from "@/components/admin/admin-context";
import { SettingsForm } from "./settings-form";
import { requirePermissionPage } from "@/lib/auth/session";
import { getSettings } from "@/server/services/site";
import { getMediaByIds, toMediaSummary } from "@/server/services/media";
import { integrationStatus } from "@/server/services/integrations";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("settings.manage");
  const [settings, status, sp] = await Promise.all([getSettings(), integrationStatus(actor), searchParams]);
  const media = await getMediaByIds([settings.general.logo, settings.general.logoLight, settings.seo.defaultOgImage].filter((x): x is string => !!x));
  return (
    <MediaRegistryProvider initial={media.map(toMediaSummary)}>
      <PageHeader title="Settings" description="Site-wide details used in the header, footer, forms, SEO defaults and analytics, plus integration configuration." />
      <SettingsForm initial={settings} status={JSON.parse(JSON.stringify(status))} initialTab={sp.tab} />
    </MediaRegistryProvider>
  );
}
