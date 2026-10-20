import { db } from "@/server/db";
import { hashPassword } from "@/server/services/auth";
import type { Actor, RoleName } from "@/lib/auth/permissions";

/** Removes all rows (FK-safe order via TRUNCATE … CASCADE). */
export async function resetDb() {
  const dbName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`resetDb refused: ${dbName} is not a test database`);
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  }
}

let n = 0;
export async function makeUser(role: RoleName, password = "Test-Password-123", overrides: { email?: string; isActive?: boolean } = {}): Promise<Actor & { password: string }> {
  n++;
  const user = await db.user.create({
    data: {
      email: overrides.email ?? `${role.toLowerCase()}${n}-${Date.now()}@test.local`,
      name: `${role} ${n}`,
      role,
      isActive: overrides.isActive ?? true,
      passwordHash: await hashPassword(password),
    },
  });
  return { id: user.id, name: user.name, email: user.email, role, password };
}

export async function makeImage(): Promise<string> {
  const sharp = (await import("sharp")).default;
  const data = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#1F3C59" } }).png().toBuffer();
  const m = await db.media.create({
    data: { kind: "IMAGE", storageKey: `test/${Date.now()}-${Math.random().toString(36).slice(2)}.png`, originalName: "t.png", mimeType: "image/png", sizeBytes: data.length, width: 40, height: 30, alt: "test" },
  });
  return m.id;
}
