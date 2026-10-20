import { publicStorage, isValidStorageKey } from "@/server/integrations/storage";
import { EXT_MIME } from "@/lib/file-types";

/**
 * GET /uploads/<key> — serves public media-library files.
 * Keys are validated against a strict pattern (no traversal), only known
 * extensions are served, and nosniff prevents content-type confusion.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.join("/");
  if (!isValidStorageKey(key)) return new Response("Not found", { status: 404 });
  const ext = key.split(".").pop()!.toLowerCase();
  const mime = EXT_MIME[ext];
  if (!mime) return new Response("Not found", { status: 404 });
  const data = await publicStorage().get(key);
  if (!data) return new Response("Not found", { status: 404 });
  const isDocument = mime === "application/pdf";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      // Documents can be replaced in place (same URL), so cache them briefly.
      "Cache-Control": isDocument ? "public, max-age=300" : "public, max-age=86400, stale-while-revalidate=604800",
      ...(isDocument ? { "Content-Disposition": "inline", "Content-Security-Policy": "sandbox" } : {}),
    },
  });
}
