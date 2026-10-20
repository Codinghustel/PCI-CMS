import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { db } from "@/server/db";
import { login, logout, resolveSession } from "@/server/services/auth";
import { createUser, deleteUser, updateUser } from "@/server/services/users";
import { deleteMedia, uploadMedia } from "@/server/services/media";
import { deliverLead, submitLead } from "@/server/services/leads";
import { consumeRateLimit } from "@/server/services/rate-limit";
import { verifySessionToken } from "@/lib/auth/jwt";
import { resetServerEnvCache } from "@/lib/env";
import { ConflictError, ForbiddenError, RateLimitError, UnauthorizedError, ValidationError } from "@/server/errors";
import { makeUser, resetDb } from "../support/db";

beforeEach(async () => {
  await resetDb();
  process.env.BITRIX24_WEBHOOK_URL = "";
  resetServerEnvCache();
});
afterEach(() => vi.unstubAllGlobals());

const meta = (ip = `10.0.0.${Math.floor(Math.random() * 250)}`) => ({ ipAddress: ip, userAgent: "vitest" });

describe("authentication", () => {
  it("signs in with valid credentials and creates a revocable session", async () => {
    const user = await makeUser("EDITOR");
    const { token } = await login({ email: user.email, password: user.password }, meta());
    const claims = await verifySessionToken(token);
    expect(await resolveSession(claims!.sid, claims!.sub)).toMatchObject({ id: user.id, role: "EDITOR" });
    await logout(claims!.sid, user);
    expect(await resolveSession(claims!.sid, claims!.sub)).toBeNull();
  });

  it("returns the same generic error for unknown users and wrong passwords", async () => {
    const user = await makeUser("EDITOR");
    const a = await login({ email: "nobody@test.local", password: "x" }, meta()).catch((e) => e);
    const b = await login({ email: user.email, password: "wrong" }, meta()).catch((e) => e);
    expect(a).toBeInstanceOf(UnauthorizedError);
    expect(b.message).toBe(a.message);
  });

  it("locks the account after repeated failures", async () => {
    const user = await makeUser("EDITOR");
    for (let i = 0; i < 5; i++) await login({ email: user.email, password: "wrong" }, meta()).catch(() => {});
    await expect(login({ email: user.email, password: user.password }, meta())).rejects.toThrow(/locked/);
  });

  it("invalidates sessions of deactivated users", async () => {
    const admin = await makeUser("ADMIN");
    const user = await makeUser("AUTHOR");
    const { token } = await login({ email: user.email, password: user.password }, meta());
    const claims = (await verifySessionToken(token))!;
    await updateUser(admin, user.id, { name: user.name, role: "AUTHOR", isActive: false });
    expect(await resolveSession(claims.sid, claims.sub)).toBeNull();
    await expect(login({ email: user.email, password: user.password }, meta())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rate limits by key", async () => {
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 3; i++) expect((await consumeRateLimit(key, 3, 60)).allowed).toBe(true);
    const blocked = await consumeRateLimit(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    // Regression: DB-side now() must be UTC, matching app-written timestamps.
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});

describe("user administration", () => {
  it("only admins manage users; roles come from the server-side enum", async () => {
    const editor = await makeUser("EDITOR");
    const admin = await makeUser("ADMIN");
    await expect(createUser(editor, { name: "X", email: "x@test.local", role: "ADMIN", password: "Very-Strong-Pass1" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createUser(admin, { name: "X", email: "x@test.local", role: "SUPERUSER", password: "Very-Strong-Pass1" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createUser(admin, { name: "X", email: "x@test.local", role: "AUTHOR", password: "short" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("never removes the last active administrator", async () => {
    const admin = await makeUser("ADMIN");
    const other = await makeUser("ADMIN");
    // Administrators cannot demote or deactivate themselves.
    await expect(updateUser(admin, admin.id, { name: admin.name, role: "EDITOR", isActive: true })).rejects.toBeInstanceOf(ValidationError);
    // Demoting another admin is fine while one active admin remains.
    await updateUser(admin, other.id, { name: other.name, role: "EDITOR", isActive: true });
    expect(await db.user.count({ where: { role: "ADMIN", isActive: true } })).toBe(1);
    // A (deactivated) admin record acting on the last active admin is refused.
    const inactive = await makeUser("ADMIN", "Test-Password-123", { isActive: false });
    await expect(updateUser(inactive, admin.id, { name: admin.name, role: "EDITOR", isActive: true })).rejects.toBeInstanceOf(ConflictError);
    await expect(updateUser(inactive, admin.id, { name: admin.name, role: "ADMIN", isActive: false })).rejects.toBeInstanceOf(ConflictError);
    await expect(deleteUser(inactive, admin.id)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("media uploads", () => {
  it("accepts real images, strips them through sharp and rejects scripts/executables", async () => {
    const editor = await makeUser("EDITOR");
    const png = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#BDA588" } }).png().toBuffer();
    const media = await uploadMedia(editor, { data: png, originalName: "Hero Image.PNG", alt: "Hero" });
    expect(media.mimeType).toBe("image/png");
    expect(media.width).toBe(2560); // resized to the maximum dimension
    expect(media.storageKey).toMatch(/^\d{4}\/\d{2}\/hero-image-[a-f0-9]+\.png$/);

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(uploadMedia(editor, { data: svg, originalName: "logo.svg" })).rejects.toBeInstanceOf(ValidationError);
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(100)]);
    await expect(uploadMedia(editor, { data: exe, originalName: "photo.jpg" })).rejects.toBeInstanceOf(ValidationError);

    const viewer = await makeUser("VIEWER");
    await expect(uploadMedia(viewer, { data: png, originalName: "x.png" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses to delete media that is still in use", async () => {
    const editor = await makeUser("EDITOR");
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).png().toBuffer();
    const media = await uploadMedia(editor, { data: png, originalName: "x.png", alt: "x" });
    await db.page.create({ data: { title: "P", slug: "p", featuredImageId: media.id } });
    await expect(deleteMedia(editor, media.id)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("lead capture and CRM delivery", () => {
  const lead = { formType: "CONTACT", name: "Ali Raza", email: "ali@example.com", phone: "+92 300 1112233", consent: true, attribution: { utmSource: "facebook", utmCampaign: "launch" }, startedAt: Date.now() - 10_000 };

  it("stores the lead first even when the CRM is not configured", async () => {
    const stored = await submitLead(lead, meta());
    expect(stored.utmSource).toBe("facebook");
    const result = await deliverLead(stored.id);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect((await db.lead.findUniqueOrThrow({ where: { id: stored.id } })).crmStatus).toBe("NOT_CONFIGURED");
  });

  it("rejects bot submissions (honeypot / instant submit) and rate limits", async () => {
    await expect(submitLead({ ...lead, website: "spam" }, meta())).rejects.toBeInstanceOf(ValidationError);
    await expect(submitLead({ ...lead, startedAt: Date.now() }, meta())).rejects.toBeInstanceOf(ValidationError);
    const ip = meta("192.0.2.77");
    for (let i = 0; i < 8; i++) await submitLead(lead, ip);
    await expect(submitLead(lead, ip)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("delivers to Bitrix24, retries transient failures and never duplicates", async () => {
    process.env.BITRIX24_WEBHOOK_URL = "https://pci.bitrix24.com/rest/1/abc/";
    resetServerEnvCache();
    const stored = await submitLead(lead, meta());

    // 1st attempt: Bitrix24 unavailable → FAILED with a scheduled retry.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "QUERY_LIMIT_EXCEEDED" }), { status: 503 })));
    const first = await deliverLead(stored.id);
    expect(first).toMatchObject({ status: "FAILED", willRetry: true });
    const failed = await db.lead.findUniqueOrThrow({ where: { id: stored.id } });
    expect(failed.crmNextAttemptAt!.getTime()).toBeGreaterThan(Date.now());

    // Retry: the lead was actually created last time (ambiguous failure) → found by ORIGIN_ID, not re-created.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: [{ ID: "321" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const second = await deliverLead(stored.id, { manual: true });
    expect(second).toMatchObject({ status: "DELIVERED", crmId: "321" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("crm.lead.list");

    // Delivered leads are not sent again.
    expect((await deliverLead(stored.id, { manual: true })).status).toBe("SKIPPED");
    expect(await db.crmDeliveryAttempt.count({ where: { leadId: stored.id } })).toBe(2);
  });
});
