// Cache tags for public content. Every public read is tagged with `site` plus
// a specific tag, so CMS mutations can invalidate precisely (or everything,
// for changes like media alt text, theme or settings that affect many pages).
export const TAGS = {
  site: "site",
  pages: "pages",
  projects: "projects",
  updates: "updates",
  locations: "locations",
  articles: "articles",
  vacancies: "vacancies",
  faqs: "faqs",
  navigation: "navigation",
  settings: "settings",
  theme: "theme",
  media: "media",
  redirects: "redirects",
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS];
