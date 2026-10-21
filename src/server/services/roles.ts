import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { parseInput } from "@/server/services/helpers";
import {
  ADMIN_ONLY_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLES,
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
    update: { permissions: next, updatedById: actor.id },
    create: { role, permissions: next, updatedById: actor.id },
  });
  const removed = before.filter((p) => !next.includes(p));
  const added = next.filter((p) => !before.includes(p));
  await audit(actor, {
    action: "role.update",
    entityType: "Role",
    entityId: role,
    summary: `Updated ${role} permissions${added.length ? ` (+${added.join(", +")})` : ""}${removed.length ? ` (-${removed.join(", -")})` : ""}`,
    metadata: { added, removed },
  });
  return { role, permissions: next, added, removed };
}

export async function resetRolePermissions(actor: Actor, role: RoleName) {
  if (!can(actor, "users.manage")) throw new ForbiddenError("Only administrators can manage roles.");
  if (role === "ADMIN") throw new ValidationError("Administrator permissions are fixed.");
  await db.rolePermission.deleteMany({ where: { role } });
  await audit(actor, { action: "role.reset", entityType: "Role", entityId: role, summary: `Reset ${role} permissions to defaults` });
  return { role, permissions: [...DEFAULT_ROLE_PERMISSIONS[role]] };
}

