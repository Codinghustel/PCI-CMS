import { describe, expect, it } from "vitest";
import {
  ORBIT_CHECK_INTERVAL_MS,
  ORBIT_GRACE_MS,
  authorizeUrl,
  callbackUrl,
  encodeStateCookie,
  generateState,
  logoutUrl,
  orbitCheckDue,
  parseStateCookie,
  safeNextPath,
  statesMatch,
  withinOutageGrace,
} from "@/lib/auth/orbit-sso";

describe("Orbit SSO state handling", () => {
  it("generates unguessable base64url states of at least 16 bytes", () => {
    const a = generateState();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22,}$/);
    expect(generateState()).not.toBe(a);
  });
  it("round-trips state and next through the cookie value", () => {
    const state = generateState();
    expect(parseStateCookie(encodeStateCookie(state, "/admin/pages"))).toEqual({ state, next: "/admin/pages" });
  });
  it("rejects missing or malformed cookie values", () => {
    expect(parseStateCookie(undefined)).toBeNull();
    expect(parseStateCookie("")).toBeNull();
    expect(parseStateCookie("short|/admin")).toBeNull();
    expect(parseStateCookie("nopipe-nopipe-nopipe-nopipe")).toBeNull();
  });
  it("only accepts a matching state", () => {
    const s = generateState();
    expect(statesMatch(s, s)).toBe(true);
    expect(statesMatch(s, generateState())).toBe(false);
    expect(statesMatch(s, null)).toBe(false);
    expect(statesMatch(undefined, s)).toBe(false);
    expect(statesMatch(s, s + "x")).toBe(false);
  });
  it("falls back to /admin for unsafe next paths", () => {
    expect(safeNextPath("/admin/pages/new")).toBe("/admin/pages/new");
    for (const bad of ["https://evil.example", "//evil.example", "/admin/../x", "/administrator", "/admin?x=1", "", undefined, 5]) {
      expect(safeNextPath(bad)).toBe("/admin");
    }
  });
  it("builds the Orbit URLs from the contract", () => {
    const cb = callbackUrl("https://pcicms.premierchoiceint.online/");
    expect(cb).toBe("https://pcicms.premierchoiceint.online/admin/sso/callback");
    const u = new URL(authorizeUrl("https://apps.premierchoiceint.online/", cb, "st"));
    expect(u.origin + u.pathname).toBe("https://apps.premierchoiceint.online/api/sso/authorize");
    expect(Object.fromEntries(u.searchParams)).toEqual({ app: "cms", redirect_uri: cb, state: "st" });
    expect(logoutUrl("https://apps.premierchoiceint.online")).toBe("https://apps.premierchoiceint.online/api/sso/logout?app=cms");
  });
});

describe("Orbit session check schedule", () => {
  const now = 1_000_000_000_000;
  const ago = (ms: number) => new Date(now - ms);
  it("checks only when the last successful check is more than 60 s old", () => {
    expect(orbitCheckDue(ago(10_000), now)).toBe(false);
    expect(orbitCheckDue(ago(ORBIT_CHECK_INTERVAL_MS), now)).toBe(false);
    expect(orbitCheckDue(ago(ORBIT_CHECK_INTERVAL_MS + 1), now)).toBe(true);
    expect(orbitCheckDue(null, now)).toBe(true);
  });
  it("keeps a session for 5 minutes after the last successful check when Orbit is unreachable", () => {
    expect(withinOutageGrace(ago(2 * 60_000), now)).toBe(true);
    expect(withinOutageGrace(ago(ORBIT_GRACE_MS), now)).toBe(true);
    expect(withinOutageGrace(ago(ORBIT_GRACE_MS + 1), now)).toBe(false);
    expect(withinOutageGrace(null, now)).toBe(false);
  });
});
