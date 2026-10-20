import crypto from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { publicStorage } from "@/server/integrations/storage";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { normalizeList, parseInput, type ListParams } from "@/server/services/helpers";
import { detectFileType, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES, type DetectedType } from "@/lib/file-types";
import { can, type Actor } from "@/lib/auth/permissions";
import { slugify } from "@/lib/text";

const MAX_IMAGE_DIMENSION = 2560;

export interface UploadInput {
  data: Buffer;
  originalName: string;
  alt?: string;
  title?: string;
  tags?: string[];
}

function checkSize(type: DetectedType, size: number) {
  const max = type.kind === "IMAGE" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (size > max) throw new ValidationError(`The file is too large. Maximum size is ${Math.round(max / 1024 / 1024)} MB.`);
  if (size === 0) throw new ValidationError("The file is empty.");
}

/** Re-encodes images: applies EXIF orientation, strips metadata, caps dimensions. */
async function processImage(data: Buffer, type: DetectedType) {
  if (type.mime === "image/gif") {
    const meta = await sharp(data, { animated: true }).metadata();
    return { data, width: meta.width ?? null, height: meta.pageHeight ?? meta.height ?? null };
  }
  let pipeline = sharp(data, { failOn: "error" }).rotate().resize({
    width: MAX_IMAGE_DIMENSION,
    height: MAX_IMAGE_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });
  if (type.mime === "image/jpeg") pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
  else if (type.mime === "image/png") pipeline = pipeline.png({ compressionLevel: 9 });
  else if (type.mime === "image/webp") pipeline = pipeline.webp({ quality: 85 });
  else if (type.mime === "image/avif") pipeline = pipeline.avif({ quality: 60 });
  const { data: out, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data: out, width: info.width, height: info.height };
}

