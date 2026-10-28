"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIA_ORBIT_COOKIE } from "@/lib/auth/login-mode";
import { getSessionOrbitSid, login, logout } from "@/server/services/auth";
import { changeOwnPassword } from "@/server/services/users";
import { logoutUrl, safeNextPath } from "@/lib/auth/orbit-sso";
import { serverEnv } from "@/lib/env";
import { clearSessionCookie, getCurrentSession, requestMeta, requireActor, setSessionCookie } from "@/lib/auth/session";
import { runAction } from "@/lib/safe-action";
import type { ActionState } from "@/lib/action-state";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const next = String(formData.get("next") ?? "");
  const result = await runAction(async () => {
    const { token, expiresAt } = await login(
      { email: formData.get("email"), password: formData.get("password") },
      await requestMeta()
    );
    await setSessionCookie(token, expiresAt);
    (await cookies()).delete({ name: VIA_ORBIT_COOKIE, path: "/admin" });
  });
  if (!result?.ok) return result;
  // Only allow internal CMS paths as the post-login destination.
  redirect(safeNextPath(next));
}

/**
 * Ends the CMS session and returns where the browser goes next. Orbit sessions finish at Orbit's logout
 * (which signs out of every app); the client must navigate the TOP window there. It is not a redirect
 * from this action because the CSP's form-action 'self' also blocks cross-origin redirects after a form POST.
 */
export async function logoutAction(): Promise<{ redirectTo: string }> {
  const session = await getCurrentSession();
  const orbitSid = session ? await getSessionOrbitSid(session.sessionId) : null;
  if (session) await logout(session.sessionId, session.actor);
  await clearSessionCookie();
  const env = serverEnv();
  return { redirectTo: env.ALLOW_PASSWORD_LOGIN && !orbitSid ? "/admin/login" : logoutUrl(env.ORBIT_URL) };
}

export async function changePasswordAction(input: unknown): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor();
    const session = await getCurrentSession();
    await changeOwnPassword(actor, session!.sessionId, input);
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  });
}
