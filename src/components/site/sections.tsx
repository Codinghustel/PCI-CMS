import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeading, SectionShell } from "@/components/site/section-shell";
import { SiteButtonLink, siteButtonClass } from "@/components/site/site-button";
import { MediaImage } from "@/components/site/media-image";
import { ArticleCard, ProjectCard, UpdateCard } from "@/components/site/cards";
import { Gallery } from "@/components/site/gallery";
import { YoutubeEmbed } from "@/components/site/youtube-embed";
import { VrTourGrid } from "@/components/site/vr-tour-viewer";
import { LeadForm } from "@/components/site/lead-form";
import { HeroSlideshow } from "@/components/site/hero-slideshow";
import { OpenFinderButton } from "@/components/site/project-finder";
import { OfficeCards } from "@/components/site/offices";
import {
  getPublicSettings,
  listActiveVrTours,
  listPublishedArticles,
  listPublishedFaqs,
  listPublishedLocations,
  listPublishedProjects,
  listPublishedUpdates,
  listPublishedVacancies,
  type MediaMap,
  type PublicMedia,
} from "@/server/public-data";
import { sanitizeRichText } from "@/lib/sanitize";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_CATEGORY_SLUGS,
  type ArticleCategoryValue,
  type LeadFormTypeValue,
  type ProjectCategoryValue,
} from "@/lib/content-labels";
import type { Section } from "@/lib/sections/registry";
import { formatDate, isSafeHref } from "@/lib/text";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any -- section data is validated by the registry schema on save */
type D = Record<string, any>;

export interface SectionContext {
  media: MediaMap;
  /** True when rendering a draft preview inside the CMS. */
  preview?: boolean;
}

const m = (ctx: SectionContext, id: unknown): PublicMedia | null => (typeof id === "string" ? ctx.media[id] ?? null : null);
const href = (v: unknown) => (typeof v === "string" && isSafeHref(v) ? v : "");

export function RenderSections({ sections, ctx }: { sections: Section[]; ctx: SectionContext }) {
  return (
    <>
      {sections
        .filter((s) => !s.hidden)
        .map((s, i) => {
          const Component = SECTION_COMPONENTS[s.type];
          if (!Component) return null;
          return <Component key={s.id} data={s.data as D} ctx={ctx} first={i === 0} />;
        })}
    </>
  );
}

type SectionProps = { data: D; ctx: SectionContext; first: boolean };

