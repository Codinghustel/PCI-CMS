import { createUserFromApi } from "@/server/services/users";
import { clientIp, hasBearerKey, jsonError, readJson, unauthorized } from "@/lib/http";
import { serverEnv } from "@/lib/env";

/**
 * POST /api/v1/users — lets an external app create a CMS user (the same
 * accounts managed in /admin/users). Roles: EDITOR, AUTHOR, SALES_APPROVER,
 * VIEWER; ADMIN can only be granted in the CMS.
 * Auth: "Authorization: Bearer <USERS_API_KEY>". Disabled while the key is unset.
 * 201 → { data: { id, name, email, role, isActive, createdAt } }
 */
export async function POST(request: Request) {
  if (!hasBearerKey(request, serverEnv().USERS_API_KEY)) return unauthorized();
  try {
    const user = await createUserFromApi(await readJson(request, 4096), { ipAddress: clientIp(request) });
    return Response.json(
      { data: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt } },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return jsonError(e);
  }
}
