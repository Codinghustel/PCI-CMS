import { z } from "zod";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { startPaymentSession } from "@/server/integrations/payment-service";
import { IntegrationError } from "@/server/integrations/http";
import { AppError, ValidationError } from "@/server/errors";
import { parseInput } from "@/server/services/helpers";
import { serverEnv, siteUrl } from "@/lib/env";

// Website side of "Pay My Installment". Two modes:
//  - Payment Service configured (Track C live): hand off to the verified flow.
//  - Not configured (interim): the entry page uses the payment-request lead
//    form; Finance verifies the customer and installment before any secure
//    link is issued. No payment amounts or card details are handled here.

export function paymentMode(): "service" | "request" {
  const env = serverEnv();
  return env.PAYMENT_SERVICE_URL && env.PAYMENT_SERVICE_SECRET ? "service" : "request";
}

const startSchema = z.object({
  bookingReference: z
    .string()
    .trim()
    .min(3, "Enter your booking reference")
    .max(40)
    .regex(/^[A-Za-z0-9\-/]+$/, "Use letters, numbers, '-' or '/' only"),
});

export async function startPayment(input: unknown, meta: { ipAddress: string }) {
  await enforceRateLimit(`pay:${meta.ipAddress}`, 10, 15 * 60);
  const { bookingReference } = parseInput(startSchema, input);
  const env = serverEnv();
  if (paymentMode() !== "service") {
    throw new ValidationError("Online installment payments are not yet available. Please use the payment request form.");
  }
  try {
    const session = await startPaymentSession(
      { baseUrl: env.PAYMENT_SERVICE_URL!, secret: env.PAYMENT_SERVICE_SECRET },
      { bookingReference, returnUrl: siteUrl("/pay-my-installment/status") }
    );
    return { redirectUrl: session.redirectUrl };
  } catch (e) {
    if (e instanceof IntegrationError) {
      console.warn("[payments] session start failed:", e.message);
      throw new AppError(
        "PAYMENT_UNAVAILABLE",
        e.httpStatus && e.httpStatus < 500
          ? "We could not verify that reference. Please check it or contact our customer care team."
          : "The payment service is temporarily unavailable. Please try again shortly.",
        e.httpStatus && e.httpStatus < 500 ? 422 : 503
      );
    }
    throw e;
  }
}
