import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <ShieldAlert className="mx-auto size-10 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold">You don&apos;t have access to this area</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your role doesn&apos;t include permission for this page. Ask an administrator if you need access.</p>
      <Button asChild className="mt-6"><Link href="/admin">Back to dashboard</Link></Button>
    </div>
  );
}
