import { db } from "@/server/db";
import { getSettings } from "@/server/services/site";
import { leadStats } from "@/server/services/leads";

/** Dashboard metrics and data-quality warnings (stale commercial data / updates, approvals). */
export async function getDashboard() {
  const settings = await getSettings();
  const commercialDays = settings.quality.commercialStaleDays ?? 90;
  const updateDays = settings.quality.updateStaleDays ?? 60;
  const now = Date.now();

  const [pageCounts, projectCounts, updatesPublished, inReview, recentPages, recentProjects, pendingApprovals, leads, ongoing] = await Promise.all([
    db.page.groupBy({ by: ["status"], _count: true }),
    db.project.groupBy({ by: ["status"], _count: true }),
    db.projectUpdate.count({ where: { status: "PUBLISHED" } }),
    Promise.all([
      db.page.findMany({ where: { status: "IN_REVIEW" }, select: { id: true, title: true, updatedAt: true } }),
      db.project.findMany({ where: { status: "IN_REVIEW" }, select: { id: true, name: true, updatedAt: true } }),
      db.projectUpdate.findMany({ where: { status: "IN_REVIEW" }, select: { id: true, title: true, updatedAt: true } }),
      db.article.findMany({ where: { status: "IN_REVIEW" }, select: { id: true, title: true, updatedAt: true } }),
    ]),
    db.page.findMany({ orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, title: true, status: true, updatedAt: true, updatedBy: { select: { name: true } } } }),
    db.project.findMany({ orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, name: true, status: true, updatedAt: true } }),
    db.project.findMany({ where: { commercialStatus: "PENDING" }, select: { id: true, name: true, updatedAt: true } }),
    leadStats(),
    db.project.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        constructionStatus: true,
        commercialStatus: true,
        commercialAsOf: true,
        priceFrom: true,
        market: true,
        dldPermitNumber: true,
        updates: { where: { status: "PUBLISHED" }, orderBy: { date: "desc" }, take: 1, select: { date: true } },
      },
    }),
  ]);

  const count = (rows: { status: string; _count: number }[], status?: string) =>
    rows.filter((r) => !status || r.status === status).reduce((a, r) => a + r._count, 0);

  const warnings: { id: string; name: string; message: string; href: string }[] = [];
  for (const p of ongoing) {
    if (p.commercialStatus === "APPROVED" && p.commercialAsOf && now - p.commercialAsOf.getTime() > commercialDays * 86400_000) {
      warnings.push({ id: p.id, name: p.name, message: `Commercial details approved over ${commercialDays} days ago — review price and payment plan.`, href: `/admin/projects/${p.id}` });
    }
    if (p.constructionStatus === "ONGOING") {
      const last = p.updates[0]?.date;
      if (!last) warnings.push({ id: p.id, name: p.name, message: "No published construction update.", href: `/admin/updates/new?projectId=${p.id}` });
      else if (now - last.getTime() > updateDays * 86400_000) {
        warnings.push({ id: p.id, name: p.name, message: `Latest construction update is older than ${updateDays} days.`, href: `/admin/updates/new?projectId=${p.id}` });
      }
    }
    if (p.market === "UAE" && !p.dldPermitNumber) {
      warnings.push({ id: p.id, name: p.name, message: "Published UAE project without a DLD permit number.", href: `/admin/projects/${p.id}` });
    }
  }

  const [pr, pj, up, ar] = inReview;
  return {
    stats: {
      pagesPublished: count(pageCounts, "PUBLISHED"),
      pagesTotal: count(pageCounts),
      projectsPublished: count(projectCounts, "PUBLISHED"),
      projectsTotal: count(projectCounts),
      updatesPublished,
      ...leads,
    },
    review: [
      ...pr.map((x) => ({ label: x.title, type: "Page", href: `/admin/pages/${x.id}`, updatedAt: x.updatedAt })),
      ...pj.map((x) => ({ label: x.name, type: "Project", href: `/admin/projects/${x.id}`, updatedAt: x.updatedAt })),
      ...up.map((x) => ({ label: x.title, type: "Update", href: `/admin/updates/${x.id}`, updatedAt: x.updatedAt })),
      ...ar.map((x) => ({ label: x.title, type: "Article", href: `/admin/articles/${x.id}`, updatedAt: x.updatedAt })),
    ],
    pendingApprovals,
    recentPages,
    recentProjects,
    warnings,
  };
}
