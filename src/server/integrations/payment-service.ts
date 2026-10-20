import crypto from "node:crypto";
import { z } from "zod";
import { fetchJson, IntegrationError } from "@/server/integrations/http";

// Client for PCI's separate Payment Service (Track C). PCI-Orbit never handles
// card data, balances or NetSuite credentials: it only asks the service to
// start a verified payment session and redirects the customer to the URL the
// service returns (OTP verification → statement → provider-hosted payment).
//
// PROPOSED CONTRACT (to be agreed with IT/Finance — the service does not exist yet):
//   POST {PAYMENT_SERVICE_URL}/v1/sessions
//   Headers: Content-Type: application/json
//            X-PCI-Timestamp: <unix seconds>
//            X-PCI-Signature: hex(HMAC-SHA256(secret, `${timestamp}.${body}`))
//   Body:    { "bookingReference": string, "returnUrl": string, "source": "website" }
//   200:     { "sessionId": string, "redirectUrl": "https://…" }
//   4xx:     { "error": string }   (e.g. unknown reference)

export interface PaymentServiceConfig {
  baseUrl: string;
  secret: string;
}

const sessionResponse = z.object({ sessionId: z.string().min(1), redirectUrl: z.url() });

export function signPayload(secret: string, timestamp: string, body: string) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function startPaymentSession(
  config: PaymentServiceConfig,
  input: { bookingReference: string; returnUrl: string }
): Promise<{ sessionId: string; redirectUrl: string }> {
  const body = JSON.stringify({ ...input, source: "website" });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const { status, body: res } = await fetchJson(`${config.baseUrl.replace(/\/$/, "")}/v1/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PCI-Timestamp": timestamp,
      "X-PCI-Signature": signPayload(config.secret, timestamp, body),
    },
    body,
    timeoutMs: 8000,
  });
  if (status !== 200) {
    throw new IntegrationError(`Payment service responded ${status}`, status >= 500, status);
  }
  const parsed = sessionResponse.safeParse(res);
  if (!parsed.success) throw new IntegrationError("Unexpected payment service response", false, status);
  // Only follow redirects to the payment service's own origin (or an https provider page it returns).
  const target = new URL(parsed.data.redirectUrl);
  if (target.protocol !== "https:") throw new IntegrationError("Payment redirect must use https", false);
  return parsed.data;
}
