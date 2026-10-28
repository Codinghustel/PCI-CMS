import { NextResponse, type NextRequest } from "next/server";
import { serverEnv, siteUrl } from "@/lib/env";
import {
  SSO_STATE_COOKIE,
  SSO_STATE_MAX_AGE_SECONDS,
  authorizeUrl,
  callbackUrl,
  encodeStateCookie,
  generateState,
  safeNextPath,
} from "@/lib/auth/orbit-sso";

/**
 * GET /admin/sso/start?next=/admin/... — begins PCI Orbit sign-in: remembers a random state (and the
 * page the person wanted) in a short-lived httpOnly cookie and sends the browser to Orbit.
 */
export function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const state = generateState();
  const target = authorizeUrl(serverEnv().ORBIT_URL, callbackUrl(siteUrl()), state);
  const res = new NextResponse(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
  res.cookies.set(SSO_STATE_COOKIE, encodeStateCookie(state, next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin/sso",
    maxAge: SSO_STATE_MAX_AGE_SECONDS,
  });
  return res;
}
