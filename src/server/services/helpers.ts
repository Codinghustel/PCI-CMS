import type { z } from "zod";
import { can, canEditItem, type Actor } from "@/lib/auth/permissions";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { PUBLISH_STATUSES, type PublishStatusValue } from "@/lib/content-labels";

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw new ValidationError("Please correct the highlighted fields.", fieldErrors);
  }
  return parsed.data;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}

/** Status filter for list queries; ignores values that are not a publish status (e.g. a hand-edited URL). */
export function statusFilter(status: string | undefined): { status?: PublishStatusValue } {
  return status && (PUBLISH_STATUSES as readonly string[]).includes(status) ? { status: status as PublishStatusValue } : {};
}

export function normalizeList(params: ListParams) {
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const pageSize = Math.min(100, Math.max(5, Math.floor(Number(params.pageSize) || 20)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, q: params.q?.trim().slice(0, 100) || undefined };
}

export type WorkflowAction = "save" | "submit" | "publish" | "unpublish" | "revert_to_draft";

/**
 * Decides the next publication status for a workflow action and enforces who
 * may perform it. Authors can save drafts and submit for review; only users
 * with content.publish can publish or unpublish.
 */
export function nextStatus(
  actor: Actor,
  current: PublishStatusValue,
  action: WorkflowAction
): PublishStatusValue {
  switch (action) {
    case "save":
      if (current === "PUBLISHED" && !can(actor, "content.publish")) throw new ForbiddenError("Only publishers can edit published content.");
      return current;
    case "submit":
      return current === "PUBLISHED" ? current : "IN_REVIEW";
    case "publish":
      if (!can(actor, "content.publish")) throw new ForbiddenError("You do not have permission to publish.");
      return "PUBLISHED";
    case "unpublish":
      if (!can(actor, "content.publish")) throw new ForbiddenError("You do not have permission to unpublish.");
      return "ARCHIVED";
    case "revert_to_draft":
      if (current === "PUBLISHED" && !can(actor, "content.publish")) throw new ForbiddenError();
      return "DRAFT";
  }
}

export function assertCanEdit(actor: Actor, item: { authorId: string | null; status: string } | null) {
  if (!canEditItem(actor, item)) throw new ForbiddenError("You can only edit your own unpublished drafts.");
}

export function assertCanCreate(actor: Actor) {
  if (!can(actor, "content.write") && !can(actor, "content.writeOwn")) throw new ForbiddenError();
}

export function assertCanDelete(actor: Actor, item: { authorId: string | null; status: string }) {
  if (can(actor, "content.delete")) return;
  // Authors may delete their own drafts that were never published.
  if (can(actor, "content.writeOwn") && item.authorId === actor.id && item.status !== "PUBLISHED") return;
  throw new ForbiddenError("You do not have permission to delete this item.");
}

/**
 * publishedAt handling: keep an existing date, honour an explicitly scheduled
 * date (future dates schedule publication), otherwise publish now.
 */
export function resolvePublishedAt(status: PublishStatusValue, existing: Date | null, requested?: Date | null): Date | null {
  // Unpublishing a scheduled item cancels its schedule; otherwise a later "Publish" would keep the
  // old future date and the item would stay hidden.
  if (status !== "PUBLISHED") return existing && existing > new Date() ? null : existing;
  if (requested) return requested;
  return existing ?? new Date();
}
