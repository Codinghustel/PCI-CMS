"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadForm } from "@/components/site/lead-form";
import { siteButtonClass } from "@/components/site/site-button";
import { track } from "@/lib/analytics-client";
import { CONSTRUCTION_STATUS_LABELS, MARKET_LABELS, PROJECT_CATEGORY_LABELS, type ConstructionStatusValue, type ProjectCategoryValue } from "@/lib/content-labels";
import { formatPrice } from "@/lib/text";
import { cn } from "@/lib/utils";

export const OPEN_FINDER_EVENT = "pci:open-finder";

export function openProjectFinder() {
  window.dispatchEvent(new Event(OPEN_FINDER_EVENT));
}

interface Result {
  id: string;
  name: string;
  slug: string;
  city: string;
  category: ProjectCategoryValue;
  constructionStatus: ConstructionStatusValue;
  imageKey: string | null;
  priceFrom: number | null;
  currency: string | null;
  reasons: string[];
}

type Step = "market" | "category" | "status" | "budget" | "results" | "handover";
type Answers = { market: string; category: string; status: string; budgetMax?: number; currency?: string };

const BUDGETS: Record<string, { label: string; value: number }[]> = {
  AED: [
    { label: "Up to AED 1M", value: 1_000_000 },
    { label: "Up to AED 2M", value: 2_000_000 },
    { label: "Up to AED 5M", value: 5_000_000 },
  ],
  PKR: [
    { label: "Up to PKR 25M", value: 25_000_000 },
    { label: "Up to PKR 50M", value: 50_000_000 },
    { label: "Up to PKR 100M", value: 100_000_000 },
  ],
};

