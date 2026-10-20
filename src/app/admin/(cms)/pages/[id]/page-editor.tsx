"use client";

import { useState } from "react";
import { Copy, History, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { SectionsEditor } from "@/components/admin/sections-editor";
import { MediaField } from "@/components/admin/media-picker";
import { ActionButton, ConfirmAction, ErrorSummary, FormField } from "@/components/admin/ui";
import { useEditorAction, WorkflowBar } from "@/components/admin/workflow";
import { useAdmin } from "@/components/admin/admin-context";
import { deletePageAction, duplicatePageAction, restoreRevisionAction, savePageAction } from "@/app/admin/actions/content";
import type { Section } from "@/lib/sections/registry";
import type { PublishStatusValue } from "@/lib/content-labels";

interface PageInputState {
  title: string;
  slug: string;
  excerpt: string;
  sections: Section[];
  featuredImageId: string | null;
  ogImageId: string | null;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  noindex: boolean;
}

export function PageEditor({
  page,
  revisions,
  canEdit,
}: {
  page: { id: string; status: PublishStatusValue; publishedAt: string | null; isHome: boolean; input: PageInputState };
  revisions: { id: string; note: string; createdAt: string; by: string }[];
  canEdit: boolean;
}) {
  const { can } = useAdmin();
  const [input, setInput] = useState(page.input);
  const [publishAt, setPublishAt] = useState("");
  const { state, errors, pending, pendingAction, run } = useEditorAction();
  const set = <K extends keyof PageInputState>(k: K, v: PageInputState[K]) => setInput((s) => ({ ...s, [k]: v }));
  const livePath = page.isHome ? "/" : `/${page.input.slug}`;

  return (
    <>
      <WorkflowBar
        status={page.status}
        publishedAt={page.publishedAt}
        pending={pending}
        pendingAction={pendingAction}
        canEdit={canEdit}
        previewHref={`/admin/preview/pages/${page.id}`}
        liveHref={livePath}
        onAction={(a) => run(a, () => savePageAction(page.id, input, a, a === "publish" && publishAt ? new Date(publishAt).toISOString() : null))}
        extra={
          can("content.writeOwn") ? (
            <ActionButton action={() => duplicatePageAction(page.id)} variant="ghost"><Copy /> Duplicate</ActionButton>
          ) : null
        }
      />
      <div className="mb-4"><ErrorSummary state={state} /></div>
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="settings">Settings & SEO</TabsTrigger>
          <TabsTrigger value="history">History ({revisions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4 space-y-6">
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              <FormField label="Title" htmlFor="p-title" required error={errors.title}>
                <Input id="p-title" value={input.title} onChange={(e) => set("title", e.target.value)} disabled={!canEdit} />
              </FormField>
              <FormField label="URL" htmlFor="p-slug" required error={errors.slug} help={page.isHome ? "The homepage URL cannot be changed." : "Changing the URL of a published page creates a redirect automatically."}>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">/<Input id="p-slug" value={input.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} disabled={!canEdit || page.isHome} /></div>
              </FormField>
              <FormField label="Introduction" htmlFor="p-excerpt" error={errors.excerpt} help="Shown in the page banner when the page doesn't start with a hero block." className="md:col-span-2">
                <Textarea id="p-excerpt" value={input.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} maxLength={300} disabled={!canEdit} />
              </FormField>
            </CardContent>
          </Card>
          <fieldset disabled={!canEdit} className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">Page blocks</legend>
            <SectionsEditor value={input.sections} onChange={(s) => set("sections", s)} errors={errors} />
          </fieldset>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardContent className="grid gap-5 p-5 md:grid-cols-2">
              <FormField label="SEO title" htmlFor="p-seo-title" error={errors.seoTitle} help={`${input.seoTitle.length}/70 — defaults to the page title.`}>
                <Input id="p-seo-title" value={input.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} />
              </FormField>
              <FormField label="Canonical URL" htmlFor="p-canonical" error={errors.canonicalUrl} help="Leave blank unless this page duplicates another URL.">
                <Input id="p-canonical" value={input.canonicalUrl} onChange={(e) => set("canonicalUrl", e.target.value)} />
              </FormField>
              <FormField label="Meta description" htmlFor="p-seo-desc" error={errors.seoDescription} help={`${input.seoDescription.length}/300 — aim for 120–160 characters.`} className="md:col-span-2">
                <Textarea id="p-seo-desc" value={input.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={300} rows={3} />
              </FormField>
              <FormField label="Banner image" help="Used in the page banner and as the default sharing image.">
                <MediaField value={input.featuredImageId} onChange={(v) => set("featuredImageId", v)} />
              </FormField>
              <FormField label="Social sharing image" help="Open Graph image (1200×630 recommended).">
                <MediaField value={input.ogImageId} onChange={(v) => set("ogImageId", v)} />
              </FormField>
              <div className="flex items-center gap-3">
                <Switch id="p-noindex" checked={input.noindex} onCheckedChange={(v) => set("noindex", v)} />
                <label htmlFor="p-noindex" className="text-sm">Hide from search engines (noindex)</label>
              </div>
              {can("content.publish") && page.status !== "PUBLISHED" ? (
                <FormField label="Schedule publication (optional)" htmlFor="p-publish-at" help="Choose a future date and press Publish to schedule.">
                  <Input id="p-publish-at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="max-w-64" />
                </FormField>
              ) : null}
            </CardContent>
          </Card>
          {!page.isHome && canEdit ? (
            <div className="mt-6 rounded-lg border border-destructive/30 p-4">
              <p className="mb-3 text-sm font-medium">Danger zone</p>
              <ConfirmAction
                action={() => deletePageAction(page.id)}
                title="Delete this page?"
                description="The page and its revision history will be permanently deleted. Consider unpublishing instead."
                confirmLabel="Delete page"
              >
                <Trash2 /> Delete page
              </ConfirmAction>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y text-sm">
                {revisions.map((r, i) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <span className="flex items-center gap-3">
                      <History className="size-4 text-muted-foreground" />
                      <span>
                        <span className="font-medium">{r.note || "Saved"}</span>
                        <span className="block text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()} · {r.by}</span>
                      </span>
                    </span>
                    {i > 0 && canEdit ? (
                      <ConfirmAction
                        action={() => restoreRevisionAction(page.id, r.id)}
                        title="Restore this revision?"
                        description="The page content will be replaced with this version. The current version stays in the history."
                        confirmLabel="Restore"
                        variant="outline"
                        onDone={() => window.location.reload()}
                      >
                        Restore
                      </ConfirmAction>
                    ) : i === 0 ? <span className="text-xs text-muted-foreground">Current</span> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
