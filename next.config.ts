import type { NextConfig } from "next";
import { CONTENT_REVALIDATE_SECONDS } from "./src/lib/limits";

const isProd = process.env.NODE_ENV === "production";
const indexable = process.env.SITE_ENV === "production";

// Security headers applied to every response. A full script-src CSP would need
// per-request nonces (forcing dynamic rendering of every page), so the policy
// focuses on the high-value directives that do not: framing, plugins, base URI
// and form targets.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
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
