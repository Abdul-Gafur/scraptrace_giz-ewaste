import { test } from "@playwright/test";

/**
 * Captures screenshots of every shell for comparison with the Figma frames. Output goes to
 * test-results/visual (an ignored test artifact directory), never to production assets.
 */
const targets = [
  ["collector", "/collector"],
  ["collector-records", "/collector/records"],
  ["collector-capture", "/collector/capture"],
  ["collector-account", "/collector/profile"],
  ["collector-clear-cache", "/collector/profile/clear-cache"],
  ["recycler-home", "/recycler"],
  ["onboarding", "/onboarding"],
  ["privacy", "/onboarding/privacy"],
  ["recycler", "/recycler/intake"],
  ["reviewer", "/review/queue"],
  ["manager", "/management"],
  ["safety-admin", "/administration/safety"],
  ["ml-review", "/administration/ml"],
  ["role-sign-in", "/sign-in"],
  ["access-denied", "/access-denied"],
  ["showcase", "/dev/components"],
] as const;

const viewports = [
  ["mobile", { width: 390, height: 844 }],
  ["tablet", { width: 768, height: 1024 }],
  ["desktop", { width: 1440, height: 900 }],
] as const;

test.describe("visual capture", () => {
  for (const locale of ["en", "ar"]) {
    for (const [viewportName, viewport] of viewports) {
      test(`${locale} ${viewportName}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "Single project");
        await page.setViewportSize(viewport);
        for (const [name, path] of targets) {
          await page.goto(`/${locale}${path}`);
          await page.waitForLoadState("networkidle");
          await page.screenshot({
            path: `test-results/visual/${locale}-${viewportName}-${name}.png`,
            fullPage: name === "showcase",
          });
        }
      });
    }
  }
});
