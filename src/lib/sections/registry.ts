import { z } from "zod";
import { collectMediaIds, defaultValues, fieldsToSchema, mapRichText, type FieldDef } from "@/lib/fields";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABELS, LEAD_FORM_TYPE_LABELS, PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS } from "@/lib/content-labels";

// Page-builder block catalogue. Each block is a predefined, brand-locked
// component; editors configure content only — never markup or code.

export interface SectionDefinition {
  type: string;
  label: string;
  description: string;
  group: "Layout" | "Content" | "Media" | "Real estate" | "Conversion";
  fields: FieldDef[];
}

const backgroundField: FieldDef = {
  type: "select",
  name: "background",
  label: "Background",
  options: [
    { value: "default", label: "Page background" },
    { value: "muted", label: "Soft tint" },
    { value: "dark", label: "Dark (brand)" },
  ],
  defaultValue: "default",
};

const headingFields: FieldDef[] = [
  { type: "text", name: "eyebrow", label: "Eyebrow label", maxLength: 80, help: "Small uppercase label above the heading." },
  { type: "text", name: "heading", label: "Heading", maxLength: 160 },
  { type: "textarea", name: "intro", label: "Intro text", maxLength: 600, rows: 3 },
];

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    type: "hero",
    label: "Hero banner",
    description: "Full-width image banner with headline and call-to-action buttons.",
    group: "Layout",
    fields: [
      { type: "text", name: "eyebrow", label: "Eyebrow label", maxLength: 80 },
      { type: "text", name: "heading", label: "Headline", required: true, maxLength: 160 },
      { type: "textarea", name: "subheading", label: "Supporting text", maxLength: 400, rows: 3 },
      { type: "images", name: "images", label: "Background image(s)", help: "Several images rotate as a slideshow.", max: 6 },
      { type: "youtube", name: "youtubeId", label: "Background video (YouTube, optional)", help: "Plays muted on larger screens; images are used as the poster and on mobile." },
      { type: "text", name: "ctaLabel", label: "Primary button label", maxLength: 40 },
      { type: "link", name: "ctaHref", label: "Primary button link" },
      { type: "text", name: "secondaryCtaLabel", label: "Secondary button label", maxLength: 40 },
      { type: "link", name: "secondaryCtaHref", label: "Secondary button link" },
      {
        type: "select",
        name: "height",
        label: "Height",
        options: [
          { value: "full", label: "Full screen" },
          { value: "large", label: "Large" },
          { value: "medium", label: "Medium" },
        ],
        defaultValue: "large",
      },
      { type: "boolean", name: "showFinder", label: "Show 'Find my property' assistant button", defaultValue: false },
    ],
  },
  {
    type: "richText",
    label: "Text",
    description: "Formatted text with headings, lists and links.",
    group: "Content",
    fields: [
      ...headingFields,
      { type: "richtext", name: "body", label: "Body" },
      {
        type: "select",
        name: "width",
        label: "Width",
        options: [
          { value: "narrow", label: "Narrow (reading)" },
          { value: "wide", label: "Wide" },
        ],
        defaultValue: "narrow",
      },
      backgroundField,
    ],
  },
  {
    type: "imageText",
    label: "Image and text",
    description: "Image beside a block of text with an optional button.",
    group: "Content",
    fields: [
      { type: "text", name: "eyebrow", label: "Eyebrow label", maxLength: 80 },
      { type: "text", name: "heading", label: "Heading", maxLength: 160 },
      { type: "richtext", name: "body", label: "Body" },
      { type: "image", name: "image", label: "Image" },
      {
        type: "select",
        name: "imagePosition",
        label: "Image position",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
        defaultValue: "right",
      },
      { type: "text", name: "ctaLabel", label: "Button label", maxLength: 40 },
      { type: "link", name: "ctaHref", label: "Button link" },
      backgroundField,
    ],
  },
  {
    type: "stats",
    label: "Statistics",
    description: "Key figures. Only enter verified numbers that have an owner.",
    group: "Content",
    fields: [
      ...headingFields,
      {
        type: "repeater",
        name: "items",
        label: "Figures",
        itemLabel: "Figure",
        max: 8,
        fields: [
          { type: "text", name: "value", label: "Value", required: true, maxLength: 20, help: "e.g. 25 or 4.5" },
          { type: "text", name: "suffix", label: "Suffix", maxLength: 20, help: "e.g. + or M sq ft" },
          { type: "text", name: "label", label: "Label", required: true, maxLength: 80 },
        ],
      },
      backgroundField,
    ],
  },
  {
    type: "featureGrid",
    label: "Feature grid",
    description: "Grid of short feature or service descriptions.",
    group: "Content",
    fields: [
      ...headingFields,
      {
        type: "select",
        name: "columns",
        label: "Columns",
        options: [
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ],
        defaultValue: "3",
      },
      {
        type: "repeater",
        name: "items",
        label: "Features",
        itemLabel: "Feature",
        max: 12,
        fields: [
          { type: "text", name: "title", label: "Title", required: true, maxLength: 100 },
          { type: "textarea", name: "description", label: "Description", maxLength: 400, rows: 3 },
          { type: "image", name: "image", label: "Image (optional)" },
          { type: "link", name: "href", label: "Link (optional)" },
        ],
      },
      backgroundField,
    ],
  },
  {
    type: "gallery",
    label: "Image gallery",
    description: "Grid of images that open in a full-screen viewer.",
    group: "Media",
    fields: [...headingFields, { type: "images", name: "images", label: "Images", required: true, max: 40 }, backgroundField],
  },
  {
    type: "video",
    label: "Video",
    description: "A YouTube video, loaded only when the visitor presses play.",
    group: "Media",
    fields: [
      ...headingFields,
      { type: "youtube", name: "youtubeId", label: "YouTube link", required: true },
      { type: "image", name: "poster", label: "Poster image (optional)" },
      backgroundField,
    ],
  },
  {
    type: "cta",
    label: "Call to action",
    description: "A prominent banner with a heading and button.",
    group: "Conversion",
    fields: [
      { type: "text", name: "heading", label: "Heading", required: true, maxLength: 160 },
      { type: "textarea", name: "text", label: "Text", maxLength: 400, rows: 3 },
      { type: "text", name: "ctaLabel", label: "Button label", required: true, maxLength: 40 },
      { type: "link", name: "ctaHref", label: "Button link", required: true },
      { type: "image", name: "image", label: "Background image (optional)" },
    ],
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Quotes from customers or partners (approved quotes only).",
    group: "Content",
    fields: [
      ...headingFields,
      {
        type: "repeater",
        name: "items",
        label: "Testimonials",
        itemLabel: "Testimonial",
        max: 12,
        fields: [
          { type: "textarea", name: "quote", label: "Quote", required: true, maxLength: 600 },
          { type: "text", name: "name", label: "Name", required: true, maxLength: 80 },
          { type: "text", name: "role", label: "Role / project", maxLength: 120 },
        ],
      },
      backgroundField,
    ],
  },
  {
    type: "faq",
    label: "FAQs",
    description: "Questions and answers from the FAQ library and/or entered here.",
    group: "Content",
    fields: [
      ...headingFields,
      { type: "text", name: "libraryCategory", label: "FAQ library category", maxLength: 40, help: "Shows published FAQs from this category (e.g. general, investment, payments). Leave blank to use only the items below." },
      {
        type: "repeater",
        name: "items",
        label: "Additional questions",
        itemLabel: "Question",
        max: 40,
        fields: [
          { type: "text", name: "question", label: "Question", required: true, maxLength: 200 },
          { type: "richtext", name: "answer", label: "Answer", required: true },
        ],
      },
      backgroundField,
    ],
  },
  {
    type: "team",
    label: "Leadership / team",
    description: "Profiles of leadership or team members.",
    group: "Content",
    fields: [
      ...headingFields,
      {
        type: "repeater",
        name: "members",
        label: "Members",
        itemLabel: "Member",
        max: 24,
        fields: [
          { type: "text", name: "name", label: "Name", required: true, maxLength: 80 },
          { type: "text", name: "role", label: "Role", maxLength: 120 },
          { type: "textarea", name: "bio", label: "Short bio", maxLength: 800 },
          { type: "image", name: "photo", label: "Photo" },
        ],
      },
      backgroundField,
    ],
  },
  {
    type: "timeline",
    label: "Journey / timeline",
    description: "Milestones in chronological order.",
    group: "Content",
    fields: [
      ...headingFields,
      {
        type: "repeater",
        name: "items",
        label: "Milestones",
        itemLabel: "Milestone",
        max: 40,
        fields: [
          { type: "text", name: "year", label: "Year / date", required: true, maxLength: 20 },
          { type: "text", name: "title", label: "Title", required: true, maxLength: 120 },
          { type: "textarea", name: "description", label: "Description", maxLength: 500 },
        ],
      },
      backgroundField,
    ],
  },
  {
    type: "logos",
    label: "Partners / logos",
    description: "Partner, collaborator or certification logos.",
    group: "Content",
    fields: [
      ...headingFields,
      {
        type: "repeater",
        name: "items",
        label: "Logos",
        itemLabel: "Logo",
        max: 30,
        fields: [
          { type: "text", name: "name", label: "Name", required: true, maxLength: 80 },
          { type: "image", name: "logo", label: "Logo", required: true },
          { type: "link", name: "href", label: "Link (optional)" },
        ],
      },
      backgroundField,
    ],
  },
  {
    type: "featuredProjects",
    label: "Projects showcase",
    description: "Project cards — featured, latest or hand-picked.",
    group: "Real estate",
    fields: [
      ...headingFields,
      {
        type: "select",
        name: "mode",
        label: "Which projects",
        options: [
          { value: "featured", label: "Featured projects" },
          { value: "latest", label: "Latest projects" },
          { value: "manual", label: "Hand-picked" },
          { value: "category", label: "By category" },
        ],
        defaultValue: "featured",
      },
      {
        type: "select",
        name: "category",
        label: "Category (when 'By category')",
        options: PROJECT_CATEGORIES.map((c) => ({ value: c, label: PROJECT_CATEGORY_LABELS[c] })),
      },
      { type: "projects", name: "projectIds", label: "Hand-picked projects", max: 12 },
      { type: "number", name: "limit", label: "Maximum number", min: 1, max: 12 },
      { type: "boolean", name: "showAllLink", label: "Show 'View all projects' link", defaultValue: true },
      backgroundField,
    ],
  },
  {
    type: "projectCategories",
    label: "Project categories",
    description: "Quick routes into project categories.",
    group: "Real estate",
    fields: [
      ...headingFields,
      {
        type: "repeater",
        name: "items",
        label: "Categories",
        itemLabel: "Category",
        max: 6,
        fields: [
          { type: "select", name: "category", label: "Category", options: PROJECT_CATEGORIES.map((c) => ({ value: c, label: PROJECT_CATEGORY_LABELS[c] })) },
          { type: "text", name: "label", label: "Label override", maxLength: 60 },
          { type: "image", name: "image", label: "Image" },
        ],
      },
      backgroundField,
    ],
  },
  {
    type: "latestUpdates",
    label: "Latest construction updates",
    description: "The most recent published project updates.",
    group: "Real estate",
    fields: [...headingFields, { type: "number", name: "limit", label: "Number of updates", min: 1, max: 12 }, backgroundField],
  },
  {
    type: "vrShowcase",
    label: "VR / 360° tours",
    description: "Active virtual tours. Hidden automatically when none exist.",
    group: "Real estate",
    fields: [...headingFields, { type: "number", name: "limit", label: "Number of tours", min: 1, max: 12 }, backgroundField],
  },
  {
    type: "locationsGrid",
    label: "Locations",
    description: "Published locations / developments.",
    group: "Real estate",
    fields: [...headingFields, backgroundField],
  },
  {
    type: "latestArticles",
    label: "Latest news & media",
    description: "Recent articles, press releases or events.",
    group: "Content",
    fields: [
      ...headingFields,
      {
        type: "select",
        name: "category",
        label: "Category",
        options: [{ value: "ALL", label: "All categories" }, ...ARTICLE_CATEGORIES.map((c) => ({ value: c, label: ARTICLE_CATEGORY_LABELS[c] }))],
        defaultValue: "ALL",
      },
      { type: "number", name: "limit", label: "Number of articles", min: 1, max: 12 },
      backgroundField,
    ],
  },
  {
    type: "vacancies",
    label: "Open vacancies",
    description: "List of published job vacancies.",
    group: "Content",
    fields: [...headingFields, backgroundField],
  },
  {
    type: "enquiry",
    label: "Enquiry form",
    description: "Lead form delivered to Bitrix24 with project and campaign context.",
    group: "Conversion",
    fields: [
      ...headingFields,
      {
        type: "select",
        name: "formType",
        label: "Form type",
        options: (["CONTACT", "PROJECT_ENQUIRY", "INVESTOR", "CHANNEL_PARTNER"] as const).map((t) => ({ value: t, label: LEAD_FORM_TYPE_LABELS[t] })),
        defaultValue: "CONTACT",
      },
      { type: "project", name: "projectId", label: "Project (optional)" },
      { type: "boolean", name: "showOffices", label: "Show office details beside the form", defaultValue: false },
      backgroundField,
    ],
  },
  {
    type: "paymentCta",
    label: "Pay My Installment",
    description: "Prominent entry point to the secure installment payment journey.",
    group: "Conversion",
    fields: [
      { type: "text", name: "heading", label: "Heading", required: true, maxLength: 160 },
      { type: "textarea", name: "text", label: "Text", maxLength: 400 },
    ],
  },
];