function Hero({ data, ctx, first }: SectionProps) {
  const images = ((data.images as string[]) ?? []).map((id) => m(ctx, id)).filter((x): x is PublicMedia => !!x);
  const height = data.height === "full" ? "min-h-[100svh]" : data.height === "medium" ? "min-h-[60svh]" : "min-h-[85svh]";
  const Heading = first ? "h1" : "h2";
  return (
    <section className={cn("on-dark relative flex items-end overflow-hidden bg-dark text-white", height)}>
      {images.length ? <HeroSlideshow images={images.map((i) => ({ url: i.url, alt: i.alt }))} /> : null}
      {data.youtubeId ? (
        <iframe
          aria-hidden
          tabIndex={-1}
          title="Background video"
          className="pointer-events-none absolute top-1/2 left-1/2 hidden aspect-video min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 md:block"
          src={`https://www.youtube-nocookie.com/embed/${data.youtubeId}?autoplay=1&mute=1&loop=1&controls=0&playlist=${data.youtubeId}&playsinline=1&rel=0`}
          allow="autoplay; encrypted-media"
          loading="lazy"
        />
      ) : null}
      {/* Overlay keeps hero text readable on bright photography (WCAG contrast). */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
      <div className="absolute inset-y-0 start-0 w-full bg-gradient-to-r from-black/45 to-transparent md:w-2/3 rtl:bg-gradient-to-l" />
      <div className="container-site relative pt-32 pb-20 md:pb-28">
        <div className="max-w-3xl [text-shadow:0_1px_12px_rgba(0,0,0,0.35)]">
          {data.eyebrow ? (
            <p className="mb-5 flex items-center gap-3 text-xs font-semibold tracking-[0.28em] text-white uppercase">
              <span aria-hidden className="h-px w-10 bg-accent" />
              {data.eyebrow}
            </p>
          ) : null}
          <Heading className="text-5xl text-balance text-white md:text-7xl">{data.heading}</Heading>
          {data.subheading ? <p className="mt-6 max-w-xl text-lg text-white/85 md:text-xl">{data.subheading}</p> : null}
          <div className="mt-10 flex flex-wrap gap-3">
            {data.ctaLabel && href(data.ctaHref) ? <SiteButtonLink href={href(data.ctaHref)} variant="accent" size="lg">{data.ctaLabel}</SiteButtonLink> : null}
            {data.secondaryCtaLabel && href(data.secondaryCtaHref) ? (
              <SiteButtonLink href={href(data.secondaryCtaHref)} variant="outline-light" size="lg">{data.secondaryCtaLabel}</SiteButtonLink>
            ) : null}
            {data.showFinder ? (
              <OpenFinderButton className={siteButtonClass("ghost-light", "lg", "border border-white/30")}>
                <Sparkles aria-hidden /> Find my property
              </OpenFinderButton>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function RichText({ data }: SectionProps) {
  return (
    <SectionShell background={data.background}>
      <div className={cn("container-site", data.width === "narrow" && "max-w-3xl")}>
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
        <div className="prose-cms" dangerouslySetInnerHTML={{ __html: sanitizeRichText(data.body) }} />
      </div>
    </SectionShell>
  );
}

function ImageText({ data, ctx }: SectionProps) {
  const image = m(ctx, data.image);
  return (
    <SectionShell background={data.background}>
      <div className="container-site grid items-center gap-12 md:grid-cols-2 lg:gap-20">
        <div className={cn("relative aspect-[4/5] overflow-hidden md:aspect-[4/5]", data.imagePosition === "left" ? "md:order-first" : "md:order-last")}>
          <MediaImage media={image} fill sizes="(min-width: 768px) 50vw, 100vw" />
        </div>
        <div>
          {data.eyebrow ? <p className="eyebrow mb-4">{data.eyebrow}</p> : null}
          {data.heading ? <h2 className="text-4xl text-balance md:text-5xl">{data.heading}</h2> : null}
          <div className="prose-cms mt-6" dangerouslySetInnerHTML={{ __html: sanitizeRichText(data.body) }} />
          {data.ctaLabel && href(data.ctaHref) ? (
            <SiteButtonLink href={href(data.ctaHref)} variant={data.background === "dark" ? "accent" : "primary"} className="mt-8">
              {data.ctaLabel} <ArrowRight aria-hidden className="rtl:rotate-180" />
            </SiteButtonLink>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}

function Stats({ data }: SectionProps) {
  const items = (data.items as D[]) ?? [];
  if (!items.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} align="center" />
        <dl className={cn("grid gap-8 text-center", items.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
          {items.map((item, i) => (
            <div key={i} className="border-s border-accent/40 px-4 first:border-s-0">
              <dd className="heading text-5xl md:text-6xl">
                {item.value}
                <span className="text-accent">{item.suffix}</span>
              </dd>
              <dt className="mt-3 text-xs font-semibold tracking-[0.2em] uppercase opacity-75">{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </SectionShell>
  );
}

function FeatureGrid({ data, ctx }: SectionProps) {
  const items = (data.items as D[]) ?? [];
  const cols = { "2": "md:grid-cols-2", "3": "md:grid-cols-3", "4": "md:grid-cols-2 lg:grid-cols-4" }[String(data.columns)] ?? "md:grid-cols-3";
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
        <ul className={cn("grid gap-6", cols)}>
          {items.map((item, i) => {
            const image = m(ctx, item.image);
            const content = (
              <>
                {image ? (
                  <div className="relative mb-6 aspect-[3/2] overflow-hidden">
                    <MediaImage media={image} fill sizes="(min-width: 768px) 33vw, 100vw" className="transition-transform duration-700 group-hover:scale-105" />
                  </div>
                ) : (
                  <span className="mb-6 block font-heading text-4xl text-accent">{String(i + 1).padStart(2, "0")}</span>
                )}
                <h3 className="line-clamp-2 text-2xl">{item.title}</h3>
                {item.description ? <p className="mt-3 line-clamp-5 text-sm leading-relaxed opacity-80">{item.description}</p> : null}
              </>
            );
            return (
              <li key={i} className={cn("group h-full border border-border p-6", data.background === "dark" && "border-white/15")}>
                {href(item.href) ? <Link href={href(item.href)} className="block">{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      </div>
    </SectionShell>
  );
}

function GallerySection({ data, ctx }: SectionProps) {
  const images = ((data.images as string[]) ?? []).map((id) => m(ctx, id)).filter((x): x is PublicMedia => !!x);
  if (!images.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
        <Gallery images={images} layout="mosaic" />
      </div>
    </SectionShell>
  );
}

function Video({ data, ctx }: SectionProps) {
  if (!data.youtubeId) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site max-w-5xl">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} align="center" />
        <YoutubeEmbed videoId={data.youtubeId} title={data.heading || "Video"} poster={m(ctx, data.poster)?.url} />
      </div>
    </SectionShell>
  );
}

function Cta({ data, ctx }: SectionProps) {
  const image = m(ctx, data.image);
  return (
    <section className="on-dark relative overflow-hidden bg-primary text-primary-foreground">
      {image ? <MediaImage media={image} fill sizes="100vw" className="opacity-30" /> : null}
      <div className="container-site relative flex flex-col items-start gap-8 py-20 md:flex-row md:items-center md:justify-between md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-4xl text-balance md:text-5xl">{data.heading}</h2>
          {data.text ? <p className="mt-4 text-lg opacity-85">{data.text}</p> : null}
        </div>
        {href(data.ctaHref) ? <SiteButtonLink href={href(data.ctaHref)} variant="accent" size="lg">{data.ctaLabel}</SiteButtonLink> : null}
      </div>
    </section>
  );
}

function Testimonials({ data }: SectionProps) {
  const items = (data.items as D[]) ?? [];
  if (!items.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} align="center" />
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <li key={i}>
              <figure className={cn("flex h-full flex-col border border-border p-8", data.background === "dark" && "border-white/15")}>
                <span aria-hidden className="font-heading text-6xl leading-none text-accent">&ldquo;</span>
                <blockquote className="mt-2 flex-1 text-lg leading-relaxed">{t.quote}</blockquote>
                <figcaption className="mt-6 text-sm">
                  <span className="font-semibold">{t.name}</span>
                  {t.role ? <span className="block opacity-70">{t.role}</span> : null}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}

async function Faq({ data }: SectionProps) {
  const library = data.libraryCategory ? await listPublishedFaqs(data.libraryCategory) : [];
  const items = [
    ...library.map((f) => ({ q: f.question, a: f.answer })),
    ...((data.items as D[]) ?? []).map((i) => ({ q: i.question as string, a: i.answer as string })),
  ];
  if (!items.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site grid gap-12 lg:grid-cols-3">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} className="lg:mb-0" />
        <Accordion type="single" collapsible className="lg:col-span-2">
          {items.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-start text-base font-semibold md:text-lg">{item.q}</AccordionTrigger>
              <AccordionContent>
                <div className="prose-cms" dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.a) }} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SectionShell>
  );
}

function Team({ data, ctx }: SectionProps) {
  const members = (data.members as D[]) ?? [];
  if (!members.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
        <ul className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member, i) => (
            <li key={i}>
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                <MediaImage media={m(ctx, member.photo)} alt={member.name} fill sizes="(min-width: 1024px) 33vw, 50vw" />
              </div>
              <h3 className="mt-5 text-2xl">{member.name}</h3>
              {member.role ? <p className="eyebrow mt-1">{member.role}</p> : null}
              {member.bio ? <p className="mt-3 text-sm leading-relaxed opacity-80">{member.bio}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}

function Timeline({ data }: SectionProps) {
  const items = (data.items as D[]) ?? [];
  if (!items.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site max-w-4xl">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
        <ol className="relative border-s border-accent/50">
          {items.map((item, i) => (
            <li key={i} className="relative ms-8 pb-12 last:pb-0">
              <span aria-hidden className="absolute -start-[2.4rem] top-1.5 size-3 rotate-45 bg-accent" />
              <p className="eyebrow">{item.year}</p>
              <h3 className="mt-2 text-2xl">{item.title}</h3>
              {item.description ? <p className="mt-2 text-sm leading-relaxed opacity-80">{item.description}</p> : null}
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}

function Logos({ data, ctx }: SectionProps) {
  const items = ((data.items as D[]) ?? []).filter((i) => m(ctx, i.logo));
  if (!items.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} align="center" />
        <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          {items.map((item, i) => {
            const logo = m(ctx, item.logo)!;
            const img = <Image src={logo.url} alt={item.name} width={logo.width ?? 160} height={logo.height ?? 80} className="h-14 w-auto object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0" />;
            return <li key={i}>{href(item.href) ? <a href={href(item.href)} target="_blank" rel="noopener noreferrer">{img}</a> : img}</li>;
          })}
        </ul>
      </div>
    </SectionShell>
  );
}

async function FeaturedProjects({ data }: SectionProps) {
  const limit = Number(data.limit) || 6;
  const projects =
    data.mode === "manual" && (data.projectIds as string[])?.length
      ? await listPublishedProjects({ ids: data.projectIds })
      : data.mode === "category"
        ? await listPublishedProjects({ category: data.category as ProjectCategoryValue, limit })
        : data.mode === "latest"
          ? await listPublishedProjects({ limit })
          : await listPublishedProjects({ featured: true, limit });
  if (!projects.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
          {data.showAllLink ? (
            <SiteButtonLink href="/projects" variant={data.background === "dark" ? "outline-light" : "outline"} className="mb-10 self-start md:mb-14 md:self-auto">
              View all projects
            </SiteButtonLink>
          ) : null}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, data.mode === "manual" ? 12 : limit).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function ProjectCategories({ data, ctx }: SectionProps) {
  const items = (data.items as D[]) ?? [];
  if (!items.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
        <ul className={cn("grid gap-4", items.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
          {items.map((item, i) => {
            const cat = item.category as ProjectCategoryValue;
            return (
              <li key={i}>
                <Link
                  href={`/projects?category=${PROJECT_CATEGORY_SLUGS[cat]}`}
                  data-track="category_browse"
                  data-track-label={cat}
                  className="group on-dark relative flex aspect-[3/4] items-end overflow-hidden bg-dark p-6 text-white"
                >
                  <MediaImage media={m(ctx, item.image)} fill sizes="(min-width: 1024px) 25vw, 50vw" className="transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <span className="relative">
                    <span className="heading block text-3xl">{item.label || PROJECT_CATEGORY_LABELS[cat]}</span>
                    <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] uppercase opacity-90">
                      Explore <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionShell>
  );
}

async function LatestUpdates({ data }: SectionProps) {
  const { items } = await listPublishedUpdates({ pageSize: Number(data.limit) || 3 });
  if (!items.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
          <SiteButtonLink href="/project-updates" variant="outline" className="mb-10 self-start md:mb-14 md:self-auto">All updates</SiteButtonLink>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((u) => <UpdateCard key={u.id} update={u} />)}
        </div>
      </div>
    </SectionShell>
  );
}

async function VrShowcase({ data }: SectionProps) {
  const tours = await listActiveVrTours(Number(data.limit) || 3);
  // Never render an empty VR section.
  if (!tours.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
          <SiteButtonLink href="/vr-tours" variant={data.background === "dark" ? "outline-light" : "outline"} className="mb-10 self-start md:mb-14 md:self-auto">All tours</SiteButtonLink>
        </div>
        <VrTourGrid tours={tours.map((t) => ({ ...t, projectName: t.project.name }))} />
      </div>
    </SectionShell>
  );
}

async function LocationsGrid({ data }: SectionProps) {
  const locations = await listPublishedLocations();
  if (!locations.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((l) => (
            <li key={l.id}>
              <Link href={`/locations/${l.slug}`} className="group on-dark relative flex aspect-[4/3] items-end overflow-hidden bg-dark p-6 text-white">
                <MediaImage media={l.image} fill sizes="(min-width: 1024px) 33vw, 50vw" className="transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <span className="relative">
                  <span className="eyebrow block">{l.city}</span>
                  <span className="heading mt-1 line-clamp-2 text-3xl">{l.name}</span>
                  <span className="mt-1 block text-sm opacity-80">{l.projectCount} project{l.projectCount === 1 ? "" : "s"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}

async function LatestArticles({ data }: SectionProps) {
  const category = data.category && data.category !== "ALL" ? (data.category as ArticleCategoryValue) : undefined;
  const { items } = await listPublishedArticles({ category, pageSize: Number(data.limit) || 3 });
  if (!items.length) return null;
  return (
    <SectionShell background={data.background}>
      <div className="container-site">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
          <SiteButtonLink href="/media" variant="outline" className="mb-10 self-start md:mb-14 md:self-auto">All news</SiteButtonLink>
        </div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      </div>
    </SectionShell>
  );
}

async function Vacancies({ data }: SectionProps) {
  const vacancies = await listPublishedVacancies();
  return (
    <SectionShell background={data.background}>
      <div className="container-site max-w-5xl">
        <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
        {vacancies.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {vacancies.map((v) => (
              <li key={v.id}>
                <Link href={`/careers/${v.slug}`} className="group flex flex-col gap-2 py-6 md:flex-row md:items-center md:justify-between">
                  <span>
                    <span className="heading block text-2xl group-hover:text-primary">{v.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{[v.department, v.location, v.employmentType].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                    {v.closesAt ? `Apply by ${formatDate(v.closesAt, "short")}` : "View & apply"} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">There are no open vacancies at the moment. Please check back soon.</p>
        )}
      </div>
    </SectionShell>
  );
}

async function Enquiry({ data }: SectionProps) {
  const { settings } = await getPublicSettings();
  const dark = data.background === "dark";
  return (
    <SectionShell background={data.background} id="enquire">
      <div className={cn("container-site grid gap-12", data.showOffices ? "lg:grid-cols-5" : "max-w-3xl")}>
        <div className={data.showOffices ? "lg:col-span-3" : ""}>
          <SectionHeading eyebrow={data.eyebrow} heading={data.heading} intro={data.intro} />
          <LeadForm
            formType={(data.formType as LeadFormTypeValue) ?? "CONTACT"}
            projectId={data.projectId ?? undefined}
            consentText={settings.forms.consentText}
            successMessage={settings.forms.successMessage}
            showCountry={data.formType === "INVESTOR" || data.formType === "CHANNEL_PARTNER"}
            submitLabel={data.formType === "CHANNEL_PARTNER" ? "Register interest" : "Send enquiry"}
            tone={dark ? "dark" : "light"}
          />
        </div>
        {data.showOffices ? (
          <div className="lg:col-span-2">
            <OfficeCards offices={settings.contact.offices} />
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

async function PaymentCta({ data }: SectionProps) {
  const { settings } = await getPublicSettings();
  if (!settings.payment.enabled) return null;
  return (
    <section className="bg-secondary">
      <div className="container-site flex flex-col items-start gap-6 py-12 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-5">
          <span className="flex size-14 shrink-0 items-center justify-center bg-primary text-primary-foreground">
            <CreditCard className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="heading text-3xl text-secondary-foreground">{data.heading}</h2>
            {data.text ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.text}</p> : null}
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden /> Card details are entered only on the secure payment provider&apos;s page.
            </p>
          </div>
        </div>
        <Link href="/pay-my-installment" data-track="pay_installment_click" data-track-label="section" className={siteButtonClass("primary", "lg")}>
          {settings.payment.buttonLabel || "Pay My Installment"}
        </Link>
      </div>
    </section>
  );
}

const SECTION_COMPONENTS: Record<string, (props: SectionProps) => React.ReactNode | Promise<React.ReactNode>> = {
  hero: Hero,
  richText: RichText,
  imageText: ImageText,
  stats: Stats,
  featureGrid: FeatureGrid,
  gallery: GallerySection,
  video: Video,
  cta: Cta,
  testimonials: Testimonials,
  faq: Faq,
  team: Team,
  timeline: Timeline,
  logos: Logos,
  featuredProjects: FeaturedProjects,
  projectCategories: ProjectCategories,
  latestUpdates: LatestUpdates,
  vrShowcase: VrShowcase,
  locationsGrid: LocationsGrid,
  latestArticles: LatestArticles,
  vacancies: Vacancies,
  enquiry: Enquiry,
  paymentCta: PaymentCta,
};
