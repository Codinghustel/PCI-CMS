import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, mapPrismaError } from "@/server/errors";
import {
  assertCanCreate,
  assertCanDelete,
  assertCanEdit,
  nextStatus,
  normalizeList,
  parseInput,
  resolvePublishedAt,
  statusFilter,
  type ListParams,
  type WorkflowAction,
} from "@/server/services/helpers";
import { projectInputSchema, type ProjectInput } from "@/lib/validation/content";
import { sanitizeRichText } from "@/lib/sanitize";
import { can, type Actor } from "@/lib/auth/permissions";
import { CONSTRUCTION_STATUSES, MARKETS, PROJECT_CATEGORIES } from "@/lib/content-labels";
import { slugify } from "@/lib/text";
import { z } from "zod";

export const projectEditInclude = {
  gallery: { orderBy: { order: "asc" } },
  floorPlans: { orderBy: { order: "asc" } },
  documents: { orderBy: { order: "asc" } },
  vrTours: { orderBy: { order: "asc" } },
  related: { select: { id: true, name: true } },
  commercialApprovedBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  location: { select: { id: true, name: true } },
  updates: { orderBy: { date: "desc" }, take: 1, select: { date: true, title: true } },
} satisfies Prisma.ProjectInclude;

export async function listProjects(params: ListParams & { category?: string }) {
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where: Prisma.ProjectWhereInput = {
    ...statusFilter(params.status),
    ...(params.category && (PROJECT_CATEGORIES as readonly string[]).includes(params.category)
      ? { category: params.category as (typeof PROJECT_CATEGORIES)[number] }
      : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      skip,
      take,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        category: true,
        constructionStatus: true,
        market: true,
        city: true,
        isFeatured: true,
        commercialStatus: true,
        commercialAsOf: true,
        updatedAt: true,
        authorId: true,
        cardImage: { select: { storageKey: true, alt: true } },
        heroImage: { select: { storageKey: true, alt: true } },
      },
    }),
    db.project.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function listProjectOptions() {
  return db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, status: true } });
}

export async function getProjectForEdit(id: string) {
  const project = await db.project.findUnique({ where: { id }, include: projectEditInclude });
  if (!project) throw new NotFoundError("Project not found");
  return project;
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.enum(PROJECT_CATEGORIES, { error: "Choose a category" }),
  constructionStatus: z.enum(CONSTRUCTION_STATUSES, { error: "Choose a status" }),
  market: z.enum(MARKETS, { error: "Choose a market" }),
  city: z.string().trim().min(1, "City is required").max(80),
});

export async function createProject(actor: Actor, input: unknown) {
  assertCanCreate(actor);
  const data = parseInput(createSchema, input);
  const base = slugify(data.name) || "project";
  let slug = base;
  for (let i = 2; await db.project.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  const project = await db.project.create({
    data: { ...data, slug, status: "DRAFT", authorId: actor.id, updatedById: actor.id },
  });
  await audit(actor, { action: "project.create", entityType: "Project", entityId: project.id, summary: `Created project "${project.name}"` });
  return project;
}

/** Fields whose change requires fresh commercial approval. */
const COMMERCIAL_KEYS = ["priceFrom", "currency", "handover", "paymentPlanSummary", "paymentPlan"] as const;

// jsonb reorders object keys, while Zod output keeps schema order and may omit optional keys —
// so compare a canonical form (sorted keys, null/undefined entries removed).
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .filter((k) => obj[k] != null)
        .sort()
        .map((k) => [k, canonical(obj[k])]),
    );
  }
  return value ?? null;
}

function commercialFingerprint(p: Pick<ProjectInput, (typeof COMMERCIAL_KEYS)[number]>) {
  return JSON.stringify(COMMERCIAL_KEYS.map((k) => canonical(p[k] ?? null)));
}

type PublishCheckable = {
  name: string;
  market: string;
  city: string;
  category: string | null;
  constructionStatus: string | null;
  heroImageId: string | null;
  overview: string;
  dldPermitNumber: string;
  dldQrImageId: string | null;
};

/**
 * Mandatory fields before a project may be published. UAE (Dubai) projects
 * must show the DLD advertising permit number and QR code.
 */
export function projectPublishIssues(p: PublishCheckable): string[] {
  const issues: string[] = [];
  if (!p.city) issues.push("Add the city / location.");
  if (!p.category) issues.push("Choose a category.");
  if (!p.constructionStatus) issues.push("Choose a construction status.");
  if (!p.heroImageId) issues.push("Add a hero image.");
  if (!p.overview || p.overview.replace(/<[^>]+>/g, "").trim().length < 40) issues.push("Write a project overview (at least a few sentences).");
  if (p.market === "UAE") {
    if (!p.dldPermitNumber) issues.push("UAE projects require the DLD advertising permit number.");
    if (!p.dldQrImageId) issues.push("UAE projects require the DLD permit QR code image.");
  }
  return issues;
}

