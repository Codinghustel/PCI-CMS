import { z } from "zod";
import { defaultValues, fieldsToSchema, type FieldDef } from "@/lib/fields";

// Global site settings (header/footer contact details, offices, social links,
// analytics IDs, payment entry page, chatbot, data-quality thresholds).
// Grouped so the CMS shows them as tabs; each group is validated by the same
// field definitions that render its form.

export const SETTINGS_GROUPS = [
  {
    key: "general",
    label: "General",
    fields: [
      { type: "text", name: "siteName", label: "Site name", required: true, maxLength: 80 },
      { type: "text", name: "tagline", label: "Tagline", maxLength: 160 },
      { type: "image", name: "logo", label: "Logo (for light backgrounds)" },
      { type: "image", name: "logoLight", label: "Logo (for dark backgrounds)" },
      { type: "textarea", name: "footerAbout", label: "Footer introduction", maxLength: 500 },
      { type: "text", name: "copyright", label: "Copyright line", maxLength: 160 },
    ],
  },
  {
    key: "contact",
    label: "Contact & offices",
    fields: [
      { type: "text", name: "phone", label: "Main phone number", maxLength: 30, help: "Used by Call buttons, e.g. +92 51 8738545" },
      { type: "text", name: "whatsapp", label: "WhatsApp number", maxLength: 30, help: "International format, e.g. +923011233333. Should be the Bitrix24-connected number." },
      { type: "text", name: "whatsappMessage", label: "WhatsApp pre-filled message", maxLength: 200 },
      { type: "text", name: "email", label: "General email", maxLength: 120 },
      {
        type: "repeater",
        name: "offices",
        label: "Offices",
        itemLabel: "Office",
        max: 10,
        fields: [
          { type: "text", name: "name", label: "Office name", required: true, maxLength: 80 },
          { type: "textarea", name: "address", label: "Address", maxLength: 300, rows: 3 },
          { type: "text", name: "phone", label: "Phone", maxLength: 30 },
          { type: "text", name: "email", label: "Email", maxLength: 120 },
          { type: "text", name: "hours", label: "Opening hours", maxLength: 120 },
          { type: "text", name: "mapQuery", label: "Map search text or coordinates", maxLength: 200, help: "e.g. 'Onyx Tower 1, The Greens, Dubai' or '33.5170,73.1060'" },
        ],
      },
    ],
  },
  {
    key: "social",
    label: "Social links",
    fields: [
      { type: "link", name: "facebook", label: "Facebook URL" },
      { type: "link", name: "instagram", label: "Instagram URL" },
      { type: "link", name: "linkedin", label: "LinkedIn URL" },
      { type: "link", name: "youtube", label: "YouTube URL" },
      { type: "link", name: "x", label: "X / Twitter URL" },
      { type: "link", name: "tiktok", label: "TikTok URL" },
    ],
  },
  {
    key: "seo",
    label: "SEO defaults",
    fields: [
      { type: "text", name: "defaultTitle", label: "Default page title", maxLength: 70 },
      { type: "text", name: "titleSuffix", label: "Title suffix", maxLength: 40, help: "Appended to page titles, e.g. '| Premier Choice International'" },
      { type: "textarea", name: "defaultDescription", label: "Default meta description", maxLength: 300 },
      { type: "image", name: "defaultOgImage", label: "Default social sharing image" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics & consent",
    fields: [
      { type: "text", name: "gtmId", label: "Google Tag Manager container ID", maxLength: 20, help: "e.g. GTM-XXXXXXX. GA4 and Meta Pixel are configured inside GTM and only fire after consent." },
      { type: "textarea", name: "cookieBannerText", label: "Cookie banner text", maxLength: 400 },
    ],
  },
  {
    key: "forms",
    label: "Forms & CRM",
    fields: [
      { type: "textarea", name: "consentText", label: "Consent statement shown on forms", required: true, maxLength: 500 },
      { type: "textarea", name: "successMessage", label: "Form success message", maxLength: 300 },
    ],
  },
  {
    key: "payment",
    label: "Pay My Installment",
    fields: [
      { type: "boolean", name: "enabled", label: "Show Pay My Installment buttons", defaultValue: true },
      { type: "text", name: "buttonLabel", label: "Button label", maxLength: 40 },
      { type: "text", name: "heading", label: "Entry page heading", maxLength: 120 },
      { type: "richtext", name: "intro", label: "Entry page introduction" },
      { type: "richtext", name: "securityNote", label: "Security note" },
    ],
  },
  {
    key: "chatbot",
    label: "Project finder",
    fields: [
      { type: "boolean", name: "enabled", label: "Enable the project finder assistant", defaultValue: true },
      { type: "text", name: "title", label: "Assistant title", maxLength: 60 },
      { type: "textarea", name: "greeting", label: "Greeting", maxLength: 300 },
      { type: "textarea", name: "disclaimer", label: "Disclaimer", maxLength: 400 },
    ],
  },
  {
    key: "quality",
    label: "Data quality",
    fields: [
      { type: "number", name: "commercialStaleDays", label: "Warn when approved commercial details are older than (days)", min: 7, max: 730 },
      { type: "number", name: "updateStaleDays", label: "Warn when a project's latest construction update is older than (days)", min: 7, max: 365 },
    ],
  },
] as const satisfies readonly { key: string; label: string; fields: FieldDef[] }[];

export type SettingsGroupKey = (typeof SETTINGS_GROUPS)[number]["key"];

export const settingsSchema = z.object(
  Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, fieldsToSchema(g.fields as unknown as FieldDef[])]))
);

