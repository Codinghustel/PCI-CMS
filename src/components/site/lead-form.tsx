"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteButton } from "@/components/site/site-button";
import { getAttribution, track } from "@/lib/analytics-client";
import type { LeadFormTypeValue } from "@/lib/content-labels";
import { cn } from "@/lib/utils";

export interface ExtraField {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}

interface LeadFormProps {
  formType: LeadFormTypeValue;
  projectId?: string;
  projectName?: string;
  consentText: string;
  successMessage?: string;
  submitLabel?: string;
  showMessage?: boolean;
  showCountry?: boolean;
  extraFields?: ExtraField[];
  /** For gated documents: revealed after a successful submission. */
  unlockDocument?: { title: string; url: string };
  className?: string;
  tone?: "light" | "dark";
  onSuccess?: () => void;
}

type Errors = Record<string, string[]>;

export function LeadForm({
  formType,
  projectId,
  projectName,
  consentText,
  successMessage = "Thank you — our team will be in touch shortly.",
  submitLabel = "Submit enquiry",
  showMessage = true,
  showCountry = false,
  extraFields = [],
  unlockDocument,
  className,
  tone = "light",
  onSuccess,
}: LeadFormProps) {
  const id = useId();
  const startedAt = useRef<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  function onFirstInteraction() {
    if (startedAt.current === null) {
      startedAt.current = Date.now();
      track("form_start", { label: formType, project: projectName });
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const extra: Record<string, string> = {};
    for (const f of extraFields) extra[f.name] = String(fd.get(f.name) ?? "");
    const payload = {
      formType,
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      country: fd.get("country") ?? "",
      message: fd.get("message") ?? "",
      projectId: projectId ?? "",
      pageUrl: window.location.href.slice(0, 1000),
      consent,
      attribution: getAttribution(),
      extra,
      website: fd.get("website") ?? "",
      startedAt: startedAt.current ?? Date.now(),
    };
    track("form_submit", { label: formType, project: projectName });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.fieldErrors ?? {});
        setFormError(body.message ?? "We could not send your enquiry. Please try again.");
        return;
      }
      // Lead conversion is recorded only after a validated, stored submission.
      track("generate_lead", { label: formType, project: projectName });
      setDone(true);
      onSuccess?.();
    } catch {
      setFormError("Network error — please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className={cn("flex flex-col items-start gap-4 border border-border p-6", tone === "dark" && "border-white/20", className)}>
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <p className="heading text-2xl">{successMessage}</p>
        {unlockDocument ? (
          <a
            href={unlockDocument.url}
            target="_blank"
            rel="noopener"
            data-track="brochure_download"
            data-track-label={unlockDocument.title}
            data-track-project={projectName}
            className="inline-flex items-center gap-2 font-semibold underline underline-offset-4"
          >
            <Download className="size-4" aria-hidden /> Download {unlockDocument.title}
          </a>
        ) : null}
      </div>
    );
  }

  const field = (name: string) => ({
    id: `${id}-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });
  const error = (name: string) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="mt-1.5 text-xs text-destructive">
        {errors[name][0]}
      </p>
    ) : null;
  const labelCls = cn("mb-1.5 text-xs font-semibold tracking-wide uppercase", tone === "dark" && "text-dark-foreground/80");
  const inputCls = cn("h-11 rounded-none bg-background", tone === "dark" && "border-white/25 bg-white/5 text-dark-foreground placeholder:text-white/40");

  return (
    <form onSubmit={onSubmit} onFocusCapture={onFirstInteraction} noValidate className={cn("grid gap-4 sm:grid-cols-2", className)} aria-describedby={formError ? `${id}-form-error` : undefined}>
      {/* Honeypot: hidden from people, often filled by bots. */}
      <div aria-hidden className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor={`${id}-name`} className={labelCls}>Full name *</Label>
        <Input {...field("name")} autoComplete="name" required maxLength={120} className={inputCls} />
        {error("name")}
      </div>
      <div>
        <Label htmlFor={`${id}-email`} className={labelCls}>Email *</Label>
        <Input {...field("email")} type="email" autoComplete="email" required maxLength={254} className={inputCls} />
        {error("email")}
      </div>
      <div>
        <Label htmlFor={`${id}-phone`} className={labelCls}>Phone (with country code) *</Label>
        <Input {...field("phone")} type="tel" autoComplete="tel" required placeholder="+971 50 000 0000" maxLength={40} className={inputCls} />
        {error("phone")}
      </div>
      {showCountry ? (
        <div className="sm:col-span-2">
          <Label htmlFor={`${id}-country`} className={labelCls}>Country of residence</Label>
          <Input {...field("country")} autoComplete="country-name" maxLength={80} className={inputCls} />
        </div>
      ) : null}
      {extraFields.map((f) => (
        <div key={f.name} className="sm:col-span-2">
          <Label htmlFor={`${id}-${f.name}`} className={labelCls}>
            {f.label}
            {f.required ? " *" : ""}
          </Label>
          <Input {...field(f.name)} required={f.required} placeholder={f.placeholder} maxLength={f.maxLength ?? 200} className={inputCls} />
          {error(`extra.${f.name}`) ?? error(f.name)}
        </div>
      ))}
      {showMessage ? (
        <div className="sm:col-span-2">
          <Label htmlFor={`${id}-message`} className={labelCls}>Message</Label>
          <Textarea {...field("message")} rows={4} maxLength={3000} className={cn(inputCls, "h-auto")} />
          {error("message")}
        </div>
      ) : null}
      <div className="flex items-start gap-3 sm:col-span-2">
        <Checkbox
          id={`${id}-consent`}
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          aria-invalid={errors.consent ? true : undefined}
          className={cn("mt-0.5 rounded-none", tone === "dark" && "border-white/50")}
        />
        <Label htmlFor={`${id}-consent`} className={cn("text-xs leading-relaxed font-normal", tone === "dark" ? "text-dark-foreground/80" : "text-muted-foreground")}>
          {consentText}
        </Label>
      </div>
      {errors.consent ? <p className="-mt-2 text-xs text-destructive sm:col-span-2">{errors.consent[0]}</p> : null}
      {formError ? (
        <p id={`${id}-form-error`} role="alert" className="text-sm text-destructive sm:col-span-2">
          {formError}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <SiteButton type="submit" size="lg" variant={tone === "dark" ? "accent" : "primary"} disabled={pending} className="w-full sm:w-auto">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Sending…" : submitLabel}
        </SiteButton>
      </div>
    </form>
  );
}
