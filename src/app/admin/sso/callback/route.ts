import { NextResponse, type NextRequest } from "next/server";
import { serverEnv, siteUrl } from "@/lib/env";
import {
  SSO_STATE_COOKIE,
  accessDeniedMessage,
  callbackUrl,
  noAccountMessage,
  parseStateCookie,
  statesMatch,
} from "@/lib/auth/orbit-sso";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/jwt";
import { requestMeta } from "@/lib/auth/session";
import { exchangeCode, ssoConfigured } from "@/server/services/orbit-sso";
import { loginWithOrbit } from "@/server/services/auth";
import { VIA_ORBIT_COOKIE, VIA_ORBIT_MAX_AGE_SECONDS } from "@/lib/auth/login-mode";
import { ssoErrorHtml } from "@/lib/sso-page";

/** GET /admin/sso/callback — Orbit sends the browser back here with ?code=…&state=… (contract section 1). */

function page(status: number, title: string, message: string, retry = true) {
  const orbit = serverEnv().ORBIT_URL;
  const links = [...(retry ? [{ href: "/admin/sso/start", label: "Try again" }] : []), { href: orbit, label: "Open PCI Orbit" }];
  const res = new NextResponse(ssoErrorHtml({ title, message, links }), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
  res.cookies.set(VIA_ORBIT_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: VIA_ORBIT_MAX_AGE_SECONDS,
  });
  res.cookies.delete({ name: SSO_STATE_COOKIE, path: "/admin/sso" });
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const stored = parseStateCookie(request.cookies.get(SSO_STATE_COOKIE)?.value);
  if (!stored || !statesMatch(stored.state, params.get("state"))) {
    return page(400, "Sign-in could not be completed", "Your sign-in request expired or did not come from this browser. Please try again.");
  }

  if (params.get("error") === "access_denied") {
    return page(403, "No access", accessDeniedMessage(), false);
  }
  const code = params.get("code");
  if (params.get("error") || !code) {
    return page(400, "Sign-in could not be completed", "PCI Orbit did not complete the sign-in. Please try again.");
  }
  if (!ssoConfigured()) {
    return page(503, "Sign-in is unavailable", "Single sign-on is not set up for the CMS yet. Please contact the Enterprise Technology Office.", false);
  }

  const exchanged = await exchangeCode(code, callbackUrl(siteUrl()));
  if (!exchanged.ok) {
    return exchanged.reason === "invalid_grant"
      ? page(400, "Sign-in expired", "The sign-in link has expired or was already used. Please try again.")
      : page(502, "Could not reach PCI Orbit", "The CMS could not confirm your sign-in with PCI Orbit. Please try again in a moment.");
  }

  const { identity } = exchanged;
  const session = await loginWithOrbit(identity, await requestMeta());
  if (!session) return page(403, "No CMS account", noAccountMessage(identity.email), false);

  const res = new NextResponse(null, { status: 302, headers: { Location: stored.next, "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  res.cookies.delete({ name: SSO_STATE_COOKIE, path: "/admin/sso" });
  return res;
}
