import { z } from "zod";

// Database-backed design tokens for the public website. The tokens are
// rendered as CSS custom properties that shadcn/ui + Tailwind already consume
// (--primary, --background, …), so every component follows the theme without
// hard-coded colours.

const hex = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{6})$/, "Use a 6-digit hex colour such as #1F3C59")
  .transform((v) => v.toUpperCase());

export const FONT_OPTIONS = {
  inter: "Inter",
  manrope: "Manrope",
  poppins: "Poppins",
  montserrat: "Montserrat",
  cormorant: "Cormorant Garamond",
  playfair: "Playfair Display",
  marcellus: "Marcellus",
} as const;
export type FontKey = keyof typeof FONT_OPTIONS;
const fontKey = z.enum(Object.keys(FONT_OPTIONS) as [FontKey, ...FontKey[]]);

export const COLOR_TOKENS = [
  { key: "primary", label: "Primary", help: "Buttons, links and key accents." },
  { key: "primaryForeground", label: "Text on primary" },
  { key: "secondary", label: "Secondary", help: "Secondary buttons and soft surfaces." },
  { key: "secondaryForeground", label: "Text on secondary" },
  { key: "accent", label: "Accent", help: "Highlights, eyebrow labels and dividers." },
  { key: "accentForeground", label: "Text on accent" },
  { key: "background", label: "Page background" },
  { key: "foreground", label: "Body text" },
  { key: "card", label: "Card / surface" },
  { key: "cardForeground", label: "Text on cards" },
  { key: "muted", label: "Muted surface", help: "Tinted section backgrounds." },
  { key: "mutedForeground", label: "Muted text", help: "Captions and secondary text." },
  { key: "border", label: "Borders" },
  { key: "dark", label: "Dark sections", help: "Footer and dark bands." },
  { key: "darkForeground", label: "Text on dark sections" },
] as const;
export type ColorTokenKey = (typeof COLOR_TOKENS)[number]["key"];

export const themeSchema = z.object({
  colors: z.object(
    Object.fromEntries(COLOR_TOKENS.map((t) => [t.key, hex])) as Record<ColorTokenKey, typeof hex>
  ),
  typography: z.object({
    headingFont: fontKey,
    bodyFont: fontKey,
    headingWeight: z.enum(["300", "400", "500", "600", "700"]),
    headingTransform: z.enum(["none", "uppercase"]),
    headingTracking: z.enum(["normal", "wide"]),
  }),
  shape: z.object({
    radius: z.coerce.number().min(0).max(1.5),
    buttonShape: z.enum(["square", "rounded", "pill"]),
    buttonTransform: z.enum(["none", "uppercase"]),
  }),
});

export type ThemeTokens = z.infer<typeof themeSchema>;

/** PCI brand defaults (navy, sand and cream from the current PCI identity). */
export const DEFAULT_THEME: ThemeTokens = {
  colors: {
    primary: "#1F3C59",
    primaryForeground: "#FFFFFF",
    secondary: "#F7F2EE",
    secondaryForeground: "#1F3C59",
    accent: "#BDA588",
    accentForeground: "#1A1A1A",
    background: "#FFFFFF",
    foreground: "#1C2530",
    card: "#FFFFFF",
    cardForeground: "#1C2530",
    muted: "#F6F3EE",
    mutedForeground: "#5A6572",
    border: "#E4DED5",
    dark: "#14283C",
    darkForeground: "#F7F2EE",
  },
  typography: {
    headingFont: "cormorant",
    bodyFont: "manrope",
    headingWeight: "500",
    headingTransform: "none",
    headingTracking: "normal",
  },
  shape: {
    radius: 0.25,
    buttonShape: "square",
    buttonTransform: "uppercase",
  },
};

/** Merges stored (possibly partial or outdated) tokens with defaults and validates. */
export function resolveTheme(stored: unknown): ThemeTokens {
  const s = (stored ?? {}) as Partial<ThemeTokens>;
  const merged = {
    colors: { ...DEFAULT_THEME.colors, ...(s.colors ?? {}) },
    typography: { ...DEFAULT_THEME.typography, ...(s.typography ?? {}) },
    shape: { ...DEFAULT_THEME.shape, ...(s.shape ?? {}) },
  };
  const parsed = themeSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** CSS declarations (without selector) for the given tokens. */
export function themeCssVariables(theme: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme.colors)) vars[`--${kebab(key)}`] = value;
  vars["--popover"] = theme.colors.card;
  vars["--popover-foreground"] = theme.colors.cardForeground;
  vars["--input"] = theme.colors.border;
  vars["--ring"] = theme.colors.accent;
  vars["--radius"] = `${theme.shape.radius}rem`;
  vars["--font-sans"] = `var(--font-${theme.typography.bodyFont}), ui-sans-serif, system-ui, sans-serif`;
  vars["--font-heading"] = `var(--font-${theme.typography.headingFont}), ui-serif, Georgia, serif`;
  vars["--heading-weight"] = theme.typography.headingWeight;
  vars["--heading-transform"] = theme.typography.headingTransform;
  vars["--heading-tracking"] = theme.typography.headingTracking === "wide" ? "0.06em" : "-0.01em";
  vars["--button-radius"] =
    theme.shape.buttonShape === "pill" ? "9999px" : theme.shape.buttonShape === "rounded" ? "var(--radius)" : "0px";
  vars["--button-transform"] = theme.shape.buttonTransform;
  vars["--button-tracking"] = theme.shape.buttonTransform === "uppercase" ? "0.12em" : "0";
  return vars;
}

export function themeToCss(theme: ThemeTokens, selector = ":root"): string {
  const body = Object.entries(themeCssVariables(theme))
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `${selector}{${body}}`;
}

// ── WCAG contrast helpers (used to warn editors about inaccessible pairs) ──

function luminance(hexColor: string): number {
  const n = hexColor.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export const CONTRAST_PAIRS: { fg: ColorTokenKey; bg: ColorTokenKey; label: string; min: number }[] = [
  { fg: "foreground", bg: "background", label: "Body text on page background", min: 4.5 },
  { fg: "primaryForeground", bg: "primary", label: "Text on primary buttons", min: 4.5 },
  { fg: "secondaryForeground", bg: "secondary", label: "Text on secondary surfaces", min: 4.5 },
  { fg: "accentForeground", bg: "accent", label: "Text on accent", min: 4.5 },
  { fg: "cardForeground", bg: "card", label: "Text on cards", min: 4.5 },
  { fg: "mutedForeground", bg: "background", label: "Muted text on page background", min: 4.5 },
  { fg: "darkForeground", bg: "dark", label: "Text on dark sections", min: 4.5 },
];

export function contrastWarnings(theme: ThemeTokens) {
  return CONTRAST_PAIRS.map((p) => ({
    ...p,
    ratio: contrastRatio(theme.colors[p.fg], theme.colors[p.bg]),
  })).filter((p) => p.ratio < p.min);
}
