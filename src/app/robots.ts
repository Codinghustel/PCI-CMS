import type { MetadataRoute } from "next";
import { isIndexingAllowed, siteUrl } from "@/lib/env";

/** Production allows crawling of public content; staging/dev disallow everything. */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexingAllowed()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/pay-my-installment/status", "/thank-you"] }],
    sitemap: siteUrl("/sitemap.xml"),
  };
}
