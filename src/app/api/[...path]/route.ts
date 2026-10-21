import { jsonError } from "@/lib/http";
import { NotFoundError } from "@/server/errors";

/** Unknown /api/* paths: a JSON 404 instead of falling through to the website's HTML not-found page. */
function notFound(): Response {
  return jsonError(new NotFoundError("Not found"));
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
