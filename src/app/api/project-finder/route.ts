import { recommendProjects } from "@/server/services/chatbot";
import { clientIp, forbiddenOrigin, isSameOrigin, jsonError, readJson } from "@/lib/http";

/** POST /api/project-finder — grounded project recommendations from published content. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  try {
    const result = await recommendProjects(await readJson(request, 4096), { ipAddress: clientIp(request) });
    return Response.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
