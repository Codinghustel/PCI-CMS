"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteButton } from "@/components/site/site-button";
import { track } from "@/lib/analytics-client";

/** Hands the customer over to the separate Payment Service (verification + hosted payment). */
export function PaymentStartForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const bookingReference = String(new FormData(e.currentTarget).get("bookingReference") ?? "");
    try {
      const res = await fetch("/api/payments/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingReference }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.redirectUrl) {
        setError(body.message ?? "We could not start the payment. Please try again.");
        return;
      }
      track("pay_installment_click", { label: "handoff" });
      window.location.assign(body.redirectUrl);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="booking-ref">Booking reference *</Label>
        <Input id="booking-ref" name="bookingReference" required maxLength={40} autoComplete="off" className="mt-1.5 h-11 rounded-none" />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <SiteButton type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Continue to secure verification
      </SiteButton>
    </form>
  );
}
