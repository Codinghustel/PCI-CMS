import { hash, verify } from "@node-rs/argon2";
import { db } from "@/server/db";
import { serverEnv } from "@/lib/env";
import { checkOrbitSession } from "@/server/services/orbit-sso";
import { orbitCheckDue, withinOutageGrace } from "@/lib/auth/orbit-sso";
import { audit } from "@/server/services/audit";
import { consumeRateLimit, resetRateLimit } from "@/server/services/rate-limit";
import { rolePermissions } from "@/server/services/roles";
import { RateLimitError, UnauthorizedError, ValidationError } from "@/server/errors";
import { signSessionToken, SESSION_ABSOLUTE_SECONDS } from "@/lib/auth/jwt";
import type { Actor, RoleName } from "@/lib/auth/permissions";
import { loginSchema } from "@/lib/validation/users";
import { LOCKOUT_MINUTES, MAX_FAILED_LOGIN_ATTEMPTS } from "@/lib/limits";

// Argon2id parameters (OWASP recommended minimums: m=19 MiB, t=2, p=1).
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 /* Argon2id */ } as const;

const MAX_FAILED_ATTEMPTS = MAX_FAILED_LOGIN_ATTEMPTS;
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

export const PASSWORD_LOGIN_DISABLED = "Password sign-in is turned off. Sign in with PCI Orbit instead.";

export function passwordLoginAllowed(): boolean {
  return serverEnv().ALLOW_PASSWORD_LOGIN;
}

export async function login(input: unknown, meta: LoginMeta) {
  if (!passwordLoginAllowed()) throw new UnauthorizedError(PASSWORD_LOGIN_DISABLED);
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

  const ok = await verifyPassword(user.passwordHash, password);

  // Only reveal the lock to someone who knows the password; otherwise a locked account would be
  // distinguishable from an unknown email.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    if (!ok) throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
    throw new UnauthorizedError("This account is temporarily locked after repeated failed sign-in attempts. Try again later.");
  }

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

  const { token, expiresAt } = await startSession(user, meta, { summary: "Signed in" });
  await resetRateLimit(accountKey);

  return { token, expiresAt, user: toActor(user) };
}

/** Creates the Session row (plus lastLoginAt and the audit entry) and its signed cookie token. */
async function startSession(
  user: { id: string },
  meta: LoginMeta,
  opts: { summary: string; orbitSid?: string }
) {
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
        ...(opts.orbitSid ? { orbitSid: opts.orbitSid, orbitCheckedAt: new Date() } : {}),
      },
    });
    await audit({ id: user.id }, { action: "auth.login", entityType: "User", entityId: user.id, summary: opts.summary }, tx);
    return created;
  });
  return signSessionToken({ userId: user.id, sessionId: session.id, absoluteExpiry });
}

/**
 * Starts a CMS session for a person Orbit has authenticated. Returns null when there is no active
 * CMS account for the email (accounts are only created through the Orbit users API).
 */
export async function loginWithOrbit(identity: { email: string; sid: string }, meta: LoginMeta) {
  const user = await db.user.findFirst({ where: { email: { equals: identity.email, mode: "insensitive" } } });
  if (!user || !user.isActive) return null;
  const { token, expiresAt } = await startSession(user, meta, { summary: "Signed in with PCI Orbit", orbitSid: identity.sid });
  return { token, expiresAt, user: toActor(user) };
}

// One in-flight Orbit check per sid, so parallel requests of one page load share a single call.
const inflightChecks = new Map<string, Promise<"active" | "ended" | "unreachable">>();

const failedChecks = new Map<string, number>();

/**
 * Keeps the session tied to Orbit (contract section 2): asks Orbit at most every 60 s, ends the
 * session when Orbit says it is over, tolerates an unreachable Orbit for 5 minutes.
 */
async function orbitSessionStillValid(session: { id: string; orbitSid: string | null; orbitCheckedAt: Date | null }): Promise<boolean> {
  if (!session.orbitSid) return passwordLoginAllowed(); // password sessions are independent of Orbit; valid while password sign-in is enabled
  if (!orbitCheckDue(session.orbitCheckedAt)) return true;
  const sid = session.orbitSid;
  // After a failed attempt don't hammer an unreachable Orbit (10 s timeout) on every request.
  const lastFailure = failedChecks.get(sid);
  if (lastFailure && !orbitCheckDue(new Date(lastFailure))) return withinOutageGrace(session.orbitCheckedAt);
  let pending = inflightChecks.get(sid);
  if (!pending) {
    pending = checkOrbitSession(sid).finally(() => inflightChecks.delete(sid));
    inflightChecks.set(sid, pending);
  }
  const result = await pending;
  if (result === "unreachable") failedChecks.set(sid, Date.now());
  else failedChecks.delete(sid);
  if (result === "active") {
    await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { orbitCheckedAt: new Date() } });
    return true;
  }
  if (result === "ended") {
    await revokeOrbitSessions(sid);
    return false;
  }
  return withinOutageGrace(session.orbitCheckedAt);
}

export async function getSessionOrbitSid(sessionId: string): Promise<string | null> {
  return (await db.session.findUnique({ where: { id: sessionId }, select: { orbitSid: true } }))?.orbitSid ?? null;
}

/** Ends every CMS session tied to an Orbit session. Returns how many were ended. */
export async function revokeOrbitSessions(orbitSid: string) {
  const { count } = await db.session.updateMany({ where: { orbitSid, revokedAt: null }, data: { revokedAt: new Date() } });
  return count;
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
  if (!(await orbitSessionStillValid(session))) return null;
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