export async function updateProject(actor: Actor, id: string, input: unknown, action: WorkflowAction = "save") {
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Project not found");
  assertCanEdit(actor, existing);
  const data = parseInput(projectInputSchema, input);
  const status = nextStatus(actor, existing.status, action);

  if (status === "PUBLISHED") {
    const issues = projectPublishIssues({ ...data, overview: data.overview });
    if (issues.length) throw new ValidationError(`This project cannot be published yet: ${issues.join(" ")}`, { _publish: issues });
  }
  if (data.relatedProjectIds.includes(id)) {
    throw new ValidationError("A project cannot be related to itself.", { relatedProjectIds: ["Remove this project from its own related list."] });
  }

  // Commercial details changed → approval must be given again.
  const commercialChanged =
    commercialFingerprint(data) !==
    commercialFingerprint({
      priceFrom: existing.priceFrom,
      currency: existing.currency,
      handover: existing.handover,
      paymentPlanSummary: existing.paymentPlanSummary,
      paymentPlan: existing.paymentPlan as ProjectInput["paymentPlan"],
    });
  const hasCommercial = data.priceFrom != null || !!data.handover || data.paymentPlan.length > 0 || !!data.paymentPlanSummary;
  const commercialUpdate: Prisma.ProjectUpdateInput = commercialChanged
    ? {
        commercialStatus: hasCommercial ? "PENDING" : "NOT_SUBMITTED",
        commercialApprovedBy: { disconnect: true },
        commercialApprovedAt: null,
        commercialAsOf: null,
      }
    : {};

  const { gallery, floorPlans, documents, vrTours, relatedProjectIds, locationId, heroImageId, cardImageId, dldQrImageId, ...scalar } = data;

  try {
    return await db.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: {
          ...scalar,
          overview: sanitizeRichText(scalar.overview),
          keyFacts: scalar.keyFacts as Prisma.InputJsonValue,
          unitTypes: scalar.unitTypes as Prisma.InputJsonValue,
          amenities: scalar.amenities as Prisma.InputJsonValue,
          videos: scalar.videos as Prisma.InputJsonValue,
          connectivity: scalar.connectivity as Prisma.InputJsonValue,
          paymentPlan: scalar.paymentPlan as Prisma.InputJsonValue,
          location: locationId ? { connect: { id: locationId } } : { disconnect: true },
          heroImage: heroImageId ? { connect: { id: heroImageId } } : { disconnect: true },
          cardImage: cardImageId ? { connect: { id: cardImageId } } : { disconnect: true },
          dldQrImage: dldQrImageId ? { connect: { id: dldQrImageId } } : { disconnect: true },
          related: { set: relatedProjectIds.map((rid) => ({ id: rid })) },
          status,
          publishedAt: resolvePublishedAt(status, existing.publishedAt),
          updatedBy: { connect: { id: actor.id } },
          ...commercialUpdate,
        },
      });

      // Child collections are edited as a whole; replace them atomically.
      await tx.projectGalleryItem.deleteMany({ where: { projectId: id } });
      if (gallery.length) {
        await tx.projectGalleryItem.createMany({ data: gallery.map((g, order) => ({ projectId: id, mediaId: g.mediaId, caption: g.caption, order })) });
      }
      await tx.floorPlan.deleteMany({ where: { projectId: id } });
      if (floorPlans.length) {
        await tx.floorPlan.createMany({ data: floorPlans.map((f, order) => ({ ...f, projectId: id, order })) });
      }
      await tx.projectDocument.deleteMany({ where: { projectId: id } });
      if (documents.length) {
        await tx.projectDocument.createMany({ data: documents.map((d, order) => ({ ...d, projectId: id, order })) });
      }
      await tx.vrTour.deleteMany({ where: { projectId: id } });
      if (vrTours.length) {
        await tx.vrTour.createMany({ data: vrTours.map((v, order) => ({ ...v, projectId: id, order })) });
      }

      if (existing.status === "PUBLISHED" && existing.slug !== project.slug) {
        // The project now lives at the new URL, so an older redirect away from it would loop or hide it.
        await tx.redirect.deleteMany({ where: { fromPath: `/projects/${project.slug}` } });
        await tx.redirect.upsert({
          where: { fromPath: `/projects/${existing.slug}` },
          update: { toPath: `/projects/${project.slug}` },
          create: { fromPath: `/projects/${existing.slug}`, toPath: `/projects/${project.slug}`, note: "Automatic: project URL changed" },
        });
      }
      await audit(
        actor,
        {
          action: `project.${action}`,
          entityType: "Project",
          entityId: id,
          summary: `${action === "save" ? "Saved" : action} project "${project.name}"${commercialChanged ? " (commercial details changed — approval required)" : ""}`,
        },
        tx
      );
      return { project, previousSlug: existing.slug, commercialChanged };
    });
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    mapPrismaError(e, { slug: "URL slug" });
  }
}

