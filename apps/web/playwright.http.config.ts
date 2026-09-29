import { existsSync } from "node:fs";

import { chromium, defineConfig, devices } from "@playwright/test";

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3101";
const chromiumBrowser = existsSync(chromium.executablePath()) ? {} : { channel: "chrome" as const };

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "http-workflow.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: "html",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "http-desktop", use: { ...devices["Desktop Chrome"], ...chromiumBrowser } },
    { name: "http-mobile", use: { ...devices["Pixel 7"], ...chromiumBrowser } },
  ],
});
