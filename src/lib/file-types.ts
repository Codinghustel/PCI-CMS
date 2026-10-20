// Detects file types from their leading bytes ("magic numbers") rather than
// trusting the browser-supplied name or MIME type. Only the formats listed here
// can be uploaded; SVG and HTML are excluded because they can carry scripts.

export interface DetectedType {
  mime: string;
  ext: string;
  kind: "IMAGE" | "DOCUMENT";
}

export function detectFileType(buf: Uint8Array): DetectedType | null {
  const at = (offset: number, bytes: number[]) => bytes.every((b, i) => buf[offset + i] === b);
  const ascii = (offset: number, text: string) => at(offset, [...text].map((c) => c.charCodeAt(0)));

  if (buf.length < 12) return null;
  if (at(0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg", kind: "IMAGE" };
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png", kind: "IMAGE" };
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return { mime: "image/gif", ext: "gif", kind: "IMAGE" };
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { mime: "image/webp", ext: "webp", kind: "IMAGE" };
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return { mime: "image/avif", ext: "avif", kind: "IMAGE" };
  if (ascii(0, "%PDF-")) return { mime: "application/pdf", ext: "pdf", kind: "DOCUMENT" };
  return null;
}

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;
export const MAX_CV_BYTES = 5 * 1024 * 1024;

export const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
};
