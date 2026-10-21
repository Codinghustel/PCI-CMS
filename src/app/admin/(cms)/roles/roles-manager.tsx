"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, RotateCcw, Save, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction } from "@/components/admin/ui";
import { resetRoleAction, updateRoleAction } from "@/app/admin/actions/site";
import {
  ADMIN_ONLY_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_INFO,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Permission,
  type RoleName,
} from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

interface RoleRow {
  role: RoleName;
  permissions: Permission[];
  customised: boolean;
  userCount: number;
  updatedAt: string | null;
}

const byGroup = PERMISSION_GROUPS.map((group) => ({ group, items: PERMISSIONS.filter((p) => PERMISSION_INFO[p].group === group) }));

/**
 * Role overview, per-role permission editor and a comparison matrix.
 * The server validates every change; this UI only explains and collects it.
 */
export function RolesManager({ roles, initialRole }: { roles: RoleRow[]; initialRole: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<RoleName>(initialRole as RoleName);
  const role = roles.find((r) => r.role === selected)!;
  const [draft, setDraft] = useState<Record<string, Permission[]>>({});
  const current = draft[selected] ?? role.permissions;
  const dirty = !!draft[selected] && [...draft[selected]].sort().join() !== [...role.permissions].sort().join();
  const locked = selected === "ADMIN";
  const [pending, start] = useTransition();

  const toggle = (p: Permission, on: boolean) => setDraft((d) => ({ ...d, [selected]: on ? [...current, p] : current.filter((x) => x !== p) }));
  const dependencyWarnings = [
    current.some((p) => p !== "content.read" && p.startsWith("content.")) && !current.includes("content.read") ? "Content permissions usually need “View content” to open the CMS screens." : null,
    (current.includes("media.upload") || current.includes("media.delete")) && !current.includes("media.read") ? "Media permissions usually need “View media library”." : null,
    (current.includes("leads.export") || current.includes("leads.resend")) && !current.includes("leads.read") ? "Exporting or re-sending leads requires “View leads” to reach the Leads screen." : null,
    !current.includes("dashboard.view") ? "Without “View dashboard” users land on an access-denied screen after signing in." : null,
  ].filter(Boolean) as string[];

  const save = () =>
    start(async () => {
      const res = await updateRoleAction({ role: selected, permissions: current });
      if (res?.ok) {
        toast.success(res.message ?? "Saved");
        setDraft((d) => {
          const next = { ...d };
          delete next[selected];
          return next;
        });
        router.refresh();
      } else if (res) toast.error(res.message);
    });

  return (
    <div className="space-y-8">
      {/* Role cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" role="tablist" aria-label="Roles">
        {roles.map((r) => (
          <button
            key={r.role}
            type="button"
            role="tab"
            aria-selected={selected === r.role}
            onClick={() => setSelected(r.role)}
            className={cn(
              "flex h-full flex-col rounded-lg border bg-background p-4 text-start transition hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected === r.role && "border-primary ring-1 ring-primary"
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{ROLE_LABELS[r.role]}</span>
              {r.role === "ADMIN" ? <Lock className="size-4 text-muted-foreground" aria-label="Fixed" /> : r.customised ? <Badge variant="secondary">Custom</Badge> : null}
            </span>
            <span className="mt-1 line-clamp-3 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r.role]}</span>
            <span className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="size-3.5" /> {r.userCount} active user{r.userCount === 1 ? "" : "s"}</span>
              <span>{r.permissions.length}/{PERMISSIONS.length}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Editor for the selected role */}
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="size-5 text-primary" /> {ROLE_LABELS[selected]}</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[selected]}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {locked
                ? "Administrators always have every permission so the CMS can never be locked out."
                : role.customised
                  ? `Customised${role.updatedAt ? ` on ${new Date(role.updatedAt).toLocaleString()}` : ""}.`
                  : "Using the default permissions for this role."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/users?role=${selected}`}><Users /> Assign users</Link>
            </Button>
            {!locked && role.customised ? (
              <ConfirmAction
                action={() => resetRoleAction(selected)}
                title={`Reset ${ROLE_LABELS[selected]}?`}
                description="The role returns to its default permissions. Users with this role are affected immediately."
                confirmLabel="Reset to defaults"
                variant="outline"
                onDone={() => {
                  setDraft({});
                  router.refresh();
                }}
              >
                <RotateCcw /> Reset to defaults
              </ConfirmAction>
            ) : null}
            {!locked ? (
              <Button size="sm" disabled={!dirty || pending} onClick={save}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5">
          {dependencyWarnings.length && !locked ? (
            <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {dependencyWarnings.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          ) : null}
          {byGroup.map(({ group, items }) => (
            <fieldset key={group}>
              <legend className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{group}</legend>
              <ul className="divide-y rounded-lg border">
                {items.map((p) => {
                  const adminOnly = ADMIN_ONLY_PERMISSIONS.includes(p);
                  const disabled = locked || adminOnly;
                  const on = locked || current.includes(p);
                  const isDefault = DEFAULT_ROLE_PERMISSIONS[selected].includes(p);
                  const id = `perm-${selected}-${p}`;
                  return (
                    <li key={p} className="flex items-start justify-between gap-4 p-3">
                      <label htmlFor={id} className={cn("min-w-0", disabled ? "cursor-default" : "cursor-pointer")}>
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {PERMISSION_INFO[p].label}
                          {adminOnly ? <Badge variant="outline" className="gap-1"><Lock className="size-3" /> Administrators only</Badge> : null}
                          {!locked && !adminOnly && on !== isDefault ? <Badge variant="secondary">{on ? "Added" : "Removed"} vs. default</Badge> : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{PERMISSION_INFO[p].description}</span>
                      </label>
                      <Switch id={id} checked={on} disabled={disabled} onCheckedChange={(v) => toggle(p, v)} />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </CardContent>
      </Card>

      {/* Comparison matrix */}
      <Card>
        <CardHeader><CardTitle className="text-base">Compare roles</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky start-0 min-w-56 bg-background">Permission</TableHead>
                {roles.map((r) => <TableHead key={r.role} className="text-center whitespace-nowrap">{ROLE_LABELS[r.role]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {byGroup.map(({ group, items }) => (
                <Fragment key={group}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={roles.length + 1} className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{group}</TableCell>
                  </TableRow>
                  {items.map((p) => (
                    <TableRow key={p}>
                      <TableCell className="sticky start-0 bg-background text-sm" title={PERMISSION_INFO[p].description}>{PERMISSION_INFO[p].label}</TableCell>
                      {roles.map((r) => {
                        const has = r.role === "ADMIN" || (draft[r.role] ?? r.permissions).includes(p);
                        return (
                          <TableCell key={r.role} className="text-center">
                            {has ? <Check className="mx-auto size-4 text-emerald-600" aria-label="Allowed" /> : <X className="mx-auto size-4 text-muted-foreground/40" aria-label="Not allowed" />}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
