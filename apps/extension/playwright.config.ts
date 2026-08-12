import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "node e2e/static-server.mjs",
    port: 8934,
    reuseExistingServer: !process.env.CI,
  },
});
