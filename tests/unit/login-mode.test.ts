import { describe, expect, it } from "vitest";
import { parsePasswordLoginFlag, signedOutDestination } from "@/lib/auth/login-mode";

describe("ALLOW_PASSWORD_LOGIN flag", () => {
  it("defaults to enabled", () => {
    for (const v of [undefined, null, "", "  ", "true", "TRUE", "1", "yes"]) expect(parsePasswordLoginFlag(v)).toBe(true);
  });
  it("is disabled only by an explicit false-like value", () => {
    for (const v of ["false", " False ", "0", "no", "off"]) expect(parsePasswordLoginFlag(v)).toBe(false);
  });
});

describe("signed-out destination", () => {
  it("shows the password form when the flag is on and the person did not come through Orbit", () => {
    expect(signedOutDestination({ passwordLogin: true, viaOrbit: false })).toBe("/admin/login");
  });
  it("restarts Orbit sign-in for people who last signed in through Orbit", () => {
    expect(signedOutDestination({ passwordLogin: true, viaOrbit: true })).toBe("/admin/sso/start");
  });
  it("always uses Orbit in Orbit-only mode", () => {
    expect(signedOutDestination({ passwordLogin: false, viaOrbit: false })).toBe("/admin/sso/start");
    expect(signedOutDestination({ passwordLogin: false, viaOrbit: true })).toBe("/admin/sso/start");
  });
});
