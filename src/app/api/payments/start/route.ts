import { startPayment } from "@/server/services/payments";
import { clientIp, forbiddenOrigin, isSameOrigin, jsonError, readJson } from "@/lib/http";

/** POST /api/payments/start { bookingReference } → { redirectUrl } to the Payment Service. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  try {
    const result = await startPayment(await readJson(request, 2048), { ipAddress: clientIp(request) });
    return Response.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
