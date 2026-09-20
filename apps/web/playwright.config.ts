import { existsSync } from "node:fs";

import { chromium, defineConfig, devices } from "@playwright/test";

const chromiumBrowser = existsSync(chromium.executablePath()) ? {} : { channel: "chrome" as const };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...chromiumBrowser } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], ...chromiumBrowser } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/en",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
