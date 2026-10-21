"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  Gauge,
  GitPullRequestArrow,
  HelpCircle,
  Images,
  Inbox,
  KeyRound,
  LifeBuoy,
  Lock,
  MapPin,
  Navigation,
  Newspaper,
  Palette,
  Rocket,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GUIDE_GROUPS, type GuideIcon, type GuideSection } from "@/lib/guide";
import { cn } from "@/lib/utils";

const ICONS: Record<GuideIcon, React.ComponentType<{ className?: string }>> = {
  start: Rocket,
  roles: KeyRound,
  dashboard: Gauge,
  workflow: GitPullRequestArrow,
  pages: FileText,
  projects: Building2,
  commercial: BarChart3,
  updates: CalendarClock,
  content: Newspaper,
  media: Images,
  navigation: Navigation,
  theme: Palette,
  settings: Settings,
  leads: Inbox,
  applications: ClipboardList,
  users: Users,
  audit: Shield,
  quality: CheckCircle2,
  help: LifeBuoy,
};

type Section = GuideSection & { available: boolean; roles: string[] };

interface You {
  name: string;
  role: string;
  roleDescription: string;
  permissions: { group: string; label: string }[];
}

function searchText(s: Section) {
  return [s.title, s.summary, s.where, s.steps?.title, ...(s.steps?.items ?? []), ...(s.terms ?? []).flatMap((t) => [t.term, t.text]), ...(s.tips ?? [])]
    .join(" ")
    .toLowerCase();
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function GuideBrowser({ sections, you }: { sections: Section[]; you: You }) {
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const tocRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => new Map(sections.map((s) => [s.id, searchText(s)])), [sections]);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = sections.filter((s) => (!mineOnly || s.available) && terms.every((t) => index.get(s.id)!.includes(t)));
  const visibleKey = visible.map((s) => s.id).join(",");

  // Scroll-spy: highlight the topic currently at the top of the viewport.
  useEffect(() => {
    const els = visibleKey ? visibleKey.split(",").map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e) : [];
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleKey]);

  // Keep the highlighted entry visible inside the (independently scrolling) contents list.
  useEffect(() => {
    const box = tocRef.current;
    const item = active ? box?.querySelector<HTMLElement>(`[data-toc="${active}"]`) : null;
    if (!box || !item) return;
    const { top, bottom } = item.getBoundingClientRect();
    const frame = box.getBoundingClientRect();
    if (top < frame.top + 8 || bottom > frame.bottom - 8) {
      box.scrollTo({ top: item.offsetTop - box.clientHeight / 2, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }, [active]);

  // Back-to-top button after scrolling down.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = useCallback((id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
    setTocOpen(false);
    el.focus({ preventScroll: true });
  }, []);

  const toTop = () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    history.replaceState(null, "", window.location.pathname);
  };

  const permissionGroups = you.permissions.reduce<Record<string, string[]>>((acc, p) => {
    (acc[p.group] ??= []).push(p.label);
    return acc;
  }, {});

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      {/* Table of contents: sticky with its own scroll on large screens, collapsible on small ones. */}
      <nav aria-label="Guide contents" className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-lg border bg-background">
          <button
            type="button"
            onClick={() => setTocOpen((o) => !o)}
            aria-expanded={tocOpen}
            aria-controls="guide-toc"
            className="flex w-full items-center justify-between gap-2 p-4 text-sm font-semibold lg:pointer-events-none"
          >
            <span className="flex items-center gap-2"><BookOpen className="size-4" /> Contents <span className="font-normal text-muted-foreground">({visible.length})</span></span>
            <ChevronDown className={cn("size-4 transition-transform lg:hidden", tocOpen && "rotate-180")} aria-hidden />
          </button>
          <div
            id="guide-toc"
            ref={tocRef}
            className={cn(
              "relative max-h-[60dvh] overflow-y-auto overscroll-contain border-t px-4 pt-3 pb-4 lg:block lg:max-h-[calc(100dvh-7.5rem)]",
              !tocOpen && "hidden"
            )}
          >
            {GUIDE_GROUPS.map((group) => {
              const items = visible.filter((s) => s.group === group);
              if (!items.length) return null;
              return (
                <div key={group} className="mb-3 last:mb-0">
                  <p className="mb-1 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">{group}</p>
                  <ul className="space-y-0.5">
                    {items.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          data-toc={s.id}
                          onClick={goTo(s.id)}
                          aria-current={active === s.id ? "location" : undefined}
                          className={cn(
                            "flex items-center gap-2 rounded border-s-2 border-transparent px-2 py-1 text-sm hover:bg-muted",
                            !s.available && "text-muted-foreground",
                            active === s.id && "border-primary bg-muted font-medium text-foreground"
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{s.title}</span>
                          {!s.available ? <Lock className="size-3 shrink-0" aria-label="Requires another role" /> : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {!visible.length ? <p className="text-sm text-muted-foreground">No topics match.</p> : null}
          </div>
        </div>
      </nav>

      <div className="min-w-0 space-y-6">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p>
            Signed in as <strong>{you.name}</strong> — <strong>{you.role}</strong>.
          </p>
          <p className="mt-1 text-muted-foreground">{you.roleDescription}</p>
          <details className="mt-3 group">
            <summary className="cursor-pointer font-medium text-primary">Your permissions ({you.permissions.length})</summary>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(permissionGroups).map(([group, labels]) => (
                <div key={group}>
                  <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{group}</dt>
                  <dd>
                    <ul className="mt-1 space-y-0.5">
                      {labels.map((l) => (
                        <li key={l} className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />{l}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the guide, e.g. “publish”, “brochure”, “Bitrix24”" className="ps-9" aria-label="Search the guide" />
          </div>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <Switch checked={mineOnly} onCheckedChange={setMineOnly} /> Only what I can do
          </label>
        </div>
        <p className="sr-only" aria-live="polite">{visible.length} topics shown</p>

        {visible.map((s) => {
          const Icon = ICONS[s.icon];
          return (
            <section
              key={s.id}
              id={s.id}
              tabIndex={-1}
              aria-labelledby={`${s.id}-title`}
              className="scroll-mt-20 rounded-lg border bg-background focus:outline-none lg:scroll-mt-6"
            >
              <header className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-5 text-primary" /></span>
                  <div>
                    <h2 id={`${s.id}-title`} className="text-lg font-semibold">{s.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{s.summary}</p>
                    {s.where ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" aria-hidden /> Where: {s.where}</p>
                    ) : null}
                  </div>
                </div>
                {s.permissions ? (
                  s.available ? (
                    <Badge variant="secondary" className="shrink-0 gap-1 bg-emerald-100 text-emerald-900"><CheckCircle2 className="size-3" /> You can do this</Badge>
                  ) : (
                    <Badge variant="secondary" className="h-auto shrink-0 gap-1 whitespace-normal" title={`Requires: ${s.roles.join(", ")}`}>
                      <Lock className="size-3 shrink-0" /> Requires {s.roles.length ? s.roles.join(" or ") : "an administrator"}
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="shrink-0">Everyone</Badge>
                )}
              </header>
              <div className="space-y-5 p-5 text-sm leading-6">
                {s.steps ? (
                  <div>
                    <h3 className="mb-2 font-semibold">{s.steps.title}</h3>
                    <ol className="space-y-2">
                      {s.steps.items.map((item, i) => (
                        <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {s.terms ? (
                  <dl className="divide-y rounded-lg border">
                    {s.terms.map((t) => (
                      <div key={t.term} className="grid gap-1 p-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                        <dt className="font-medium">{t.term}</dt>
                        <dd className="text-muted-foreground">{t.text}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {s.tips?.length ? (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="mb-1 flex items-center gap-1.5 font-semibold"><HelpCircle className="size-4" /> Tips</p>
                    <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                      {s.tips.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                ) : null}
                {s.links?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {s.links.map((l) => (
                      <Link key={l.href} href={l.href} className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted">
                        {l.label} →
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
        {!visible.length ? (
          <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No topics match “{query}”. Try another word or turn off “Only what I can do”.</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={toTop}
        aria-label="Back to top"
        className={cn(
          "fixed end-6 bottom-6 z-30 flex size-11 items-center justify-center rounded-full border bg-background shadow-lg transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          showTop ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        tabIndex={showTop ? 0 : -1}
      >
        <ArrowUp className="size-5" />
      </button>
    </div>
  );
}
