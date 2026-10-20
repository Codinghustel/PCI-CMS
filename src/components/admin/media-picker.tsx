"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Check, FileText, ImagePlus, Loader2, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchMediaAction } from "@/app/admin/actions/site";
import { useMediaRegistry } from "@/components/admin/admin-context";
import type { MediaSummary } from "@/server/services/media";
import { cn } from "@/lib/utils";

type Kind = "IMAGE" | "DOCUMENT";

export async function uploadFile(file: File, alt: string): Promise<MediaSummary> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("alt", alt);
  const res = await fetch("/api/admin/media", { method: "POST", body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? "Upload failed");
  return body as MediaSummary;
}

/** Dialog for choosing (or uploading) media-library items. */
export function MediaPickerDialog({
  open,
  onOpenChange,
  kind,
  multiple,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  multiple?: boolean;
  onSelect: (items: MediaSummary[]) => void;
}) {
  const registry = useMediaRegistry();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaSummary[]>([]);
  const [loading, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [alt, setAlt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    (query: string, p: number) =>
      start(async () => {
        const res = await searchMediaAction({ q: query, kind, page: p });
        setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(p);
        registry.register(res.items);
      }),
    [kind, registry]
  );

  useEffect(() => {
    if (open) load("", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when opened
  }, [open]);

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    if (kind === "IMAGE" && !alt.trim()) {
      toast.error("Add alternative text describing the image before uploading.");
      return;
    }
    setUploading(true);
    try {
      const uploaded: MediaSummary[] = [];
      for (const file of Array.from(files)) uploaded.push(await uploadFile(file, alt));
      registry.register(uploaded);
      setItems((prev) => [...uploaded, ...prev]);
      setSelected((prev) => (multiple ? [...prev, ...uploaded] : uploaded.slice(0, 1)));
      setAlt("");
      toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const toggle = (m: MediaSummary) =>
    setSelected((prev) => (prev.some((s) => s.id === m.id) ? prev.filter((s) => s.id !== m.id) : multiple ? [...prev, m] : [m]));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setSelected([]); onOpenChange(o); }}>
      <DialogContent className="max-h-[90dvh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{kind === "IMAGE" ? "Choose image" : "Choose document"}{multiple ? "s" : ""}</DialogTitle>
          <DialogDescription>Select from the media library or upload a new file.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 rounded-lg border border-dashed p-3 md:grid-cols-[1fr_auto] md:items-end">
          {kind === "IMAGE" ? (
            <div className="space-y-1.5">
              <Label htmlFor="upload-alt">Alt text for new upload (required)</Label>
              <Input id="upload-alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Aerial view of Grand Orchard towers at dusk" maxLength={300} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">PDF documents up to 30 MB.</p>
          )}
          <div>
            <input ref={fileRef} type="file" className="sr-only" id="media-upload" multiple={multiple} accept={kind === "IMAGE" ? "image/jpeg,image/png,image/webp,image/avif,image/gif" : "application/pdf"} onChange={(e) => onUpload(e.target.files)} />
            <Button type="button" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload
            </Button>
          </div>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(q, 1);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, alt text or tag" aria-label="Search media" />
          <Button type="submit" variant="outline"><Search /> Search</Button>
        </form>
        <div className="min-h-48 overflow-y-auto pe-1" style={{ maxHeight: "45dvh" }}>
          {items.length === 0 && !loading ? <p className="py-12 text-center text-sm text-muted-foreground">No files found.</p> : null}
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {items.map((m) => {
              const isSel = selected.some((s) => s.id === m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    className={cn("group relative block aspect-square w-full overflow-hidden rounded-md border bg-muted text-start", isSel && "ring-2 ring-primary ring-offset-2")}
                    aria-pressed={isSel}
                    title={m.title || m.alt}
                  >
                    {m.kind === "IMAGE" ? (
                      <Image src={m.url} alt={m.alt} fill sizes="150px" className="object-cover" />
                    ) : (
                      <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs"><FileText className="size-6" />{m.title}</span>
                    )}
                    {isSel ? <span className="absolute end-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3" /></span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {items.length < total ? (
            <div className="mt-4 text-center">
              <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => load(q, page + 1)}>
                {loading ? <Loader2 className="animate-spin" /> : null} Load more
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={!selected.length}
            onClick={() => {
              onSelect(selected);
              setSelected([]);
              onOpenChange(false);
            }}
          >
            Use {selected.length > 1 ? `${selected.length} files` : "selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Single image/document field with preview. */
export function MediaField({ value, onChange, kind = "IMAGE", id }: { value: string | null; onChange: (id: string | null) => void; kind?: Kind; id?: string }) {
  const registry = useMediaRegistry();
  const [open, setOpen] = useState(false);
  const media = registry.get(value);
  return (
    <div className="flex items-center gap-3" id={id}>
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {media?.kind === "IMAGE" ? <Image src={media.url} alt={media.alt} fill sizes="80px" className="object-cover" /> : media ? <FileText className="size-6" /> : <ImagePlus className="size-6 text-muted-foreground" />}
      </div>
      <div className="min-w-0 space-y-1">
        {media ? <p className="truncate text-xs text-muted-foreground">{media.title || media.alt || "Selected file"}</p> : value ? <p className="text-xs text-amber-700">File not found in library</p> : null}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>{value ? "Change" : "Choose"}</Button>
          {value ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} aria-label="Remove"><X /></Button> : null}
        </div>
      </div>
      <MediaPickerDialog open={open} onOpenChange={setOpen} kind={kind} onSelect={(items) => onChange(items[0]?.id ?? null)} />
    </div>
  );
}

/** Ordered list of images (gallery). */
export function MediaListField({ value, onChange, max = 60 }: { value: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const registry = useMediaRegistry();
  const [open, setOpen] = useState(false);
  const move = (i: number, d: number) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {value.map((id, i) => {
            const m = registry.get(id);
            return (
              <li key={`${id}-${i}`} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
                {m ? <Image src={m.url} alt={m.alt} fill sizes="120px" className="object-cover" /> : null}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" className="px-1 text-xs text-white" onClick={() => move(i, -1)} aria-label="Move earlier">◀</button>
                  <button type="button" className="px-1 text-xs text-white" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove image">✕</button>
                  <button type="button" className="px-1 text-xs text-white" onClick={() => move(i, 1)} aria-label="Move later">▶</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} disabled={value.length >= max}>
        <ImagePlus /> Add images
      </Button>
      <MediaPickerDialog open={open} onOpenChange={setOpen} kind="IMAGE" multiple onSelect={(items) => onChange([...value, ...items.map((i) => i.id)].slice(0, max))} />
    </div>
  );
}
