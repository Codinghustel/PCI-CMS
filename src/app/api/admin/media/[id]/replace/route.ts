import { requirePermission } from "@/lib/auth/session";
import { forbiddenOrigin, isSameOrigin, jsonError } from "@/lib/http";
import { replaceMediaFile, toMediaSummary } from "@/server/services/media";
import { ValidationError } from "@/server/errors";
import { refreshPublicFromRoute } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache-tags";
import { MAX_DOCUMENT_BYTES } from "@/lib/file-types";

/** POST /api/admin/media/:id/replace (multipart: file) — replace content, keep URL. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  try {
    const { id } = await params;
    const actor = await requirePermission("media.upload");
    if (Number(request.headers.get("content-length") ?? 0) > MAX_DOCUMENT_BYTES + 1024 * 1024) {
      throw new ValidationError("The file is too large.");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a file to upload.");
    const media = await replaceMediaFile(actor, id, { data: Buffer.from(await file.arrayBuffer()), originalName: file.name });
    refreshPublicFromRoute(TAGS.site);
    return Response.json(toMediaSummary(media));
  } catch (e) {
    return jsonError(e);
  }
}
