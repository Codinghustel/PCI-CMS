import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AdminProvider } from "@/components/admin/admin-context";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireActorPage } from "@/lib/auth/session";

// Authenticated CMS shell. The session is read at request time behind a
// Suspense boundary (Cache Components); every page and action also performs
// its own permission check on the server.

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-label="Loading" />
        </div>
      }
    >
      <CmsShell>{children}</CmsShell>
    </Suspense>
  );
}

async function CmsShell({ children }: { children: React.ReactNode }) {
  const actor = await requireActorPage();
  return (
    <AdminProvider actor={actor}>
      <AdminNav />
      <div className="lg:ps-64">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </AdminProvider>
  );
}
