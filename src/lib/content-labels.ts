// Human-readable labels for enum values used across the site and CMS.
// Kept as plain string unions so this module can be imported by client code
// without pulling in the Prisma client.

export const PROJECT_CATEGORIES = ["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "CO_LIVING", "RETAIL", "HOSPITALITY"] as const;
export type ProjectCategoryValue = (typeof PROJECT_CATEGORIES)[number];
export const PROJECT_CATEGORY_LABELS: Record<ProjectCategoryValue, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  MIXED_USE: "Mixed Use",
  CO_LIVING: "Co-Living",
  RETAIL: "Retail & Malls",
  HOSPITALITY: "Hospitality",
};
/** URL-friendly keys for category browsing (e.g. /projects?category=co-living). */
export const PROJECT_CATEGORY_SLUGS: Record<ProjectCategoryValue, string> = {
  RESIDENTIAL: "residential",
  COMMERCIAL: "commercial",
  MIXED_USE: "mixed-use",
  CO_LIVING: "co-living",
  RETAIL: "retail",
  HOSPITALITY: "hospitality",
};

export const CONSTRUCTION_STATUSES = ["UPCOMING", "ONGOING", "COMPLETED"] as const;
export type ConstructionStatusValue = (typeof CONSTRUCTION_STATUSES)[number];
export const CONSTRUCTION_STATUS_LABELS: Record<ConstructionStatusValue, string> = {
  UPCOMING: "Upcoming",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
};
export const CONSTRUCTION_STATUS_SLUGS: Record<ConstructionStatusValue, string> = {
  UPCOMING: "upcoming",
  ONGOING: "ongoing",
  COMPLETED: "completed",
};

export const MARKETS = ["UAE", "PAKISTAN", "CANADA", "USA"] as const;
export type MarketValue = (typeof MARKETS)[number];
export const MARKET_LABELS: Record<MarketValue, string> = {
  UAE: "United Arab Emirates",
  PAKISTAN: "Pakistan",
  CANADA: "Canada",
  USA: "United States",
};

export const CURRENCIES = ["AED", "PKR", "USD", "CAD"] as const;
export type CurrencyValue = (typeof CURRENCIES)[number];

export const PUBLISH_STATUSES = ["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export type PublishStatusValue = (typeof PUBLISH_STATUSES)[number];
export const PUBLISH_STATUS_LABELS: Record<PublishStatusValue, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  PUBLISHED: "Published",
  ARCHIVED: "Unpublished",
};

export const APPROVAL_STATUSES = ["NOT_SUBMITTED", "PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalStatusValue = (typeof APPROVAL_STATUSES)[number];
export const APPROVAL_STATUS_LABELS: Record<ApprovalStatusValue, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Awaiting approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const ARTICLE_CATEGORIES = ["NEWS", "PRESS_RELEASE", "EVENT", "BLOG"] as const;
export type ArticleCategoryValue = (typeof ARTICLE_CATEGORIES)[number];
export const ARTICLE_CATEGORY_LABELS: Record<ArticleCategoryValue, string> = {
  NEWS: "News",
  PRESS_RELEASE: "Press Release",
  EVENT: "Event",
  BLOG: "Insights",
};
export const ARTICLE_CATEGORY_SLUGS: Record<ArticleCategoryValue, string> = {
  NEWS: "news",
  PRESS_RELEASE: "press-releases",
  EVENT: "events",
  BLOG: "insights",
};

export const DOCUMENT_KINDS = ["BROCHURE", "FACT_SHEET", "PAYMENT_PLAN", "OTHER"] as const;
export type DocumentKindValue = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABELS: Record<DocumentKindValue, string> = {
  BROCHURE: "Brochure",
  FACT_SHEET: "Fact sheet",
  PAYMENT_PLAN: "Payment plan",
  OTHER: "Document",
};

export const LEAD_FORM_TYPES = [
  "CONTACT",
  "PROJECT_ENQUIRY",
  "BROCHURE_REQUEST",
  "CHANNEL_PARTNER",
  "INVESTOR",
  "PAYMENT_REQUEST",
  "CHATBOT",
] as const;
export type LeadFormTypeValue = (typeof LEAD_FORM_TYPES)[number];
export const LEAD_FORM_TYPE_LABELS: Record<LeadFormTypeValue, string> = {
  CONTACT: "General enquiry",
  PROJECT_ENQUIRY: "Project enquiry",
  BROCHURE_REQUEST: "Brochure / document request",
  CHANNEL_PARTNER: "Channel partner registration",
  INVESTOR: "Investor enquiry",
  PAYMENT_REQUEST: "Installment payment request",
  CHATBOT: "Project finder (chatbot)",
};

export const CRM_STATUS_LABELS = {
  PENDING: "Pending",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  NOT_CONFIGURED: "CRM not configured",
} as const;
