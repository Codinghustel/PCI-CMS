import { Suspense } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { getPublicTheme } from "@/server/public-data";
import { themeToCss } from "@/lib/theme";

// Draft previews: authenticated, rendered on request (never cached publicly),
// using the real website templates and the current theme.

export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const theme = await getPublicTheme();
  return (
    <div className="site min-h-dvh bg-background">
      <style dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-semibold text-black">
        <Eye className="size-4" aria-hidden /> Preview — this is how the content will look when published. It is not visible to the public.
        <Link href="/admin" className="underline">Back to CMS</Link>
      </div>
      <Suspense fallback={<p className="p-24 text-center">Loading preview…</p>}>{children}</Suspense>
    </div>
  );
}
