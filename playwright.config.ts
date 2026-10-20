import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build connected to a dedicated
// database (pci_e2e), seeded with known credentials by e2e/prepare-db.ts.
const PORT = 3100;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://pci:pci_local_only@localhost:54329/pci_e2e";
export const E2E_PASSWORD = "E2e-Password-2026";

const env = {
  DATABASE_URL,
  AUTH_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NEXT_DIST_DIR: ".next-e2e",
  SITE_ENV: "staging",
  UPLOAD_DIR: "./storage-e2e/public",
  PRIVATE_UPLOAD_DIR: "./storage-e2e/private",
  // Deliberately unreachable CRM endpoint: forms must still succeed.
  BITRIX24_WEBHOOK_URL: "http://127.0.0.1:9/rest/1/e2e/",
  SEED_ADMIN_PASSWORD: E2E_PASSWORD,
  SEED_DEMO_PASSWORD: E2E_PASSWORD,
};
Object.assign(process.env, env);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx tsx e2e/prepare-db.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env,
  },
});
