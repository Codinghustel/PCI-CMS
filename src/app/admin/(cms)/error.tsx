"use client";

import { Button } from "@/components/ui/button";

export default function CmsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page could not be loaded.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
