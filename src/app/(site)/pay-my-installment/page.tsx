import type { Metadata } from "next";
import { Suspense } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { LeadForm } from "@/components/site/lead-form";
import { PaymentStartForm } from "@/components/site/payment-start-form";
import { TrackView } from "@/components/site/project-widgets";
import { getPublicSettings } from "@/server/public-data";
import { paymentMode } from "@/server/services/payments";
import { buildMetadata } from "@/lib/seo";
import { sanitizeRichText } from "@/lib/sanitize";
import { connection } from "next/server";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getPublicSettings();
  return buildMetadata({
    title: settings.payment.heading || "Pay My Installment",
    description: "Securely pay your installment to Premier Choice International.",
    path: "/pay-my-installment",
    noindex: true,
  });
}

export default async function PayPage() {
  const { settings } = await getPublicSettings();
  return (
    <>
      <TrackView event="payment_page_start" />
      <PageHero eyebrow="Customer payments" title={settings.payment.heading || "Pay My Installment"} crumbs={[{ name: "Pay My Installment", path: "/pay-my-installment" }]} />
      <section className="section-y">
        <div className="container-site grid gap-12 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-2">
            {settings.payment.intro ? <div className="prose-cms" dangerouslySetInnerHTML={{ __html: sanitizeRichText(settings.payment.intro) }} /> : null}
            <div className="border border-border bg-secondary p-6 text-sm">
              <p className="mb-3 flex items-center gap-2 font-semibold text-secondary-foreground"><ShieldCheck className="size-5 text-success" aria-hidden /> Your payment is protected</p>
              {settings.payment.securityNote ? (
                <div className="prose-cms text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(settings.payment.securityNote) }} />
              ) : (
                <p className="text-muted-foreground">PCI never asks for or stores your card details on this website. Payments are completed on the approved payment provider&apos;s secure page.</p>
              )}
            </div>
          </div>
          <div className="lg:col-span-3">
            <Suspense fallback={null}>
              <PaymentEntry consentText={settings.forms.consentText} />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  );
}

/** Mode depends on runtime configuration (payment service availability). */
async function PaymentEntry({ consentText }: { consentText: string }) {
  await connection();
  if (paymentMode() === "service") {
    return (
      <div className="border border-border p-6 md:p-8">
        <h2 className="mb-2 flex items-center gap-2 text-3xl"><Lock className="size-6 text-accent" aria-hidden /> Verify and pay</h2>
        <p className="mb-6 text-sm text-muted-foreground">Enter your booking reference. You will verify with a one-time code sent to your registered mobile number, then view and pay your open installments on the secure payment page.</p>
        <PaymentStartForm />
      </div>
    );
  }
  return (
    <div className="border border-border p-6 md:p-8">
      <h2 className="mb-2 text-3xl">Request a secure payment link</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Submit your details below. Our Finance team will verify your booking and installment and send you a secure payment link. No payment is taken on this page.
      </p>
      <LeadForm
        formType="PAYMENT_REQUEST"
        consentText={consentText}
        submitLabel="Request payment link"
        successMessage="Thank you — our Finance team will verify your details and send your secure payment link."
        extraFields={[
          { name: "bookingReference", label: "Booking / customer reference", required: true, maxLength: 60 },
          { name: "unitReference", label: "Project and unit number", maxLength: 60 },
          { name: "purpose", label: "Payment purpose (e.g. installment due in March)", maxLength: 200 },
        ]}
        showMessage
      />
    </div>
  );
}
