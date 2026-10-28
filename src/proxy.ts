import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_RENEW_THRESHOLD_SECONDS,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/jwt";
import { VIA_ORBIT_COOKIE, parsePasswordLoginFlag, signedOutDestination } from "@/lib/auth/login-mode";
import { decide, getRoutingIndex } from "@/server/routing-index";

// Runs before every page request:
//  - /admin: optimistic session check + sliding renewal of the session token.
//    Real authorisation happens on the server for every page/action/API.
//  - public pages: CMS redirects (real 301/302) and 404s for unknown slugs,
//    decided before the streamed response starts so status codes are correct.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminProxy(request);

  const index = await getRoutingIndex();
  if (!index) return NextResponse.next();
  let decision = decide(pathname, index);
  if (decision.kind === "missing") {
    // Newly published content may not be in the index yet — refresh once.
    const fresh = await getRoutingIndex({ maxAgeMs: 1_000 }); // at most ~1 refresh per second, even under 404 floods
    if (fresh) decision = decide(pathname, fresh);
  }
  if (decision.kind === "redirect") {
    const target = decision.to.startsWith("/") ? new URL(decision.to + request.nextUrl.search, request.url) : new URL(decision.to);
    return NextResponse.redirect(target, decision.permanent ? 301 : 302);
  }
  // Slugs and routes are lowercase, but routing decisions ignore case: send "/Projects" to
  // "/projects" rather than letting it fall through to a soft 404 or a duplicate URL.
  if (decision.kind === "pass" && pathname !== pathname.toLowerCase()) {
    return NextResponse.redirect(new URL(pathname.toLowerCase() + request.nextUrl.search, request.url), 301);
  }
  if (decision.kind === "missing") {
    const url = request.nextUrl.clone();
    url.pathname = "/page-not-found";
    url.search = "";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

async function adminProxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The PCI Orbit sign-in start and callback run without a session.
  if (pathname.startsWith("/admin/sso/")) return NextResponse.next();
  const passwordLogin = parsePasswordLoginFlag(process.env.ALLOW_PASSWORD_LOGIN);
  const isLogin = pathname === "/admin/login";
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);

  if (!claims) {
    if (isLogin && passwordLogin) return NextResponse.next();
    const url = request.nextUrl.clone();
    // Signed out: the password form, unless Orbit-only mode is on or the person last signed in through Orbit.
    url.pathname = signedOutDestination({ passwordLogin, viaOrbit: request.cookies.get(VIA_ORBIT_COOKIE)?.value === "1" });
    const wanted = isLogin ? request.nextUrl.searchParams.get("next") : pathname !== "/admin" ? pathname : null;
    url.search = wanted ? `?next=${encodeURIComponent(wanted)}` : "";
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // The token's signature is valid, but its session may have been revoked (password reset, role
  // change, deactivation). Only the login page's database check may send the user on to /admin —
  // redirecting here would loop with the CMS layout, which sends revoked sessions back to login.
  if (isLogin) return NextResponse.next();

  const res = NextResponse.next();
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp - now < SESSION_RENEW_THRESHOLD_SECONDS && claims.aexp > now) {
    const renewed = await signSessionToken({ userId: claims.sub, sessionId: claims.sid, absoluteExpiry: claims.aexp });
    res.cookies.set(SESSION_COOKIE, renewed.token, sessionCookieOptions(renewed.expiresAt));
  }
  return res;
}

export const config = {
  // Everything except API routes, uploads, Next internals and the generated root files. Other
  // paths with an extension (e.g. /wp-login.php) must reach the routing index to get a real 404.
  matcher: ["/((?!api/|uploads/|_next/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)"],
};
