import { resetRolePermissionsFromApi, updateRolePermissionsFromApi } from "@/server/services/roles";
import { clientIp, hasBearerKey, jsonError, readJson, unauthorized } from "@/lib/http";
import { serverEnv } from "@/lib/env";

type Params = { params: Promise<{ role: string }> };

/**
 * PUT /api/v1/roles/{role}/permissions { permissions: string[] } — replaces the
 * role's permission set (applies to its users immediately). ADMIN is fixed and
 * "users.manage" can never be granted.
 * Auth: "Authorization: Bearer <USERS_API_KEY>".
 */
export async function PUT(request: Request, { params }: Params) {
  if (!hasBearerKey(request, serverEnv().USERS_API_KEY)) return unauthorized();
  try {
    const { role } = await params;
    const result = await updateRolePermissionsFromApi(role.toUpperCase(), await readJson(request, 8192), { ipAddress: clientIp(request) });
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}

/** DELETE /api/v1/roles/{role}/permissions — resets the role to its built-in defaults. */
export async function DELETE(request: Request, { params }: Params) {
  if (!hasBearerKey(request, serverEnv().USERS_API_KEY)) return unauthorized();
  try {
    const { role } = await params;
    const result = await resetRolePermissionsFromApi(role.toUpperCase(), { ipAddress: clientIp(request) });
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
