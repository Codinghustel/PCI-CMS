import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { NotFoundError, mapPrismaError } from "@/server/errors";
import {
  assertCanCreate,
  assertCanDelete,
  assertCanEdit,
  nextStatus,
  normalizeList,
  parseInput,
  resolvePublishedAt,
  type ListParams,
  type WorkflowAction,
} from "@/server/services/helpers";
import {
  articleInputSchema,
  faqInputSchema,
  locationInputSchema,
  projectUpdateInputSchema,
  vacancyInputSchema,
} from "@/lib/validation/content";
import { sanitizeRichText } from "@/lib/sanitize";
import { can, type Actor } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/server/errors";
import type { PublishStatusValue } from "@/lib/content-labels";

// Services for the simpler content types: construction updates, locations,
// media articles, vacancies and FAQs. Same workflow rules as pages/projects.

const SLUG_LABEL = { slug: "URL slug" };

// ───────────────────────── Project updates ─────────────────────────

export async function listProjectUpdates(params: ListParams & { projectId?: string }) {
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where: Prisma.ProjectUpdateWhereInput = {
    ...(params.status ? { status: params.status as PublishStatusValue } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    db.projectUpdate.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take,
      select: { id: true, title: true, slug: true, date: true, status: true, progressPercent: true, authorId: true, updatedAt: true, project: { select: { name: true } } },
    }),
    db.projectUpdate.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getProjectUpdateForEdit(id: string) {
  const item = await db.projectUpdate.findUnique({ where: { id }, include: { images: { orderBy: { order: "asc" } } } });
  if (!item) throw new NotFoundError("Update not found");
  return item;
}

export async function saveProjectUpdate(actor: Actor, id: string | null, input: unknown, action: WorkflowAction = "save") {
  const existing = id ? await db.projectUpdate.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new NotFoundError("Update not found");
  if (existing) assertCanEdit(actor, existing);
  else assertCanCreate(actor);
  const { images, projectId, ...data } = parseInput(projectUpdateInputSchema, input);
  const status = nextStatus(actor, existing?.status ?? "DRAFT", action);
  try {
    return await db.$transaction(async (tx) => {
      const values = {
        ...data,
        body: sanitizeRichText(data.body),
        status,
        publishedAt: resolvePublishedAt(status, existing?.publishedAt ?? null),
        project: { connect: { id: projectId } },
      };
      const item = existing
        ? await tx.projectUpdate.update({ where: { id: existing.id }, data: values })
        : await tx.projectUpdate.create({ data: { ...values, author: { connect: { id: actor.id } } } });
      await tx.projectUpdateImage.deleteMany({ where: { updateId: item.id } });
      if (images.length) {
        await tx.projectUpdateImage.createMany({ data: images.map((img, order) => ({ ...img, updateId: item.id, order })) });
      }
      await audit(actor, { action: `update.${existing ? action : "create"}`, entityType: "ProjectUpdate", entityId: item.id, summary: `${existing ? action : "Created"} update "${item.title}"` }, tx);
      return item;
    });
  } catch (e) {
    mapPrismaError(e, SLUG_LABEL);
  }
}

export async function deleteProjectUpdate(actor: Actor, id: string) {
  const existing = await db.projectUpdate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Update not found");
  assertCanDelete(actor, existing);
  await db.projectUpdate.delete({ where: { id } });
  await audit(actor, { action: "update.delete", entityType: "ProjectUpdate", entityId: id, summary: `Deleted update "${existing.title}"` });
  return existing;
}

// ───────────────────────── Locations ─────────────────────────

export async function listLocations(params: ListParams) {
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where: Prisma.LocationWhereInput = q ? { name: { contains: q, mode: "insensitive" } } : {};
  const [items, total] = await Promise.all([
    db.location.findMany({ where, orderBy: { name: "asc" }, skip, take, include: { _count: { select: { projects: true } } } }),
    db.location.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getLocationForEdit(id: string) {
  const item = await db.location.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Location not found");
  return item;
}

export async function saveLocation(actor: Actor, id: string | null, input: unknown, action: WorkflowAction = "save") {
  if (!can(actor, "content.write")) throw new ForbiddenError("Only editors can manage locations.");
  const existing = id ? await db.location.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new NotFoundError("Location not found");
  const data = parseInput(locationInputSchema, input);
  const status = nextStatus(actor, existing?.status ?? "DRAFT", action);
  const values = {
    ...data,
    overview: sanitizeRichText(data.overview),
    landmarks: data.landmarks as Prisma.InputJsonValue,
    status,
    publishedAt: resolvePublishedAt(status, existing?.publishedAt ?? null),
  };
  try {
    const item = existing
      ? await db.location.update({ where: { id: existing.id }, data: values })
      : await db.location.create({ data: values });
    await audit(actor, { action: `location.${existing ? action : "create"}`, entityType: "Location", entityId: item.id, summary: `${existing ? action : "Created"} location "${item.name}"` });
    return item;
  } catch (e) {
    mapPrismaError(e, SLUG_LABEL);
  }
}

export async function deleteLocation(actor: Actor, id: string) {
  if (!can(actor, "content.delete")) throw new ForbiddenError();
  const existing = await db.location.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Location not found");
  await db.location.delete({ where: { id } });
  await audit(actor, { action: "location.delete", entityType: "Location", entityId: id, summary: `Deleted location "${existing.name}"` });
  return existing;
}

export async function listLocationOptions() {
  return db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// ───────────────────────── Articles ─────────────────────────

export async function listArticles(params: ListParams & { category?: string }) {
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where: Prisma.ArticleWhereInput = {
    ...(params.status ? { status: params.status as PublishStatusValue } : {}),
    ...(params.category ? { category: params.category as Prisma.ArticleWhereInput["category"] & string } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    db.article.findMany({
      where,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }],
      skip,
      take,
      select: { id: true, title: true, slug: true, category: true, status: true, publishedAt: true, updatedAt: true, authorId: true },
    }),
    db.article.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getArticleForEdit(id: string) {
  const item = await db.article.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Article not found");
  return item;
}

export async function saveArticle(actor: Actor, id: string | null, input: unknown, action: WorkflowAction = "save") {
  const existing = id ? await db.article.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new NotFoundError("Article not found");
  if (existing) assertCanEdit(actor, existing);
  else assertCanCreate(actor);
  const { publishedAt, ...data } = parseInput(articleInputSchema, input);
  const status = nextStatus(actor, existing?.status ?? "DRAFT", action);
  const values = {
    ...data,
    body: sanitizeRichText(data.body),
    status,
    // A future publication date schedules the article.
    publishedAt: resolvePublishedAt(status, existing?.publishedAt ?? null, publishedAt),
  };
  try {
    const item = existing
      ? await db.article.update({ where: { id: existing.id }, data: values })
      : await db.article.create({ data: { ...values, authorId: actor.id } });
    await audit(actor, { action: `article.${existing ? action : "create"}`, entityType: "Article", entityId: item.id, summary: `${existing ? action : "Created"} article "${item.title}"` });
    return item;
  } catch (e) {
    mapPrismaError(e, SLUG_LABEL);
  }
}

export async function deleteArticle(actor: Actor, id: string) {
  const existing = await db.article.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Article not found");
  assertCanDelete(actor, existing);
  await db.article.delete({ where: { id } });
  await audit(actor, { action: "article.delete", entityType: "Article", entityId: id, summary: `Deleted article "${existing.title}"` });
  return existing;
}

// ───────────────────────── Vacancies & applications ─────────────────────────

export async function listVacancies(params: ListParams) {
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where: Prisma.VacancyWhereInput = q ? { title: { contains: q, mode: "insensitive" } } : {};
  const [items, total] = await Promise.all([
    db.vacancy.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take, include: { _count: { select: { applications: true } } } }),
    db.vacancy.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getVacancyForEdit(id: string) {
  const item = await db.vacancy.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Vacancy not found");
  return item;
}

export async function saveVacancy(actor: Actor, id: string | null, input: unknown, action: WorkflowAction = "save") {
  if (!can(actor, "content.write")) throw new ForbiddenError("Only editors can manage vacancies.");
  const existing = id ? await db.vacancy.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new NotFoundError("Vacancy not found");
  const data = parseInput(vacancyInputSchema, input);
  const status = nextStatus(actor, existing?.status ?? "DRAFT", action);
  const values = { ...data, description: sanitizeRichText(data.description), status, publishedAt: resolvePublishedAt(status, existing?.publishedAt ?? null) };
  try {
    const item = existing ? await db.vacancy.update({ where: { id: existing.id }, data: values }) : await db.vacancy.create({ data: values });
    await audit(actor, { action: `vacancy.${existing ? action : "create"}`, entityType: "Vacancy", entityId: item.id, summary: `${existing ? action : "Created"} vacancy "${item.title}"` });
    return item;
  } catch (e) {
    mapPrismaError(e, SLUG_LABEL);
  }
}

export async function deleteVacancy(actor: Actor, id: string) {
  if (!can(actor, "content.delete")) throw new ForbiddenError();
  const existing = await db.vacancy.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Vacancy not found");
  await db.vacancy.delete({ where: { id } });
  await audit(actor, { action: "vacancy.delete", entityType: "Vacancy", entityId: id, summary: `Deleted vacancy "${existing.title}"` });
  return existing;
}

export async function listApplications(actor: Actor, params: ListParams & { vacancyId?: string }) {
  if (!can(actor, "applications.read")) throw new ForbiddenError();
  const { skip, take, page, pageSize } = normalizeList(params);
  const where: Prisma.JobApplicationWhereInput = params.vacancyId ? { vacancyId: params.vacancyId } : {};
  const [items, total] = await Promise.all([
    db.jobApplication.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { vacancy: { select: { title: true } } } }),
    db.jobApplication.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// ───────────────────────── FAQs ─────────────────────────

export async function listFaqs() {
  return db.faq.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
}

export async function saveFaq(actor: Actor, id: string | null, input: unknown) {
  if (!can(actor, "content.write")) throw new ForbiddenError("Only editors can manage FAQs.");
  const data = parseInput(faqInputSchema, input);
  const values = { ...data, answer: sanitizeRichText(data.answer) };
  const item = id ? await db.faq.update({ where: { id }, data: values }) : await db.faq.create({ data: values });
  await audit(actor, { action: id ? "faq.update" : "faq.create", entityType: "Faq", entityId: item.id, summary: `Saved FAQ "${item.question.slice(0, 80)}"` });
  return item;
}

export async function deleteFaq(actor: Actor, id: string) {
  if (!can(actor, "content.delete")) throw new ForbiddenError();
  const existing = await db.faq.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("FAQ not found");
  await db.faq.delete({ where: { id } });
  await audit(actor, { action: "faq.delete", entityType: "Faq", entityId: id, summary: `Deleted FAQ "${existing.question.slice(0, 80)}"` });
}
