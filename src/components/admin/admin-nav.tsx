"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  Gauge,
  HelpCircle,
  Images,
  Inbox,
  KeyRound,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Newspaper,
  Palette,
  Settings,
  Shield,
  Signpost,
  UserCog,
  Users,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAdmin } from "@/components/admin/admin-context";
import { logoutAction } from "@/app/admin/actions/auth";
import { ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const NAV: { heading: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; permission?: Permission }[] }[] = [
  {
    heading: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: Gauge, permission: "dashboard.view" },
      // Available to every signed-in user.
      { href: "/admin/guide", label: "User guide", icon: BookOpen },
    ],
  },
  {
    heading: "Content",
    items: [
      { href: "/admin/projects", label: "Projects", icon: Building2, permission: "content.read" },
      { href: "/admin/updates", label: "Construction updates", icon: CalendarClock, permission: "content.read" },
      { href: "/admin/pages", label: "Pages", icon: FileText, permission: "content.read" },
      { href: "/admin/articles", label: "News & media", icon: Newspaper, permission: "content.read" },
      { href: "/admin/locations", label: "Locations", icon: MapPin, permission: "content.read" },
      { href: "/admin/vacancies", label: "Careers", icon: Briefcase, permission: "content.read" },
      { href: "/admin/faqs", label: "FAQs", icon: HelpCircle, permission: "content.read" },
      { href: "/admin/media", label: "Media library", icon: Images, permission: "media.read" },
    ],
  },
  {
    heading: "Site",
    items: [
      { href: "/admin/navigation", label: "Menus", icon: Navigation, permission: "navigation.manage" },
      { href: "/admin/redirects", label: "Redirects", icon: Signpost, permission: "redirects.manage" },
      { href: "/admin/theme", label: "Theme & branding", icon: Palette, permission: "theme.manage" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
    ],
  },
  {
    heading: "Leads & admin",
    items: [
      { href: "/admin/leads", label: "Leads", icon: Inbox, permission: "leads.read" },
      { href: "/admin/applications", label: "Job applications", icon: ClipboardList, permission: "applications.read" },
      { href: "/admin/users", label: "Users", icon: Users, permission: "users.manage" },
      { href: "/admin/roles", label: "Roles & permissions", icon: KeyRound, permission: "users.manage" },
      { href: "/admin/audit", label: "Audit log", icon: Shield, permission: "audit.read" },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, actor } = useAdmin();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-5 py-5">
        <Link href="/admin" className="block text-lg font-semibold tracking-tight" onClick={onNavigate}>
          PCI-Orbit <span className="font-normal text-muted-foreground">CMS</span>
        </Link>
      </div>
      <nav aria-label="CMS" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.permission || can(i.permission));
          if (!items.length) return null;
          return (
            <div key={group.heading}>
              <p className="mb-1 px-2 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">{group.heading}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm", active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-foreground/80 hover:bg-sidebar-accent/60")}
                      >
                        <Icon className="size-4" /> {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="space-y-1 border-t p-3 text-sm">
        <Link href="/" target="_blank" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/60">
          <ExternalLink className="size-4" /> View website
        </Link>
        <Link href="/admin/account" onClick={onNavigate} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/60">
          <UserCog className="size-4" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{actor.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[actor.role]}</span>
          </span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start hover:bg-sidebar-accent/60">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminNav() {
  return (
    <>
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e bg-sidebar lg:block">
        <NavLinks />
      </aside>
      <MobileNav />
    </>
  );
}

function MobileNav() {
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden">
      <Sheet>
        <SheetTrigger className="inline-flex size-9 items-center justify-center rounded-md border" aria-label="Open CMS menu">
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">CMS navigation</SheetTitle>
          <NavLinks />
        </SheetContent>
      </Sheet>
      <span className="font-semibold">PCI-Orbit CMS</span>
    </div>
  );
}
