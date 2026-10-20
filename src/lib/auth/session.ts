import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession } from "@/server/services/auth";
import { SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from "@/lib/auth/jwt";
import { can, type Actor, type Permission } from "@/lib/auth/permissions";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";

// Data Access Layer for authentication in Next.js code (Server Components,
// Server Actions, Route Handlers). Business services receive the resolved
// Actor and perform their own permission checks.

export interface CurrentSession {
  actor: Actor;
  sessionId: string;
}

/** Resolves the current session once per request. Returns null when signed out. */
export const getCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const actor = await resolveSession(claims.sid, claims.sub);
  return actor ? { actor, sessionId: claims.sid } : null;
});

export async function getCurrentActor(): Promise<Actor | null> {
  return (await getCurrentSession())?.actor ?? null;
}

/** For pages: redirects to the login screen when not signed in. */
export async function requireActorPage(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

/** For pages: redirects to the access-denied screen when the permission is missing. */
export async function requirePermissionPage(permission: Permission): Promise<Actor> {
  const actor = await requireActorPage();
  if (!can(actor, permission)) redirect("/admin/forbidden");
  return actor;
}

/** For actions and route handlers: throws AppErrors instead of redirecting. */
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) throw new UnauthorizedError();
  return actor;
}

export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor, permission)) throw new ForbiddenError();
  return actor;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || h.get("x-real-ip") || "unknown",
    userAgent: h.get("user-agent") ?? "",
  };
}
