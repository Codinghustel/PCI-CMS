import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[linear-gradient(135deg,var(--primary),var(--dark))] p-4">
      <div className="w-full max-w-sm rounded-xl bg-background p-8 shadow-2xl">
        <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">Premier Choice International</p>
        <h1 className="mt-2 text-2xl font-semibold">PCI-Orbit CMS</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">Sign in with your CMS account.</p>
        <Suspense fallback={<LoginForm next="" />}>
          <LoginWithNext searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginWithNext({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  // Already signed in with a live session (checked against the database, unlike the proxy).
  if (await getCurrentActor()) redirect("/admin");
  return <LoginForm next={typeof sp.next === "string" ? sp.next : ""} />;
}
