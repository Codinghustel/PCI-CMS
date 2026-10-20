"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { ConfirmAction, FormField } from "@/components/admin/ui";
import { deleteFaqAction, saveFaqAction } from "@/app/admin/actions/content";
import { htmlToText } from "@/lib/text";

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
}

const EMPTY = { question: "", answer: "", category: "general", order: 0, isPublished: true };

export function FaqManager({ faqs, canEdit }: { faqs: Faq[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const categories = [...new Set(faqs.map((f) => f.category))];

  const save = () =>
    start(async () => {
      if (!editing) return;
      const { id, ...input } = editing;
      const res = await saveFaqAction(id ?? null, input);
      if (res?.ok) {
        toast.success(res.message ?? "Saved");
        setEditing(null);
        router.refresh();
      } else if (res) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.message);
      }
    });

  return (
    <>
      {canEdit ? <Button size="sm" className="mb-4" onClick={() => { setErrors({}); setEditing({ ...EMPTY }); }}><Plus /> New FAQ</Button> : null}
      {categories.length === 0 ? <p className="text-sm text-muted-foreground">No FAQs yet.</p> : null}
      {categories.map((cat) => (
        <section key={cat} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">{cat}</h2>
          <ul className="divide-y rounded-lg border bg-background">
            {faqs.filter((f) => f.category === cat).map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{f.question} {!f.isPublished ? <Badge variant="secondary">Hidden</Badge> : null}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{htmlToText(f.answer)}</p>
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => { setErrors({}); setEditing({ ...f }); }}><Pencil /></Button>
                    <ConfirmAction action={() => deleteFaqAction(f.id)} title="Delete FAQ?" description={f.question} confirmLabel="Delete" variant="ghost" onDone={() => router.refresh()}>
                      <Trash2 className="text-destructive" />
                    </ConfirmAction>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit FAQ" : "New FAQ"}</DialogTitle></DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <FormField label="Question" htmlFor="faq-q" required error={errors.question}>
                <Input id="faq-q" value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
              </FormField>
              <FormField label="Answer" required error={errors.answer}>
                <RichTextEditor value={editing.answer} onChange={(v) => setEditing({ ...editing, answer: v })} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Category" htmlFor="faq-cat" error={errors.category} help="e.g. general, investment, payments">
                  <Input id="faq-cat" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value.toLowerCase() })} list="faq-categories" />
                  <datalist id="faq-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </FormField>
                <FormField label="Order" htmlFor="faq-order">
                  <Input id="faq-order" type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} />
                </FormField>
              </div>
              <label className="flex items-center gap-3 text-sm"><Switch checked={editing.isPublished} onCheckedChange={(v) => setEditing({ ...editing, isPublished: v })} /> Published</label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