export function ProjectFinder({ title, greeting, disclaimer, consentText }: { title: string; greeting: string; disclaimer: string; consentText: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("market");
  const [answers, setAnswers] = useState<Answers>({ market: "ANY", category: "ANY", status: "ANY" });
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_FINDER_EVENT, handler);
    return () => window.removeEventListener(OPEN_FINDER_EVENT, handler);
  }, []);

  useEffect(() => {
    if (open) track("chatbot_start");
  }, [open]);

  function reset() {
    setStep("market");
    setAnswers({ market: "ANY", category: "ANY", status: "ANY" });
    setResults([]);
    setError("");
  }

  async function search(final: Answers) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/project-finder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(final) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      setResults(body.results);
      setStep("results");
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const choose = (patch: Partial<Answers>, next: Step) => {
    const updated = { ...answers, ...patch };
    setAnswers(updated);
    if (next === "results") void search(updated);
    else setStep(next);
  };

  const back: Partial<Record<Step, Step>> = { category: "market", status: "category", budget: "status", results: "budget", handover: "results" };
  const currency = answers.market === "UAE" ? "AED" : answers.market === "PAKISTAN" ? "PKR" : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed end-4 bottom-20 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl transition hover:bg-primary/90 md:bottom-6"
        aria-label={`Open ${title}`}
      >
        <Sparkles className="size-4" aria-hidden />
        <span className="hidden sm:inline">{title}</span>
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(reset, 300); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-none sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-medium">
              <Sparkles className="size-5 text-accent" aria-hidden /> {title}
            </DialogTitle>
            <DialogDescription>{step === "market" ? greeting || "Tell us what you are looking for and we'll suggest suitable PCI projects." : "Answer a few quick questions."}</DialogDescription>
          </DialogHeader>

          {back[step] && !loading ? (
            <button type="button" onClick={() => setStep(back[step]!)} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden /> Back
            </button>
          ) : null}

          <div aria-live="polite" className="space-y-4">
            {step === "market" && (
              <Question label="Where would you like to invest or live?">
                {(["UAE", "PAKISTAN"] as const).map((m) => (
                  <Choice key={m} onClick={() => choose({ market: m }, "category")}>{MARKET_LABELS[m]}</Choice>
                ))}
                <Choice onClick={() => choose({ market: "ANY" }, "category")}>Open to either</Choice>
              </Question>
            )}
            {step === "category" && (
              <Question label="What type of property?">
                {(["RESIDENTIAL", "COMMERCIAL", "RETAIL", "CO_LIVING", "MIXED_USE"] as const).map((c) => (
                  <Choice key={c} onClick={() => choose({ category: c }, "status")}>{PROJECT_CATEGORY_LABELS[c]}</Choice>
                ))}
                <Choice onClick={() => choose({ category: "ANY" }, "status")}>Not sure yet</Choice>
              </Question>
            )}
            {step === "status" && (
              <Question label="When do you need it?">
                <Choice onClick={() => choose({ status: "COMPLETED" }, currency ? "budget" : "results")}>Ready now (completed)</Choice>
                <Choice onClick={() => choose({ status: "ONGOING" }, currency ? "budget" : "results")}>Under construction / off-plan</Choice>
                <Choice onClick={() => choose({ status: "UPCOMING" }, currency ? "budget" : "results")}>Upcoming launches</Choice>
                <Choice onClick={() => choose({ status: "ANY" }, currency ? "budget" : "results")}>Flexible</Choice>
              </Question>
            )}
            {step === "budget" && currency && (
              <Question label="What is your approximate budget?">
                {BUDGETS[currency].map((b) => (
                  <Choice key={b.value} onClick={() => choose({ budgetMax: b.value, currency }, "results")}>{b.label}</Choice>
                ))}
                <Choice onClick={() => choose({ budgetMax: undefined, currency: undefined }, "results")}>Prefer not to say</Choice>
              </Question>
            )}
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Finding suitable projects…</p>
            ) : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            {step === "results" && !loading && (
              <div className="space-y-4">
                {results.length ? (
                  <>
                    <p className="text-sm font-semibold">Projects that may suit you</p>
                    <ul className="space-y-3">
                      {results.map((r) => (
                        <li key={r.id}>
                          <Link href={`/projects/${r.slug}`} onClick={() => setOpen(false)} className="flex gap-4 border border-border p-3 transition hover:border-primary">
                            <span className="relative size-20 shrink-0 overflow-hidden bg-muted">
                              {r.imageKey ? <Image src={`/uploads/${r.imageKey}`} alt="" fill sizes="80px" className="object-cover" /> : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-heading text-xl">{r.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {r.city} · {PROJECT_CATEGORY_LABELS[r.category]} · {CONSTRUCTION_STATUS_LABELS[r.constructionStatus]}
                              </span>
                              {r.priceFrom && r.currency ? <span className="block text-xs font-semibold">From {formatPrice(r.priceFrom, r.currency)}</span> : null}
                              {r.reasons.length ? <span className="mt-1 block text-xs text-muted-foreground">{r.reasons.join(" · ")}</span> : null}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm">We couldn&apos;t find a published project that matches every answer. Our sales team can advise on current and upcoming options.</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={siteButtonClass("primary", "sm")} onClick={() => { setStep("handover"); track("chatbot_handover"); }}>
                    <MessageCircle aria-hidden /> Talk to a sales advisor
                  </button>
                  <button type="button" className={siteButtonClass("outline", "sm")} onClick={reset}>Start again</button>
                </div>
              </div>
            )}

            {step === "handover" && (
              <LeadForm
                formType="CHATBOT"
                consentText={consentText}
                submitLabel="Request a call back"
                extraFields={[]}
                showMessage
                successMessage="Thank you — a sales advisor will contact you shortly."
                className="pt-2"
                key="handover"
                projectName={results[0]?.name}
                projectId={results.length === 1 ? results[0].id : undefined}
              />
            )}
          </div>
          {disclaimer ? <p className="border-t border-border pt-3 text-[0.7rem] text-muted-foreground">{disclaimer}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Choice({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("border border-border px-4 py-3 text-start text-sm transition hover:border-primary hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none")}>
      {children}
    </button>
  );
}

export function OpenFinderButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={openProjectFinder}>
      {children}
    </button>
  );
}
