import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { HeaderNav } from "@/components/site/header-nav";
import { BRAND_NAMES, BrandIcon, isBrandIcon, type BrandIconName } from "@/components/site/brand-icons";
import { getPublicMenu, getPublicSettings } from "@/server/public-data";
import { telLink, whatsappLink, type Office } from "@/lib/settings";
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

export async function SiteFooter() {
  const [{ settings, media }, footerItems, legalItems] = await Promise.all([
    getPublicSettings(),
    getPublicMenu("footer"),
    getPublicMenu("legal"),
  ]);
  const logo = settings.general.logoLight ? media[settings.general.logoLight] : settings.general.logo ? media[settings.general.logo] : null;
  const socials = Object.entries(settings.social).filter(([key, url]) => !!url && isBrandIcon(key)) as [BrandIconName, string][];

  return (
    <footer className="on-dark site bg-dark pb-16 text-dark-foreground md:pb-0">
      <div className="container-site grid gap-12 py-16 md:grid-cols-2 md:py-20 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          {logo ? (
            <Image src={logo.url} alt={logo.alt || settings.general.siteName} width={logo.width ?? 200} height={logo.height ?? 50} className="h-12 w-auto" />
          ) : (
            <p className="heading text-3xl">{settings.general.siteName}</p>
          )}
          {settings.general.footerAbout ? <p className="mt-6 max-w-sm text-sm leading-6 text-dark-foreground/75">{settings.general.footerAbout}</p> : null}
          {socials.length ? (
            <ul className="mt-6 flex flex-wrap gap-2.5" aria-label="Social media">
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${BRAND_NAMES[key]} (opens in a new tab)`}
                    className="flex size-10 items-center justify-center rounded-full border border-white/20 text-dark-foreground/85 transition hover:border-accent hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    <BrandIcon name={key} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {settings.payment.enabled ? (
            <Link href="/pay-my-installment" data-track="pay_installment_click" data-track-label="footer" className={siteButtonClass("accent", "sm", "mt-8")}>
              {settings.payment.buttonLabel || "Pay My Installment"}
            </Link>
          ) : null}
        </div>

        <nav aria-label="Footer" className="lg:col-span-2">
          <p className="eyebrow mb-5">Explore</p>
          <ul className="space-y-3 text-sm leading-6">
            {footerItems.map((item) => (
              <li key={item.href + item.label}>
                <Link href={item.href} className="text-dark-foreground/80 transition hover:text-accent">{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-10 sm:grid-cols-2 md:col-span-2 lg:col-span-6 lg:gap-8">
          {settings.contact.offices.map((office) => (
            <FooterOffice key={office.name} office={office} />
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        {/* End padding keeps the legal links clear of the floating WhatsApp / Project Finder buttons. */}
        <div className="container-site flex flex-col gap-3 py-6 pe-20 text-xs leading-5 text-dark-foreground/60 md:flex-row md:items-center md:gap-8 md:pe-56">
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

function FooterOffice({ office }: { office: Office }) {
  const row = "grid grid-cols-[1rem_1fr] items-start gap-x-3";
  const icon = "mt-1 size-4 text-accent";
  return (
    <div>
      <p className="eyebrow mb-4">{office.name}</p>
      <address className="space-y-3 text-sm leading-6 text-dark-foreground/80 not-italic">
        {office.address ? (
          <p className={row}>
            <MapPin className={icon} aria-hidden />
            <span>
              {office.address.split("\n").map((line, i) => (
                <span key={i} className="block">{line.trim()}</span>
              ))}
            </span>
          </p>
        ) : null}
        {office.phone ? (
          <p className={row}>
            <Phone className={icon} aria-hidden />
            <a href={telLink(office.phone) ?? undefined} data-track="call_click" data-track-label={`footer_${office.name}`} className="whitespace-nowrap hover:text-accent">{office.phone}</a>
          </p>
        ) : null}
        {office.email ? (
          <p className={row}>
            <Mail className={icon} aria-hidden />
            <a href={`mailto:${office.email}`} className="break-all hover:text-accent">{office.email}</a>
          </p>
        ) : null}
        {office.hours ? (
          <p className={`${row} text-dark-foreground/65`}>
            <Clock className={icon} aria-hidden />
            <span>{office.hours}</span>
          </p>
        ) : null}
      </address>
    </div>
  );
}

/** Persistent Enquire / Call / WhatsApp actions on mobile (Req. 4 & 7). */
export async function MobileCtaBar() {
  const { settings } = await getPublicSettings();
  const tel = telLink(settings.contact.phone);
  const wa = whatsappLink(settings);
  return (
    <nav aria-label="Quick contact" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-3 border-t border-border bg-background text-[0.7rem] font-semibold tracking-wider uppercase shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
      <Link href="/contact" className="flex flex-col items-center justify-center gap-1 text-primary">
        <Mail className="size-5" aria-hidden /> Enquire
      </Link>
      {tel ? (
        <a href={tel} data-track="call_click" data-track-label="mobile_bar" className="flex flex-col items-center justify-center gap-1 border-x border-border text-primary">
          <Phone className="size-5" aria-hidden /> Call
        </a>
      ) : <span />}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" data-track="whatsapp_click" data-track-label="mobile_bar" className="flex flex-col items-center justify-center gap-1 text-[#128C7E]">
          <BrandIcon name="whatsapp" className="size-5" /> WhatsApp
        </a>
      ) : <span />}
    </nav>
  );
}

/** Floating WhatsApp button (tablet/desktop; on phones WhatsApp lives in the bottom bar). */
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
      aria-label="Chat with us on WhatsApp (opens in a new tab)"
      title="Chat on WhatsApp"
      className="hidden size-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none md:flex"
    >
      <BrandIcon name="whatsapp" className="size-6" />
    </a>
  );
}
