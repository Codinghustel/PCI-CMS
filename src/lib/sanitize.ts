import sanitizeHtml from "sanitize-html";

// Allow-list for CMS rich text. Anything not listed (scripts, iframes, event
// handlers, inline styles, javascript: URLs) is removed. Applied when content is
// saved and again when it is rendered.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li", "blockquote", "a", "hr", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? "");
      return {
        tagName,
        attribs: {
          href: attribs.href ?? "#",
          ...(external || attribs.target === "_blank" ? { target: "_blank", rel: "noopener noreferrer" } : {}),
        },
      };
    },
    h1: "h2",
  },
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS).trim();
}
