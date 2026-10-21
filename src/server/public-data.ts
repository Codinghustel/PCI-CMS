import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getMenu, getSettings, getTheme, type MenuKey } from "@/server/services/site";
import { mediaUrl } from "@/server/services/media";
import { TAGS } from "@/lib/cache-tags";
import { sectionMediaIds, type Section } from "@/lib/sections/registry";
import type { ArticleCategoryValue, ConstructionStatusValue, ProjectCategoryValue } from "@/lib/content-labels";

// Public (anonymous) reads. Every function:
//  - only returns PUBLISHED content whose publishedAt is not in the future,
//  - is cached with `use cache` and tagged so CMS edits invalidate it,
//  - uses the "content" cache profile (5-minute revalidation) so scheduled
//    content appears without an explicit edit.
// Draft previews do NOT use these functions (see app/admin/preview).

function live() {
  return { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };
}

export interface PublicMedia {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  title: string;
  sizeBytes: number;
}
export type MediaMap = Record<string, PublicMedia>;

const mediaSelect = { id: true, storageKey: true, alt: true, width: true, height: true, mimeType: true, title: true, sizeBytes: true } satisfies Prisma.MediaSelect;
type MediaRow = Prisma.MediaGetPayload<{ select: typeof mediaSelect }>;

export function toPublicMedia(m: MediaRow | null | undefined): PublicMedia | null {
  if (!m) return null;
  return { id: m.id, url: mediaUrl(m.storageKey), alt: m.alt, width: m.width, height: m.height, mimeType: m.mimeType, title: m.title, sizeBytes: m.sizeBytes };
}

export async function getMediaMap(ids: string[]): Promise<MediaMap> {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.media);
  if (!ids.length) return {};
  const rows = await db.media.findMany({ where: { id: { in: [...new Set(ids)] } }, select: mediaSelect });
  return Object.fromEntries(rows.map((m) => [m.id, toPublicMedia(m)!]));
}

// ───────────────────────── Global ─────────────────────────

export async function getPublicTheme() {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.theme);
  return getTheme();
}

export async function getPublicSettings() {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.settings);
  const settings = await getSettings();
  const media = await getMediaMap(
    [settings.general.logo, settings.general.logoLight, settings.seo.defaultOgImage].filter((x): x is string => !!x)
  );
  return { settings, media };
}

export async function getPublicMenu(key: MenuKey) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.navigation);
  return getMenu(key);
}

// ───────────────────────── Pages ─────────────────────────

export async function getPublishedPage(slug: string) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.pages);
  const page = await db.page.findFirst({
    where: { slug, ...live() },
    include: { featuredImage: { select: mediaSelect }, ogImage: { select: mediaSelect } },
  });
  if (!page) return null;
  const sections = (page.sections as unknown as Section[]) ?? [];
  return { page, sections, media: await getMediaMap(sectionMediaIds(sections)) };
}

// ───────────────────────── Projects ─────────────────────────

const cardSelect = {
  id: true,
  name: true,
  slug: true,
  city: true,
  address: true,
  market: true,
  category: true,
  constructionStatus: true,
  tagline: true,
  priceFrom: true,
  currency: true,
  showPrice: true,
  commercialStatus: true,
  keyFacts: true,
  latitude: true,
  longitude: true,
  cardImage: { select: mediaSelect },
  heroImage: { select: mediaSelect },
} satisfies Prisma.ProjectSelect;
type CardRow = Prisma.ProjectGetPayload<{ select: typeof cardSelect }>;

export interface ProjectCardData {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  category: ProjectCategoryValue;
  constructionStatus: ConstructionStatusValue;
  tagline: string;
  image: PublicMedia | null;
  price: { amount: number; currency: string } | null;
  facts: { label: string; value: string }[];
  latitude: number | null;
  longitude: number | null;
}