export interface Office {
  name: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  mapQuery: string;
}

export interface SiteSettings {
  general: { siteName: string; tagline: string; logo: string | null; logoLight: string | null; footerAbout: string; copyright: string };
  contact: { phone: string; whatsapp: string; whatsappMessage: string; email: string; offices: Office[] };
  social: Record<"facebook" | "instagram" | "linkedin" | "youtube" | "x" | "tiktok", string>;
  seo: { defaultTitle: string; titleSuffix: string; defaultDescription: string; defaultOgImage: string | null };
  analytics: { gtmId: string; cookieBannerText: string };
  forms: { consentText: string; successMessage: string };
  payment: { enabled: boolean; buttonLabel: string; heading: string; intro: string; securityNote: string };
  chatbot: { enabled: boolean; title: string; greeting: string; disclaimer: string };
  quality: { commercialStaleDays: number | null; updateStaleDays: number | null };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  ...(Object.fromEntries(
    SETTINGS_GROUPS.map((g) => [g.key, defaultValues(g.fields as unknown as FieldDef[])])
  ) as unknown as SiteSettings),
};
DEFAULT_SETTINGS.general.siteName = "Premier Choice International";
DEFAULT_SETTINGS.forms.consentText =
  "I agree that PCI may contact me about my enquiry and process my details in line with the Privacy Policy.";
DEFAULT_SETTINGS.forms.successMessage = "Thank you — our team will be in touch shortly.";
DEFAULT_SETTINGS.payment.buttonLabel = "Pay My Installment";
DEFAULT_SETTINGS.payment.heading = "Pay My Installment";
DEFAULT_SETTINGS.chatbot.title = "Project Finder";
DEFAULT_SETTINGS.quality.commercialStaleDays = 90;
DEFAULT_SETTINGS.quality.updateStaleDays = 60;

/** Merges stored settings with defaults group by group. */
export function resolveSettings(stored: unknown): SiteSettings {
  const s = (stored ?? {}) as Record<string, Record<string, unknown>>;
  const out: Record<string, unknown> = {};
  for (const g of SETTINGS_GROUPS) {
    const merged = { ...(DEFAULT_SETTINGS as unknown as Record<string, Record<string, unknown>>)[g.key], ...(s[g.key] ?? {}) };
    const parsed = fieldsToSchema(g.fields as unknown as FieldDef[]).safeParse(merged);
    out[g.key] = parsed.success ? parsed.data : (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[g.key];
  }
  return out as unknown as SiteSettings;
}

export function whatsappLink(settings: SiteSettings, context?: string): string | null {
  const digits = settings.contact.whatsapp.replace(/\D/g, "");
  if (!digits) return null;
  const message = [settings.contact.whatsappMessage, context].filter(Boolean).join(" ");
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function telLink(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

export function mapEmbedUrl(query: string): string | null {
  if (!query.trim()) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(query.trim())}&output=embed`;
}
