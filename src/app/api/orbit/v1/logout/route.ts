import { hasBearerKey, jsonError, readJson, unauthorized } from "@/lib/http";
import { serverEnv } from "@/lib/env";
import { ValidationError } from "@/server/errors";
import { revokeOrbitSessions } from "@/server/services/auth";

/**
 * POST /api/orbit/v1/logout — back-channel from PCI Orbit when an Orbit session ends
 * (Apps-PCI-Backend/docs/orbit-sso.md, section 3). Body: { sid, reason: "signed_out" | "admin" }.
 * Auth: "Authorization: Bearer <USERS_API_KEY>". Ends every CMS session with that sid.
 * 204, also when there is none.
 */
export async function POST(request: Request) {
  if (!hasBearerKey(request, serverEnv().USERS_API_KEY)) return unauthorized();
  try {
    const body = (await readJson(request, 4096)) as { sid?: unknown } | null;
    const sid = body && typeof body === "object" ? body.sid : undefined;
    if (typeof sid !== "string" || !sid || sid.length > 200) throw new ValidationError("sid is required.");
    await revokeOrbitSessions(sid);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
