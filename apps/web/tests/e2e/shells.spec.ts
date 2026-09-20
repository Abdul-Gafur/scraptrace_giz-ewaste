import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("collector shell renders and supports keyboard navigation", async ({ page }, testInfo) => {
  await page.goto("/en/collector");
  await expect(page.getByRole("heading", { name: "Collector home" })).toBeVisible();
  const navigationName =
    testInfo.project.name === "mobile-chromium" ? "Mobile navigation" : "Primary navigation";
  const navigation = page.getByRole("navigation", { name: navigationName });
  await expect(navigation).toBeVisible();
  const firstLink = navigation.getByRole("link").first();
  const secondLink = navigation.getByRole("link").nth(1);
  await firstLink.focus();
  await page.keyboard.press("Tab");
  await expect(secondLink).toBeFocused();
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  if (testInfo.project.name === "chromium") {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("operational shell renders", async ({ page }, testInfo) => {
  await page.goto("/en/recycler");
  await expect(page.getByRole("heading", { name: "Recycler intake" })).toBeVisible();
  const navigationName =
    testInfo.project.name === "mobile-chromium" ? "Mobile navigation" : "Primary navigation";
  await expect(page.getByRole("navigation", { name: navigationName })).toBeVisible();
  if (testInfo.project.name === "chromium") {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("all locale routes load and Arabic is RTL", async ({ page }) => {
  for (const locale of ["en", "fr", "pt"]) {
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  }
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});