function buildKey(originalName: string, ext: string) {
  const now = new Date();
  const base = slugify(originalName.replace(/\.[^.]+$/, "")).slice(0, 60) || "file";
  const rand = crypto.randomBytes(5).toString("hex");
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${base}-${rand}.${ext}`;
}

export async function uploadMedia(actor: Actor, input: UploadInput) {
  if (!can(actor, "media.upload")) throw new ForbiddenError("You do not have permission to upload files.");
  const type = detectFileType(input.data);
  if (!type) {
    throw new ValidationError("Unsupported file type. Upload JPG, PNG, WebP, AVIF or GIF images, or PDF documents.");
  }
  checkSize(type, input.data.length);

  let data = input.data;
  let width: number | null = null;
  let height: number | null = null;
  if (type.kind === "IMAGE") {
    try {
      ({ data, width, height } = await processImage(input.data, type));
    } catch {
      throw new ValidationError("The image could not be read. It may be corrupted.");
    }
  }

  const storageKey = buildKey(input.originalName, type.ext);
  await publicStorage().put(storageKey, data);
  try {
    const media = await db.media.create({
      data: {
        kind: type.kind,
        storageKey,
        originalName: input.originalName.slice(0, 200),
        mimeType: type.mime,
        sizeBytes: data.length,
        width,
        height,
        alt: (input.alt ?? "").trim().slice(0, 300),
        title: (input.title ?? input.originalName.replace(/\.[^.]+$/, "")).trim().slice(0, 200),
        tags: (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 20),
        uploadedById: actor.id,
      },
    });
    await audit(actor, { action: "media.upload", entityType: "Media", entityId: media.id, summary: `Uploaded "${media.originalName}"` });
    return media;
  } catch (e) {
    await publicStorage().delete(storageKey);
    throw e;
  }
}

/** Replaces the file content while keeping the same public URL (e.g. an updated brochure). */
export async function replaceMediaFile(actor: Actor, id: string, input: UploadInput) {
  if (!can(actor, "media.upload")) throw new ForbiddenError();
  const existing = await db.media.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("File not found");
  const type = detectFileType(input.data);
  if (!type || type.mime !== existing.mimeType) {
    throw new ValidationError(`The replacement must be the same file type as the original (${existing.mimeType}) so its URL stays the same.`);
  }
  checkSize(type, input.data.length);
  let data = input.data;
  let width = existing.width;
  let height = existing.height;
  if (type.kind === "IMAGE") ({ data, width, height } = await processImage(input.data, type));
  await publicStorage().put(existing.storageKey, data);
  const media = await db.media.update({
    where: { id },
    data: { sizeBytes: data.length, width, height, originalName: input.originalName.slice(0, 200) },
  });
  await audit(actor, { action: "media.replace", entityType: "Media", entityId: id, summary: `Replaced file for "${media.title || media.originalName}"` });
  return media;
}

const metaSchema = z.object({
  alt: z.string().trim().max(300).default(""),
  title: z.string().trim().max(200).default(""),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
});

export async function updateMediaMeta(actor: Actor, id: string, input: unknown) {
  if (!can(actor, "media.upload")) throw new ForbiddenError();
  const data = parseInput(metaSchema, input);
  const media = await db.media.update({ where: { id }, data }).catch(() => {
    throw new NotFoundError("File not found");
  });
  await audit(actor, { action: "media.update", entityType: "Media", entityId: id, summary: `Updated details for "${media.title || media.originalName}"` });
  return media;
}

/** Where a media item is referenced. Used to prevent breaking live content. */
export async function mediaUsage(id: string) {
  const [relations, sectionPages] = await Promise.all([
    db.media.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            pagesFeatured: true, pagesOg: true, projectsHero: true, projectsCard: true, projectsDldQr: true,
            galleryItems: true, floorPlansImage: true, floorPlansFile: true, documents: true, vrThumbnails: true,
            updateImages: true, locationsHero: true, articlesCover: true,
          },
        },
      },
    }),
    // Page sections are JSON; look for the id inside them (parameterised query).
    db.$queryRaw<{ title: string }[]>`SELECT "title" FROM "Page" WHERE "sections"::text LIKE ${"%" + id + "%"} LIMIT 10`,
  ]);
  if (!relations) throw new NotFoundError("File not found");
  const counts = relations._count as Record<string, number>;
  const relationCount = Object.values(counts).reduce((a, b) => a + b, 0);
  return { relationCount, pages: sectionPages.map((p) => p.title) };
}

export async function deleteMedia(actor: Actor, id: string) {
  if (!can(actor, "media.delete")) throw new ForbiddenError("You do not have permission to delete files.");
  const media = await db.media.findUnique({ where: { id } });
  if (!media) throw new NotFoundError("File not found");
  const usage = await mediaUsage(id);
  if (usage.relationCount > 0 || usage.pages.length > 0) {
    const where = usage.pages.length ? ` (pages: ${usage.pages.join(", ")})` : "";
    throw new ConflictError(`This file is still used in ${usage.relationCount + usage.pages.length} place(s)${where}. Remove it from that content first.`);
  }
  await db.media.delete({ where: { id } });
  await publicStorage().delete(media.storageKey);
  await audit(actor, { action: "media.delete", entityType: "Media", entityId: id, summary: `Deleted "${media.originalName}"` });
}

export async function listMedia(params: ListParams & { kind?: "IMAGE" | "DOCUMENT"; tag?: string }) {
  const { skip, take, q, page, pageSize } = normalizeList({ ...params, pageSize: params.pageSize ?? 40 });
  const where: Prisma.MediaWhereInput = {
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.tag ? { tags: { has: params.tag } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { originalName: { contains: q, mode: "insensitive" } },
            { alt: { contains: q, mode: "insensitive" } },
            { tags: { has: q.toLowerCase() } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.media.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getMediaByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.media.findMany({ where: { id: { in: ids } } });
}

export function mediaUrl(storageKey: string) {
  return `/uploads/${storageKey}`;
}

export type MediaSummary = {
  id: string;
  url: string;
  alt: string;
  title: string;
  kind: "IMAGE" | "DOCUMENT";
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
};

export function toMediaSummary(m: { id: string; storageKey: string; alt: string; title: string; kind: "IMAGE" | "DOCUMENT"; mimeType: string; width: number | null; height: number | null; sizeBytes: number }): MediaSummary {
  return { id: m.id, url: mediaUrl(m.storageKey), alt: m.alt, title: m.title, kind: m.kind, mimeType: m.mimeType, width: m.width, height: m.height, sizeBytes: m.sizeBytes };
}
