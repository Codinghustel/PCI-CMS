"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction } from "@/components/admin/ui";
import { deleteRedirectAction, saveRedirectAction } from "@/app/admin/actions/site";

interface R { id: string; fromPath: string; toPath: string; permanent: boolean; note: string }

export function RedirectManager({ items }: { items: R[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState({ fromPath: "", toPath: "", permanent: true, note: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 rounded-lg border bg-background p-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveRedirectAction(null, draft);
            if (res?.ok) {
              toast.success(res.message ?? "Saved");
              setDraft({ fromPath: "", toPath: "", permanent: true, note: "" });
              setErrors({});
              router.refresh();
            } else if (res) {
              setErrors(res.fieldErrors ?? {});
              toast.error(res.message);
            }
          });
        }}
      >
        <div>
          <Input placeholder="From: /old-page/" value={draft.fromPath} onChange={(e) => setDraft({ ...draft, fromPath: e.target.value })} aria-label="From path" aria-invalid={!!errors.fromPath} />
          {errors.fromPath ? <p className="mt-1 text-xs text-destructive">{errors.fromPath[0]}</p> : null}
        </div>
        <div>
          <Input placeholder="To: /projects/new-page" value={draft.toPath} onChange={(e) => setDraft({ ...draft, toPath: e.target.value })} aria-label="To path" aria-invalid={!!errors.toPath} />
          {errors.toPath ? <p className="mt-1 text-xs text-destructive">{errors.toPath[0]}</p> : null}
        </div>
        <label className="flex h-9 items-center gap-2 text-sm"><Switch checked={draft.permanent} onCheckedChange={(v) => setDraft({ ...draft, permanent: v })} /> Permanent (301)</label>
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />} Add</Button>
      </form>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader><TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Type</TableHead><TableHead className="w-12"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No redirects yet.</TableCell></TableRow> : null}
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.fromPath}</TableCell>
                <TableCell className="font-mono text-xs">{r.toPath}{r.note ? <span className="block font-sans text-muted-foreground">{r.note}</span> : null}</TableCell>
                <TableCell className="text-xs">{r.permanent ? "301" : "302"}</TableCell>
                <TableCell>
                  <ConfirmAction action={() => deleteRedirectAction(r.id)} title="Remove redirect?" description={`${r.fromPath} → ${r.toPath}`} confirmLabel="Remove" variant="ghost" onDone={() => router.refresh()}>
                    <Trash2 className="text-destructive" />
                  </ConfirmAction>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
