import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { parseInput } from "@/server/services/helpers";
import {
  ADMIN_ONLY_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_INFO,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  can,
  sanitizeRolePermissions,
  type Actor,
  type Permission,
  type RoleName,
} from "@/lib/auth/permissions";

export interface RoleSummary {
  role: RoleName;
  permissions: Permission[];
  customised: boolean;
  userCount: number;
  updatedAt: Date | null;
}

/** Effective permissions for one role (custom set if stored, else defaults). */
export async function rolePermissions(role: RoleName): Promise<Permission[]> {
  if (role === "ADMIN") return [...PERMISSIONS];
  const row = await db.rolePermission.findUnique({ where: { role } });
  return row ? sanitizeRolePermissions(role, row.permissions) : [...DEFAULT_ROLE_PERMISSIONS[role]];
}

export async function listRoles(actor: Actor): Promise<RoleSummary[]> {
  if (!can(actor, "users.manage")) throw new ForbiddenError("Only administrators can manage roles.");
  return roleSummaries();
}

async function roleSummaries(): Promise<RoleSummary[]> {
  const [rows, counts] = await Promise.all([
    db.rolePermission.findMany(),
    db.user.groupBy({ by: ["role"], _count: true, where: { isActive: true } }),
  ]);
  return ROLES.map((role) => {
    const row = role === "ADMIN" ? undefined : rows.find((r) => r.role === role);
    return {
      role,
      permissions: role === "ADMIN" ? [...PERMISSIONS] : row ? sanitizeRolePermissions(role, row.permissions) : [...DEFAULT_ROLE_PERMISSIONS[role]],
      customised: !!row,
      userCount: counts.find((c) => c.role === role)?._count ?? 0,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

const updateSchema = z.object({
  role: z.enum(ROLES),
  permissions: z.array(z.string().max(60)).max(100),
});

/**
 * Saves a custom permission set for a non-admin role. Admin-only permissions
 * are refused. Permissions are resolved on every request (see
 * services/auth resolveSession), so changes apply to signed-in users at once.
 */
export async function updateRolePermissions(actor: Actor, input: unknown) {
  if (!can(actor, "users.manage")) throw new ForbiddenError("Only administrators can manage roles.");
  return saveRolePermissions(input, { actorId: actor.id });
}

/** Shared by the CMS (signed-in admin) and the external API (no actor, audited as an API action). */
async function saveRolePermissions(input: unknown, by: { actorId: string | null; ipAddress?: string }) {
  const { role, permissions } = parseInput(updateSchema, input);
  if (role === "ADMIN") throw new ValidationError("Administrator permissions are fixed and cannot be changed.");
  const requestedAdminOnly = permissions.filter((p) => (ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(p));
  if (requestedAdminOnly.length) {
    throw new ValidationError(`"${requestedAdminOnly.join(", ")}" can only be held by administrators.`);
  }
  const unknown = permissions.filter((p) => !(PERMISSIONS as readonly string[]).includes(p));
  if (unknown.length) throw new ValidationError(`Unknown permission: ${unknown.join(", ")}`);

  const next = sanitizeRolePermissions(role, permissions);
  const before = await rolePermissions(role);
  await db.rolePermission.upsert({
    where: { role },
    update: { permissions: next, updatedById: by.actorId },
    create: { role, permissions: next, updatedById: by.actorId },
  });
  const removed = before.filter((p) => !next.includes(p));
  const added = next.filter((p) => !before.includes(p));
  await audit(by.actorId ? { id: by.actorId } : null, {
    action: "role.update",
    entityType: "Role",
    entityId: role,
    summary: `Updated ${role} permissions${added.length ? ` (+${added.join(", +")})` : ""}${removed.length ? ` (-${removed.join(", -")})` : ""}${by.actorId ? "" : " via external API"}`,
    metadata: by.actorId ? { added, removed } : { added, removed, source: "api", ipAddress: by.ipAddress },
  });
  return { role, permissions: next, added, removed };
}

export async function resetRolePermissions(actor: Actor, role: RoleName) {
  if (!can(actor, "users.manage")) throw new ForbiddenError("Only administrators can manage roles.");
  return resetToDefaults(role, { actorId: actor.id });
}

async function resetToDefaults(role: RoleName, by: { actorId: string | null; ipAddress?: string }) {
  if (role === "ADMIN") throw new ValidationError("Administrator permissions are fixed.");
  await db.rolePermission.deleteMany({ where: { role } });
  await audit(by.actorId ? { id: by.actorId } : null, {
    action: "role.reset",
    entityType: "Role",
    entityId: role,
    summary: `Reset ${role} permissions to defaults${by.actorId ? "" : " via external API"}`,
    ...(by.actorId ? {} : { metadata: { source: "api", ipAddress: by.ipAddress } }),
  });
  return { role, permissions: [...DEFAULT_ROLE_PERMISSIONS[role]] };
}

// ─────────────── External API (GET/PUT/DELETE /api/v1/roles…, authenticated by USERS_API_KEY) ───────────────

export async function listRolesFromApi(meta: { ipAddress: string }) {
  await enforceRateLimit(`users-api:${meta.ipAddress}`, 30, 15 * 60);
  const roles = await roleSummaries();
  return {
    roles: roles.map((r) => ({
      role: r.role,
      label: ROLE_LABELS[r.role],
      description: ROLE_DESCRIPTIONS[r.role],
      editable: r.role !== "ADMIN",
      customised: r.customised,
      permissions: r.permissions,
      userCount: r.userCount,
      updatedAt: r.updatedAt,
    })),
    permissions: PERMISSIONS.map((key) => ({ key, ...PERMISSION_INFO[key], adminOnly: ADMIN_ONLY_PERMISSIONS.includes(key) })),
  };
}

export async function updateRolePermissionsFromApi(role: string, input: unknown, meta: { ipAddress: string }) {
  await enforceRateLimit(`users-api:${meta.ipAddress}`, 30, 15 * 60);
  if (!(ROLES as readonly string[]).includes(role)) throw new NotFoundError(`Unknown role: ${role}`);
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return saveRolePermissions({ role, permissions: body.permissions }, { actorId: null, ipAddress: meta.ipAddress });
}

export async function resetRolePermissionsFromApi(role: string, meta: { ipAddress: string }) {
  await enforceRateLimit(`users-api:${meta.ipAddress}`, 30, 15 * 60);
  if (!(ROLES as readonly string[]).includes(role)) throw new NotFoundError(`Unknown role: ${role}`);
  return resetToDefaults(role as RoleName, { actorId: null, ipAddress: meta.ipAddress });
}

