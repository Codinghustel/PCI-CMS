import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "PCI-Orbit CMS", template: "%s · PCI-Orbit CMS" },
  robots: { index: false, follow: false },
};

// CMS screens are per-user and always rendered on request.
export const instant = false;

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full flex-1 bg-muted/30">{children}</div>;
}
