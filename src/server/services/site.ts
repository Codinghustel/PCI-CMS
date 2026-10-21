import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { ForbiddenError, NotFoundError, ValidationError, mapPrismaError } from "@/server/errors";
import { normalizeList, parseInput, type ListParams } from "@/server/services/helpers";
import { menuInputSchema, normalizePath, redirectInputSchema } from "@/lib/validation/content";
import { resolveSettings, settingsSchema, SETTINGS_GROUPS, type SiteSettings } from "@/lib/settings";
import { resolveTheme, themeSchema, type ThemeTokens } from "@/lib/theme";
import { sanitizeRichText } from "@/lib/sanitize";
import { can, type Actor } from "@/lib/auth/permissions";

// ───────────────────────── Menus ─────────────────────────

export const MENU_KEYS = {
  header: "Main navigation",
  footer: "Footer links",
  legal: "Legal links (footer bottom)",
} as const;
export type MenuKey = keyof typeof MENU_KEYS;

export interface MenuLink {
  label: string;
  href: string;
  openInNewTab: boolean;
  children: { label: string; href: string; openInNewTab: boolean }[];
}

export async function getMenu(key: MenuKey): Promise<MenuLink[]> {
  const menu = await db.menu.findUnique({
    where: { key },
    include: { items: { where: { parentId: null }, orderBy: { order: "asc" }, include: { children: { orderBy: { order: "asc" } } } } },
  });
  if (!menu) return [];
  return menu.items.map((i) => ({
    label: i.label,
    href: i.href,
    openInNewTab: i.openInNewTab,
    children: i.children.map((c) => ({ label: c.label, href: c.href, openInNewTab: c.openInNewTab })),
  }));
}

export async function saveMenu(actor: Actor, key: MenuKey, input: unknown) {
  if (!can(actor, "navigation.manage")) throw new ForbiddenError("You do not have permission to edit menus.");
  if (!(key in MENU_KEYS)) throw new NotFoundError("Menu not found");
  const { items } = parseInput(menuInputSchema, input);
  await db.$transaction(async (tx) => {
    const menu = await tx.menu.upsert({ where: { key }, update: {}, create: { key, name: MENU_KEYS[key] } });
    await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
    for (const [order, item] of items.entries()) {
      const parent = await tx.menuItem.create({
        data: { menuId: menu.id, label: item.label, href: item.href, openInNewTab: item.openInNewTab, order },
      });
      if (item.children.length) {
        await tx.menuItem.createMany({
          data: item.children.map((c, childOrder) => ({ ...c, menuId: menu.id, parentId: parent.id, order: childOrder })),
        });
      }
    }
    await audit(actor, { action: "menu.update", entityType: "Menu", entityId: menu.id, summary: `Updated ${MENU_KEYS[key]}` }, tx);
  });
}

// ───────────────────────── Redirects ─────────────────────────

