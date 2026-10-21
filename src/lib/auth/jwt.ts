import { jwtVerify, SignJWT } from "jose";

// Session JWTs. This module only depends on `jose` and Web Crypto, so it can run
// in the proxy (optimistic checks / sliding renewal) as well as on the server.
// The token is a pointer to a server-side Session row: every protected
// operation still validates the session and user in the database, which is
// what makes logout, deactivation and password changes take effect immediately.

export const SESSION_COOKIE = "pci_session";
export { SESSION_ABSOLUTE_SECONDS, SESSION_IDLE_SECONDS, SESSION_RENEW_THRESHOLD_SECONDS } from "@/lib/limits";
import { SESSION_IDLE_SECONDS } from "@/lib/limits";

const ISSUER = "pci-orbit";
const AUDIENCE = "pci-orbit-cms";

export interface SessionClaims {
  sub: string; // user id
  sid: string; // session id
  aexp: number; // absolute expiry (epoch seconds)
  exp: number;
}

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(input: { userId: string; sessionId: string; absoluteExpiry: number }) {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.min(now + SESSION_IDLE_SECONDS, input.absoluteExpiry);
  const token = await new SignJWT({ sid: input.sessionId, aexp: input.absoluteExpiry })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key());
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || typeof payload.aexp !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    return { sub: payload.sub, sid: payload.sid, aexp: payload.aexp, exp: payload.exp };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
