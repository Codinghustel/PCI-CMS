import { Pool } from "pg";

// Lightweight index of live public URLs and redirects, used by the proxy to
// return real HTTP statuses (301/302 redirects and 404s) before a streamed
// page response starts. It deliberately uses a tiny `pg` pool and static
// queries (no user input) instead of the full Prisma client, and refreshes on
// a short TTL so publishing changes are picked up within seconds.

const TTL_MS = 15_000;

export interface RoutingIndex {
  loadedAt: number;
  redirects: Map<string, { to: string; permanent: boolean }>;
  pages: Set<string>;
  projects: Set<string>;
  updates: Set<string>;
  locations: Set<string>;
  articles: Set<string>;
  vacancies: Set<string>;
}

let pool: Pool | undefined;
let current: RoutingIndex | undefined;
let loading: Promise<RoutingIndex> | undefined;

function getPool() {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 30_000, options: "-c TimeZone=UTC" });
  return pool;
}

const LIVE = `status = 'PUBLISHED' AND "publishedAt" <= now()`;

async function load(): Promise<RoutingIndex> {
  const p = getPool();
  const slugs = async (sql: string) => new Set((await p.query<{ slug: string }>(sql)).rows.map((r) => r.slug));
  const [redirects, pages, projects, updates, locations, articles, vacancies] = await Promise.all([
    p.query<{ fromPath: string; toPath: string; permanent: boolean }>(`SELECT "fromPath", "toPath", permanent FROM "Redirect"`),
    slugs(`SELECT slug FROM "Page" WHERE ${LIVE}`),
    slugs(`SELECT slug FROM "Project" WHERE ${LIVE}`),
    slugs(`SELECT u.slug FROM "ProjectUpdate" u JOIN "Project" p ON p.id = u."projectId" WHERE u.status = 'PUBLISHED' AND u."publishedAt" <= now() AND p.status = 'PUBLISHED' AND p."publishedAt" <= now()`),
    slugs(`SELECT slug FROM "Location" WHERE ${LIVE}`),
    slugs(`SELECT slug FROM "Article" WHERE ${LIVE}`),
    slugs(`SELECT slug FROM "Vacancy" WHERE ${LIVE}`),
  ]);
  return {
    loadedAt: Date.now(),
    redirects: new Map(redirects.rows.map((r) => [r.fromPath, { to: r.toPath, permanent: r.permanent }])),
    pages,
    projects,
    updates,
    locations,
    articles,
    vacancies,
  };
}

export async function getRoutingIndex(opts: { maxAgeMs?: number } = {}): Promise<RoutingIndex | null> {
  const maxAge = opts.maxAgeMs ?? TTL_MS;
  if (current && Date.now() - current.loadedAt < maxAge) return current;
  try {
    loading ??= load().finally(() => (loading = undefined));
    current = await loading;
    return current;
  } catch (e) {
    console.error("[routing-index] refresh failed", (e as Error).message);
    // Fail open: let the page render (it will soft-404 if needed).
    return current ?? null;
  }
}

/** Static application routes that are not backed by a slug. */
const STATIC_ROUTES = new Set([
  "/",
  "/projects",
  "/project-updates",
  "/locations",
  "/vr-tours",
  "/media",
  "/careers",
  "/pay-my-installment",
  "/pay-my-installment/status",
  "/thank-you",
  "/page-not-found",
]);

export type RouteDecision = { kind: "pass" } | { kind: "redirect"; to: string; permanent: boolean } | { kind: "missing" };

/** Decides how the proxy should treat a public path. Pure apart from the index. */
export function decide(pathname: string, index: RoutingIndex): RouteDecision {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "").toLowerCase() : "/";
  const redirect = index.redirects.get(path);
  if (redirect) return { kind: "redirect", ...redirect };
  if (STATIC_ROUTES.has(path)) return { kind: "pass" };

  const [, first, second, ...rest] = path.split("/");
  const detail: Record<string, Set<string>> = {
    projects: index.projects,
    "project-updates": index.updates,
    locations: index.locations,
    media: index.articles,
    careers: index.vacancies,
  };
  if (first in detail) {
    return second && rest.length === 0 && detail[first].has(decodeURIComponent(second)) ? { kind: "pass" } : { kind: "missing" };
  }
  const slug = path.slice(1);
  return index.pages.has(slug) && slug !== "home" ? { kind: "pass" } : { kind: "missing" };
}
