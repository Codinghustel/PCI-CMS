import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { hashPassword, revokeAllSessions, verifyPassword } from "@/server/services/auth";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, mapPrismaError } from "@/server/errors";
import { normalizeList, parseInput, type ListParams } from "@/server/services/helpers";
import { can, type Actor } from "@/lib/auth/permissions";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { apiCreateUserSchema, changeOwnPasswordSchema, createUserSchema, lookupUserSchema, resetPasswordSchema, updateUserSchema } from "@/lib/validation/users";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

function assertAdmin(actor: Actor) {
  if (!can(actor, "users.manage")) throw new ForbiddenError("Only administrators can manage users.");
}

export async function listUsers(actor: Actor, params: ListParams & { role?: string }) {
  assertAdmin(actor);
  const { skip, take, q, page, pageSize } = normalizeList(params);
  const where: Prisma.UserWhereInput = {
    ...(params.role ? { role: params.role as Prisma.UserWhereInput["role"] & string } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({ where, select: userSelect, orderBy: { name: "asc" }, skip, take }),
    db.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getUser(actor: Actor, id: string) {
  assertAdmin(actor);
  const user = await db.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function createUser(actor: Actor, input: unknown) {
  assertAdmin(actor);
  const data = parseInput(createUserSchema, input);
  try {
    const user = await db.user.create({
      data: { name: data.name, email: data.email, role: data.role, passwordHash: await hashPassword(data.password) },
      select: userSelect,
    });
    await audit(actor, { action: "user.create", entityType: "User", entityId: user.id, summary: `Created user ${user.email} (${user.role})` });
    return user;
  } catch (e) {
    mapPrismaError(e, { email: "email address" });
  }
}

/**
 * Creates a user on behalf of an external app (POST /api/v1/users). The caller
 * is authenticated by API key, not a session, so there is no actor: the audit
 * entry is recorded as a system action. ADMIN accounts cannot be created here.
 */
export async function createUserFromApi(input: unknown, meta: { ipAddress: string }) {
  await enforceRateLimit(`users-api:${meta.ipAddress}`, 30, 15 * 60);
  const data = parseInput(apiCreateUserSchema, input);
  try {
    const user = await db.user.create({
      data: { name: data.name, email: data.email, role: data.role, passwordHash: await hashPassword(data.password) },
      select: userSelect,
    });
    await audit(null, {
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      summary: `Created user ${user.email} (${user.role}) via external API`,
      metadata: { source: "api", ipAddress: meta.ipAddress },
    });
    return user;
  } catch (e) {
    mapPrismaError(e, { email: "email address" });
  }
}

/**
 * Read-only lookup for an external app (GET /api/v1/users?email=). Returns only
 * the fields the caller needs; ADMIN accounts are included. Reads are not
 * audited (same as GET /api/v1/roles).
 */
export async function findUserByEmailFromApi(input: unknown, meta: { ipAddress: string }) {
  await enforceRateLimit(`users-api:${meta.ipAddress}`, 30, 15 * 60);
  const { email } = parseInput(lookupUserSchema, input);
  const user = await db.user.findUnique({ where: { email }, select: { email: true, name: true, role: true, isActive: true } });
  if (!user) throw new NotFoundError(`No CMS account uses ${email}.`);
  return user;
}

/**
 * Updates role/name/active status. Guards: the role value is validated against
 * the server-side enum (never trusted from the client), administrators cannot
 * demote or deactivate themselves, and the last active administrator cannot
 * be removed.
 */
export async function updateUser(actor: Actor, id: string, input: unknown) {
  assertAdmin(actor);
  const data = parseInput(updateUserSchema, input);
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError("User not found");

  if (target.id === actor.id && (data.role !== target.role || !data.isActive)) {
    throw new ValidationError("You cannot change your own role or deactivate your own account.");
  }
  const losingAdmin = target.role === "ADMIN" && target.isActive && (data.role !== "ADMIN" || !data.isActive);

  const user = await db.$transaction(async (tx) => {
    if (losingAdmin) {
      const activeAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
      if (activeAdmins <= 1) throw new ConflictError("At least one active administrator is required.");
    }
    const updated = await tx.user.update({ where: { id }, data, select: userSelect });
    await audit(actor, {
      action: "user.update",
      entityType: "User",
      entityId: id,
      summary: `Updated ${updated.email}: role ${target.role}→${updated.role}, ${updated.isActive ? "active" : "deactivated"}`,
    }, tx);
    return updated;
  });
  if (!data.isActive || data.role !== target.role) await revokeAllSessions(id);
  return user;
}

export async function resetUserPassword(actor: Actor, id: string, input: unknown) {
  assertAdmin(actor);
  const { password } = parseInput(resetPasswordSchema, input);
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError("User not found");
  await db.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await revokeAllSessions(id);
  await audit(actor, { action: "user.password_reset", entityType: "User", entityId: id, summary: `Reset password for ${target.email}` });
}

export async function changeOwnPassword(actor: Actor, currentSessionId: string, input: unknown) {
  const data = parseInput(changeOwnPasswordSchema, input);
  const user = await db.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new NotFoundError();
  if (!(await verifyPassword(user.passwordHash, data.currentPassword))) {
    throw new ValidationError("Your current password is incorrect.", { currentPassword: ["Incorrect password"] });
  }
  await db.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(data.newPassword), passwordChangedAt: new Date() } });
  // Sign out every other device.
  await revokeAllSessions(actor.id, currentSessionId);
  await audit(actor, { action: "user.password_change", entityType: "User", entityId: actor.id, summary: "Changed own password" });
}

export async function deleteUser(actor: Actor, id: string) {
  assertAdmin(actor);
  if (id === actor.id) throw new ValidationError("You cannot delete your own account.");
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError("User not found");
  await db.$transaction(async (tx) => {
    if (target.role === "ADMIN" && target.isActive) {
      const activeAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
      if (activeAdmins <= 1) throw new ConflictError("At least one active administrator is required.");
    }
    await tx.user.delete({ where: { id } });
    await audit(actor, { action: "user.delete", entityType: "User", entityId: id, summary: `Deleted user ${target.email}` }, tx);
  });
}
