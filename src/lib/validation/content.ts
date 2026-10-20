import { z } from "zod";
import { fieldsToSchema, type FieldDef } from "@/lib/fields";
import {
  ARTICLE_CATEGORIES,
  CONSTRUCTION_STATUSES,
  CURRENCIES,
  DOCUMENT_KINDS,
  MARKETS,
  PROJECT_CATEGORIES,
} from "@/lib/content-labels";
import { isSafeHref, PAGE_SLUG_PATTERN, parseYoutubeId, SLUG_PATTERN } from "@/lib/text";

// Input schemas for CMS content. They validate shape and length; services add
// business rules (slug uniqueness, permissions, publish requirements).

const ref = z.string().min(1).max(64).regex(/^[a-z0-9]+$/i, "Invalid reference");
const optionalRef = z.preprocess((v) => (v === "" || v === undefined ? null : v), ref.nullable());
const str = (max: number) => z.string().trim().max(max).default("");
const requiredStr = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`);
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(96)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and hyphens only");
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.date({ error: "Enter a valid date" }).nullable()
);
const youtube = z
  .string()
  .trim()
  .default("")
  .transform((v, ctx) => {
    if (!v) return "";
    const id = parseYoutubeId(v);
    if (!id) {
      ctx.addIssue({ code: "custom", message: "Enter a YouTube link or video id" });
      return z.NEVER;
    }
    return id;
  });

export const seoFields = {
  seoTitle: str(70),
  seoDescription: str(300),
};

// ── Pages ──
export const pageInputSchema = z.object({
  title: requiredStr("Title", 160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(160)
    .regex(PAGE_SLUG_PATTERN, "Use lowercase letters, numbers, hyphens and '/' for nested pages"),
  excerpt: str(300),
  sections: z.array(z.unknown()).max(60).default([]),
  featuredImageId: optionalRef,
  ogImageId: optionalRef,
  canonicalUrl: z
    .string()
    .trim()
    .max(500)
    .default("")
    .refine((v) => v === "" || isSafeHref(v), "Canonical URL must be a path or https URL"),
  noindex: z.boolean().default(false),
  ...seoFields,
});
export type PageInput = z.infer<typeof pageInputSchema>;

// ── Projects ──
export const PROJECT_LIST_FIELDS = {
  keyFacts: [
    { type: "text", name: "label", label: "Label", required: true, maxLength: 60 },
    { type: "text", name: "value", label: "Value", required: true, maxLength: 120 },
  ],
  unitTypes: [
    { type: "text", name: "name", label: "Unit / space type", required: true, maxLength: 80, help: "e.g. 1 Bedroom, Retail shop, Studio" },
    { type: "text", name: "size", label: "Size range", maxLength: 60, help: "e.g. 650 – 820 sq ft" },
    { type: "text", name: "details", label: "Details", maxLength: 200 },
  ],
  amenities: [
    { type: "text", name: "name", label: "Amenity", required: true, maxLength: 80 },
    { type: "textarea", name: "description", label: "Description", maxLength: 300, rows: 2 },
  ],
  videos: [
    { type: "text", name: "title", label: "Title", required: true, maxLength: 120 },
    { type: "youtube", name: "youtubeId", label: "YouTube link", required: true },
  ],
  connectivity: [
    { type: "text", name: "place", label: "Landmark / destination", required: true, maxLength: 100 },
    { type: "text", name: "distance", label: "Distance / travel time", maxLength: 60 },
  ],
  paymentPlan: [
    { type: "text", name: "milestone", label: "Milestone", required: true, maxLength: 120, help: "e.g. Down payment, During construction, On handover" },
    { type: "number", name: "percentage", label: "Percentage", min: 0, max: 100 },
    { type: "text", name: "note", label: "Note", maxLength: 200 },
  ],
} satisfies Record<string, FieldDef[]>;

const list = (fields: FieldDef[], max = 40) => z.array(fieldsToSchema(fields)).max(max).default([]);

export const projectInputSchema = z
  .object({
    name: requiredStr("Name", 120),
    slug,
    category: z.enum(PROJECT_CATEGORIES, { error: "Choose a category" }),
    constructionStatus: z.enum(CONSTRUCTION_STATUSES, { error: "Choose a construction status" }),
    market: z.enum(MARKETS, { error: "Choose a country / market" }),
    city: requiredStr("City", 80),
    address: str(240),
    locationId: optionalRef,
    latitude: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(-90).max(90).nullable()),
    longitude: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(-180).max(180).nullable()),
    tagline: str(200),
    overview: z.string().max(50_000).default(""),
    heroImageId: optionalRef,
    cardImageId: optionalRef,
    heroYoutubeId: youtube,
    keyFacts: list(PROJECT_LIST_FIELDS.keyFacts, 16),
    unitTypes: list(PROJECT_LIST_FIELDS.unitTypes, 30),
    amenities: list(PROJECT_LIST_FIELDS.amenities, 40),
    videos: list(PROJECT_LIST_FIELDS.videos, 12),
    connectivity: list(PROJECT_LIST_FIELDS.connectivity, 20),
    isFeatured: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),

    priceFrom: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().positive("Price must be positive").nullable()),
    currency: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(CURRENCIES).nullable()),
    handover: str(60),
    paymentPlanSummary: str(200),
    paymentPlan: list(PROJECT_LIST_FIELDS.paymentPlan, 20),
    showPrice: z.boolean().default(true),
    showPaymentPlan: z.boolean().default(true),
    showHandover: z.boolean().default(true),

    dldPermitNumber: str(60),
    dldQrImageId: optionalRef,
    regulatoryApprovals: str(500),
    bitrixProjectId: str(60),
    noindex: z.boolean().default(false),
    ...seoFields,

    gallery: z.array(z.object({ mediaId: ref, caption: str(200) })).max(80).default([]),
    floorPlans: z
      .array(
        z.object({
          title: requiredStr("Floor plan title", 120),
          unitType: str(80),
          size: str(60),
          imageId: optionalRef,
          documentId: optionalRef,
          gated: z.boolean().default(false),
        })
      )
      .max(60)
      .default([]),
    documents: z
      .array(
        z.object({
          mediaId: ref,
          title: requiredStr("Document title", 120),
          kind: z.enum(DOCUMENT_KINDS).default("BROCHURE"),
          gated: z.boolean().default(false),
        })
      )
      .max(30)
      .default([]),
    vrTours: z
      .array(
        z.object({
          title: requiredStr("Tour title", 120),
          provider: str(60),
          embedUrl: z
            .string()
            .trim()
            .url("Enter the tour's https embed URL")
            .refine((v) => v.startsWith("https://"), "Tour URL must use https"),
          unitType: str(80),
          thumbnailId: optionalRef,
          isActive: z.boolean().default(true),
        })
      )
      .max(30)
      .default([]),
    relatedProjectIds: z.array(ref).max(12).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.priceFrom != null && !v.currency) {
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Choose the currency for the price" });
    }
    const totalPct = v.paymentPlan.reduce((sum, step) => sum + (Number(step.percentage) || 0), 0);
    if (v.paymentPlan.length && totalPct > 100.0001) {
      ctx.addIssue({ code: "custom", path: ["paymentPlan"], message: `Payment plan percentages add up to ${totalPct}% (more than 100%)` });
    }
    v.floorPlans.forEach((fp, i) => {
      if (!fp.imageId && !fp.documentId) {
        ctx.addIssue({ code: "custom", path: ["floorPlans", i, "imageId"], message: "Add an image or a PDF for this floor plan" });
      }
    });
  });
export type ProjectInput = z.infer<typeof projectInputSchema>;

// ── Project updates ──
export const projectUpdateInputSchema = z.object({
  projectId: ref,
  title: requiredStr("Title", 160),
  slug,
  date: z.coerce.date({ error: "The update date is required" }),
  summary: str(500),
  body: z.string().max(50_000).default(""),
  progressPercent: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int().min(0, "Progress must be 0–100").max(100, "Progress must be 0–100").nullable()
  ),
  milestone: str(120),
  youtubeId: youtube,
  images: z.array(z.object({ mediaId: ref, caption: str(200) })).max(40).default([]),
});
export type ProjectUpdateInput = z.infer<typeof projectUpdateInputSchema>;

// ── Locations ──
export const LOCATION_LANDMARK_FIELDS: FieldDef[] = [
  { type: "text", name: "name", label: "Landmark", required: true, maxLength: 100 },
  { type: "text", name: "distance", label: "Distance / travel time", maxLength: 60 },
];
export const locationInputSchema = z.object({
  name: requiredStr("Name", 120),
  slug,
  market: z.enum(MARKETS),
  city: requiredStr("City", 80),
  summary: str(400),
  overview: z.string().max(50_000).default(""),
  heroImageId: optionalRef,
  latitude: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(-90).max(90).nullable()),
  longitude: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(-180).max(180).nullable()),
  landmarks: list(LOCATION_LANDMARK_FIELDS, 30),
  ...seoFields,
});
export type LocationInput = z.infer<typeof locationInputSchema>;

// ── Articles (news, press, events, insights) ──
export const articleInputSchema = z.object({
  title: requiredStr("Title", 200),
  slug,
  category: z.enum(ARTICLE_CATEGORIES),
  excerpt: str(400),
  body: z.string().max(100_000).default(""),
  coverImageId: optionalRef,
  youtubeId: youtube,
  eventDate: optionalDate,
  eventLocation: str(200),
  publishedAt: optionalDate,
  ...seoFields,
});
export type ArticleInput = z.infer<typeof articleInputSchema>;

// ── Vacancies ──
export const vacancyInputSchema = z.object({
  title: requiredStr("Title", 160),
  slug,
  department: str(80),
  location: str(120),
  employmentType: str(40),
  summary: str(400),
  description: z.string().max(50_000).default(""),
  closesAt: optionalDate,
});
export type VacancyInput = z.infer<typeof vacancyInputSchema>;

// ── FAQs ──
export const faqInputSchema = z.object({
  question: requiredStr("Question", 300),
  answer: requiredStr("Answer", 5000),
  category: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .default("general"),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  isPublished: z.boolean().default(true),
});
export type FaqInput = z.infer<typeof faqInputSchema>;

// ── Menus ──
const menuLink = z
  .string()
  .trim()
  .min(1, "Link is required")
  .max(500)
  .refine(isSafeHref, "Use a path such as /projects or a full https:// URL");
export const menuItemSchema = z.object({
  label: requiredStr("Label", 60),
  href: menuLink,
  openInNewTab: z.boolean().default(false),
  children: z
    .array(z.object({ label: requiredStr("Label", 60), href: menuLink, openInNewTab: z.boolean().default(false) }))
    .max(20)
    .default([]),
});
export const menuInputSchema = z.object({ items: z.array(menuItemSchema).max(20) });
export type MenuInput = z.infer<typeof menuInputSchema>;

// ── Redirects ──
const path = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^\/[^\s]*$/, "Must start with / and contain no spaces");
export const redirectInputSchema = z
  .object({
    fromPath: path,
    toPath: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine((v) => isSafeHref(v) && !v.startsWith("#"), "Destination must be a path or https URL"),
    permanent: z.boolean().default(true),
    note: str(200),
  })
  .refine((v) => normalizePath(v.fromPath) !== normalizePath(v.toPath), {
    path: ["toPath"],
    message: "Destination cannot be the same as the source",
  })
  .refine((v) => !/^\/(admin|api|_next|uploads)(\/|$)/.test(v.fromPath), {
    path: ["fromPath"],
    message: "System paths cannot be redirected",
  });
export type RedirectInput = z.infer<typeof redirectInputSchema>;

export function normalizePath(p: string): string {
  let out = p.trim();
  try {
    if (/^https?:\/\//.test(out)) out = new URL(out).pathname;
  } catch {
    /* keep as-is */
  }
  out = out.split("?")[0].split("#")[0].toLowerCase();
  if (out.length > 1) out = out.replace(/\/+$/, "");
  return out || "/";
}
