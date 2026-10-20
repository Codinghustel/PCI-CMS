import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { privateStorage } from "@/server/integrations/storage";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { parseInput } from "@/server/services/helpers";
import { detectFileType, MAX_CV_BYTES } from "@/lib/file-types";
import { normalizePhone } from "@/lib/text";
import { can, type Actor } from "@/lib/auth/permissions";
import { audit } from "@/server/services/audit";

// Careers applications. CVs are personal data: stored outside the public
// upload directory, only downloadable by users with applications.read, and
// never sent to third parties from the website.

const applicationSchema = z.object({
  vacancyId: z.string().trim().max(64).optional().default(""),
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(254),
  phone: z
    .string()
    .trim()
    .max(40)
    .transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({ code: "custom", message: "Please enter a valid phone number" });
        return z.NEVER;
      }
      return p;
    }),
  coverLetter: z.string().trim().max(5000).optional().default(""),
  consent: z.literal(true, { error: "Please confirm consent to process your application" }),
  website: z.string().max(0).optional().default(""),
});

export async function submitApplication(input: unknown, cv: { data: Buffer; name: string } | null, meta: { ipAddress: string }) {
  await enforceRateLimit(`apply:${meta.ipAddress}`, 5, 60 * 60);
  const data = parseInput(applicationSchema, input);
  if (data.website) throw new ValidationError("We could not process this submission.");
  if (!cv) throw new ValidationError("Please attach your CV.", { cv: ["Please attach your CV (PDF)."] });
  if (cv.data.length > MAX_CV_BYTES) throw new ValidationError("CV is too large.", { cv: ["Maximum size is 5 MB."] });
  const type = detectFileType(cv.data);
  if (type?.mime !== "application/pdf") throw new ValidationError("CV must be a PDF.", { cv: ["Please upload your CV as a PDF file."] });

  const vacancy = data.vacancyId
    ? await db.vacancy.findFirst({ where: { id: data.vacancyId, status: "PUBLISHED" }, select: { id: true } })
    : null;
  const cvKey = `cv/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.pdf`;
  await privateStorage().put(cvKey, cv.data);
  try {
    return await db.jobApplication.create({
      data: {
        vacancyId: vacancy?.id ?? null,
        name: data.name,
        email: data.email,
        phone: data.phone,
        coverLetter: data.coverLetter,
        cvKey,
        cvName: cv.name.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "cv.pdf",
        consent: true,
      },
    });
  } catch (e) {
    await privateStorage().delete(cvKey);
    throw e;
  }
}

export async function downloadApplicationCv(actor: Actor, id: string) {
  if (!can(actor, "applications.read")) throw new ForbiddenError();
  const app = await db.jobApplication.findUnique({ where: { id } });
  if (!app) throw new NotFoundError("Application not found");
  const data = await privateStorage().get(app.cvKey);
  if (!data) throw new NotFoundError("CV file not found");
  await audit(actor, { action: "application.cv_download", entityType: "JobApplication", entityId: id, summary: "Downloaded applicant CV" });
  return { data, name: app.cvName };
}
