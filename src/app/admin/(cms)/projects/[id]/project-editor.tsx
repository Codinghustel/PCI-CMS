"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldRenderer } from "@/components/admin/field-renderer";
import { MediaListField } from "@/components/admin/media-picker";
import { ActionButton, ApprovalBadge, ConfirmAction, ErrorSummary, FormField } from "@/components/admin/ui";
import { useEditorAction, WorkflowBar } from "@/components/admin/workflow";
import { useAdmin } from "@/components/admin/admin-context";
import { deleteProjectAction, duplicateProjectAction, reviewCommercialAction, saveProjectAction } from "@/app/admin/actions/content";
import type { FieldDef } from "@/lib/fields";
import { PROJECT_LIST_FIELDS } from "@/lib/validation/content";
import {
  CONSTRUCTION_STATUSES,
  CONSTRUCTION_STATUS_LABELS,
  CURRENCIES,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABELS,
  MARKETS,
  MARKET_LABELS,
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  type ApprovalStatusValue,
  type PublishStatusValue,
} from "@/lib/content-labels";
import { formatDate } from "@/lib/text";

export type ProjectEditorInput = Record<string, unknown> & {
  name: string;
  slug: string;
  market: string;
  gallery: { mediaId: string; caption: string }[];
};

const opts = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((v) => ({ value: v, label: labels[v] }));

