import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { HeaderNav } from "@/components/site/header-nav";
import { getPublicMenu, getPublicSettings } from "@/server/public-data";
import { telLink, whatsappLink } from "@/lib/settings";
import { siteButtonClass } from "@/components/site/site-button";

export async function SiteHeader({ overlay }: { overlay: boolean }) {
  const [{ settings, media }, items] = await Promise.all([getPublicSettings(), getPublicMenu("header")]);
  const logo = settings.general.logo ? media[settings.general.logo] ?? null : null;
  const logoLight = settings.general.logoLight ? media[settings.general.logoLight] ?? null : null;
  const props = {
      items,
      siteName: settings.general.siteName,
      logo,
      logoLight,
      phone: settings.contact.phone,
      tel: telLink(settings.contact.phone),
      payment: { enabled: settings.payment.enabled, label: settings.payment.buttonLabel || "Pay My Installment" },
      overlay,
  };
  // HeaderNav reads the current path; the fallback is the same bar without active states.
  return (
    <Suspense fallback={<HeaderNav {...props} pathnameOverride="" />}>
      <HeaderNav {...props} />
    </Suspense>
  );
}

const SOCIAL_LABELS: Record<string, { short: string; name: string }> = {
  facebook: { short: "Fb", name: "Facebook" },
  instagram: { short: "Ig", name: "Instagram" },
  linkedin: { short: "in", name: "LinkedIn" },
  youtube: { short: "Yt", name: "YouTube" },
  x: { short: "X", name: "X" },
  tiktok: { short: "Tt", name: "TikTok" },
};

export async function SiteFooter() {
  const [{ settings, media }, footerItems, legalItems] = await Promise.all([
    getPublicSettings(),
    getPublicMenu("footer"),
    getPublicMenu("legal"),
  ]);
  const logo = settings.general.logoLight ? media[settings.general.logoLight] : settings.general.logo ? media[settings.general.logo] : null;
  const socials = Object.entries(settings.social).filter(([, url]) => !!url);

  return (
    <footer className="on-dark site bg-dark pb-24 text-dark-foreground md:pb-0">
      <div className="container-site grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-4">
          {logo ? (
            <Image src={logo.url} alt={logo.alt || settings.general.siteName} width={logo.width ?? 200} height={logo.height ?? 50} className="h-12 w-auto" />
          ) : (
            <p className="heading text-3xl">{settings.general.siteName}</p>
          )}
          {settings.general.footerAbout ? <p className="mt-6 max-w-sm text-sm leading-relaxed text-dark-foreground/75">{settings.general.footerAbout}</p> : null}
          {socials.length ? (
            <ul className="mt-6 flex flex-wrap gap-3">
              {socials.map(([key, url]) => {
                const social = SOCIAL_LABELS[key] ?? { short: key.slice(0, 2), name: key };
                return (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={social.name} className="flex size-10 items-center justify-center border border-white/20 transition hover:border-accent hover:text-accent">
                      <span className="text-xs font-semibold" aria-hidden>{social.short}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <nav aria-label="Footer" className="md:col-span-3">
          <p className="eyebrow mb-5">Explore</p>
          <ul className="space-y-3 text-sm">
            {footerItems.map((item) => (
              <li key={item.href + item.label}>
                <Link href={item.href} className="text-dark-foreground/80 transition hover:text-accent">{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-8 md:col-span-5">
          {settings.contact.offices.map((office) => (
            <div key={office.name}>
              <p className="eyebrow mb-3">{office.name}</p>
              <address className="space-y-2 text-sm text-dark-foreground/80 not-italic">
                {office.address ? (
                  <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> <span className="whitespace-pre-line">{office.address}</span></p>
                ) : null}
                {office.phone ? (
                  <p className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><a href={telLink(office.phone) ?? undefined} data-track="call_click" data-track-label={`footer_${office.name}`} className="hover:text-accent">{office.phone}</a></p>
                ) : null}
                {office.email ? (
                  <p className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><a href={`mailto:${office.email}`} className="hover:text-accent">{office.email}</a></p>
                ) : null}
                {office.hours ? <p className="text-xs text-dark-foreground/60">{office.hours}</p> : null}
              </address>
            </div>
          ))}
          {settings.payment.enabled ? (
            <Link href="/pay-my-installment" data-track="pay_installment_click" data-track-label="footer" className={siteButtonClass("accent", "sm")}>
              {settings.payment.buttonLabel || "Pay My Installment"}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-site flex flex-col gap-4 py-6 text-xs text-dark-foreground/60 md:flex-row md:items-center md:justify-between">
          <p>{settings.general.copyright || `© ${settings.general.siteName}`}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {legalItems.map((item) => (
              <li key={item.href}><Link href={item.href} className="hover:text-accent">{item.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

/** Persistent Enquire / Call / WhatsApp actions on mobile (Req. 4 & 7). */
export async function MobileCtaBar() {
  const { settings } = await getPublicSettings();
  const tel = telLink(settings.contact.phone);
  const wa = whatsappLink(settings);
  return (
    <nav aria-label="Quick contact" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-background text-xs font-semibold tracking-wider uppercase shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
      <Link href="/contact" className="flex flex-col items-center gap-1 py-3 text-primary">
        <Mail className="size-5" aria-hidden /> Enquire
      </Link>
      {tel ? (
        <a href={tel} data-track="call_click" data-track-label="mobile_bar" className="flex flex-col items-center gap-1 border-x border-border py-3 text-primary">
          <Phone className="size-5" aria-hidden /> Call
        </a>
      ) : <span />}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" data-track="whatsapp_click" data-track-label="mobile_bar" className="flex flex-col items-center gap-1 py-3 text-[#128C7E]">
          <MessageCircle className="size-5" aria-hidden /> WhatsApp
        </a>
      ) : <span />}
    </nav>
  );
}

/** Desktop floating WhatsApp button. */
export async function WhatsAppFloat() {
  const { settings } = await getPublicSettings();
  const wa = whatsappLink(settings);
  if (!wa) return null;
  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      data-track="whatsapp_click"
      data-track-label="floating"
      aria-label="Chat with us on WhatsApp"
      className="fixed start-4 bottom-6 z-40 hidden size-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105 md:flex"
    >
      <MessageCircle className="size-6" aria-hidden />
    </a>
  );
}
