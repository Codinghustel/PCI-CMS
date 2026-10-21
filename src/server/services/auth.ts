import { hash, verify } from "@node-rs/argon2";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { consumeRateLimit, resetRateLimit } from "@/server/services/rate-limit";
import { rolePermissions } from "@/server/services/roles";
import { RateLimitError, UnauthorizedError, ValidationError } from "@/server/errors";
import { signSessionToken, SESSION_ABSOLUTE_SECONDS } from "@/lib/auth/jwt";
import type { Actor, RoleName } from "@/lib/auth/permissions";
import { loginSchema } from "@/lib/validation/users";

// Argon2id parameters (OWASP recommended minimums: m=19 MiB, t=2, p=1).
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 /* Argon2id */ } as const;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_LOGIN_ERROR = "Invalid email or password.";

// Precomputed hash used to keep timing similar when the email does not exist.
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string) {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export interface LoginMeta {
  ipAddress?: string;
  userAgent?: string;
}

export async function login(input: unknown, meta: LoginMeta) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(GENERIC_LOGIN_ERROR);
  const { email, password } = parsed.data;

  // Throttle per IP and per account to slow down credential stuffing.
  const ipKey = `login:ip:${meta.ipAddress ?? "unknown"}`;
  const accountKey = `login:acct:${email}`;
  const [ipLimit, accountLimit] = await Promise.all([
    consumeRateLimit(ipKey, 20, 15 * 60),
    consumeRateLimit(accountKey, 10, 15 * 60),
  ]);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    throw new RateLimitError(Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds));
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    dummyHash ??= hashPassword("timing-equaliser-password");
    await verifyPassword(await dummyHash, password);
    throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new UnauthorizedError("This account is temporarily locked after repeated failed sign-in attempts. Try again later.");
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok || !user.isActive) {
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed >= MAX_FAILED_ATTEMPTS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil,
        },
      });
      if (failed >= MAX_FAILED_ATTEMPTS) {
        await audit(null, { action: "auth.lockout", entityType: "User", entityId: user.id, summary: `Account locked after ${failed} failed sign-in attempts` });
      }
    }
    throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
  }

  const absoluteExpiry = Math.floor(Date.now() / 1000) + SESSION_ABSOLUTE_SECONDS;
  const session = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const created = await tx.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(absoluteExpiry * 1000),
        ipAddress: meta.ipAddress?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 300),
      },
    });
    await audit({ id: user.id }, { action: "auth.login", entityType: "User", entityId: user.id, summary: "Signed in" }, tx);
    return created;
  });
  await resetRateLimit(accountKey);

  const { token, expiresAt } = await signSessionToken({ userId: user.id, sessionId: session.id, absoluteExpiry });
  return { token, expiresAt, user: toActor(user) };
}

/** Validates a session id from a verified token against the database. */
export async function resolveSession(sessionId: string, userId: string): Promise<Actor | null> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session || session.userId !== userId) return null;
  if (session.revokedAt || session.expiresAt <= new Date()) return null;
  if (!session.user.isActive) return null;
  const actor = toActor(session.user);
  // Effective (possibly customised) role permissions, resolved on every request.
  return { ...actor, permissions: await rolePermissions(actor.role) };
}

export async function logout(sessionId: string, actor: Pick<Actor, "id"> | null) {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (actor) await audit(actor, { action: "auth.logout", entityType: "User", entityId: actor.id, summary: "Signed out" });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export async function purgeExpiredSessions() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] } });
}

function toActor(user: { id: string; name: string; email: string; role: string }): Actor {
  return { id: user.id, name: user.name, email: user.email, role: user.role as RoleName };
}
