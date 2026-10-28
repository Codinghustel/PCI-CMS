import { z } from "zod";

// Server-side configuration. Parsed lazily so that importing a module never
// crashes a build step that does not need a particular variable.
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  // "production" allows search-engine indexing; anything else is treated as
  // staging/development and is served with noindex.
  SITE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  UPLOAD_DIR: z.string().default("./storage/public"),
  PRIVATE_UPLOAD_DIR: z.string().default("./storage/private"),
  BITRIX24_WEBHOOK_URL: z.url().optional().or(z.literal("")),
  BITRIX24_PROJECT_FIELD: z.string().optional().default(""),
  BITRIX24_DEFAULT_ASSIGNEE_ID: z.string().optional().default(""),
  PAYMENT_SERVICE_URL: z.url().optional().or(z.literal("")),
  PAYMENT_SERVICE_SECRET: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  // Bearer key for /api/v1/users and /api/v1/roles (external apps creating CMS
  // users and changing role permissions).
  // Empty disables the endpoint.
  USERS_API_KEY: z.string().optional().default(""),
  // PCI Orbit single sign-on. The app secret is USERS_API_KEY (shared with Orbit's CMS_API_KEY).
  ORBIT_URL: z.url().default("https://apps.premierchoiceint.online"),
  // Emergency switch: "true" re-enables the email/password form next to Orbit sign-in.
  ALLOW_PASSWORD_LOGIN: z.string().optional().default("false").transform((v) => v.trim().toLowerCase() === "true"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Invalid server environment configuration:\n${issues.join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** For tests that change process.env between cases. */
export function resetServerEnvCache() {
  cached = undefined;
}

export function siteUrl(path = "/"): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isIndexingAllowed(): boolean {
  return process.env.SITE_ENV === "production";
}
