"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { siteButtonClass } from "@/components/site/site-button";
import { cn } from "@/lib/utils";
import type { MenuLink } from "@/server/services/site";

interface Props {
  items: MenuLink[];
  siteName: string;
  logo: { url: string; alt: string; width: number | null; height: number | null } | null;
  logoLight: { url: string; alt: string; width: number | null; height: number | null } | null;
  phone: string;
  tel: string | null;
  payment: { enabled: boolean; label: string };
  /** Pages whose first section is a full-bleed hero get a transparent header. */
  overlay: boolean;
  /** Static render without reading the URL (Suspense fallback). */
  pathnameOverride?: string;
}

export function HeaderNav(props: Props) {
  if (props.pathnameOverride !== undefined) return <HeaderNavInner {...props} pathname={props.pathnameOverride} />;
  return <HeaderNavWithPath {...props} />;
}

function HeaderNavWithPath(props: Props) {
  const pathname = usePathname();
  return <HeaderNavInner {...props} pathname={pathname} />;
}

function HeaderNavInner({ items, siteName, logo, logoLight, phone, tel, payment, overlay, pathname }: Props & { pathname: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const transparent = overlay && pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu when the route changes (render-time state adjustment).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileOpen(false);
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const activeLogo = transparent ? (logoLight ?? logo) : logo;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        transparent ? "bg-gradient-to-b from-black/60 to-transparent text-white" : "border-b border-border bg-background/95 text-foreground shadow-sm backdrop-blur"
      )}
    >
      <div className="container-site flex h-20 items-center justify-between gap-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label={`${siteName} — home`}>
          {activeLogo ? (
            <Image src={activeLogo.url} alt={activeLogo.alt || siteName} width={activeLogo.width ?? 200} height={activeLogo.height ?? 50} priority className="h-11 w-auto" />
          ) : (
            <span className="heading text-2xl">{siteName}</span>
          )}
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {items.map((item) =>
            item.children.length ? (
              <div key={item.label} className="group relative">
                <Link
                  href={item.href}
                  className={cn("inline-flex items-center gap-1 px-3 py-2 text-[0.8rem] font-semibold tracking-[0.12em] uppercase transition-opacity hover:opacity-70", isActive(item.href) && "text-accent")}
                  aria-haspopup="true"
                >
                  {item.label}
                  <ChevronDown className="size-3.5 transition-transform group-focus-within:rotate-180 group-hover:rotate-180" aria-hidden />
                </Link>
                <div className="invisible absolute start-0 top-full min-w-60 translate-y-1 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <ul className="border border-border bg-background py-2 text-foreground shadow-xl">
                    {item.children.map((child) => (
                      <li key={child.href + child.label}>
                        <Link
                          href={child.href}
                          target={child.openInNewTab ? "_blank" : undefined}
                          className="block px-5 py-2.5 text-sm hover:bg-muted hover:text-primary"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                target={item.openInNewTab ? "_blank" : undefined}
                className={cn("px-3 py-2 text-[0.8rem] font-semibold tracking-[0.12em] uppercase transition-opacity hover:opacity-70", isActive(item.href) && "text-accent")}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-2">
          {tel ? (
            <a
              href={tel}
              data-track="call_click"
              data-track-label="header"
              aria-label={`Call ${phone}`}
              title={phone}
              className={cn(
                // Icon-only until there is room for the full number next to the navigation.
                "hidden size-9 shrink-0 items-center justify-center gap-2 rounded-full border text-sm font-semibold whitespace-nowrap transition md:inline-flex 2xl:size-auto 2xl:rounded-none 2xl:border-0 2xl:px-2",
                transparent ? "border-white/40 text-white hover:bg-white/10" : "border-border text-primary hover:bg-muted"
              )}
            >
              <Phone className="size-4 shrink-0" aria-hidden />
              <span className="hidden 2xl:inline">{phone}</span>
            </a>
          ) : null}
          {payment.enabled ? (
            <Link
              href="/pay-my-installment"
              data-track="pay_installment_click"
              data-track-label="header"
              className={cn(siteButtonClass(transparent ? "outline-light" : "outline", "sm"), "hidden sm:inline-flex")}
            >
              {payment.label}
            </Link>
          ) : null}
          <Link href="/contact" className={cn(siteButtonClass("accent", "sm"), "hidden md:inline-flex")}>
            Enquire
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger className="inline-flex size-11 items-center justify-center xl:hidden" aria-label="Open menu">
              <Menu className="size-6" />
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-heading text-2xl font-medium">{siteName}</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="px-4 pb-8">
                <Accordion type="multiple">
                  {items.map((item) =>
                    item.children.length ? (
                      <AccordionItem key={item.label} value={item.label}>
                        <AccordionTrigger className="text-sm font-semibold tracking-[0.12em] uppercase">{item.label}</AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1 ps-2">
                            <li><Link href={item.href} className="block py-2 text-sm">All {item.label}</Link></li>
                            {item.children.map((child) => (
                              <li key={child.href + child.label}>
                                <Link href={child.href} className="block py-2 text-sm text-muted-foreground hover:text-foreground">{child.label}</Link>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    ) : (
                      <div key={item.label} className="border-b border-border">
                        <Link href={item.href} className="block py-4 text-sm font-semibold tracking-[0.12em] uppercase">{item.label}</Link>
                      </div>
                    )
                  )}
                </Accordion>
                <div className="mt-6 grid gap-3">
                  {payment.enabled ? (
                    <Link href="/pay-my-installment" data-track="pay_installment_click" data-track-label="mobile_menu" className={siteButtonClass("outline", "md")}>
                      {payment.label}
                    </Link>
                  ) : null}
                  <Link href="/contact" className={siteButtonClass("primary", "md")}>Enquire now</Link>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