export const SECTION_MAP: Record<string, SectionDefinition> = Object.fromEntries(
  SECTION_DEFINITIONS.map((d) => [d.type, d])
);

export type SectionData = Record<string, unknown>;
export interface Section {
  id: string;
  type: string;
  hidden: boolean;
  data: SectionData;
}

const sectionEnvelope = z.object({
  id: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  type: z.string(),
  hidden: z.boolean().default(false),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type SectionValidationResult =
  | { success: true; sections: Section[] }
  | { success: false; errors: Record<string, string[]> };

/**
 * Validates a list of sections against the registry. Error keys are
 * "sections.<index>.<field path>" so the editor can highlight the block.
 */
export function validateSections(input: unknown, sanitize?: (html: string) => string): SectionValidationResult {
  const list = z.array(sectionEnvelope).max(60).safeParse(input);
  if (!list.success) return { success: false, errors: { sections: ["The page sections are malformed."] } };

  const errors: Record<string, string[]> = {};
  const out: Section[] = [];
  const ids = new Set<string>();
  list.data.forEach((section, index) => {
    const def = SECTION_MAP[section.type];
    if (!def) {
      errors[`sections.${index}`] = [`Unknown block type "${section.type}".`];
      return;
    }
    if (ids.has(section.id)) {
      errors[`sections.${index}`] = ["Duplicate block id."];
      return;
    }
    ids.add(section.id);
    const parsed = fieldsToSchema(def.fields).safeParse(section.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = `sections.${index}.${issue.path.join(".")}`;
        (errors[key] ??= []).push(issue.message);
      }
      return;
    }
    const data = sanitize ? mapRichText(def.fields, parsed.data, sanitize) : parsed.data;
    out.push({ id: section.id, type: section.type, hidden: section.hidden, data });
  });

  if (Object.keys(errors).length) return { success: false, errors };
  return { success: true, sections: out };
}

export function newSection(type: string): Section {
  const def = SECTION_MAP[type];
  if (!def) throw new Error(`Unknown section type ${type}`);
  return { id: randomId(), type, hidden: false, data: defaultValues(def.fields) };
}

export function sectionMediaIds(sections: Section[]): string[] {
  const ids = new Set<string>();
  for (const s of sections) {
    const def = SECTION_MAP[s.type];
    if (def) collectMediaIds(def.fields, s.data, ids);
  }
  return [...ids];
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}