export async function setProjectStatus(actor: Actor, id: string, action: WorkflowAction) {
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Project not found");
  assertCanEdit(actor, existing);
  const status = nextStatus(actor, existing.status, action);
  if (status === "PUBLISHED") {
    const issues = projectPublishIssues(existing);
    if (issues.length) throw new ValidationError(`This project cannot be published yet: ${issues.join(" ")}`, { _publish: issues });
  }
  const project = await db.project.update({
    where: { id },
    data: { status, publishedAt: resolvePublishedAt(status, existing.publishedAt), updatedById: actor.id },
  });
  await audit(actor, { action: `project.${action}`, entityType: "Project", entityId: id, summary: `${action} project "${project.name}"` });
  return project;
}

const approvalSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).default(""),
});

/** Sales approval of commercial fields. Separation of duties: approvers cannot approve their own edits. */
export async function reviewCommercial(actor: Actor, id: string, input: unknown) {
  if (!can(actor, "projects.approveCommercial")) throw new ForbiddenError("Only Sales Approvers can approve commercial details.");
  const { decision, note } = parseInput(approvalSchema, input);
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Project not found");
  if (existing.commercialStatus !== "PENDING") throw new ConflictError("There are no commercial changes awaiting approval.");
  if (existing.updatedById === actor.id && actor.role !== "ADMIN") {
    throw new ForbiddenError("You cannot approve commercial details you edited yourself.");
  }
  const now = new Date();
  const project = await db.project.update({
    where: { id },
    data:
      decision === "approve"
        ? { commercialStatus: "APPROVED", commercialApprovedById: actor.id, commercialApprovedAt: now, commercialAsOf: now, commercialNote: note }
        : { commercialStatus: "REJECTED", commercialApprovedById: null, commercialApprovedAt: null, commercialAsOf: null, commercialNote: note },
  });
  await audit(actor, {
    action: `project.commercial.${decision}`,
    entityType: "Project",
    entityId: id,
    summary: `${decision === "approve" ? "Approved" : "Rejected"} commercial details for "${project.name}"${note ? `: ${note}` : ""}`,
  });
  return project;
}

export async function deleteProject(actor: Actor, id: string) {
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Project not found");
  assertCanDelete(actor, existing);
  await db.$transaction(async (tx) => {
    await tx.project.delete({ where: { id } });
    await audit(actor, { action: "project.delete", entityType: "Project", entityId: id, summary: `Deleted project "${existing.name}"` }, tx);
  });
  return existing;
}

export async function duplicateProject(actor: Actor, id: string) {
  assertCanCreate(actor);
  const source = await db.project.findUnique({ where: { id }, include: { gallery: true, floorPlans: true, documents: true, vrTours: true } });
  if (!source) throw new NotFoundError("Project not found");
  let slug = `${source.slug}-copy`;
  for (let i = 2; await db.project.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${source.slug}-copy-${i}`;
  const {
    id: _id, gallery, floorPlans, documents, vrTours, createdAt: _c, updatedAt: _u, publishedAt: _p,
    commercialApprovedById: _a, commercialApprovedAt: _aa, commercialAsOf: _ao, ...rest
  } = source;
  const copy = await db.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        ...rest,
        name: `${source.name} (copy)`,
        slug,
        status: "DRAFT",
        isFeatured: false,
        commercialStatus: source.priceFrom != null || source.paymentPlanSummary ? "PENDING" : "NOT_SUBMITTED",
        authorId: actor.id,
        updatedById: actor.id,
        keyFacts: rest.keyFacts as Prisma.InputJsonValue,
        unitTypes: rest.unitTypes as Prisma.InputJsonValue,
        amenities: rest.amenities as Prisma.InputJsonValue,
        videos: rest.videos as Prisma.InputJsonValue,
        connectivity: rest.connectivity as Prisma.InputJsonValue,
        paymentPlan: rest.paymentPlan as Prisma.InputJsonValue,
      },
    });
    const strip = <T extends { id: string; projectId: string }>(rows: T[]) => rows.map(({ id: _i, projectId: _p, ...r }) => ({ ...r, projectId: created.id }));
    if (gallery.length) await tx.projectGalleryItem.createMany({ data: strip(gallery) });
    if (floorPlans.length) await tx.floorPlan.createMany({ data: strip(floorPlans) });
    if (documents.length) await tx.projectDocument.createMany({ data: strip(documents) });
    if (vrTours.length) await tx.vrTour.createMany({ data: strip(vrTours) });
    return created;
  });
  await audit(actor, { action: "project.duplicate", entityType: "Project", entityId: copy.id, summary: `Duplicated "${source.name}"` });
  return copy;
}