export async function listRedirects(params: ListParams) {
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where: Prisma.RedirectWhereInput = q
    ? { OR: [{ fromPath: { contains: q, mode: "insensitive" } }, { toPath: { contains: q, mode: "insensitive" } }] }
    : {};
  const [items, total] = await Promise.all([
    db.redirect.findMany({ where, orderBy: { fromPath: "asc" }, skip, take }),
    db.redirect.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function saveRedirect(actor: Actor, id: string | null, input: unknown) {
  if (!can(actor, "redirects.manage")) throw new ForbiddenError("You do not have permission to manage redirects.");
  const data = parseInput(redirectInputSchema, input);
  const values = { ...data, fromPath: normalizePath(data.fromPath) };
  // Prevent simple loops (A→B while B→A exists).
  const reverse = await db.redirect.findUnique({ where: { fromPath: normalizePath(values.toPath) } });
  if (reverse && normalizePath(reverse.toPath) === values.fromPath) {
    throw new ValidationError("This would create a redirect loop.", { toPath: [`${values.toPath} already redirects back to ${values.fromPath}.`] });
  }
  try {
    const item = id ? await db.redirect.update({ where: { id }, data: values }) : await db.redirect.create({ data: values });
    await audit(actor, { action: id ? "redirect.update" : "redirect.create", entityType: "Redirect", entityId: item.id, summary: `${item.fromPath} → ${item.toPath}` });
    return item;
  } catch (e) {
    mapPrismaError(e, { fromPath: "source path" });
  }
}

export async function deleteRedirect(actor: Actor, id: string) {
  if (!can(actor, "redirects.manage")) throw new ForbiddenError();
  const item = await db.redirect.delete({ where: { id } }).catch(() => {
    throw new NotFoundError("Redirect not found");
  });
  await audit(actor, { action: "redirect.delete", entityType: "Redirect", entityId: id, summary: `Removed ${item.fromPath} → ${item.toPath}` });
}

/** Looks up a redirect for a path that did not match any content. */
export async function findRedirect(path: string) {
  const fromPath = normalizePath(path);
  const redirect = await db.redirect.findUnique({ where: { fromPath } });
  if (redirect) {
    // Hit counting is best-effort and must never break the redirect.
    db.redirect.update({ where: { id: redirect.id }, data: { hits: { increment: 1 } } }).catch(() => {});
  }
  return redirect;
}

// ───────────────────────── Settings ─────────────────────────

export async function getSettings(): Promise<SiteSettings> {
  const row = await db.siteSettings.findUnique({ where: { id: "default" } });
  return resolveSettings(row?.data);
}

export async function saveSettings(actor: Actor, input: unknown) {
  if (!can(actor, "settings.manage")) throw new ForbiddenError("Only administrators can change site settings.");
  const data = parseInput(settingsSchema, input) as unknown as SiteSettings;
  data.payment.intro = sanitizeRichText(data.payment.intro);
  data.payment.securityNote = sanitizeRichText(data.payment.securityNote);
  if (data.analytics.gtmId && !/^GTM-[A-Z0-9]{4,12}$/.test(data.analytics.gtmId)) {
    throw new ValidationError("Check the Google Tag Manager ID.", { "analytics.gtmId": ["Use the format GTM-XXXXXXX"] });
  }
  if (data.integrations.bitrixProjectField && !/^UF_CRM_[A-Z0-9_]+$/.test(data.integrations.bitrixProjectField)) {
    throw new ValidationError("Check the Bitrix24 field code.", { "integrations.bitrixProjectField": ["Custom lead fields look like UF_CRM_PROJECT (capital letters, digits, underscores)."] });
  }
  if (data.integrations.bitrixAssigneeId && !/^\d+$/.test(data.integrations.bitrixAssigneeId)) {
    throw new ValidationError("Check the Bitrix24 user id.", { "integrations.bitrixAssigneeId": ["Enter the numeric Bitrix24 user id."] });
  }
  await db.siteSettings.upsert({
    where: { id: "default" },
    update: { data: data as unknown as Prisma.InputJsonValue },
    create: { id: "default", data: data as unknown as Prisma.InputJsonValue },
  });
  await audit(actor, { action: "settings.update", entityType: "SiteSettings", entityId: "default", summary: "Updated site settings", metadata: { groups: SETTINGS_GROUPS.map((g) => g.key) } });
  return data;
}

// ───────────────────────── Theme ─────────────────────────

export async function getTheme(): Promise<ThemeTokens> {
  const row = await db.themeSettings.findUnique({ where: { id: "default" } });
  return resolveTheme(row?.tokens);
}

export async function getThemeMeta() {
  return db.themeSettings.findUnique({ where: { id: "default" }, select: { updatedAt: true, updatedBy: { select: { name: true } } } });
}

export async function saveTheme(actor: Actor, input: unknown) {
  if (!can(actor, "theme.manage")) throw new ForbiddenError("Only administrators can change the website theme.");
  const tokens = parseInput(themeSchema, input);
  await db.themeSettings.upsert({
    where: { id: "default" },
    update: { tokens: tokens as unknown as Prisma.InputJsonValue, updatedById: actor.id },
    create: { id: "default", tokens: tokens as unknown as Prisma.InputJsonValue, updatedById: actor.id },
  });
  await audit(actor, { action: "theme.update", entityType: "ThemeSettings", entityId: "default", summary: "Updated website theme", metadata: tokens as unknown as Prisma.InputJsonValue });
  return tokens;
}
