"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/server/services/auth";
import { changeOwnPassword } from "@/server/services/users";
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
  });
  if (!result?.ok) return result;
  // Only allow internal CMS paths as the post-login destination.
  redirect(/^\/admin(\/[\w\-/]*)?$/.test(next) ? next : "/admin");
}

export async function logoutAction() {
  const session = await getCurrentSession();
  if (session) await logout(session.sessionId, session.actor);
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function changePasswordAction(input: unknown): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor();
    const session = await getCurrentSession();
    await changeOwnPassword(actor, session!.sessionId, input);
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  });
}
