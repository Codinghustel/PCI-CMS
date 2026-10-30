// Pure sign-in routing decisions (no I/O, no node-only imports: also used by the proxy).

/** Cookie remembering that the last successful sign-in went through PCI Orbit. */
export const VIA_ORBIT_COOKIE = "pci_via_orbit";
export const VIA_ORBIT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** ALLOW_PASSWORD_LOGIN defaults to true; only an explicit "false" (or "0"/"no"/"off") means Orbit-only. */
export function parsePasswordLoginFlag(raw: string | undefined | null): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "") return true;
  return !["false", "0", "no", "off"].includes(v);
}

/**
 * Where a signed-out visitor to a protected /admin page goes. Orbit-only mode, or a visitor who
 * signed in through Orbit last time (e.g. an expired Orbit session inside Orbit's frame), restarts
 * Orbit sign-in; everyone else sees the password form.
 */
export function signedOutDestination(opts: { passwordLogin: boolean; viaOrbit: boolean }): "/admin/sso/start" | "/admin/login" {
  return opts.passwordLogin && !opts.viaOrbit ? "/admin/login" : "/admin/sso/start";
}
