import { listRolesFromApi } from "@/server/services/roles";
import { clientIp, hasBearerKey, jsonError, unauthorized } from "@/lib/http";
import { serverEnv } from "@/lib/env";

/**
 * GET /api/v1/roles — every role with its current permissions, plus the
 * catalogue of permissions that can be granted (same data as /admin/roles).
 * Auth: "Authorization: Bearer <USERS_API_KEY>".
 */
export async function GET(request: Request) {
  if (!hasBearerKey(request, serverEnv().USERS_API_KEY)) return unauthorized();
  try {
    return Response.json({ data: await listRolesFromApi({ ipAddress: clientIp(request) }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
