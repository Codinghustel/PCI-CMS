"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Copy, FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmAction, FormField } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/admin-context";
import { uploadFile } from "@/components/admin/media-picker";
import { deleteMediaAction, updateMediaAction } from "@/app/admin/actions/site";
import type { MediaSummary } from "@/server/services/media";

type Item = MediaSummary & { originalName: string; tags: string[]; createdAt: string };

export function MediaLibrary({ items }: { items: Item[] }) {
  const router = useRouter();
  const { can } = useAdmin();
  const [selected, setSelected] = useState<Item | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const hasImage = Array.from(files).some((f) => f.type.startsWith("image/"));
    if (hasImage && !alt.trim()) {
      toast.error("Enter alt text describing the image(s) before uploading.");
      return;
    }
    setUploading(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      try {
        await uploadFile(f, alt);
        ok++;
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    setUploading(false);
    setAlt("");
    if (fileRef.current) fileRef.current.value = "";
    if (ok) {
      toast.success(`${ok} file${ok > 1 ? "s" : ""} uploaded`);
      router.refresh();
    }
  }

  return (
    <>
      {can("media.upload") ? (
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-dashed bg-background p-4">
          <FormField label="Alt text for new images" htmlFor="lib-alt" className="min-w-64 flex-1">
            <Input id="lib-alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image for screen readers" maxLength={300} />
          </FormField>
          <input ref={fileRef} type="file" multiple className="sr-only" id="lib-upload" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,application/pdf" onChange={(e) => onFiles(e.target.files)} />
          <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload files
          </Button>
          <p className="w-full text-xs text-muted-foreground">JPG, PNG, WebP, AVIF, GIF (max 15 MB) or PDF (max 30 MB). SVG and other file types are not accepted.</p>
        </div>
      ) : null}
      {items.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No files found.</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => setSelected(m)} className="group block w-full text-start">
              <span className="relative block aspect-square overflow-hidden rounded-md border bg-muted">
                {m.kind === "IMAGE" ? <Image src={m.url} alt={m.alt} fill sizes="200px" className="object-cover transition group-hover:scale-105" /> : <span className="flex h-full items-center justify-center"><FileText className="size-8 text-muted-foreground" /></span>}
                {m.kind === "IMAGE" && !m.alt ? <span className="absolute start-1 top-1 rounded bg-amber-400 px-1.5 text-[10px] font-semibold">No alt text</span> : null}
              </span>
              <span className="mt-1 block truncate text-xs">{m.title || m.originalName}</span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>File details</SheetTitle></SheetHeader>
          {selected ? <MediaDetails key={selected.id} item={selected} onDone={() => { setSelected(null); router.refresh(); }} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function MediaDetails({ item, onDone }: { item: Item; onDone: () => void }) {
  const { can } = useAdmin();
  const [alt, setAlt] = useState(item.alt);
  const [title, setTitle] = useState(item.title);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [pending, start] = useTransition();
  const [replacing, setReplacing] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  async function replace(file: File | undefined) {
    if (!file) return;
    setReplacing(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/admin/media/${item.id}/replace`, { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setReplacing(false);
    if (!res.ok) toast.error(body.message ?? "Replace failed");
    else {
      toast.success("File replaced — the URL is unchanged.");
      onDone();
    }
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
        {item.kind === "IMAGE" ? <Image src={item.url} alt={item.alt} fill sizes="400px" className="object-contain" /> : <span className="flex h-full items-center justify-center"><FileText className="size-10" /></span>}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <dt>File</dt><dd className="truncate text-foreground">{item.originalName}</dd>
        <dt>Type</dt><dd className="text-foreground">{item.mimeType}</dd>
        <dt>Size</dt><dd className="text-foreground">{(item.sizeBytes / 1024).toFixed(0)} KB{item.width ? ` · ${item.width}×${item.height}` : ""}</dd>
        <dt>Uploaded</dt><dd className="text-foreground">{new Date(item.createdAt).toLocaleDateString()}</dd>
      </dl>
      <div className="flex gap-2">
        <Input readOnly value={item.url} aria-label="File URL" className="text-xs" />
        <Button type="button" size="icon" variant="outline" aria-label="Copy URL" onClick={() => { navigator.clipboard.writeText(window.location.origin + item.url); toast.success("URL copied"); }}><Copy /></Button>
      </div>
      <fieldset disabled={!can("media.upload")} className="space-y-4">
        <FormField label="Alt text" htmlFor="md-alt" help="Describe the image for people using screen readers.">
          <Input id="md-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} />
        </FormField>
        <FormField label="Title" htmlFor="md-title"><Input id="md-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></FormField>
        <FormField label="Tags (comma separated)" htmlFor="md-tags"><Input id="md-tags" value={tags} onChange={(e) => setTags(e.target.value)} /></FormField>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await updateMediaAction(item.id, { alt, title, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
                if (res?.ok) { toast.success(res.message ?? "Saved"); onDone(); } else if (res) toast.error(res.message);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null} Save details
          </Button>
          <input ref={replaceRef} type="file" className="sr-only" accept={item.mimeType} onChange={(e) => replace(e.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={replacing} onClick={() => replaceRef.current?.click()}>
            {replacing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Replace file
          </Button>
        </div>
      </fieldset>
      {can("media.delete") ? (
        <ConfirmAction action={() => deleteMediaAction(item.id)} title="Delete this file?" description="Files still used by content cannot be deleted." confirmLabel="Delete" onDone={onDone}>
          <Trash2 /> Delete
        </ConfirmAction>
      ) : null}
    </div>
  );
}
