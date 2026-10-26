import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/v1/users/route";
import { db } from "@/server/db";
import { login } from "@/server/services/auth";
import { resetServerEnvCache } from "@/lib/env";
import { resetDb } from "../support/db";

const KEY = "users-api-test-key-0123456789abcdef0123456789";

function call(body: unknown, auth: string | null = `Bearer ${KEY}`, ip = "203.0.113.10") {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": ip };
  if (auth) headers.authorization = auth;
  return POST(new Request("http://localhost/api/v1/users", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
}

const valid = { name: "Ali Khan", email: "Ali.Khan@Example.com", role: "EDITOR", password: "Start-Passw0rd-2026" };

beforeEach(async () => {
  await resetDb();
  process.env.USERS_API_KEY = KEY;
  resetServerEnvCache();
});

afterEach(() => {
  delete process.env.USERS_API_KEY;
  resetServerEnvCache();
});

describe("POST /api/v1/users", () => {
  it("creates a user who can then sign in, and audits it as an API action", async () => {
    const res = await call(valid);
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data).toMatchObject({ name: "Ali Khan", email: "ali.khan@example.com", role: "EDITOR", isActive: true });
    expect(data).not.toHaveProperty("passwordHash");

    const session = await login({ email: "ali.khan@example.com", password: valid.password }, { ipAddress: "203.0.113.11", userAgent: "test" });
    expect(session).toBeTruthy();

    const log = await db.auditLog.findFirst({ where: { action: "user.create", entityId: data.id } });
    expect(log?.actorId).toBeNull();
    expect(log?.summary).toContain("via external API");
  });

  it("rejects missing, wrong or unconfigured keys", async () => {
    expect((await call(valid, null)).status).toBe(401);
    expect((await call(valid, "Bearer wrong-key")).status).toBe(401);
    process.env.USERS_API_KEY = "";
    resetServerEnvCache();
    expect((await call(valid)).status).toBe(401);
    expect(await db.user.count()).toBe(0);
  });

  it("never creates administrators", async () => {
    const res = await call({ ...valid, role: "ADMIN" });
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors.role).toBeTruthy();
    expect(await db.user.count()).toBe(0);
  });

  it("validates fields and reports duplicate emails", async () => {
    const weak = await call({ ...valid, password: "short" });
    expect(weak.status).toBe(422);
    expect((await weak.json()).fieldErrors.password).toBeTruthy();

    expect((await call("{not json")).status).toBe(400);

    expect((await call(valid)).status).toBe(201);
    const dup = await call({ ...valid, email: "ALI.KHAN@example.com" });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("CONFLICT");
  });
});
