import crypto from "node:crypto";

// PCI Orbit single sign-on: the pure parts (state handling, safe redirect paths and the
// session-check schedule). No I/O here so they can be unit tested; see server/services/orbit-sso.ts
// for the calls to Orbit. Contract: Apps-PCI-Backend/docs/orbit-sso.md.

export const SSO_APP_KEY = "cms";
export const SSO_STATE_COOKIE = "pci_sso_state";
export const SSO_STATE_MAX_AGE_SECONDS = 10 * 60;
/** Never ask Orbit about the same session more often than this. */
export const ORBIT_CHECK_INTERVAL_MS = 60_000;
/** If Orbit can't be reached, keep a session this long after the last successful check. */
export const ORBIT_GRACE_MS = 5 * 60_000;

/** Only internal CMS paths are allowed as the post-login destination. */
const SAFE_NEXT = /^\/admin(\/[\w\-/]*)?$/;

export function safeNextPath(next: unknown): string {
  return typeof next === "string" && SAFE_NEXT.test(next) ? next : "/admin";
}

export function generateState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Cookie value: "<state>|<next>". Neither part can contain "|". */
export function encodeStateCookie(state: string, next: string): string {
  return `${state}|${safeNextPath(next)}`;
}

export function parseStateCookie(value: string | undefined | null): { state: string; next: string } | null {
  if (!value) return null;
  const i = value.indexOf("|");
  if (i < 16) return null;
  return { state: value.slice(0, i), next: safeNextPath(value.slice(i + 1)) };
}

/** Constant-time comparison; false when either side is missing or the lengths differ. */
export function statesMatch(expected: string | undefined | null, actual: string | undefined | null): boolean {
  if (!expected || !actual || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function callbackUrl(siteBase: string): string {
  return `${siteBase.replace(/\/$/, "")}/admin/sso/callback`;
}

export function authorizeUrl(orbitUrl: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ app: SSO_APP_KEY, redirect_uri: redirectUri, state });
  return `${orbitUrl.replace(/\/$/, "")}/api/sso/authorize?${q}`;
}

export function logoutUrl(orbitUrl: string): string {
  return `${orbitUrl.replace(/\/$/, "")}/api/sso/logout?app=${SSO_APP_KEY}`;
}

/** Is it time to ask Orbit again? (More than 60 s since the last successful check.) */
export function orbitCheckDue(checkedAt: Date | null | undefined, now = Date.now()): boolean {
  return !checkedAt || now - checkedAt.getTime() > ORBIT_CHECK_INTERVAL_MS;
}

/** When Orbit can't be reached: may the session live on (≤ 5 min after the last successful check)? */
export function withinOutageGrace(checkedAt: Date | null | undefined, now = Date.now()): boolean {
  return !!checkedAt && now - checkedAt.getTime() <= ORBIT_GRACE_MS;
}

export function accessDeniedMessage(): string {
  return "You don't have access to CMS in PCI Orbit. Ask the Enterprise Technology Office to grant it.";
}

export function noAccountMessage(email: string): string {
  return `There is no CMS account for ${email}. Ask the Enterprise Technology Office.`;
}
