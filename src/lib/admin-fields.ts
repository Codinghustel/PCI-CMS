import type { FieldDef } from "@/lib/fields";
import { LOCATION_LANDMARK_FIELDS } from "@/lib/validation/content";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABELS, MARKETS, MARKET_LABELS } from "@/lib/content-labels";

// Editor field layouts for the simpler content types. Server-side validation
// lives in lib/validation/content.ts; these definitions only drive the forms.

export function updateFields(projects: { id: string; name: string }[]): FieldDef[] {
  return [
    { type: "select", name: "projectId", label: "Project", options: [{ value: "", label: "— Choose project —" }, ...projects.map((p) => ({ value: p.id, label: p.name }))], required: true },
    { type: "text", name: "title", label: "Title", required: true, maxLength: 160, help: "e.g. Grand Orchard — September 2026 progress" },
    { type: "text", name: "slug", label: "URL slug", required: true, maxLength: 96 },
    { type: "text", name: "date", label: "Update date (YYYY-MM-DD)", required: true, maxLength: 10, help: "Required. Determines ordering and the archive." },
    { type: "number", name: "progressPercent", label: "Overall progress %", min: 0, max: 100 },
    { type: "text", name: "milestone", label: "Milestone / status", maxLength: 120, help: "e.g. Structure complete up to level 12" },
    { type: "textarea", name: "summary", label: "Summary", maxLength: 500 },
    { type: "richtext", name: "body", label: "Details" },
    { type: "youtube", name: "youtubeId", label: "Video (YouTube)" },
    { type: "repeater", name: "images", label: "Photos", itemLabel: "Photo", max: 40, fields: [
      { type: "image", name: "mediaId", label: "Photo", required: true },
      { type: "text", name: "caption", label: "Caption", maxLength: 200 },
    ] },
  ];
}

export const locationFields: FieldDef[] = [
  { type: "text", name: "name", label: "Name", required: true, maxLength: 120 },
  { type: "text", name: "slug", label: "URL slug", required: true, maxLength: 96 },
  { type: "select", name: "market", label: "Country / market", options: MARKETS.map((m) => ({ value: m, label: MARKET_LABELS[m] })) },
  { type: "text", name: "city", label: "City", required: true, maxLength: 80 },
  { type: "textarea", name: "summary", label: "Summary", maxLength: 400 },
  { type: "richtext", name: "overview", label: "Overview & lifestyle" },
  { type: "image", name: "heroImageId", label: "Hero image" },
  { type: "number", name: "latitude", label: "Latitude", min: -90, max: 90 },
  { type: "number", name: "longitude", label: "Longitude", min: -180, max: 180 },
  { type: "repeater", name: "landmarks", label: "Landmarks & connectivity", itemLabel: "Landmark", fields: LOCATION_LANDMARK_FIELDS, max: 30 },
  { type: "text", name: "seoTitle", label: "SEO title", maxLength: 70 },
  { type: "textarea", name: "seoDescription", label: "Meta description", maxLength: 300 },
];

export const articleFields: FieldDef[] = [
  { type: "text", name: "title", label: "Title", required: true, maxLength: 200 },
  { type: "text", name: "slug", label: "URL slug", required: true, maxLength: 96 },
  { type: "select", name: "category", label: "Category", options: ARTICLE_CATEGORIES.map((c) => ({ value: c, label: ARTICLE_CATEGORY_LABELS[c] })) },
  { type: "textarea", name: "excerpt", label: "Summary", maxLength: 400 },
  { type: "image", name: "coverImageId", label: "Cover image" },
  { type: "richtext", name: "body", label: "Body" },
  { type: "youtube", name: "youtubeId", label: "Video (YouTube)" },
  { type: "text", name: "eventDate", label: "Event date (YYYY-MM-DD, events only)", maxLength: 10 },
  { type: "text", name: "eventLocation", label: "Event location", maxLength: 200 },
  { type: "text", name: "publishedAt", label: "Publication date (YYYY-MM-DD HH:mm UTC, optional)", maxLength: 16, help: "A future date schedules the article when you press Publish." },
  { type: "text", name: "seoTitle", label: "SEO title", maxLength: 70 },
  { type: "textarea", name: "seoDescription", label: "Meta description", maxLength: 300 },
];

export const vacancyFields: FieldDef[] = [
  { type: "text", name: "title", label: "Job title", required: true, maxLength: 160 },
  { type: "text", name: "slug", label: "URL slug", required: true, maxLength: 96 },
  { type: "text", name: "department", label: "Department", maxLength: 80 },
  { type: "text", name: "location", label: "Location", maxLength: 120 },
  { type: "text", name: "employmentType", label: "Employment type", maxLength: 40 },
  { type: "textarea", name: "summary", label: "Summary", maxLength: 400 },
  { type: "richtext", name: "description", label: "Description, responsibilities & requirements" },
  { type: "text", name: "closesAt", label: "Closing date (YYYY-MM-DD, optional)", maxLength: 10 },
];

export const toDateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const toDateTimeInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");
