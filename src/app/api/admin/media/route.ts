import { requirePermission } from "@/lib/auth/session";
import { forbiddenOrigin, isSameOrigin, jsonError } from "@/lib/http";
import { toMediaSummary, uploadMedia } from "@/server/services/media";
import { ValidationError } from "@/server/errors";
import { MAX_DOCUMENT_BYTES } from "@/lib/file-types";

/**
 * POST /api/admin/media (multipart: file, alt?, title?, tags?)
 * Auth: CMS session cookie with media.upload. 201 → MediaSummary.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  try {
    const actor = await requirePermission("media.upload");
    if (Number(request.headers.get("content-length") ?? 0) > MAX_DOCUMENT_BYTES + 1024 * 1024) {
      throw new ValidationError("The file is too large.");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a file to upload.");
    const media = await uploadMedia(actor, {
      data: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      alt: String(form.get("alt") ?? ""),
      title: String(form.get("title") ?? "") || undefined,
      tags: String(form.get("tags") ?? "").split(",").filter(Boolean),
    });
    return Response.json(toMediaSummary(media), { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
