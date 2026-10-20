import { db } from "@/server/db";
import { RateLimitError } from "@/server/errors";

// Fixed-window rate limiter backed by PostgreSQL so limits hold across multiple
// application instances. Raw SQL is used because the conditional "reset or
// increment" must be a single atomic statement; all values are parameterised.

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  const retryAfterSeconds = Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
  return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count), retryAfterSeconds };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const result = await consumeRateLimit(key, limit, windowSeconds);
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
}

export async function resetRateLimit(key: string) {
  await db.rateLimitBucket.deleteMany({ where: { key } });
}

/** Housekeeping: remove expired buckets (called opportunistically by the cron job). */
export async function purgeExpiredRateLimits() {
  await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
