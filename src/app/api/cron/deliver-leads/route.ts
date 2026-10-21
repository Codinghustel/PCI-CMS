import crypto from "node:crypto";
import { runLeadDeliveryJob } from "@/server/services/integrations";
import { serverEnv } from "@/lib/env";

/**
 * POST /api/cron/deliver-leads — scheduled job (run every 1–5 minutes from the
 * host's scheduler). Retries due CRM deliveries and performs housekeeping; each
 * run is recorded and shown in Settings → Integrations.
 * Auth: "Authorization: Bearer <CRON_SECRET>".
 */
export async function POST(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    secret.length >= 16 &&
    provided.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  if (!ok) return Response.json({ error: { code: "UNAUTHORIZED" }, message: "Unauthorized" }, { status: 401 });

  const result = await runLeadDeliveryJob("schedule");
  return Response.json(result);
}