/** Commercial values are only shown when approved and not hidden by the editor. */
function approvedPrice(p: { priceFrom: number | null; currency: string | null; showPrice: boolean; commercialStatus: string }) {
  return p.showPrice && p.commercialStatus === "APPROVED" && p.priceFrom != null && p.currency
    ? { amount: p.priceFrom, currency: p.currency }
    : null;
}

function toCard(p: CardRow): ProjectCardData {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    city: p.city,
    address: p.address,
    category: p.category,
    constructionStatus: p.constructionStatus,
    tagline: p.tagline,
    image: toPublicMedia(p.cardImage ?? p.heroImage),
    price: approvedPrice(p),
    facts: ((p.keyFacts as { label: string; value: string }[]) ?? []).slice(0, 2),
    latitude: p.latitude,
    longitude: p.longitude,
  };
}

export async function listPublishedProjects(filter: { category?: ProjectCategoryValue; status?: ConstructionStatusValue; featured?: boolean; ids?: string[]; limit?: number; excludeId?: string } = {}) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.projects);
  const rows = await db.project.findMany({
    where: {
      ...live(),
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.status ? { constructionStatus: filter.status } : {}),
      ...(filter.featured ? { isFeatured: true } : {}),
      ...(filter.ids ? { id: { in: filter.ids } } : {}),
      ...(filter.excludeId ? { id: { not: filter.excludeId } } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    take: filter.limit,
    select: cardSelect,
  });
  const cards = rows.map(toCard);
  if (filter.ids) {
    const order = new Map(filter.ids.map((id, i) => [id, i]));
    cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  return cards;
}

export async function getPublishedProject(slug: string) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.projects, TAGS.updates, TAGS.locations);
  return loadProjectView({ slug });
}

/**
 * Builds the project detail view model. Public pages call it through the cached
 * getPublishedProject; CMS previews call it directly with preview=true so a
 * draft project can be reviewed in the real template (never cached).
 */
