import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SiteButtonLink } from "@/components/site/site-button";

export const metadata: Metadata = { title: "Payment status", robots: { index: false, follow: false } };

// Return page from the Payment Service. The query string is NOT trusted as proof
// of payment — it only selects which message to show. The authoritative status
// lives in the Payment Service / NetSuite and is confirmed by receipt.
const STATES = {
  success: { icon: CheckCircle2, cls: "text-success", title: "Payment received", text: "Thank you. Your payment has been submitted. You will receive an acknowledgement shortly, and PCI Finance will issue your official receipt once the payment is reconciled." },
  pending: { icon: Clock, cls: "text-warning", title: "Payment pending", text: "Your payment is being processed by the payment provider. You will receive a confirmation once it completes. Please do not pay again." },
  failed: { icon: XCircle, cls: "text-destructive", title: "Payment not completed", text: "The payment was not completed and you have not been charged by PCI. You can try again or contact our customer care team." },
} as const;

export default function PaymentStatusPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <PageHero title="Payment status" crumbs={[{ name: "Pay My Installment", path: "/pay-my-installment" }, { name: "Status", path: "/pay-my-installment/status" }]} />
      <section className="section-y">
        <div className="container-site max-w-2xl">
          <Suspense fallback={null}>
            <Status searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function Status({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const key = (typeof sp.status === "string" && sp.status in STATES ? sp.status : "pending") as keyof typeof STATES;
  const s = STATES[key];
  const Icon = s.icon;
  return (
    <div className="border border-border p-8 text-center" role="status">
      <Icon className={`mx-auto size-12 ${s.cls}`} aria-hidden />
      <h2 className="mt-4 text-4xl">{s.title}</h2>
      <p className="mt-4 text-muted-foreground">{s.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {key === "failed" ? <SiteButtonLink href="/pay-my-installment">Try again</SiteButtonLink> : null}
        <SiteButtonLink href="/contact" variant="outline">Contact customer care</SiteButtonLink>
      </div>
    </div>
  );
}
