import { describe, expect, it } from "vitest";
import { validateSections, newSection } from "@/lib/sections/registry";
import { sanitizeRichText } from "@/lib/sanitize";
import { contrastRatio, contrastWarnings, DEFAULT_THEME, resolveTheme, themeSchema, themeToCss } from "@/lib/theme";
import { leadInputSchema } from "@/lib/validation/leads";
import { articleInputSchema, normalizePath, projectInputSchema, redirectInputSchema } from "@/lib/validation/content";
import { toDateTimeInput } from "@/lib/admin-fields";
import { resolveSettings } from "@/lib/settings";

describe("page builder sections", () => {
  it("accepts valid blocks and applies defaults", () => {
    const hero = newSection("hero");
    hero.data.heading = "Inspiring Lifestyles";
    const res = validateSections([hero]);
    expect(res.success).toBe(true);
    if (res.success) expect(res.sections[0].data.height).toBe("large");
  });
  it("reports missing required fields with a block-scoped key", () => {
    const res = validateSections([newSection("hero")]);
    expect(res.success).toBe(false);
    if (!res.success) expect(Object.keys(res.errors)).toContain("sections.0.heading");
  });
  it("rejects unknown block types and unsafe links", () => {
    const bad = { id: "abc", type: "script", hidden: false, data: {} };
    const cta = { ...newSection("cta"), data: { heading: "Go", ctaLabel: "Go", ctaHref: "javascript:alert(1)" } };
    const res = validateSections([bad, cta]);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors["sections.0"]).toBeDefined();
      expect(res.errors["sections.1.ctaHref"]).toBeDefined();
    }
  });
  it("sanitises rich text inside nested repeaters", () => {
    const faq = { ...newSection("faq"), data: { items: [{ question: "Q?", answer: "<p>A</p><script>x</script>" }] } };
    const res = validateSections([faq], sanitizeRichText);
    expect(res.success).toBe(true);
    if (res.success) expect(JSON.stringify(res.sections)).not.toContain("<script>");
  });
  it("normalises YouTube links to ids", () => {
    const v = { ...newSection("video"), data: { youtubeId: "https://youtu.be/dQw4w9WgXcQ" } };
    const res = validateSections([v]);
    expect(res.success && res.sections[0].data.youtubeId).toBe("dQw4w9WgXcQ");
  });
});

describe("theme tokens", () => {
  it("rejects invalid colour values", () => {
    const bad = structuredClone(DEFAULT_THEME) as unknown as { colors: Record<string, string> };
    bad.colors.primary = "red; background:url(x)";
    expect(themeSchema.safeParse(bad).success).toBe(false);
  });
  it("falls back to defaults for missing or broken stored themes", () => {
    expect(resolveTheme(null)).toEqual(DEFAULT_THEME);
    expect(resolveTheme({ colors: { primary: "#000000" } }).colors.primary).toBe("#000000");
    expect(resolveTheme({ colors: { primary: "not-a-colour" } })).toEqual(DEFAULT_THEME);
  });
  it("renders CSS custom properties", () => {
    const css = themeToCss(DEFAULT_THEME);
    expect(css).toContain("--primary:#1F3C59;");
    expect(css).toContain("--font-heading:var(--font-cormorant)");
  });
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastWarnings(DEFAULT_THEME)).toEqual([]);
    const low = { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, foreground: "#EEEEEE" } };
    expect(contrastWarnings(low).map((w) => w.fg)).toContain("foreground");
  });
});

describe("lead validation", () => {
  const valid = { formType: "PROJECT_ENQUIRY", name: "Sara Khan", email: "SARA@example.com ", phone: "+92 300 1234567", consent: true, attribution: {} };
  it("normalises email and phone", () => {
    const r = leadInputSchema.parse(valid);
    expect(r.email).toBe("sara@example.com");
    expect(r.phone).toBe("+923001234567");
  });
  it("requires consent and a valid phone", () => {
    expect(leadInputSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
  });
  it("flags honeypot content", () => {
    expect(leadInputSchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });
});

describe("content validation", () => {
  it("normalises redirect paths and blocks loops to self or system paths", () => {
    expect(normalizePath("https://premierchoiceint.com/About-Us/?x=1")).toBe("/about-us");
    expect(redirectInputSchema.safeParse({ fromPath: "/a", toPath: "/a/" }).success).toBe(false);
    expect(redirectInputSchema.safeParse({ fromPath: "/admin/x", toPath: "/" }).success).toBe(false);
    expect(redirectInputSchema.safeParse({ fromPath: "/old", toPath: "/projects" }).success).toBe(true);
  });
  const baseProject = { name: "P", slug: "p", category: "RESIDENTIAL", constructionStatus: "ONGOING", market: "PAKISTAN", city: "Islamabad" };
  it("rejects payment plans above 100% and prices without currency", () => {
    const plan = projectInputSchema.safeParse({ ...baseProject, paymentPlan: [{ milestone: "Down", percentage: 70 }, { milestone: "Handover", percentage: 40 }] });
    expect(plan.success).toBe(false);
    expect(projectInputSchema.safeParse({ ...baseProject, priceFrom: 1000000 }).success).toBe(false);
    expect(projectInputSchema.safeParse({ ...baseProject, priceFrom: 1000000, currency: "PKR" }).success).toBe(true);
  });
  it("reads CMS date-times as UTC so re-saving never shifts them", () => {
    const parsed = articleInputSchema.parse({ title: "T", slug: "t", category: "NEWS", publishedAt: "2026-12-01 10:00" });
    expect(parsed.publishedAt?.toISOString()).toBe("2026-12-01T10:00:00.000Z");
    expect(toDateTimeInput(parsed.publishedAt)).toBe("2026-12-01 10:00");
  });
  it("requires https VR embeds", () => {
    expect(projectInputSchema.safeParse({ ...baseProject, vrTours: [{ title: "T", embedUrl: "http://vr.example.com/x" }] }).success).toBe(false);
  });
});

describe("settings", () => {
  it("merges stored settings with defaults", () => {
    const s = resolveSettings({ contact: { phone: "+92 1" } });
    expect(s.contact.phone).toBe("+92 1");
    expect(s.payment.buttonLabel).toBe("Pay My Installment");
  });
});