export async function loadProjectView(by: { slug?: string; id?: string }, preview = false) {
  const p = await db.project.findFirst({
    where: { ...(by.id ? { id: by.id } : { slug: by.slug }), ...(preview ? {} : live()) },
    include: {
      heroImage: { select: mediaSelect },
      cardImage: { select: mediaSelect },
      dldQrImage: { select: mediaSelect },
      location: { select: { name: true, slug: true, status: true } },
      gallery: { orderBy: { order: "asc" }, include: { media: { select: mediaSelect } } },
      floorPlans: { orderBy: { order: "asc" }, include: { image: { select: mediaSelect }, document: { select: mediaSelect } } },
      documents: { orderBy: { order: "asc" }, include: { media: { select: mediaSelect } } },
      vrTours: { where: { isActive: true }, orderBy: { order: "asc" }, include: { thumbnail: { select: mediaSelect } } },
      updates: {
        where: live(),
        orderBy: { date: "desc" },
        take: 1,
        include: { images: { orderBy: { order: "asc" }, take: 1, include: { media: { select: mediaSelect } } } },
      },
      related: { where: live(), select: cardSelect, take: 6 },
    },
  });
  if (!p) return null;

  let related = p.related.map(toCard);
  if (related.length === 0) {
    // Fall back to projects in the same city or category.
    const rows = await db.project.findMany({
      where: { ...live(), id: { not: p.id }, OR: [{ city: p.city }, { category: p.category }] },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      take: 3,
      select: cardSelect,
    });
    related = rows.map(toCard);
  }
  const updateCount = await db.projectUpdate.count({ where: { projectId: p.id, ...live() } });
  const commercialApproved = p.commercialStatus === "APPROVED";

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    constructionStatus: p.constructionStatus,
    market: p.market,
    city: p.city,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    tagline: p.tagline,
    overview: p.overview,
    heroImage: toPublicMedia(p.heroImage ?? p.cardImage),
    heroYoutubeId: p.heroYoutubeId,
    keyFacts: (p.keyFacts as { label: string; value: string }[]) ?? [],
    unitTypes: (p.unitTypes as { name: string; size: string; details: string }[]) ?? [],
    amenities: (p.amenities as { name: string; description: string }[]) ?? [],
    videos: (p.videos as { title: string; youtubeId: string }[]) ?? [],
    connectivity: (p.connectivity as { place: string; distance: string }[]) ?? [],
    commercial: {
      approved: commercialApproved,
      asOf: p.commercialAsOf,
      price: approvedPrice(p),
      handover: commercialApproved && p.showHandover ? p.handover : "",
      paymentPlanSummary: commercialApproved && p.showPaymentPlan ? p.paymentPlanSummary : "",
      paymentPlan:
        commercialApproved && p.showPaymentPlan
          ? ((p.paymentPlan as { milestone: string; percentage: number | null; note: string }[]) ?? [])
          : [],
    },
    compliance: { dldPermitNumber: p.dldPermitNumber, dldQr: toPublicMedia(p.dldQrImage), regulatoryApprovals: p.regulatoryApprovals },
    location: p.location?.status === "PUBLISHED" ? p.location : null,
    gallery: p.gallery.map((g) => ({ caption: g.caption, media: toPublicMedia(g.media)! })),
    floorPlans: p.floorPlans.map((f) => ({ id: f.id, title: f.title, unitType: f.unitType, size: f.size, gated: f.gated, image: toPublicMedia(f.image), document: toPublicMedia(f.document) })),
    documents: p.documents.map((d) => ({ id: d.id, title: d.title, kind: d.kind, gated: d.gated, media: toPublicMedia(d.media)! })),
    vrTours: p.vrTours.map((v) => ({ id: v.id, title: v.title, provider: v.provider, embedUrl: v.embedUrl, unitType: v.unitType, thumbnail: toPublicMedia(v.thumbnail) })),
    latestUpdate: p.updates[0]
      ? {
          title: p.updates[0].title,
          slug: p.updates[0].slug,
          date: p.updates[0].date,
          summary: p.updates[0].summary,
          progressPercent: p.updates[0].progressPercent,
          milestone: p.updates[0].milestone,
          image: toPublicMedia(p.updates[0].images[0]?.media),
        }
      : null,
    updateCount,
    related,
    seo: { title: p.seoTitle, description: p.seoDescription, noindex: p.noindex },
    updatedAt: p.updatedAt,
  };
}
export type PublicProject = NonNullable<Awaited<ReturnType<typeof loadProjectView>>>;

// ───────────────────────── Updates ─────────────────────────

