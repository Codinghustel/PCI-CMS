import { describe, expect, it } from "vitest";
import { can, canEditItem, permissionsFor } from "@/lib/auth/permissions";
import { isSafeHref, normalizePhone, parseYoutubeId, slugify, isReservedPageSlug } from "@/lib/text";
import { sanitizeRichText } from "@/lib/sanitize";
import { detectFileType } from "@/lib/file-types";
import { nextStatus, resolvePublishedAt } from "@/server/services/helpers";
import { ForbiddenError } from "@/server/errors";

const actor = (role: "ADMIN" | "EDITOR" | "AUTHOR" | "SALES_APPROVER" | "VIEWER", id = "u1") => ({ id, role, name: role, email: `${role}@x` });

describe("RBAC permissions", () => {
  it("grants administrators everything", () => {
    expect(can(actor("ADMIN"), "users.manage")).toBe(true);
    expect(can(actor("ADMIN"), "theme.manage")).toBe(true);
  });
  it("restricts editors from user, theme and settings administration", () => {
    expect(can(actor("EDITOR"), "content.publish")).toBe(true);
    expect(can(actor("EDITOR"), "users.manage")).toBe(false);
    expect(can(actor("EDITOR"), "theme.manage")).toBe(false);
    expect(can(actor("EDITOR"), "settings.manage")).toBe(false);
  });
  it("lets authors write only their own unpublished items", () => {
    const a = actor("AUTHOR", "me");
    expect(can(a, "content.publish")).toBe(false);
    expect(canEditItem(a, null)).toBe(true);
    expect(canEditItem(a, { authorId: "me", status: "DRAFT" })).toBe(true);
    expect(canEditItem(a, { authorId: "me", status: "PUBLISHED" })).toBe(false);
    expect(canEditItem(a, { authorId: "someone-else", status: "DRAFT" })).toBe(false);
  });
  it("keeps commercial approval with sales approvers (and admins)", () => {
    expect(can(actor("SALES_APPROVER"), "projects.approveCommercial")).toBe(true);
    expect(can(actor("EDITOR"), "projects.approveCommercial")).toBe(false);
    expect(can(actor("VIEWER"), "content.writeOwn")).toBe(false);
  });
  it("denies anonymous actors", () => {
    expect(can(null, "dashboard.view")).toBe(false);
    expect(permissionsFor("VIEWER").has("leads.read")).toBe(true);
  });
});

describe("publishing workflow", () => {
  it("prevents authors from publishing", () => {
    expect(() => nextStatus(actor("AUTHOR"), "DRAFT", "publish")).toThrow(ForbiddenError);
    expect(nextStatus(actor("AUTHOR"), "DRAFT", "submit")).toBe("IN_REVIEW");
  });
  it("allows editors to publish and unpublish", () => {
    expect(nextStatus(actor("EDITOR"), "IN_REVIEW", "publish")).toBe("PUBLISHED");
    expect(nextStatus(actor("EDITOR"), "PUBLISHED", "unpublish")).toBe("ARCHIVED");
  });
  it("keeps the original publication date and honours scheduled dates", () => {
    const existing = new Date("2026-01-01T00:00:00Z");
    expect(resolvePublishedAt("PUBLISHED", existing)).toBe(existing);
    const future = new Date("2027-01-01T00:00:00Z");
    expect(resolvePublishedAt("PUBLISHED", null, future)).toBe(future);
    expect(resolvePublishedAt("DRAFT", null)).toBeNull();
    // Unpublishing a scheduled item clears the schedule, so publishing again goes live now.
    expect(resolvePublishedAt("DRAFT", future)).toBeNull();
    expect(resolvePublishedAt("DRAFT", existing)).toBe(existing);
    expect(resolvePublishedAt("PUBLISHED", future)).toBe(future); // an edit keeps the schedule
  });
});

describe("text utilities", () => {
  it("slugifies titles", () => {
    expect(slugify("Grand Orchard — DHA Phase 1!")).toBe("grand-orchard-dha-phase-1");
    expect(slugify("Café & Résidence")).toBe("cafe-and-residence");
  });
  it("extracts YouTube ids and rejects other URLs", () => {
    expect(parseYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeId("https://evil.example.com/watch?v=dQw4w9WgXcQ")).toBe("");
  });
  it("normalises phone numbers", () => {
    expect(normalizePhone("+92 301 123 3333")).toBe("+923011233333");
    expect(normalizePhone("00971 4 591 7499")).toBe("+97145917499");
    expect(normalizePhone("12")).toBe("");
  });
  it("only allows safe link protocols", () => {
    expect(isSafeHref("/projects")).toBe(true);
    expect(isSafeHref("https://premierchoiceint.com")).toBe(true);
    expect(isSafeHref("tel:+971")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("//evil.com")).toBe(false);
    expect(isSafeHref("/\\evil.com")).toBe(false);
    expect(isSafeHref("/\t/evil.com")).toBe(false);
    expect(isSafeHref("/projects/grand-orchard?tab=updates#plan")).toBe(true);
  });
  it("reserves application routes", () => {
    expect(isReservedPageSlug("projects")).toBe(true);
    expect(isReservedPageSlug("admin/x")).toBe(true);
    expect(isReservedPageSlug("about/leadership")).toBe(false);
  });
});

describe("rich text sanitisation", () => {
  it("removes scripts, event handlers and javascript: links", () => {
    const out = sanitizeRichText('<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><iframe src="https://evil"></iframe>');
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|iframe|<img/i);
    expect(out).toContain("<p>Hi</p>");
  });
  it("keeps formatting and hardens external links", () => {
    const out = sanitizeRichText('<h2>T</h2><ul><li><strong>a</strong></li></ul><a href="https://x.com">x</a>');
    expect(out).toContain("<h2>T</h2>");
    expect(out).toContain('rel="noopener noreferrer"');
  });
});

describe("upload file type detection", () => {
  it("detects allowed types by magic bytes", () => {
    expect(detectFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.mime).toBe("image/png");
    expect(detectFileType(new TextEncoder().encode("%PDF-1.7 ......"))?.mime).toBe("application/pdf");
  });
  it("rejects SVG, HTML and executables regardless of name", () => {
    expect(detectFileType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("<!doctype html><html>"))).toBeNull();
    expect(detectFileType(new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]))).toBeNull(); // PE/EXE
  });
});

describe("customisable role permissions", () => {
  it("uses an actor's resolved permission list over the defaults", async () => {
    const { can: canDo } = await import("@/lib/auth/permissions");
    const author = { id: "a", role: "AUTHOR" as const, name: "A", email: "a@x", permissions: ["content.publish", "content.read"] as const };
    expect(canDo(author, "content.publish")).toBe(true);
    expect(canDo(author, "media.upload")).toBe(false); // not in the custom list
  });
  it("never grants admin-only permissions to other roles", async () => {
    const { can: canDo, sanitizeRolePermissions } = await import("@/lib/auth/permissions");
    expect(sanitizeRolePermissions("EDITOR", ["users.manage", "content.read", "bogus"])).toEqual(["content.read"]);
    expect(canDo({ role: "EDITOR", permissions: ["users.manage"] }, "users.manage")).toBe(false);
    expect(canDo({ role: "ADMIN", permissions: [] }, "users.manage")).toBe(true);
  });
});
