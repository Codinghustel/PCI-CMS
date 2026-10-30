import path from "node:path";
import os from "node:os";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // Next's "server-only" guard throws outside the react-server condition.
  "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
};

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://pci:pci_local_only@localhost:54329/pci_test";

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          env: { AUTH_SECRET: "unit-test-secret-0123456789abcdef0123456789", DATABASE_URL: "postgresql://unused/unused" },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/support/global-setup.ts"],
          // Tests share one database; run files sequentially.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            AUTH_SECRET: "integration-test-secret-0123456789abcdef0123",
            UPLOAD_DIR: path.join(os.tmpdir(), "pci-orbit-test-uploads"),
            PRIVATE_UPLOAD_DIR: path.join(os.tmpdir(), "pci-orbit-test-private"),
            BITRIX24_WEBHOOK_URL: "",
            ALLOW_PASSWORD_LOGIN: "true",
          },
        },
      },
    ],
  },
});