export async function listPublishedUpdates(filter: { projectSlug?: string; year?: number; page?: number; pageSize?: number } = {}) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.updates);
  const pageSize = filter.pageSize ?? 12;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.ProjectUpdateWhereInput = {
    ...live(),
    project: { ...live(), ...(filter.projectSlug ? { slug: filter.projectSlug } : {}) },
    ...(filter.year ? { date: { gte: new Date(Date.UTC(filter.year, 0, 1)), lt: new Date(Date.UTC(filter.year + 1, 0, 1)) } } : {}),
  };
  const [rows, total, years] = await Promise.all([
    db.projectUpdate.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        project: { select: { name: true, slug: true } },
        images: { orderBy: { order: "asc" }, take: 1, include: { media: { select: mediaSelect } } },
      },
    }),
    db.projectUpdate.count({ where }),
    db.$queryRaw<{ year: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM u."date")::int AS year
      FROM "ProjectUpdate" u JOIN "Project" p ON p.id = u."projectId"
      WHERE u.status = 'PUBLISHED' AND u."publishedAt" <= now() AND p.status = 'PUBLISHED'
      ORDER BY year DESC`,
  ]);
  return {
    items: rows.map((u) => ({
      id: u.id,
      title: u.title,
      slug: u.slug,
      date: u.date,
      summary: u.summary,
      progressPercent: u.progressPercent,
      milestone: u.milestone,
      youtubeId: u.youtubeId,
      project: u.project,
      image: toPublicMedia(u.images[0]?.media),
    })),
    total,
    page,
    pageSize,
    years: years.map((y) => y.year),
  };
}

export async function getPublishedUpdate(slug: string) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.updates);
  const u = await db.projectUpdate.findFirst({
    where: { slug, ...live(), project: live() },
    include: {
      project: { select: { id: true, name: true, slug: true, city: true } },
      images: { orderBy: { order: "asc" }, include: { media: { select: mediaSelect } } },
    },
  });
  if (!u) return null;
  const [previous, next] = await Promise.all([
    db.projectUpdate.findFirst({ where: { projectId: u.projectId, ...live(), date: { lt: u.date } }, orderBy: { date: "desc" }, select: { slug: true, title: true } }),
    db.projectUpdate.findFirst({ where: { projectId: u.projectId, ...live(), date: { gt: u.date } }, orderBy: { date: "asc" }, select: { slug: true, title: true } }),
  ]);
  return {
    ...u,
    images: u.images.map((i) => ({ caption: i.caption, media: toPublicMedia(i.media)! })),
    previous,
    next,
  };
}

export async function listProjectsWithUpdates() {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.projects, TAGS.updates);
  return db.project.findMany({
    where: { ...live(), updates: { some: live() } },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });
}

// ───────────────────────── VR tours ─────────────────────────

export async function listActiveVrTours(limit?: number) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.projects);
  const tours = await db.vrTour.findMany({
    where: { isActive: true, project: live() },
    orderBy: [{ project: { sortOrder: "asc" } }, { order: "asc" }],
    take: limit,
    include: {
      thumbnail: { select: mediaSelect },
      project: { select: { name: true, slug: true, city: true, heroImage: { select: mediaSelect } } },
    },
  });
  return tours.map((t) => ({
    id: t.id,
    title: t.title,
    unitType: t.unitType,
    provider: t.provider,
    embedUrl: t.embedUrl,
    image: toPublicMedia(t.thumbnail ?? t.project.heroImage),
    project: { name: t.project.name, slug: t.project.slug, city: t.project.city },
  }));
}

// ───────────────────────── Locations ─────────────────────────

export async function listPublishedLocations() {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.locations, TAGS.projects); // counts live projects
  const rows = await db.location.findMany({
    where: live(),
    orderBy: { name: "asc" },
    include: { heroImage: { select: mediaSelect }, _count: { select: { projects: { where: live() } } } },
  });
  return rows.map((l) => ({ id: l.id, name: l.name, slug: l.slug, city: l.city, market: l.market, summary: l.summary, image: toPublicMedia(l.heroImage), projectCount: l._count.projects }));
}

export async function getPublishedLocation(slug: string) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.locations, TAGS.projects);
  const l = await db.location.findFirst({
    where: { slug, ...live() },
    include: { heroImage: { select: mediaSelect }, projects: { where: live(), select: cardSelect, orderBy: { sortOrder: "asc" } } },
  });
  if (!l) return null;
  return {
    ...l,
    heroImage: toPublicMedia(l.heroImage),
    landmarks: (l.landmarks as { name: string; distance: string }[]) ?? [],
    projects: l.projects.map(toCard),
  };
}

// ───────────────────────── Articles ─────────────────────────

export async function listPublishedArticles(filter: { category?: ArticleCategoryValue; page?: number; pageSize?: number } = {}) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.articles);
  const pageSize = filter.pageSize ?? 9;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.ArticleWhereInput = { ...live(), ...(filter.category ? { category: filter.category } : {}) };
  const [rows, total] = await Promise.all([
    db.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, title: true, slug: true, category: true, excerpt: true, publishedAt: true, eventDate: true, coverImage: { select: mediaSelect } },
    }),
    db.article.count({ where }),
  ]);
  return { items: rows.map((a) => ({ ...a, coverImage: toPublicMedia(a.coverImage) })), total, page, pageSize };
}

export async function getPublishedArticle(slug: string) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.articles);
  const a = await db.article.findFirst({
    where: { slug, ...live() },
    include: { coverImage: { select: mediaSelect }, author: { select: { name: true } } },
  });
  if (!a) return null;
  const related = await db.article.findMany({
    where: { ...live(), category: a.category, id: { not: a.id } },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { id: true, title: true, slug: true, category: true, excerpt: true, publishedAt: true, eventDate: true, coverImage: { select: mediaSelect } },
  });
  return { ...a, coverImage: toPublicMedia(a.coverImage), related: related.map((r) => ({ ...r, coverImage: toPublicMedia(r.coverImage) })) };
}

// ───────────────────────── Careers ─────────────────────────

export async function listPublishedVacancies() {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.vacancies);
  return db.vacancy.findMany({
    where: { ...live(), OR: [{ closesAt: null }, { closesAt: { gte: new Date() } }] },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, slug: true, department: true, location: true, employmentType: true, summary: true, closesAt: true, publishedAt: true },
  });
}

export async function getPublishedVacancy(slug: string) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.vacancies);
  const v = await db.vacancy.findFirst({ where: { slug, ...live() } });
  return v ? { ...v, isOpen: !v.closesAt || v.closesAt >= new Date(Date.now() - 24 * 3600 * 1000) } : null;
}

// ───────────────────────── FAQs ─────────────────────────

export async function listPublishedFaqs(category?: string) {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.faqs);
  return db.faq.findMany({
    where: { isPublished: true, ...(category ? { category } : {}) },
    orderBy: [{ category: "asc" }, { order: "asc" }],
    select: { id: true, question: true, answer: true, category: true },
  });
}

// ───────────────────────── Sitemap ─────────────────────────

export async function getSitemapEntries() {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site);
  const [pages, projects, updates, locations, articles, vacancies] = await Promise.all([
    db.page.findMany({ where: { ...live(), noindex: false }, select: { slug: true, updatedAt: true } }),
    db.project.findMany({ where: { ...live(), noindex: false }, select: { slug: true, updatedAt: true } }),
    db.projectUpdate.findMany({ where: { ...live(), project: live() }, select: { slug: true, updatedAt: true } }),
    db.location.findMany({ where: live(), select: { slug: true, updatedAt: true } }),
    db.article.findMany({ where: live(), select: { slug: true, updatedAt: true } }),
    db.vacancy.findMany({ where: live(), select: { slug: true, updatedAt: true } }),
  ]);
  return { pages, projects, updates, locations, articles, vacancies };
}

// ───────────────────────── Redirects ─────────────────────────

/** All redirects as a map (small table), cached so 404 handling stays cheap. */
export async function getRedirectMap(): Promise<Record<string, { to: string; permanent: boolean }>> {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site, TAGS.redirects);
  const rows = await db.redirect.findMany({ select: { fromPath: true, toPath: true, permanent: true } });
  return Object.fromEntries(rows.map((r) => [r.fromPath, { to: r.toPath, permanent: r.permanent }]));
}

/** Published slugs for generateStaticParams (Cache Components requires at least one value). */
export async function publishedSlugs(kind: "pages" | "projects" | "updates" | "locations" | "articles" | "vacancies") {
  "use cache";
  cacheLife("content");
  cacheTag(TAGS.site);
  const where = live();
  const rows =
    kind === "pages" ? await db.page.findMany({ where, select: { slug: true } })
    : kind === "projects" ? await db.project.findMany({ where, select: { slug: true } })
    : kind === "updates" ? await db.projectUpdate.findMany({ where, select: { slug: true }, take: 200, orderBy: { date: "desc" } })
    : kind === "locations" ? await db.location.findMany({ where, select: { slug: true } })
    : kind === "articles" ? await db.article.findMany({ where, select: { slug: true }, take: 200, orderBy: { publishedAt: "desc" } })
    : await db.vacancy.findMany({ where, select: { slug: true } });
  return rows.map((r) => r.slug);
}
