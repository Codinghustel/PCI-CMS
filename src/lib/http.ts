import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AppError, RateLimitError } from "@/server/errors";

// Helpers for Route Handlers: consistent JSON error envelope
//   { "error": { "code": string }, "message": string, "fieldErrors"?: {…} }
// and same-origin enforcement for cookie-authenticated / browser-only POSTs.

export function jsonError(error: unknown): Response {
  unstable_rethrow(error);
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    if (error instanceof RateLimitError) headers["Retry-After"] = String(error.retryAfterSeconds);
    return Response.json(
      { error: { code: error.code }, message: error.message, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) },
      { status: error.status, headers }
    );
  }
  console.error("[api] unexpected error", error);
  return Response.json({ error: { code: "INTERNAL_ERROR" }, message: "Something went wrong. Please try again." }, { status: 500 });
}

/**
 * CSRF defence for state-changing requests: the Origin (or Referer) must match
 * the host serving the request. Combined with SameSite=Lax cookies this blocks
 * cross-site form posts and fetches.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbiddenOrigin(): Response {
  return Response.json({ error: { code: "FORBIDDEN_ORIGIN" }, message: "Cross-site request rejected." }, { status: 403 });
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", "Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid JSON body.", 400);
  }
}
