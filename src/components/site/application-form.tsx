"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteButton } from "@/components/site/site-button";

/** Job application with CV upload. Posts multipart data to /api/careers/apply. */
export function ApplicationForm({ vacancyId }: { vacancyId: string }) {
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setMessage("");
    const fd = new FormData(e.currentTarget);
    fd.set("vacancyId", vacancyId);
    fd.set("consent", consent ? "true" : "false");
    try {
      const res = await fetch("/api/careers/apply", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.fieldErrors ?? {});
        setMessage(body.message ?? "We could not submit your application.");
        return;
      }
      setDone(true);
    } catch {
      setMessage("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="space-y-3">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <p className="heading text-2xl">Thank you for applying.</p>
        <p className="text-sm text-muted-foreground">Our HR team will review your application and contact you if your profile matches the role.</p>
      </div>
    );
  }
  const err = (k: string) => (errors[k] ? <p className="mt-1 text-xs text-destructive">{errors[k][0]}</p> : null);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div aria-hidden className="absolute -start-[9999px] h-0 w-0 overflow-hidden"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <div><Label htmlFor="app-name">Full name *</Label><Input id="app-name" name="name" required autoComplete="name" className="mt-1.5 rounded-none" aria-invalid={!!errors.name} />{err("name")}</div>
      <div><Label htmlFor="app-email">Email *</Label><Input id="app-email" name="email" type="email" required autoComplete="email" className="mt-1.5 rounded-none" aria-invalid={!!errors.email} />{err("email")}</div>
      <div><Label htmlFor="app-phone">Phone *</Label><Input id="app-phone" name="phone" type="tel" required autoComplete="tel" className="mt-1.5 rounded-none" aria-invalid={!!errors.phone} />{err("phone")}</div>
      <div><Label htmlFor="app-cv">CV (PDF, max 5 MB) *</Label><Input id="app-cv" name="cv" type="file" accept="application/pdf" required className="mt-1.5 rounded-none" aria-invalid={!!errors.cv} />{err("cv")}</div>
      <div><Label htmlFor="app-cover">Cover note</Label><Textarea id="app-cover" name="coverLetter" rows={4} maxLength={5000} className="mt-1.5 rounded-none" /></div>
      <div className="flex items-start gap-3">
        <Checkbox id="app-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5 rounded-none" />
        <Label htmlFor="app-consent" className="text-xs leading-relaxed font-normal text-muted-foreground">
          I consent to PCI processing my personal data and CV for recruitment purposes, in line with the Privacy Policy.
        </Label>
      </div>
      {err("consent")}
      {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
      <SiteButton type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Submit application
      </SiteButton>
    </form>
  );
}
