// Small, dependency-free text helpers shared by server and client code.

/** Converts a title into a URL slug: lowercase ASCII words separated by hyphens. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Nested page slugs such as "about/leadership". */
export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/** Paths owned by application routes; CMS pages may not shadow them. */
export const RESERVED_PAGE_SLUGS = [
  "admin",
  "api",
  "uploads",
  "projects",
  "project-updates",
  "locations",
  "vr-tours",
  "media",
  "careers",
  "pay-my-installment",
  "thank-you",
  "page-not-found",
  "sitemap.xml",
  "robots.txt",
  "_next",
];

export function isReservedPageSlug(slug: string): boolean {
  const first = slug.split("/")[0];
  return RESERVED_PAGE_SLUGS.includes(first);
}

/**
 * Extracts an 11-character YouTube video id from a URL or bare id.
 * Returns "" when the input is not a recognisable YouTube reference.
 */
export function parseYoutubeId(input: string | null | undefined): string {
  if (!input) return "";
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return validId(url.pathname.slice(1));
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") return validId(url.searchParams.get("v") ?? "");
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      if (m) return validId(m[1]);
    }
  } catch {
    // not a URL
  }
  return "";
}

function validId(id: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
}

/** Normalises a phone number to "+<digits>" form. Returns "" if implausible. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return "";
  return hasPlus ? `+${digits}` : digits;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Strips HTML tags for plain-text contexts (meta descriptions, search). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

export function formatDate(date: Date | string | null | undefined, style: "long" | "month" | "short" = "long"): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const options: Intl.DateTimeFormatOptions =
    style === "month"
      ? { month: "long", year: "numeric", timeZone: "UTC" }
      : style === "short"
        ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
        : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-GB", options).format(d);
}

/** Validates internal ("/path") or absolute http(s) links; rejects javascript: etc. */
export function isSafeHref(href: string): boolean {
  if (!href) return false;
  // Browsers treat "\" as "/" and drop tabs/newlines, so "/\evil.example" would leave the site.
  if (/[\\\u0000-\u001f\u007f]/.test(href)) return false;
  if (href.startsWith("/")) return new URL(href, "https://internal.invalid").origin === "https://internal.invalid";
  if (href.startsWith("#")) return true;
  if (/^(mailto|tel):/i.test(href)) return true;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
