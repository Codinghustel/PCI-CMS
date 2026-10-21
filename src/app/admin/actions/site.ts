"use server";

import { requireActor, requirePermission } from "@/lib/auth/session";
import { runAction } from "@/lib/safe-action";
import { refreshPublic } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache-tags";
import type { ActionState } from "@/lib/action-state";
import * as site from "@/server/services/site";
import * as media from "@/server/services/media";
import * as users from "@/server/services/users";
import * as leads from "@/server/services/leads";
import * as roles from "@/server/services/roles";
import * as integrations from "@/server/services/integrations";
import type { RoleName } from "@/lib/auth/permissions";
import type { MediaSummary } from "@/server/services/media";

// ───────── Navigation, redirects, settings, theme ─────────
export async function saveMenuAction(key: string, input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await site.saveMenu(await requireActor(), key as site.MenuKey, input);
    refreshPublic(TAGS.navigation);
    return { ok: true, message: "Menu saved." };
  });
}

export async function saveRedirectAction(id: string | null, input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await site.saveRedirect(await requireActor(), id, input);
    refreshPublic(TAGS.redirects);
    return { ok: true, message: "Redirect saved." };
  });
}

export async function deleteRedirectAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    await site.deleteRedirect(await requireActor(), id);
    refreshPublic(TAGS.redirects);
    return { ok: true, message: "Redirect removed." };
  });
}

export async function saveSettingsAction(input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await site.saveSettings(await requireActor(), input);
    refreshPublic(TAGS.site);
    return { ok: true, message: "Settings saved." };
  });
}

export async function saveThemeAction(input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await site.saveTheme(await requireActor(), input);
    refreshPublic(TAGS.theme);
    return { ok: true, message: "Theme published to the website." };
  });
}

// ───────── Media ─────────
export async function searchMediaAction(params: { q?: string; kind?: "IMAGE" | "DOCUMENT"; page?: number }): Promise<{ items: MediaSummary[]; total: number; page: number; pageSize: number }> {
  await requirePermission("media.read");
  const result = await media.listMedia({ q: params.q, kind: params.kind, page: params.page, pageSize: 24 });
  return { ...result, items: result.items.map(media.toMediaSummary) };
}

export async function updateMediaAction(id: string, input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await media.updateMediaMeta(await requireActor(), id, input);
    refreshPublic(TAGS.site);
    return { ok: true, message: "File details saved." };
  });
}

export async function deleteMediaAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    await media.deleteMedia(await requireActor(), id);
    refreshPublic(TAGS.media);
    return { ok: true, message: "File deleted." };
  });
}

// ───────── Users ─────────
export async function createUserAction(input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await users.createUser(await requireActor(), input);
    return { ok: true, message: "User created." };
  });
}

export async function updateUserAction(id: string, input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await users.updateUser(await requireActor(), id, input);
    return { ok: true, message: "User updated." };
  });
}

export async function resetPasswordAction(id: string, input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await users.resetUserPassword(await requireActor(), id, input);
    return { ok: true, message: "Password reset. The user's sessions were signed out." };
  });
}

export async function deleteUserAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    await users.deleteUser(await requireActor(), id);
    return { ok: true, message: "User deleted." };
  });
}

// ───────── Leads ─────────
export async function resendLeadAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const result = await leads.resendLead(await requireActor(), id);
    if (result.status === "DELIVERED") return { ok: true, message: "Delivered to Bitrix24." };
    if (result.status === "NOT_CONFIGURED") return { ok: false, message: "Bitrix24 is not configured (BITRIX24_WEBHOOK_URL)." };
    return { ok: false, message: `Delivery failed: ${"error" in result ? result.error : "unknown error"}` };
  });
}

// ───────── Roles & permissions ─────────
export async function updateRoleAction(input: unknown): Promise<ActionState> {
  return runAction(async () => {
    const result = await roles.updateRolePermissions(await requireActor(), input);
    const changes = result.added.length + result.removed.length;
    return { ok: true, message: changes ? `Permissions updated (${changes} change${changes === 1 ? "" : "s"}). They apply immediately.` : "No changes to save." };
  });
}

export async function resetRoleAction(role: string): Promise<ActionState> {
  return runAction(async () => {
    await roles.resetRolePermissions(await requireActor(), role as RoleName);
    return { ok: true, message: "Role reset to its default permissions." };
  });
}

// ───────── Integrations ─────────
export async function testBitrixAction(): Promise<ActionState> {
  return runAction(async () => {
    const result = await integrations.testBitrix(await requireActor());
    return result.ok
      ? { ok: true, message: `Connected to Bitrix24 (${result.fieldCount} lead fields available).` }
      : { ok: false, message: `Bitrix24 connection failed: ${result.error}` };
  });
}

export async function runLeadDeliveryAction(): Promise<ActionState> {
  return runAction(async () => {
    const result = await integrations.runLeadDeliveryJob("manual", await requireActor());
    return { ok: true, message: `Delivery job finished: ${result.processed} processed, ${result.delivered} delivered.` };
  });
}
