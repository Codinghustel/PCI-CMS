"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/ui";
import { createPageAction } from "@/app/admin/actions/content";
import { slugify } from "@/lib/text";

export function NewPageButton() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await createPageAction({ title, slug: slug || slugify(title), sections: [] });
      if (res?.ok && res.data) {
        toast.success("Page created");
        router.push(`/admin/pages/${res.data.id}`);
      } else if (res && !res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.message);
      }
    });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> New page</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New page</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <FormField label="Title" htmlFor="np-title" required error={errors.title}>
            <Input id="np-title" value={title} onChange={(e) => { setTitle(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} autoFocus />
          </FormField>
          <FormField label="URL" htmlFor="np-slug" required error={errors.slug} help="Use '/' for nested pages, e.g. about/leadership">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">/<Input id="np-slug" value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} /></div>
          </FormField>
          <DialogFooter>
            <Button type="submit" disabled={pending || !title}>{pending ? <Loader2 className="animate-spin" /> : null} Create page</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
