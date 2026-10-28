import type { NextConfig } from "next";
import { CONTENT_REVALIDATE_SECONDS } from "./src/lib/limits";

const isProd = process.env.NODE_ENV === "production";
const indexable = process.env.SITE_ENV === "production";
// Sites allowed to show the CMS in a frame besides itself: PCI Orbit opens it as an embedded module.
// Space-separated origins; FRAME_ANCESTORS="" allows none.
const frameAncestors = (process.env.FRAME_ANCESTORS ?? "https://apps.premierchoiceint.online").trim();

// Security headers applied to every response. A full script-src CSP would need
// per-request nonces (forcing dynamic rendering of every page), so the policy
// focuses on the high-value directives that do not: framing, plugins, base URI
// and form targets. X-Frame-Options can't list other sites, so framing is
// controlled by frame-ancestors alone.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: `frame-ancestors 'self'${frameAncestors ? ` ${frameAncestors}` : ""}; object-src 'none'; base-uri 'self'; form-action 'self'`,
  },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  // Staging and development must never be indexed.
  ...(indexable ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Separate build output for the end-to-end suite (built against its own database).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheLife: {
    // Public CMS content: invalidated on-demand by tags after every edit; the
    // short revalidate window lets scheduled content go live on time.
    content: { stale: CONTENT_REVALIDATE_SECONDS, revalidate: CONTENT_REVALIDATE_SECONDS, expire: 86400 },
  },
  images: {
    localPatterns: [{ pathname: "/uploads/**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },
  serverExternalPackages: ["@node-rs/argon2", "sharp", "embedded-postgres"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The global CSP above would replace the uploads route's own "sandbox" CSP for PDFs; keep both.
      {
        source: "/uploads/:path(.*\\.pdf)",
        headers: [{ key: "Content-Security-Policy", value: `sandbox; ${securityHeaders.find((h) => h.key === "Content-Security-Policy")!.value}` }],
      },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
