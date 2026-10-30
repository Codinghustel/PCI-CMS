import "server-only";
import { serverEnv } from "@/lib/env";
import { SSO_APP_KEY } from "@/lib/auth/orbit-sso";

// Server-to-server calls to PCI Orbit (token exchange and session check).
// The app secret is USERS_API_KEY and never reaches the browser.

const TIMEOUT_MS = 10_000;

export function orbitBase(): string {
  return serverEnv().ORBIT_URL.replace(/\/$/, "");
}

export function ssoConfigured(): boolean {
  return serverEnv().USERS_API_KEY.length >= 32;
}

async function orbitPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${orbitBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv().USERS_API_KEY}`,
      "X-Orbit-App": SSO_APP_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export interface OrbitIdentity {
  sid: string;
  email: string;
  name?: string;
}

export type ExchangeResult = { ok: true; identity: OrbitIdentity } | { ok: false; reason: "invalid_grant" | "unavailable" };

export async function exchangeCode(code: string, redirectUri: string): Promise<ExchangeResult> {
  try {
    const res = await orbitPost("/api/sso/token", { code, redirect_uri: redirectUri });
    if (res.status === 400) return { ok: false, reason: "invalid_grant" };
    if (!res.ok) {
      console.error("[sso] token exchange failed with status", res.status);
      return { ok: false, reason: "unavailable" };
    }
    const data = (await res.json()) as { sid?: unknown; user?: { email?: unknown; name?: unknown } };
    if (typeof data.sid !== "string" || !data.sid || typeof data.user?.email !== "string" || !data.user.email) {
      return { ok: false, reason: "unavailable" };
    }
    return {
      ok: true,
      identity: { sid: data.sid, email: data.user.email.toLowerCase(), name: typeof data.user.name === "string" ? data.user.name : undefined },
    };
  } catch (e) {
    console.error("[sso] token exchange error", e instanceof Error ? e.message : e);
    return { ok: false, reason: "unavailable" };
  }
}

/** "active" / "ended" are Orbit's answer; "unreachable" covers network errors and any non-200 reply. */
export async function checkOrbitSession(sid: string): Promise<"active" | "ended" | "unreachable"> {
  try {
    const res = await orbitPost("/api/sso/session", { sid, active: true });
    if (!res.ok) {
      console.error("[sso] session check failed with status", res.status);
      return "unreachable";
    }
    const data = (await res.json()) as { active?: unknown };
    if (data.active === true) return "active";
    if (data.active === false) return "ended";
    return "unreachable";
  } catch (e) {
    console.error("[sso] session check error", e instanceof Error ? e.message : e);
    return "unreachable";
  }
}
