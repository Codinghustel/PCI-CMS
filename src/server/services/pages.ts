import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { ConflictError, NotFoundError, ValidationError, mapPrismaError } from "@/server/errors";
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
import { pageInputSchema, type PageInput } from "@/lib/validation/content";
import { validateSections, type Section } from "@/lib/sections/registry";
import { sanitizeRichText } from "@/lib/sanitize";
import { isReservedPageSlug } from "@/lib/text";
import type { Actor } from "@/lib/auth/permissions";
import type { PublishStatusValue } from "@/lib/content-labels";

const MAX_REVISIONS = 30;

export async function listPages(params: ListParams) {
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where: Prisma.PageWhereInput = {
    ...(params.status ? { status: params.status as PublishStatusValue } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.page.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        authorId: true,
        author: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    }),
    db.page.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getPageForEdit(id: string) {
  const page = await db.page.findUnique({
    where: { id },
    include: { author: { select: { name: true } }, updatedBy: { select: { name: true } } },
  });
  if (!page) throw new NotFoundError("Page not found");
  return page;
}

function prepare(input: unknown): PageInput & { sections: Section[] } {
  const data = parseInput(pageInputSchema, input);
  if (isReservedPageSlug(data.slug) && data.slug !== "home") {
    throw new ValidationError("This URL is reserved by the website.", {
      slug: ["This URL is used by a built-in section of the website. Choose another slug."],
    });
  }
  const sections = validateSections(data.sections, sanitizeRichText);
  if (!sections.success) throw new ValidationError("Some blocks have invalid content.", sections.errors);
  return { ...data, sections: sections.sections };
}

function snapshot(page: { title: string; slug: string; sections: unknown; excerpt: string; seoTitle: string; seoDescription: string; featuredImageId: string | null; ogImageId: string | null; canonicalUrl: string; noindex: boolean }) {
  return {
    title: page.title,
    slug: page.slug,
    sections: page.sections,
    excerpt: page.excerpt,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    featuredImageId: page.featuredImageId,
    ogImageId: page.ogImageId,
    canonicalUrl: page.canonicalUrl,
    noindex: page.noindex,
  } as Prisma.InputJsonObject;
}

export async function createPage(actor: Actor, input: unknown) {
  assertCanCreate(actor);
  const data = prepare(input);
  try {
    return await db.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          ...data,
          sections: data.sections as unknown as Prisma.InputJsonValue,
          status: "DRAFT",
          authorId: actor.id,
          updatedById: actor.id,
        },
      });
      await tx.pageRevision.create({
        data: { pageId: page.id, title: page.title, snapshot: snapshot(page), note: "Created", createdById: actor.id },
      });
      await audit(actor, { action: "page.create", entityType: "Page", entityId: page.id, summary: `Created page "${page.title}"` }, tx);
      return page;
    });
  } catch (e) {
    mapPrismaError(e, { slug: "URL slug" });
  }
}

export async function updatePage(actor: Actor, id: string, input: unknown, action: WorkflowAction = "save", publishAt?: Date | null) {
  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Page not found");
  assertCanEdit(actor, existing);
  const data = prepare(input);
  const status = nextStatus(actor, existing.status, action);
  const previousSlug = existing.slug;

  try {
    const page = await db.$transaction(async (tx) => {
      const page = await tx.page.update({
        where: { id },
        data: {
          ...data,
          sections: data.sections as unknown as Prisma.InputJsonValue,
          status,
          publishedAt: resolvePublishedAt(status, existing.publishedAt, publishAt),
          updatedById: actor.id,
        },
      });
      await tx.pageRevision.create({
        data: { pageId: id, title: page.title, snapshot: snapshot(page), note: actionNote(action), createdById: actor.id },
      });
      // Keep revision history bounded.
      const old = await tx.pageRevision.findMany({
        where: { pageId: id },
        orderBy: { createdAt: "desc" },
        skip: MAX_REVISIONS,
        select: { id: true },
      });
      if (old.length) await tx.pageRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });

      // Preserve SEO equity: when a published page's URL changes, redirect the old URL.
      if (existing.status === "PUBLISHED" && previousSlug !== page.slug) {
        await tx.redirect.upsert({
          where: { fromPath: `/${previousSlug}` },
          update: { toPath: `/${page.slug}`, permanent: true },
          create: { fromPath: `/${previousSlug}`, toPath: `/${page.slug}`, permanent: true, note: "Automatic: page URL changed" },
        });
      }
      await audit(actor, { action: `page.${action}`, entityType: "Page", entityId: id, summary: `${actionNote(action)}: "${page.title}"` }, tx);
      return page;
    });
    return { page, previousSlug };
  } catch (e) {
    mapPrismaError(e, { slug: "URL slug" });
  }
}

