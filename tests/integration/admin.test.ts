import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { login, resolveSession } from "@/server/services/auth";
import { listRoles, resetRolePermissions, updateRolePermissions } from "@/server/services/roles";
import { integrationStatus, runLeadDeliveryJob, testBitrix } from "@/server/services/integrations";
import { deliverLead, submitLead } from "@/server/services/leads";
import { saveSettings, getSettings } from "@/server/services/site";
import { verifySessionToken } from "@/lib/auth/jwt";
import { can } from "@/lib/auth/permissions";
import { resetServerEnvCache } from "@/lib/env";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { makeUser, resetDb } from "../support/db";

beforeEach(async () => {
  await resetDb();
  process.env.BITRIX24_WEBHOOK_URL = "";
  resetServerEnvCache();
});
afterEach(() => vi.unstubAllGlobals());

describe("roles & permissions", () => {
  it("lets administrators customise a role, effective immediately for signed-in users", async () => {
    const admin = await makeUser("ADMIN");
    const author = await makeUser("AUTHOR");
    const { token } = await login({ email: author.email, password: author.password }, { ipAddress: "10.1.1.1" });
    const claims = (await verifySessionToken(token))!;

    expect(can(await resolveSession(claims.sid, claims.sub), "content.publish")).toBe(false);
    const result = await updateRolePermissions(admin, { role: "AUTHOR", permissions: ["dashboard.view", "content.read", "content.writeOwn", "content.publish"] });
    expect(result.added).toEqual(["content.publish"]);
    expect(result.removed).toEqual(["media.read", "media.upload"]);
    // Same session, new permissions.
    const actor = await resolveSession(claims.sid, claims.sub);
    expect(can(actor, "content.publish")).toBe(true);
    expect(can(actor, "media.upload")).toBe(false);

    const roles = await listRoles(admin);
    expect(roles.find((r) => r.role === "AUTHOR")).toMatchObject({ customised: true, userCount: 1 });
    await resetRolePermissions(admin, "AUTHOR");
    expect(can(await resolveSession(claims.sid, claims.sub), "content.publish")).toBe(false);
    expect(await db.auditLog.count({ where: { entityType: "Role" } })).toBe(2);
  });

  it("prevents privilege escalation and protects the administrator role", async () => {
    const admin = await makeUser("ADMIN");
    const editor = await makeUser("EDITOR");
    await expect(updateRolePermissions(editor, { role: "EDITOR", permissions: ["users.manage"] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateRolePermissions(admin, { role: "EDITOR", permissions: ["users.manage"] })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateRolePermissions(admin, { role: "ADMIN", permissions: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateRolePermissions(admin, { role: "VIEWER", permissions: ["not.real"] })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("integrations", () => {
  const lead = { formType: "CONTACT", name: "Zara Ali", email: "zara@example.com", phone: "+92 300 2223344", consent: true, attribution: {}, startedAt: Date.now() - 10_000 };

  it("reports status without exposing secrets", async () => {
    process.env.BITRIX24_WEBHOOK_URL = "https://pci.bitrix24.com/rest/7/supersecretcode/";
    resetServerEnvCache();
    const admin = await makeUser("ADMIN");
    const status = await integrationStatus(admin);
    expect(status.bitrix.webhook).toBe("https://pci.bitrix24.com/••••");
    expect(JSON.stringify(status)).not.toContain("supersecretcode");
    const editor = await makeUser("EDITOR");
    await expect(integrationStatus(editor)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("can pause CRM delivery from settings and uses settings for field mapping", async () => {
    process.env.BITRIX24_WEBHOOK_URL = "https://pci.bitrix24.com/rest/7/abc/";
    resetServerEnvCache();
    const admin = await makeUser("ADMIN");
    const settings = await getSettings();
    await saveSettings(admin, { ...settings, integrations: { ...settings.integrations, crmEnabled: false } });
    const stored = await submitLead(lead, { ipAddress: "10.2.2.2", userAgent: "t" });
    expect((await deliverLead(stored.id)).status).toBe("NOT_CONFIGURED");
    expect((await db.lead.findUniqueOrThrow({ where: { id: stored.id } })).crmLastError).toMatch(/turned off/);

    await expect(saveSettings(admin, { ...settings, integrations: { ...settings.integrations, bitrixProjectField: "project; drop" } })).rejects.toBeInstanceOf(ValidationError);
    await saveSettings(admin, { ...settings, integrations: { ...settings.integrations, crmEnabled: true, bitrixProjectField: "UF_CRM_PROJECT", bitrixAssigneeId: "12" } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: 55 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    // The job picks up the paused lead and records its run.
    const result = await runLeadDeliveryJob("manual", admin);
    expect(result.delivered).toBe(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.fields.ASSIGNED_BY_ID).toBe("12");
    const run = await db.jobRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });
    expect(run).toMatchObject({ trigger: "manual", success: true });
  });

  it("tests the Bitrix24 connection read-only", async () => {
    process.env.BITRIX24_WEBHOOK_URL = "https://pci.bitrix24.com/rest/7/abc/";
    resetServerEnvCache();
    const admin = await makeUser("ADMIN");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { ID: {}, TITLE: {} } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await testBitrix(admin)).toEqual({ ok: true, fieldCount: 2 });
    expect(String(fetchMock.mock.calls[0][0])).toContain("crm.lead.fields");
  });
});
