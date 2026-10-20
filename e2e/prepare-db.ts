import { execSync } from "node:child_process";
import fs from "node:fs";
import { Client } from "pg";

/**
 * Prepares the dedicated e2e database: applies migrations, empties all tables
 * (refusing any database not named *_e2e) and seeds the standard content with
 * known test credentials. Run by the Playwright webServer command before the
 * e2e build, so prerendered pages reflect this database.
 */
async function prepare() {
  const url = process.env.DATABASE_URL!;
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_e2e")) throw new Error(`Refusing to prepare non-e2e database "${name}"`);

  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
  const client = new Client({ connectionString: url, options: "-c TimeZone=UTC" });
  await client.connect();
  const tables = (await client.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`)).rows;
  if (tables.length) await client.query(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await client.end();
  fs.rmSync("storage-e2e", { recursive: true, force: true });
  execSync("npx prisma db seed", { stdio: "inherit", env: process.env });
}

prepare().catch((e) => {
  console.error(e);
  process.exit(1);
});
