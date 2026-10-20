"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FormField, scopedErrors } from "@/components/admin/ui";
import { MediaField, MediaListField } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { useProjectOptions } from "@/components/admin/admin-context";
import { defaultValues, type FieldDef } from "@/lib/fields";

type Value = Record<string, unknown>;

/** Renders an editor form for a set of declarative field definitions. */
export function FieldRenderer({
  fields,
  value,
  onChange,
  errors = {},
}: {
  fields: FieldDef[];
  value: Value;
  onChange: (next: Value) => void;
  errors?: Record<string, string[]>;
}) {
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });
  return (
    <div className="grid gap-4">
      {fields.map((f) => (
        <Field key={f.name} field={f} value={value?.[f.name]} onChange={(v) => set(f.name, v)} errors={errors} />
      ))}
    </div>
  );
}

function Field({ field: f, value, onChange, errors }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; errors: Record<string, string[]> }) {
  const id = useId();
  const err = errors[f.name];
  const projects = useProjectOptions();
  const common = { label: f.label, htmlFor: id, error: err, help: f.help, required: f.required };

  switch (f.type) {
    case "text":
    case "link":
    case "youtube":
      return (
        <FormField {...common}>
          <Input
            id={id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            maxLength={f.type === "text" ? f.maxLength : 500}
            placeholder={f.type === "link" ? "/contact or https://…" : f.type === "youtube" ? "https://www.youtube.com/watch?v=…" : f.type === "text" ? f.placeholder : undefined}
            aria-invalid={!!err}
          />
        </FormField>
      );
    case "textarea":
      return (
        <FormField {...common}>
          <Textarea id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={f.rows ?? 3} maxLength={f.maxLength} aria-invalid={!!err} />
        </FormField>
      );
    case "number":
      return (
        <FormField {...common}>
          <Input
            id={id}
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            min={f.min}
            max={f.max}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className="max-w-48"
            aria-invalid={!!err}
          />
        </FormField>
      );
    case "richtext":
      return (
        <FormField {...common}>
          <RichTextEditor id={id} value={(value as string) ?? ""} onChange={onChange} invalid={!!err} />
        </FormField>
      );
    case "image":
    case "document":
      return (
        <FormField {...common}>
          <MediaField id={id} value={(value as string) ?? null} onChange={onChange} kind={f.type === "image" ? "IMAGE" : "DOCUMENT"} />
        </FormField>
      );
    case "images":
      return (
        <FormField {...common}>
          <MediaListField value={(value as string[]) ?? []} onChange={onChange} max={f.max} />
        </FormField>
      );
    case "select":
      return (
        <FormField {...common}>
          <select id={id} value={(value as string) ?? f.defaultValue ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9 w-full max-w-sm rounded-lg border border-input bg-background px-2.5 text-sm">
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-3">
          <Switch id={id} checked={!!value} onCheckedChange={onChange} />
          <label htmlFor={id} className="text-sm">{f.label}</label>
        </div>
      );
    case "project":
      return (
        <FormField {...common}>
          <select id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} className="h-9 w-full max-w-sm rounded-lg border border-input bg-background px-2.5 text-sm">
            <option value="">— None —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.status !== "PUBLISHED" ? " (not published)" : ""}</option>
            ))}
          </select>
        </FormField>
      );
    case "projects": {
      const selected = (value as string[]) ?? [];
      return (
        <FormField {...common}>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
            {projects.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
                />
                {p.name}
                {p.status !== "PUBLISHED" ? <span className="text-xs text-muted-foreground">(not published)</span> : null}
              </label>
            ))}
          </div>
        </FormField>
      );
    }
    case "repeater":
      return <Repeater field={f} value={(value as Value[]) ?? []} onChange={onChange} errors={errors} />;
  }
}

function Repeater({
  field,
  value,
  onChange,
  errors,
}: {
  field: Extract<FieldDef, { type: "repeater" }>;
  value: Value[];
  onChange: (v: Value[]) => void;
  errors: Record<string, string[]>;
}) {
  const update = (i: number, v: Value) => onChange(value.map((x, k) => (k === i ? v : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const itemLabel = field.itemLabel ?? "Item";
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{field.label}</legend>
      {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
      {errors[field.name] ? <p className="text-xs text-destructive">{errors[field.name][0]}</p> : null}
      {value.map((item, i) => (
        <div key={i} className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">{itemLabel} {i + 1}</span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${itemLabel} ${i + 1} up`}><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move ${itemLabel} ${i + 1} down`}><ArrowDown /></Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label={`Remove ${itemLabel} ${i + 1}`}><Trash2 className="text-destructive" /></Button>
            </div>
          </div>
          <FieldRenderer fields={field.fields} value={item} onChange={(v) => update(i, v)} errors={scopedErrors(errors, `${field.name}.${i}`)} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, defaultValues(field.fields)])} disabled={value.length >= (field.max ?? 50)}>
        <Plus /> Add {itemLabel.toLowerCase()}
      </Button>
    </fieldset>
  );
}
