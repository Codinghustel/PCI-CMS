"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldRenderer } from "@/components/admin/field-renderer";
import { scopedErrors } from "@/components/admin/ui";
import { newSection, randomId, SECTION_DEFINITIONS, SECTION_MAP, type Section } from "@/lib/sections/registry";
import { cn } from "@/lib/utils";

/** Block-based page builder: add, configure, reorder, hide and remove sections. */
export function SectionsEditor({ value, onChange, errors = {} }: { value: Section[]; onChange: (s: Section[]) => void; errors?: Record<string, string[]> }) {
  const [openId, setOpenId] = useState<string | null>(value[0]?.id ?? null);
  const [adding, setAdding] = useState<number | null>(null);

  const update = (i: number, s: Section) => onChange(value.map((x, k) => (k === i ? s : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const insert = (type: string, at: number) => {
    const s = newSection(type);
    const next = [...value];
    next.splice(at, 0, s);
    onChange(next);
    setOpenId(s.id);
    setAdding(null);
  };
  const groups = [...new Set(SECTION_DEFINITIONS.map((d) => d.group))];

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">This page has no blocks yet.</div>
      ) : null}
      {value.map((section, i) => {
        const def = SECTION_MAP[section.type];
        const sectionErrors = scopedErrors(errors, `sections.${i}`);
        const hasErrors = Object.keys(sectionErrors).length > 0 || !!errors[`sections.${i}`];
        const open = openId === section.id;
        const title = (section.data.heading as string) || (section.data.eyebrow as string) || "";
        return (
          <div key={section.id} className={cn("rounded-lg border bg-card", hasErrors && "border-destructive", section.hidden && "opacity-60")}>
            <div className="flex items-center gap-2 p-3">
              <button type="button" onClick={() => setOpenId(open ? null : section.id)} className="flex min-w-0 flex-1 items-center gap-2 text-start" aria-expanded={open}>
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} aria-hidden />
                <span className="font-medium">{def?.label ?? section.type}</span>
                {title ? <span className="truncate text-sm text-muted-foreground">— {title}</span> : null}
                {section.hidden ? <Badge variant="secondary">Hidden</Badge> : null}
                {hasErrors ? <Badge variant="destructive">Needs attention</Badge> : null}
              </button>
              <div className="flex shrink-0 gap-0.5">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move block up"><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move block down"><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => update(i, { ...section, hidden: !section.hidden })} aria-label={section.hidden ? "Show block" : "Hide block"}>
                  {section.hidden ? <EyeOff /> : <Eye />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Duplicate block"
                  onClick={() => {
                    const copy = { ...structuredClone(section), id: randomId() };
                    const next = [...value];
                    next.splice(i + 1, 0, copy);
                    onChange(next);
                  }}
                >
                  <Copy />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove block"
                  onClick={() => {
                    if (window.confirm(`Remove the "${def?.label ?? section.type}" block?`)) onChange(value.filter((_, k) => k !== i));
                  }}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </div>
            {open && def ? (
              <div className="border-t p-4">
                <p className="mb-4 text-xs text-muted-foreground">{def.description}</p>
                {errors[`sections.${i}`] ? <p className="mb-3 text-xs text-destructive">{errors[`sections.${i}`][0]}</p> : null}
                <FieldRenderer fields={def.fields} value={section.data} onChange={(data) => update(i, { ...section, data })} errors={sectionErrors} />
              </div>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="outline" onClick={() => setAdding(value.length)}>
        <Plus /> Add block
      </Button>

      <Dialog open={adding !== null} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add a block</DialogTitle>
            <DialogDescription>Blocks use the website&apos;s brand styles automatically.</DialogDescription>
          </DialogHeader>
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{g}</p>
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                {SECTION_DEFINITIONS.filter((d) => d.group === g).map((d) => (
                  <button key={d.type} type="button" onClick={() => insert(d.type, adding ?? value.length)} className="rounded-lg border p-3 text-start hover:border-primary hover:bg-muted/50">
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
