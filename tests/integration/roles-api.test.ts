import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/roles/route";
import { DELETE, PUT } from "@/app/api/v1/roles/[role]/permissions/route";
import { db } from "@/server/db";
import { login, resolveSession } from "@/server/services/auth";
import { verifySessionToken } from "@/lib/auth/jwt";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { resetServerEnvCache } from "@/lib/env";
import { makeUser, resetDb } from "../support/db";

const KEY = "users-api-test-key-0123456789abcdef0123456789";

function req(method: string, path: string, body?: unknown, auth: string | null = `Bearer ${KEY}`) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": "203.0.113.20" };
  if (auth) headers.authorization = auth;
  return new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const params = (role: string) => ({ params: Promise.resolve({ role }) });

beforeEach(async () => {
  await resetDb();
  process.env.USERS_API_KEY = KEY;
  resetServerEnvCache();
});

afterEach(() => {
  delete process.env.USERS_API_KEY;
  resetServerEnvCache();
});

describe("external roles API", () => {
  it("lists roles with their permissions and the permission catalogue", async () => {
    const res = await GET(req("GET", "/api/v1/roles"));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.roles.map((r: { role: string }) => r.role)).toEqual(["ADMIN", "EDITOR", "AUTHOR", "SALES_APPROVER", "VIEWER"]);
    const viewer = data.roles.find((r: { role: string }) => r.role === "VIEWER");
    expect(viewer).toMatchObject({ editable: true, customised: false, permissions: [...DEFAULT_ROLE_PERMISSIONS.VIEWER] });
    expect(data.roles[0].editable).toBe(false);
    expect(data.permissions.find((p: { key: string }) => p.key === "users.manage")).toMatchObject({ adminOnly: true });
  });

  it("replaces a role's permissions, applies them to signed-in users at once, and audits it", async () => {
    const viewer = await makeUser("VIEWER");
    const { token } = await login({ email: viewer.email, password: viewer.password }, { ipAddress: "10.4.4.4" });

    const res = await PUT(req("PUT", "/api/v1/roles/viewer/permissions", { permissions: ["dashboard.view", "content.read", "leads.read", "leads.export"] }), params("viewer"));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ role: "VIEWER", added: ["leads.export"], removed: ["media.read"] });

    const claims = (await verifySessionToken(token))!;
    const actor = await resolveSession(claims.sid, claims.sub);
    expect(actor?.permissions).toContain("leads.export");
    expect(actor?.permissions).not.toContain("media.read");

    const log = await db.auditLog.findFirst({ where: { action: "role.update", entityId: "VIEWER" } });
    expect(log?.actorId).toBeNull();
    expect(log?.summary).toContain("via external API");

    const reset = await DELETE(req("DELETE", "/api/v1/roles/VIEWER/permissions"), params("VIEWER"));
    expect(reset.status).toBe(200);
    expect((await reset.json()).data.permissions).toEqual([...DEFAULT_ROLE_PERMISSIONS.VIEWER]);
    expect(await db.rolePermission.count()).toBe(0);
  });

  it("refuses admin changes, admin-only and unknown permissions, unknown roles and bad keys", async () => {
    expect((await PUT(req("PUT", "/x", { permissions: [] }), params("ADMIN"))).status).toBe(422);
    expect((await DELETE(req("DELETE", "/x"), params("ADMIN"))).status).toBe(422);
    expect((await PUT(req("PUT", "/x", { permissions: ["users.manage"] }), params("EDITOR"))).status).toBe(422);
    expect((await PUT(req("PUT", "/x", { permissions: ["everything"] }), params("EDITOR"))).status).toBe(422);
    expect((await PUT(req("PUT", "/x", { permissions: "leads.read" }), params("EDITOR"))).status).toBe(422);
    expect((await PUT(req("PUT", "/x", { permissions: [] }), params("OWNER"))).status).toBe(404);
    expect((await GET(req("GET", "/api/v1/roles", undefined, null))).status).toBe(401);
    expect((await PUT(req("PUT", "/x", { permissions: [] }, "Bearer nope"), params("EDITOR"))).status).toBe(401);
    expect(await db.rolePermission.count()).toBe(0);
  });
});
