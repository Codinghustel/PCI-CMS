import { execSync } from "node:child_process";

/**
 * Applies pending migrations to the dedicated test database (non-destructive).
 * Tables are emptied between tests by tests/support/db.ts, which refuses to
 * run against any database whose name does not end in "_test".
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://pci:pci_local_only@localhost:54329/pci_test";
  if (!/_test(\?|$)/.test(new URL(url).pathname + new URL(url).search)) {
    throw new Error(`Refusing to run integration tests against a non-test database: ${new URL(url).pathname}`);
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
