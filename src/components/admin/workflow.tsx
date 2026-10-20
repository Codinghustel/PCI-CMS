"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, Loader2, Send, Upload, Undo2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/components/admin/admin-context";
import { StatusBadge } from "@/components/admin/ui";
import type { ActionState } from "@/lib/action-state";
import type { PublishStatusValue } from "@/lib/content-labels";

export type WorkflowName = "save" | "submit" | "publish" | "unpublish" | "revert_to_draft";

/**
 * Shared editor state: holds the last action result (for field errors) and
 * runs Server Actions with pending state, toasts and a router refresh.
 */
export function useEditorAction<T = undefined>() {
  const router = useRouter();
  const [state, setState] = useState<ActionState<T>>(null);
  const [pending, start] = useTransition();
  const [pendingAction, setPendingAction] = useState<WorkflowName | null>(null);

  const run = (name: WorkflowName, fn: () => Promise<ActionState<T>>, onOk?: (s: ActionState<T>) => void) => {
    setPendingAction(name);
    start(async () => {
      const result = await fn();
      setState(result);
      setPendingAction(null);
      if (result?.ok) {
        toast.success(result.message ?? "Saved");
        onOk?.(result);
        router.refresh();
      } else if (result) {
        toast.error(result.message);
        document.querySelector("[aria-invalid='true']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  };

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return { state, errors, pending, pendingAction, run };
}

export function WorkflowBar({
  status,
  publishedAt,
  pending,
  pendingAction,
  onAction,
  previewHref,
  liveHref,
  canEdit = true,
  extra,
}: {
  status: PublishStatusValue | "NEW";
  publishedAt?: Date | string | null;
  pending: boolean;
  pendingAction: WorkflowName | null;
  onAction: (a: WorkflowName) => void;
  previewHref?: string;
  liveHref?: string;
  canEdit?: boolean;
  extra?: React.ReactNode;
}) {
  const { can } = useAdmin();
  const canPublish = can("content.publish");
  const spin = (a: WorkflowName) => (pending && pendingAction === a ? <Loader2 className="animate-spin" /> : null);
  const isNew = status === "NEW";
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <div className="flex items-center gap-3 text-sm">
        {isNew ? <span className="text-muted-foreground">New item</span> : <StatusBadge status={status} publishedAt={publishedAt} />}
        {liveHref && status === "PUBLISHED" ? (
          <Link href={liveHref} target="_blank" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            View live <ExternalLink className="size-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {extra}
        {previewHref && !isNew ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={previewHref} target="_blank"><Eye /> Preview</Link>
          </Button>
        ) : null}
        {canEdit ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => onAction("save")}>
              {spin("save") ?? <Save />} {status === "PUBLISHED" ? "Update" : "Save draft"}
            </Button>
            {!canPublish && status !== "PUBLISHED" && status !== "IN_REVIEW" ? (
              <Button type="button" size="sm" disabled={pending} onClick={() => onAction("submit")}>
                {spin("submit") ?? <Send />} Submit for review
              </Button>
            ) : null}
            {canPublish && status !== "PUBLISHED" ? (
              <Button type="button" size="sm" disabled={pending} onClick={() => onAction("publish")}>
                {spin("publish") ?? <Upload />} Publish
              </Button>
            ) : null}
            {canPublish && status === "PUBLISHED" ? (
              <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => onAction("unpublish")}>
                {spin("unpublish") ?? <Undo2 />} Unpublish
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
