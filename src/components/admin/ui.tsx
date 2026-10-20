"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { PUBLISH_STATUS_LABELS, APPROVAL_STATUS_LABELS, type PublishStatusValue, type ApprovalStatusValue } from "@/lib/content-labels";
import type { ActionState } from "@/lib/action-state";

export function FormField({
  label,
  htmlFor,
  error,
  help,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string[];
  help?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {help && !error?.length ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      {error?.length ? (
        <p className="text-xs text-destructive" role="alert">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

const STATUS_STYLES: Record<PublishStatusValue, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  IN_REVIEW: "bg-amber-100 text-amber-900",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  ARCHIVED: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ status, publishedAt }: { status: PublishStatusValue; publishedAt?: Date | string | null }) {
  const scheduled = status === "PUBLISHED" && publishedAt && new Date(publishedAt) > new Date();
  return (
    <Badge variant="secondary" className={cn("font-medium", scheduled ? "bg-sky-100 text-sky-900" : STATUS_STYLES[status])}>
      {scheduled ? "Scheduled" : PUBLISH_STATUS_LABELS[status]}
    </Badge>
  );
}

const APPROVAL_STYLES: Record<ApprovalStatusValue, string> = {
  NOT_SUBMITTED: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  REJECTED: "bg-red-100 text-red-900",
};

export function ApprovalBadge({ status }: { status: ApprovalStatusValue }) {
  return (
    <Badge variant="secondary" className={APPROVAL_STYLES[status]}>
      {APPROVAL_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ErrorSummary({ state }: { state: ActionState<unknown> }) {
  if (!state || state.ok) return null;
  const fieldCount = Object.keys(state.fieldErrors ?? {}).length;
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{state.message}</p>
        {state.fieldErrors?._publish ? (
          <ul className="mt-2 list-disc ps-5">
            {state.fieldErrors._publish.map((m) => <li key={m}>{m}</li>)}
          </ul>
        ) : fieldCount ? (
          <p className="mt-1 text-xs opacity-80">{fieldCount} field{fieldCount === 1 ? "" : "s"} need attention.</p>
        ) : null}
      </div>
    </div>
  );
}

/** Button that runs a Server Action after confirmation and reports the outcome. */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = "Confirm",
  children,
  variant = "destructive",
  size = "sm",
  onDone,
}: {
  action: () => Promise<ActionState<unknown>>;
  title: string;
  description: string;
  confirmLabel?: string;
  children: React.ReactNode;
  variant?: "destructive" | "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} type="button">{children}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={variant === "destructive" ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await action();
                if (res && !res.ok) toast.error(res.message);
                else {
                  if (res?.message) toast.success(res.message);
                  onDone?.();
                }
                setOpen(false);
              });
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Runs an action immediately (no confirmation) with toast feedback. */
export function ActionButton({
  action,
  children,
  variant = "outline",
  size = "sm",
  onDone,
}: {
  action: () => Promise<ActionState<unknown>>;
  children: React.ReactNode;
  variant?: "destructive" | "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await action();
          if (res && !res.ok) toast.error(res.message);
          else {
            if (res?.message) toast.success(res.message);
            onDone?.();
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
      ← {children}
    </Link>
  );
}

export function errorsFor(state: ActionState<unknown>, prefix: string): string[] | undefined {
  if (!state || state.ok || !state.fieldErrors) return undefined;
  return state.fieldErrors[prefix];
}

/** Field errors under a path prefix, with the prefix stripped (for nested editors). */
export function scopedErrors(errors: Record<string, string[]> | undefined, prefix: string): Record<string, string[]> {
  if (!errors) return {};
  const out: Record<string, string[]> = {};
  const p = `${prefix}.`;
  for (const [k, v] of Object.entries(errors)) if (k.startsWith(p)) out[k.slice(p.length)] = v;
  return out;
}
