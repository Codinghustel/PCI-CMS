"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CornerDownRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveMenuAction } from "@/app/admin/actions/site";

interface Link { label: string; href: string; openInNewTab: boolean }
interface Item extends Link { children: Link[] }

function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function MenuEditor({ menuKey, name, initial, allowChildren }: { menuKey: string; name: string; initial: Item[]; allowChildren: boolean }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<Item>) => setItems((list) => list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const row = (link: Link, onChange: (p: Partial<Link>) => void, path: string) => (
    <div className="grid flex-1 gap-2 sm:grid-cols-2">
      <div>
        <Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Label" aria-label="Label" aria-invalid={!!errors[`${path}.label`]} />
        {errors[`${path}.label`] ? <p className="mt-1 text-xs text-destructive">{errors[`${path}.label`][0]}</p> : null}
      </div>
      <div>
        <Input value={link.href} onChange={(e) => onChange({ href: e.target.value })} placeholder="/projects or https://…" aria-label="Link" aria-invalid={!!errors[`${path}.href`]} />
        {errors[`${path}.href`] ? <p className="mt-1 text-xs text-destructive">{errors[`${path}.href`][0]}</p> : null}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{name}</CardTitle>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveMenuAction(menuKey, { items });
              if (res?.ok) { setErrors({}); toast.success(res.message ?? "Saved"); }
              else if (res) { setErrors(res.fieldErrors ?? {}); toast.error(res.message); }
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null} Save menu
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-start gap-2">
              {row(item, (p) => update(i, p), `items.${i}`)}
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon-sm" aria-label="Move up" onClick={() => setItems((l) => move(l, i, -1))}><ArrowUp /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Move down" onClick={() => setItems((l) => move(l, i, 1))}><ArrowDown /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setItems((l) => l.filter((_, k) => k !== i))}><Trash2 className="text-destructive" /></Button>
              </div>
            </div>
            {allowChildren ? (
              <div className="mt-2 space-y-2 ps-6">
                {item.children.map((child, c) => (
                  <div key={c} className="flex items-start gap-2">
                    <CornerDownRight className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
                    {row(child, (p) => update(i, { children: item.children.map((x, k) => (k === c ? { ...x, ...p } : x)) }), `items.${i}.children.${c}`)}
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon-sm" aria-label="Move up" onClick={() => update(i, { children: move(item.children, c, -1) })}><ArrowUp /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Move down" onClick={() => update(i, { children: move(item.children, c, 1) })}><ArrowDown /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => update(i, { children: item.children.filter((_, k) => k !== c) })}><Trash2 className="text-destructive" /></Button>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => update(i, { children: [...item.children, { label: "", href: "", openInNewTab: false }] })}><Plus /> Add dropdown link</Button>
              </div>
            ) : null}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setItems((l) => [...l, { label: "", href: "", openInNewTab: false, children: [] }])}><Plus /> Add link</Button>
      </CardContent>
    </Card>
  );
}
