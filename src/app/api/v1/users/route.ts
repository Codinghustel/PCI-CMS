import { createUserFromApi, findUserByEmailFromApi } from "@/server/services/users";
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

/**
 * GET /api/v1/users?email=<email> — read-only lookup of one CMS account by
 * email (case-insensitive). ADMIN accounts are included.
 * Auth: "Authorization: Bearer <USERS_API_KEY>".
 * 200 → { data: { email, name, role, isActive } } · 404 when no account uses the email
 */
export async function GET(request: Request) {
  if (!hasBearerKey(request, serverEnv().USERS_API_KEY)) return unauthorized();
  try {
    const user = await findUserByEmailFromApi({ email: new URL(request.url).searchParams.get("email") ?? "" }, { ipAddress: clientIp(request) });
    return Response.json(
      { data: { email: user.email, name: user.name, role: user.role, isActive: user.isActive } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return jsonError(e);
  }
}
