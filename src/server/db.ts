import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

// Reuse one client per process; in development, Next's hot reload re-evaluates
// modules, so the instance is cached on globalThis to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Timestamps are stored as UTC in `timestamp without time zone` columns, so every
  // session must run in UTC for now()/CURRENT_TIMESTAMP to agree with app-written values.
  const adapter = new PrismaPg({ connectionString: serverEnv().DATABASE_URL, options: "-c TimeZone=UTC" });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
