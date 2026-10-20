import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Target of proxy rewrites for unknown public URLs. Calling notFound() before
// anything streams makes Next.js serve the branded 404 page with a real 404 status.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PageNotFound() {
  notFound();
}
