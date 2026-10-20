import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/server/errors";
import type { ActionState } from "@/lib/action-state";

/**
 * Runs a Server Action body and converts failures into form state.
 * Known AppErrors become user-facing messages; Zod errors become field errors;
 * anything else is logged server-side and reported generically so internal
 * details are never sent to the browser. Next.js control-flow errors
 * (redirect, notFound) are re-thrown.
 */
export async function runAction<T>(fn: () => Promise<ActionState<T> | void>): Promise<ActionState<T>> {
  try {
    const result = await fn();
    return result ?? { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(error) };
    }
    console.error("[action] unexpected error", error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
