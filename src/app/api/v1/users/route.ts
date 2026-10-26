import crypto from "node:crypto";
import { createUserFromApi } from "@/server/services/users";
import { clientIp, jsonError, readJson } from "@/lib/http";
import { serverEnv } from "@/lib/env";

/**
 * POST /api/v1/users — lets an external app create a CMS user (the same
 * accounts managed in /admin/users). Roles: EDITOR, AUTHOR, SALES_APPROVER,
 * VIEWER; ADMIN can only be granted in the CMS.
 * Auth: "Authorization: Bearer <USERS_API_KEY>". Disabled while the key is unset.
 * 201 → { data: { id, name, email, role, isActive, createdAt } }
 */
export async function POST(request: Request) {
  const key = serverEnv().USERS_API_KEY;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    key.length >= 32 &&
    provided.length === key.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(key));
  if (!ok) return Response.json({ error: { code: "UNAUTHORIZED" }, message: "Unauthorized" }, { status: 401 });

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
