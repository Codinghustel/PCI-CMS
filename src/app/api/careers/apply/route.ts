import { submitApplication } from "@/server/services/applications";
import { clientIp, forbiddenOrigin, isSameOrigin, jsonError } from "@/lib/http";
import { ValidationError } from "@/server/errors";
import { MAX_CV_BYTES } from "@/lib/file-types";

/** POST /api/careers/apply (multipart/form-data) — job application with PDF CV. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_CV_BYTES + 64 * 1024) throw new ValidationError("CV is too large.", { cv: ["Maximum size is 5 MB."] });
    const form = await request.formData();
    const file = form.get("cv");
    const cv = file instanceof File && file.size > 0 ? { data: Buffer.from(await file.arrayBuffer()), name: file.name } : null;
    const app = await submitApplication(
      {
        vacancyId: form.get("vacancyId") ?? "",
        name: form.get("name") ?? "",
        email: form.get("email") ?? "",
        phone: form.get("phone") ?? "",
        coverLetter: form.get("coverLetter") ?? "",
        consent: form.get("consent") === "true",
        website: form.get("website") ?? "",
      },
      cv,
      { ipAddress: clientIp(request) }
    );
    return Response.json({ id: app.id }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
