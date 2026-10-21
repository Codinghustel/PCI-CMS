import { z } from "zod";
import { LEAD_FORM_TYPES } from "@/lib/content-labels";
import { normalizePhone } from "@/lib/text";

const optional = (max: number) => z.string().trim().max(max).optional().default("");

export const attributionSchema = z
  .object({
    utmSource: optional(200),
    utmMedium: optional(200),
    utmCampaign: optional(200),
    utmContent: optional(200),
    utmTerm: optional(200),
    gclid: optional(200),
    fbclid: optional(300),
    landingPage: optional(1000),
    referrer: optional(1000),
  })
  .default({
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    gclid: "",
    fbclid: "",
    landingPage: "",
    referrer: "",
  });

export const leadInputSchema = z.object({
  formType: z.enum(LEAD_FORM_TYPES),
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().toLowerCase().max(254).email("Please enter a valid email address"),
  phone: z
    .string()
    .trim()
    .max(40)
    .transform((v, ctx) => {
      const normalized = normalizePhone(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Please enter a valid phone number including country code" });
        return z.NEVER;
      }
      return normalized;
    }),
  country: optional(80),
  message: optional(3000),
  projectId: z.string().trim().max(64).regex(/^[a-z0-9]*$/i).optional().default(""),
  pageUrl: optional(1000),
  consent: z.literal(true, { error: "Please confirm your consent so we can contact you" }),
  attribution: attributionSchema,
  // Extra structured fields for specific forms (e.g. payment request, chatbot answers).
  extra: z.record(z.string().max(60), z.union([z.string().max(500), z.number(), z.boolean()])).optional().default({}),
  // Anti-spam signals.
  website: z.string().max(0, "Invalid submission").optional().default(""),
  startedAt: z.coerce.number().optional(),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

export const paymentRequestExtraSchema = z.object({
  bookingReference: z.string().trim().min(2, "Enter your booking or customer reference").max(60),
  project: z.string().trim().min(1, "Select your project").max(120),
  unitNumber: z.string().trim().min(1, "Enter your unit number as shown on your booking form or SPA").max(60),
  purpose: z.string().trim().max(200).optional().default("Installment payment"),
});
