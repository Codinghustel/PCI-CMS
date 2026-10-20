import { PageHeader } from "@/components/admin/page-header";
import { MediaRegistryProvider } from "@/components/admin/admin-context";
import { SettingsForm } from "./settings-form";
import { requirePermissionPage } from "@/lib/auth/session";
import { getSettings } from "@/server/services/site";
import { getMediaByIds, toMediaSummary } from "@/server/services/media";
import { paymentMode } from "@/server/services/payments";
import { serverEnv } from "@/lib/env";

export default async function SettingsPage() {
  await requirePermissionPage("settings.manage");
  const settings = await getSettings();
  const media = await getMediaByIds([settings.general.logo, settings.general.logoLight, settings.seo.defaultOgImage].filter((x): x is string => !!x));
  const env = serverEnv();
  // Integration status only — secrets themselves are never shown.
  const integrations = [
    { name: "Bitrix24 CRM", ok: !!env.BITRIX24_WEBHOOK_URL, detail: env.BITRIX24_WEBHOOK_URL ? "Inbound webhook configured" : "Set BITRIX24_WEBHOOK_URL to deliver leads" },
    { name: "Payment Service", ok: paymentMode() === "service", detail: paymentMode() === "service" ? "Verified payment hand-off active" : "Interim mode: payment requests go to Finance via Bitrix24" },
    { name: "Scheduled job", ok: !!env.CRON_SECRET, detail: env.CRON_SECRET ? "CRON_SECRET set — schedule POST /api/cron/deliver-leads" : "Set CRON_SECRET and schedule the retry job" },
    { name: "Search indexing", ok: env.SITE_ENV === "production", detail: env.SITE_ENV === "production" ? "Production: indexable" : `${env.SITE_ENV}: noindex enforced` },
  ];
  return (
    <MediaRegistryProvider initial={media.map(toMediaSummary)}>
      <PageHeader title="Settings" description="Site-wide details used in the header, footer, forms, SEO defaults, analytics and the payment entry page." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {integrations.map((i) => (
          <div key={i.name} className="rounded-lg border bg-background p-4 text-sm">
            <p className="flex items-center gap-2 font-medium"><span className={`size-2 rounded-full ${i.ok ? "bg-emerald-500" : "bg-amber-500"}`} />{i.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
          </div>
        ))}
      </div>
      <SettingsForm initial={settings} />
    </MediaRegistryProvider>
  );
}
