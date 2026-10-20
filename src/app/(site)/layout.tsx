import { Suspense } from "react";
import { MobileCtaBar, SiteFooter, SiteHeader, WhatsAppFloat } from "@/components/site/site-chrome";
import { SiteAnalytics } from "@/components/site/site-analytics";
import { ProjectFinder } from "@/components/site/project-finder";
import { JsonLd } from "@/components/site/json-ld";
import { getPublicSettings, getPublicTheme } from "@/server/public-data";
import { themeToCss } from "@/lib/theme";
import { organizationJsonLd } from "@/lib/seo";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [theme, { settings }, org] = await Promise.all([getPublicTheme(), getPublicSettings(), organizationJsonLd()]);
  return (
    <div className="site flex min-h-full flex-1 flex-col">
      {/* Theme tokens from the CMS (validated hex values / enums only). */}
      <style dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
      <a href="#main" className="sr-only z-50 bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        Skip to content
      </a>
      <SiteHeader overlay />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MobileCtaBar />
      <WhatsAppFloat />
      {settings.chatbot.enabled ? (
        <ProjectFinder
          title={settings.chatbot.title || "Project Finder"}
          greeting={settings.chatbot.greeting}
          disclaimer={settings.chatbot.disclaimer}
          consentText={settings.forms.consentText}
        />
      ) : null}
      <Suspense fallback={null}>
        <SiteAnalytics gtmId={settings.analytics.gtmId} bannerText={settings.analytics.cookieBannerText} />
      </Suspense>
      <JsonLd data={org} />
    </div>
  );
}
