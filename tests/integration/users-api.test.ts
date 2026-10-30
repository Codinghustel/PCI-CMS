import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/v1/users/route";
import { db } from "@/server/db";
import { login } from "@/server/services/auth";
import { resetServerEnvCache } from "@/lib/env";
import { makeUser, resetDb } from "../support/db";

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

function lookup(email: string | null, auth: string | null = `Bearer ${KEY}`, ip = "203.0.113.30") {
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  if (auth) headers.authorization = auth;
  const qs = email === null ? "" : `?email=${encodeURIComponent(email)}`;
  return GET(new Request(`http://localhost/api/v1/users${qs}`, { method: "GET", headers }));
}

describe("GET /api/v1/users?email=", () => {
  it("rejects missing, wrong or unconfigured keys", async () => {
    await makeUser("EDITOR", undefined, { email: "found@example.com" });
    expect((await lookup("found@example.com", null)).status).toBe(401);
    expect((await lookup("found@example.com", "Bearer wrong-key")).status).toBe(401);
    process.env.USERS_API_KEY = "";
    resetServerEnvCache();
    expect((await lookup("found@example.com")).status).toBe(401);
  });

  it("validates the email query parameter", async () => {
    for (const bad of [null, "", "not-an-email"]) {
      const res = await lookup(bad);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.fieldErrors.email).toBeTruthy();
    }
  });

  it("returns 404 for an unknown email", async () => {
    const res = await lookup("nobody@example.com");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.message).toBe("No CMS account uses nobody@example.com.");
  });

  it("returns only email, name, role and active status — never secrets", async () => {
    const u = await makeUser("EDITOR", undefined, { email: "found@example.com" });
    const res = await lookup("found@example.com");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { data } = await res.json();
    expect(data).toEqual({ email: "found@example.com", name: u.name, role: "EDITOR", isActive: true });
    expect(Object.keys(data).sort()).toEqual(["email", "isActive", "name", "role"]);
  });

  it("reports deactivated accounts and includes administrators", async () => {
    await makeUser("VIEWER", undefined, { email: "off@example.com", isActive: false });
    await makeUser("ADMIN", undefined, { email: "boss@example.com" });
    expect((await (await lookup("off@example.com")).json()).data).toMatchObject({ role: "VIEWER", isActive: false });
    expect((await (await lookup("boss@example.com")).json()).data).toMatchObject({ role: "ADMIN", isActive: true });
  });

  it("matches the email case-insensitively and ignores surrounding spaces", async () => {
    await makeUser("AUTHOR", undefined, { email: "mixed.case@example.com" });
    const res = await lookup("  Mixed.CASE@Example.com ");
    expect(res.status).toBe(200);
    expect((await res.json()).data.email).toBe("mixed.case@example.com");
  });

  it("does not write an audit entry and shares the users-api rate limit", async () => {
    await makeUser("EDITOR", undefined, { email: "found@example.com" });
    const before = await db.auditLog.count();
    for (let i = 0; i < 30; i++) expect((await lookup("found@example.com", undefined, "203.0.113.99")).status).toBe(200);
    expect(await db.auditLog.count()).toBe(before);
    const limited = await lookup("found@example.com", undefined, "203.0.113.99");
    expect(limited.status).toBe(429);
    // The POST endpoint shares the same per-IP bucket.
    expect((await call(valid, undefined, "203.0.113.99")).status).toBe(429);
  });
});
