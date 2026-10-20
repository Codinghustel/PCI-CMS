// Local PostgreSQL for development and automated tests.
//
// Runs a real PostgreSQL server from the `embedded-postgres` binaries so that a
// developer machine without a PostgreSQL install (or Docker) can still run
// migrations, the app and the test suites. Production uses a managed/hosted
// PostgreSQL instance configured through DATABASE_URL — never this script.
//
// Usage: npm run db:start   (keeps running until Ctrl+C)
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.LOCAL_PG_PORT ?? 54329);
const databaseDir = path.resolve(process.env.LOCAL_PG_DIR ?? ".pgdata");
const databases = ["pci_dev", "pci_test", "pci_e2e"];

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "pci",
  password: "pci_local_only",
  port,
  persistent: true,
  // UTF-8 regardless of the host OS locale (Windows defaults to WIN1252).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

const firstRun = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));
if (firstRun) {
  await pg.initialise();
}
await pg.start();

const client = pg.getPgClient();
await client.connect();
const existing = new Set(
  (await client.query("SELECT datname FROM pg_database")).rows.map((r) => r.datname)
);
for (const name of databases) {
  if (!existing.has(name)) {
    await client.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
    console.log(`created database ${name}`);
  }
}
const nonUtf8 = (await client.query("SELECT datname FROM pg_database WHERE datname = ANY($1) AND pg_encoding_to_char(encoding) <> 'UTF8'", [databases])).rows;
for (const r of nonUtf8) console.warn(`WARNING: database ${r.datname} is not UTF-8 — recreate it (drop and re-run this script).`);
await client.end();

console.log(`Local PostgreSQL running on port ${port} (data: ${databaseDir})`);
console.log(`DATABASE_URL=postgresql://pci:pci_local_only@localhost:${port}/pci_dev`);

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// Keep the process alive.
setInterval(() => {}, 1 << 30);