export function ProjectEditor({
  id,
  status,
  publishedAt,
  input: initial,
  locations,
  publishIssues,
  commercial,
  latestUpdate,
  canEdit,
  initialTab,
}: {
  id: string;
  status: PublishStatusValue;
  publishedAt: string | null;
  input: ProjectEditorInput;
  locations: { id: string; name: string }[];
  publishIssues: string[];
  commercial: { status: ApprovalStatusValue; asOf: string | null; approvedBy: string | null; note: string; editedBySelf: boolean };
  latestUpdate: { date: string; title: string } | null;
  canEdit: boolean;
  initialTab?: string;
}) {
  const { can } = useAdmin();
  const [input, setInput] = useState<ProjectEditorInput>(initial);
  const { state, errors, pending, pendingAction, run } = useEditorAction<{ commercialChanged: boolean }>();
  const merge = (patch: Record<string, unknown>) => setInput((s) => ({ ...s, ...patch }));

  const basics: FieldDef[] = [
    { type: "text", name: "name", label: "Project name", required: true, maxLength: 120 },
    { type: "text", name: "slug", label: "URL slug", required: true, maxLength: 96, help: "Appears as /projects/<slug>. Changing it on a published project creates a redirect." },
    { type: "select", name: "category", label: "Category", options: opts(PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS) },
    { type: "select", name: "constructionStatus", label: "Construction status", options: opts(CONSTRUCTION_STATUSES, CONSTRUCTION_STATUS_LABELS) },
    { type: "select", name: "market", label: "Country / market", options: opts(MARKETS, MARKET_LABELS), help: "UAE projects require the DLD permit number and QR code before publishing." },
    { type: "text", name: "city", label: "City", required: true, maxLength: 80 },
    { type: "text", name: "address", label: "Area / address", maxLength: 240 },
    { type: "select", name: "locationId", label: "Location page", options: [{ value: "", label: "— None —" }, ...locations.map((l) => ({ value: l.id, label: l.name }))] },
    { type: "number", name: "latitude", label: "Latitude (for the map)", min: -90, max: 90 },
    { type: "number", name: "longitude", label: "Longitude (for the map)", min: -180, max: 180 },
    { type: "boolean", name: "isFeatured", label: "Feature on the homepage" },
    { type: "number", name: "sortOrder", label: "Sort order (lower first)", min: 0, max: 9999 },
  ];
  const contentFields: FieldDef[] = [
    { type: "text", name: "tagline", label: "Tagline / positioning", maxLength: 200 },
    { type: "richtext", name: "overview", label: "Overview", help: "The project story and key proposition." },
    { type: "repeater", name: "keyFacts", label: "Key facts", itemLabel: "Fact", fields: PROJECT_LIST_FIELDS.keyFacts, max: 16, help: "e.g. Total area · 300,000 sq ft; Floors · G+24" },
    { type: "repeater", name: "unitTypes", label: "Units / spaces", itemLabel: "Unit type", fields: PROJECT_LIST_FIELDS.unitTypes, max: 30 },
    { type: "repeater", name: "amenities", label: "Amenities", itemLabel: "Amenity", fields: PROJECT_LIST_FIELDS.amenities, max: 40 },
    { type: "repeater", name: "connectivity", label: "Location & connectivity", itemLabel: "Landmark", fields: PROJECT_LIST_FIELDS.connectivity, max: 20 },
    { type: "projects", name: "relatedProjectIds", label: "Related projects (optional)", help: "Leave empty to show projects in the same city or category automatically.", max: 12 },
  ];
  const mediaFields: FieldDef[] = [
    { type: "image", name: "heroImageId", label: "Hero image", help: "Required to publish. Wide landscape image, at least 2000px." },
    { type: "image", name: "cardImageId", label: "Card image (optional)", help: "Used on project listings; defaults to the hero image." },
    { type: "youtube", name: "heroYoutubeId", label: "Hero film (YouTube, optional)" },
    { type: "repeater", name: "videos", label: "Project films", itemLabel: "Video", fields: PROJECT_LIST_FIELDS.videos, max: 12 },
  ];
  const plansFields: FieldDef[] = [
    {
      type: "repeater",
      name: "floorPlans",
      label: "Floor plans",
      itemLabel: "Floor plan",
      max: 60,
      fields: [
        { type: "text", name: "title", label: "Title", required: true, maxLength: 120 },
        { type: "text", name: "unitType", label: "Unit type", maxLength: 80 },
        { type: "text", name: "size", label: "Size", maxLength: 60 },
        { type: "image", name: "imageId", label: "Plan image" },
        { type: "document", name: "documentId", label: "Plan PDF (optional)" },
        { type: "boolean", name: "gated", label: "Require an enquiry form before viewing" },
      ],
    },
    {
      type: "repeater",
      name: "documents",
      label: "Brochures & documents",
      itemLabel: "Document",
      max: 30,
      help: "Files can be replaced in the media library without changing their URL.",
      fields: [
        { type: "document", name: "mediaId", label: "File", required: true },
        { type: "text", name: "title", label: "Title", required: true, maxLength: 120 },
        { type: "select", name: "kind", label: "Type", options: opts(DOCUMENT_KINDS, DOCUMENT_KIND_LABELS) },
        { type: "boolean", name: "gated", label: "Require an enquiry form before download" },
      ],
    },
  ];
  const vrFields: FieldDef[] = [
    {
      type: "repeater",
      name: "vrTours",
      label: "VR / 360° tours",
      itemLabel: "Tour",
      max: 30,
      help: "Paste the embed URL supplied by the VR provider (https). Inactive tours are hidden; the VR section only appears when at least one tour is active.",
      fields: [
        { type: "text", name: "title", label: "Title", required: true, maxLength: 120 },
        { type: "text", name: "embedUrl", label: "Embed URL", required: true, maxLength: 500, placeholder: "https://…" },
        { type: "text", name: "provider", label: "Provider", maxLength: 60 },
        { type: "text", name: "unitType", label: "Unit type / space", maxLength: 80 },
        { type: "image", name: "thumbnailId", label: "Thumbnail (optional)" },
        { type: "boolean", name: "isActive", label: "Active", defaultValue: true },
      ],
    },
  ];
  const commercialFields: FieldDef[] = [
    { type: "number", name: "priceFrom", label: "Starting price", min: 0 },
    { type: "select", name: "currency", label: "Currency", options: [{ value: "", label: "— Select —" }, ...CURRENCIES.map((c) => ({ value: c, label: c }))] },
    { type: "text", name: "handover", label: "Handover", maxLength: 60, help: "e.g. Q4 2027" },
    { type: "text", name: "paymentPlanSummary", label: "Payment plan headline", maxLength: 200, help: "e.g. 30/70 payment plan · 3-year installments" },
    { type: "repeater", name: "paymentPlan", label: "Payment plan steps", itemLabel: "Step", fields: PROJECT_LIST_FIELDS.paymentPlan, max: 20 },
    { type: "boolean", name: "showPrice", label: "Show price on the website" },
    { type: "boolean", name: "showHandover", label: "Show handover date on the website" },
    { type: "boolean", name: "showPaymentPlan", label: "Show payment plan on the website" },
  ];
  const complianceFields: FieldDef[] = [
    { type: "text", name: "dldPermitNumber", label: "DLD advertising permit number", maxLength: 60, help: input.market === "UAE" ? "Required for UAE projects." : "Dubai projects only." },
    { type: "image", name: "dldQrImageId", label: "DLD permit QR code" },
    { type: "textarea", name: "regulatoryApprovals", label: "Approvals / NOC references (Pakistan)", maxLength: 500, help: "As confirmed by PCI Legal." },
    { type: "text", name: "bitrixProjectId", label: "Bitrix24 project identifier", maxLength: 60, help: "Passed with every enquiry for this project." },
    { type: "text", name: "seoTitle", label: "SEO title", maxLength: 70 },
    { type: "textarea", name: "seoDescription", label: "Meta description", maxLength: 300 },
    { type: "boolean", name: "noindex", label: "Hide from search engines" },
  ];

  const section = (fields: FieldDef[]) => (
    <fieldset disabled={!canEdit}>
      <FieldRenderer fields={fields} value={input} onChange={(v) => setInput(v as ProjectEditorInput)} errors={errors} />
    </fieldset>
  );

  const gallery = input.gallery;
  return (
    <>
      <WorkflowBar
        status={status}
        publishedAt={publishedAt}
        pending={pending}
        pendingAction={pendingAction}
        canEdit={canEdit}
        previewHref={`/admin/preview/projects/${id}`}
        liveHref={`/projects/${initial.slug}`}
        onAction={(a) => run(a, () => saveProjectAction(id, { ...input, locationId: input.locationId || null, currency: input.currency || null }, a))}
        extra={can("content.writeOwn") ? <ActionButton action={() => duplicateProjectAction(id)} variant="ghost"><Copy /> Duplicate</ActionButton> : null}
      />
      <div className="mb-4 space-y-3">
        <ErrorSummary state={state} />
        {publishIssues.length && status !== "PUBLISHED" ? (
          <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Before this project can be published (based on the last save):</p>
              <ul className="mt-1 list-disc ps-5">{publishIssues.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          </div>
        ) : null}
      </div>

      <Tabs defaultValue={initialTab ?? "basics"}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="plans">Floor plans & downloads</TabsTrigger>
          <TabsTrigger value="vr">VR tours</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
          <TabsTrigger value="compliance">Compliance & SEO</TabsTrigger>
        </TabsList>
        <TabsContent value="basics" className="mt-4"><Card><CardContent className="p-5">{section(basics)}</CardContent></Card></TabsContent>
        <TabsContent value="content" className="mt-4"><Card><CardContent className="p-5">{section(contentFields)}</CardContent></Card></TabsContent>
        <TabsContent value="media" className="mt-4 space-y-4">
          <Card><CardContent className="p-5">{section(mediaFields)}</CardContent></Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Gallery</CardTitle></CardHeader>
            <CardContent>
              <MediaListField
                value={gallery.map((g) => g.mediaId)}
                onChange={(ids) => merge({ gallery: ids.map((mid) => ({ mediaId: mid, caption: gallery.find((g) => g.mediaId === mid)?.caption ?? "" })) })}
                max={80}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-5 text-sm">
              <span>
                Construction updates are managed separately and the latest one appears on the project page automatically.
                {latestUpdate ? <span className="block text-muted-foreground">Latest: {latestUpdate.title} ({formatDate(latestUpdate.date, "month")})</span> : <span className="block text-amber-700">No updates yet.</span>}
              </span>
              <Button asChild variant="outline" size="sm"><Link href={`/admin/updates/new?projectId=${id}`}>Add update</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="plans" className="mt-4"><Card><CardContent className="p-5">{section(plansFields)}</CardContent></Card></TabsContent>
        <TabsContent value="vr" className="mt-4"><Card><CardContent className="p-5">{section(vrFields)}</CardContent></Card></TabsContent>
        <TabsContent value="commercial" className="mt-4 space-y-4">
          <CommercialApproval id={id} commercial={commercial} />
          <Card><CardContent className="p-5">{section(commercialFields)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="compliance" className="mt-4 space-y-4">
          <Card><CardContent className="p-5">{section(complianceFields)}</CardContent></Card>
          {canEdit ? (
            <div className="rounded-lg border border-destructive/30 p-4">
              <ConfirmAction action={() => deleteProjectAction(id)} title="Delete this project?" description="The project, its gallery, floor plans, VR tours and construction updates will be permanently deleted. Consider unpublishing instead." confirmLabel="Delete project">
                <Trash2 /> Delete project
              </ConfirmAction>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </>
  );
}

function CommercialApproval({ id, commercial }: { id: string; commercial: { status: ApprovalStatusValue; asOf: string | null; approvedBy: string | null; note: string; editedBySelf: boolean } }) {
  const { can, actor } = useAdmin();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const review = (decision: "approve" | "reject") =>
    start(async () => {
      const res = await reviewCommercialAction(id, { decision, note });
      if (res?.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else if (res) toast.error(res.message);
    });
  const canApprove = can("projects.approveCommercial") && commercial.status === "PENDING" && (!commercial.editedBySelf || actor.role === "ADMIN");
  return (
    <Card>
      <CardContent className="space-y-3 p-5 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">Sales approval:</span>
          <ApprovalBadge status={commercial.status} />
          {commercial.status === "APPROVED" && commercial.asOf ? (
            <span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600" /> As of {formatDate(commercial.asOf)}{commercial.approvedBy ? ` by ${commercial.approvedBy}` : ""}</span>
          ) : null}
        </div>
        <p className="text-muted-foreground">
          Price, payment plan and handover are shown on the website only after approval by a Sales Approver. Any change resets the approval.
        </p>
        {commercial.note ? <p className="rounded bg-muted p-2 text-xs">Reviewer note: {commercial.note}</p> : null}
        {canApprove ? (
          <div className="space-y-2 rounded-lg border p-3">
            <FormField label="Review note (optional)" htmlFor="approval-note">
              <Textarea id="approval-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
            </FormField>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={() => review("approve")}>{pending ? <Loader2 className="animate-spin" /> : null} Approve</Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => review("reject")}>Reject</Button>
            </div>
          </div>
        ) : commercial.status === "PENDING" && can("projects.approveCommercial") && commercial.editedBySelf ? (
          <p className="text-xs text-amber-700">You edited these details, so another approver must review them.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
