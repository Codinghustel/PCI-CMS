import { z } from "zod";
import { isSafeHref, parseYoutubeId } from "@/lib/text";

// Declarative field definitions. The same definition drives:
//  - the CMS editor UI (components/admin/fields/field-renderer.tsx), and
//  - server-side validation (fieldsToSchema below).
// This keeps the page builder, project lists and other structured content
// consistent without hand-writing a form and a schema for every block.

export type SelectOption = { value: string; label: string };

interface BaseField {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
}

export type FieldDef =
  | (BaseField & { type: "text"; maxLength?: number; placeholder?: string })
  | (BaseField & { type: "textarea"; maxLength?: number; rows?: number })
  | (BaseField & { type: "link" })
  | (BaseField & { type: "number"; min?: number; max?: number })
  | (BaseField & { type: "richtext" })
  | (BaseField & { type: "image" })
  | (BaseField & { type: "document" })
  | (BaseField & { type: "images"; max?: number })
  | (BaseField & { type: "select"; options: SelectOption[]; defaultValue?: string })
  | (BaseField & { type: "boolean"; defaultValue?: boolean })
  | (BaseField & { type: "youtube" })
  | (BaseField & { type: "project" })
  | (BaseField & { type: "projects"; max?: number })
  | (BaseField & { type: "repeater"; fields: FieldDef[]; itemLabel?: string; max?: number });

const cuidLike = z.string().min(1).max(64).regex(/^[a-z0-9]+$/i, "Invalid reference");

function fieldSchema(field: FieldDef): z.ZodType {
  const req = field.required ?? false;
  switch (field.type) {
    case "text":
    case "textarea": {
      const max = field.maxLength ?? (field.type === "text" ? 200 : 2000);
      const base = z.string().trim().max(max, `${field.label} must be at most ${max} characters`);
      return req ? base.min(1, `${field.label} is required`) : base.default("");
    }
    case "link": {
      const base = z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === "" || isSafeHref(v), `${field.label} must be a path like /contact or a full https:// URL`);
      return req ? base.refine((v) => v !== "", `${field.label} is required`) : base.default("");
    }
    case "number": {
      let base = z.coerce.number({ error: `${field.label} must be a number` });
      if (field.min !== undefined) base = base.min(field.min);
      if (field.max !== undefined) base = base.max(field.max);
      return req ? base : base.nullable().optional().default(null);
    }
    case "richtext": {
      // Sanitisation happens on the server (see lib/sanitize) after validation.
      const base = z.string().max(100_000);
      return req ? base.min(1, `${field.label} is required`) : base.default("");
    }
    case "image":
    case "document":
    case "project":
      return req ? cuidLike : cuidLike.nullable().optional().default(null);
    case "images":
    case "projects": {
      const base = z.array(cuidLike).max(field.max ?? 60);
      return req ? base.min(1, `${field.label} is required`) : base.default([]);
    }
    case "select": {
      const values = field.options.map((o) => o.value) as [string, ...string[]];
      const base = z.enum(values);
      return req ? base : base.default((field.defaultValue ?? values[0]) as string);
    }
    case "boolean":
      return z.boolean().default(field.defaultValue ?? false);
    case "youtube":
      return z
        .string()
        .trim()
        .default("")
        .transform((v, ctx) => {
          if (!v) return "";
          const id = parseYoutubeId(v);
          if (!id) {
            ctx.addIssue({ code: "custom", message: `${field.label} must be a YouTube link or video id` });
            return z.NEVER;
          }
          return id;
        });
    case "repeater": {
      const item = fieldsToSchema(field.fields);
      const base = z.array(item).max(field.max ?? 50);
      return req ? base.min(1, `${field.label} needs at least one item`) : base.default([]);
    }
  }
}

export function fieldsToSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) shape[f.name] = fieldSchema(f);
  return z.object(shape);
}

/** Default (empty) value for a set of fields, used when adding a block/item. */
export function defaultValues(fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    switch (f.type) {
      case "number":
      case "image":
      case "document":
      case "project":
        out[f.name] = null;
        break;
      case "images":
      case "projects":
      case "repeater":
        out[f.name] = [];
        break;
      case "boolean":
        out[f.name] = f.defaultValue ?? false;
        break;
      case "select":
        out[f.name] = f.defaultValue ?? f.options[0]?.value ?? "";
        break;
      default:
        out[f.name] = "";
    }
  }
  return out;
}

/** Collects every media id referenced by a value shaped by `fields`. */
export function collectMediaIds(fields: FieldDef[], value: Record<string, unknown>, into: Set<string>) {
  for (const f of fields) {
    const v = value?.[f.name];
    if ((f.type === "image" || f.type === "document") && typeof v === "string") into.add(v);
    if (f.type === "images" && Array.isArray(v)) v.forEach((id) => typeof id === "string" && into.add(id));
    if (f.type === "repeater" && Array.isArray(v)) {
      v.forEach((item) => collectMediaIds(f.fields, item as Record<string, unknown>, into));
    }
  }
}

/** Applies a transform to every rich-text field (used for sanitisation). */
export function mapRichText(
  fields: FieldDef[],
  value: Record<string, unknown>,
  fn: (html: string) => string
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  for (const f of fields) {
    if (f.type === "richtext" && typeof out[f.name] === "string") out[f.name] = fn(out[f.name] as string);
    if (f.type === "repeater" && Array.isArray(out[f.name])) {
      out[f.name] = (out[f.name] as Record<string, unknown>[]).map((item) => mapRichText(f.fields, item, fn));
    }
  }
  return out;
}
