import { existsSync } from "node:fs";

import { chromium, defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env["PLAYWRIGHT_BASE_URL"];
const chromiumBrowser = existsSync(chromium.executablePath()) ? {} : { channel: "chrome" as const };

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "http-workflow.spec.ts",
  fullyParallel: false,
  workers: 1,
  // A cross-role scenario visits several routes in one test, and the development server compiles
  // each route on its first request, so the budget covers compilation as well as interaction.
  timeout: 120_000,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...chromiumBrowser } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], ...chromiumBrowser } },
  ],
  // Set PLAYWRIGHT_BASE_URL to test against an already running server instead of starting one.
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
          url: "http://127.0.0.1:3100/en",
          reuseExistingServer: !process.env["CI"],
          timeout: 120_000,
        },
      }),
});