export async function setPageStatus(actor: Actor, id: string, action: WorkflowAction) {
  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Page not found");
  assertCanEdit(actor, existing);
  const status = nextStatus(actor, existing.status, action);
  const page = await db.page.update({
    where: { id },
    data: { status, publishedAt: resolvePublishedAt(status, existing.publishedAt), updatedById: actor.id },
  });
  await audit(actor, { action: `page.${action}`, entityType: "Page", entityId: id, summary: `${actionNote(action)}: "${page.title}"` });
  return page;
}

export async function deletePage(actor: Actor, id: string) {
  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Page not found");
  if (existing.slug === "home") throw new ConflictError("The homepage cannot be deleted.");
  assertCanDelete(actor, existing);
  await db.$transaction(async (tx) => {
    await tx.page.delete({ where: { id } });
    await audit(actor, { action: "page.delete", entityType: "Page", entityId: id, summary: `Deleted page "${existing.title}"` }, tx);
  });
  return existing;
}

export async function duplicatePage(actor: Actor, id: string) {
  assertCanCreate(actor);
  const source = await db.page.findUnique({ where: { id } });
  if (!source) throw new NotFoundError("Page not found");
  let slug = `${source.slug}-copy`;
  for (let i = 2; await db.page.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${source.slug}-copy-${i}`;
  const page = await db.page.create({
    data: {
      title: `${source.title} (copy)`,
      slug,
      sections: source.sections as Prisma.InputJsonValue,
      excerpt: source.excerpt,
      featuredImageId: source.featuredImageId,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      ogImageId: source.ogImageId,
      noindex: source.noindex,
      status: "DRAFT",
      authorId: actor.id,
      updatedById: actor.id,
    },
  });
  await audit(actor, { action: "page.duplicate", entityType: "Page", entityId: page.id, summary: `Duplicated "${source.title}"` });
  return page;
}

export async function listRevisions(pageId: string) {
  return db.pageRevision.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, note: true, createdAt: true, createdBy: { select: { name: true } } },
  });
}

/** Restores a revision's content into the page as a draft-level edit. */
export async function restoreRevision(actor: Actor, pageId: string, revisionId: string) {
  const [page, revision] = await Promise.all([
    db.page.findUnique({ where: { id: pageId } }),
    db.pageRevision.findUnique({ where: { id: revisionId } }),
  ]);
  if (!page || !revision || revision.pageId !== pageId) throw new NotFoundError("Revision not found");
  assertCanEdit(actor, page);
  const snap = revision.snapshot as Record<string, unknown>;
  const result = await updatePage(actor, pageId, { ...snap, slug: page.slug }, "save");
  await audit(actor, { action: "page.restore", entityType: "Page", entityId: pageId, summary: `Restored revision from ${revision.createdAt.toISOString()}` });
  return result;
}

function actionNote(action: WorkflowAction) {
  return {
    save: "Saved",
    submit: "Submitted for review",
    publish: "Published",
    unpublish: "Unpublished",
    revert_to_draft: "Reverted to draft",
  }[action];
}
