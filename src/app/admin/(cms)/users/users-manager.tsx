"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction, FormField } from "@/components/admin/ui";
import { createUserAction, deleteUserAction, resetPasswordAction, updateUserAction } from "@/app/admin/actions/site";
import { ROLES, ROLE_LABELS, type RoleName } from "@/lib/auth/permissions";
import type { ActionState } from "@/lib/action-state";

interface U { id: string; name: string; email: string; role: RoleName; isActive: boolean; lastLoginAt: string | null; lockedUntil: string | null; createdAt: string }
type Mode = { kind: "create" } | { kind: "edit"; user: U } | { kind: "password"; user: U } | null;

const selectCls = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function UsersManager({ users, currentUserId }: { users: U[]; currentUserId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "AUTHOR" as RoleName, password: "", isActive: true });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const open = (m: Mode) => {
    setErrors({});
    if (m?.kind === "edit") setForm({ ...form, name: m.user.name, email: m.user.email, role: m.user.role, isActive: m.user.isActive, password: "" });
    else setForm({ name: "", email: "", role: "AUTHOR", password: "", isActive: true });
    setMode(m);
  };
  const submit = () =>
    start(async () => {
      let res: ActionState = null;
      if (mode?.kind === "create") res = await createUserAction({ name: form.name, email: form.email, role: form.role, password: form.password });
      if (mode?.kind === "edit") res = await updateUserAction(mode.user.id, { name: form.name, role: form.role, isActive: form.isActive });
      if (mode?.kind === "password") res = await resetPasswordAction(mode.user.id, { password: form.password });
      if (res?.ok) {
        toast.success(res.message ?? "Saved");
        setMode(null);
        router.refresh();
      } else if (res) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.message);
      }
    });

  return (
    <>
      <Button size="sm" className="mb-4" onClick={() => open({ kind: "create" })}><Plus /> New user</Button>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="hidden md:table-cell">Last sign-in</TableHead><TableHead>Status</TableHead><TableHead className="w-32"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell><span className="font-medium">{u.name}</span>{u.id === currentUserId ? <Badge variant="outline" className="ms-2">You</Badge> : null}<span className="block text-xs text-muted-foreground">{u.email}</span></TableCell>
                <TableCell className="text-sm">{ROLE_LABELS[u.role]}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</TableCell>
                <TableCell>
                  {u.isActive ? <Badge className="bg-emerald-100 text-emerald-900" variant="secondary">Active</Badge> : <Badge variant="secondary">Deactivated</Badge>}
                  {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? <Badge variant="destructive" className="ms-1">Locked</Badge> : null}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${u.name}`} onClick={() => open({ kind: "edit", user: u })}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Reset password for ${u.name}`} onClick={() => open({ kind: "password", user: u })}><KeyRound /></Button>
                    {u.id !== currentUserId ? (
                      <ConfirmAction action={() => deleteUserAction(u.id)} title={`Delete ${u.name}?`} description="Prefer deactivating accounts to keep the audit trail readable. Deletion cannot be undone." confirmLabel="Delete user" variant="ghost" onDone={() => router.refresh()}>
                        <Trash2 className="text-destructive" />
                      </ConfirmAction>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode?.kind === "create" ? "New user" : mode?.kind === "edit" ? `Edit ${mode.user.name}` : mode?.kind === "password" ? `Reset password — ${mode.user.name}` : ""}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {mode?.kind !== "password" ? (
              <>
                <FormField label="Name" htmlFor="u-name" required error={errors.name}><Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
                <FormField label="Email" htmlFor="u-email" required error={errors.email}><Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={mode?.kind === "edit"} /></FormField>
                <FormField label="Role" htmlFor="u-role" error={errors.role}>
                  <select id="u-role" className={selectCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as RoleName })} disabled={mode?.kind === "edit" && mode.user.id === currentUserId}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </FormField>
              </>
            ) : null}
            {mode?.kind === "edit" ? (
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} disabled={mode.user.id === currentUserId} /> Account active
              </label>
            ) : null}
            {mode?.kind !== "edit" ? (
              <FormField label={mode?.kind === "password" ? "New password" : "Initial password"} htmlFor="u-pass" required error={errors.password} help="At least 12 characters with upper- and lower-case letters and a number. Share it securely.">
                <Input id="u-pass" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </FormField>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMode(null)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
