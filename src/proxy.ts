import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_RENEW_THRESHOLD_SECONDS,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/jwt";
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
  const isLogin = pathname === "/admin/login";
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);

  if (!claims) {
    if (isLogin) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname !== "/admin" ? `?next=${encodeURIComponent(pathname)}` : "";
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (isLogin) return NextResponse.redirect(new URL("/admin", request.url));

  const res = NextResponse.next();
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp - now < SESSION_RENEW_THRESHOLD_SECONDS && claims.aexp > now) {
    const renewed = await signSessionToken({ userId: claims.sub, sessionId: claims.sid, absoluteExpiry: claims.aexp });
    res.cookies.set(SESSION_COOKIE, renewed.token, sessionCookieOptions(renewed.expiresAt));
  }
  return res;
}

export const config = {
  // Everything except API routes, uploads, Next internals and files with an extension.
  matcher: ["/((?!api/|uploads/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
