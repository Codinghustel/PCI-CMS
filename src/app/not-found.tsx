import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm font-semibold tracking-widest text-accent uppercase">Error 404</p>
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <Link href="/" className="underline underline-offset-4">Go to the homepage</Link>
    </main>
  );
}
