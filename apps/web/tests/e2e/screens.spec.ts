import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const expectClean = async (page: Page) => {
  expect(await noOverflow(page)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
};

test.describe("collector screens", () => {
  test("home shows the capture card, draft and recent records with status badges", async ({
    page,
  }) => {
    await page.goto("/en/collector");
    await expect(page.getByRole("heading", { name: "Register Recovered E-Waste" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Capture New Recovery" })).toHaveAttribute(
      "href",
      "/en/collector/capture",
    );
    await expect(page.getByText("Resume (80%)")).toBeVisible();
    await expect(page.getByText("Recent local records (3)")).toBeVisible();
    await expect(page.getByText("Pending Sync")).toBeVisible();
    await expect(page.getByText("Action Required")).toBeVisible();
    await expect(page.getByText("Synced", { exact: true })).toBeVisible();
    await expectClean(page);
  });

  test("records lists the sample records with a critical safety panel", async ({ page }) => {
    await page.goto("/en/collector/records");
    await expect(page.getByRole("heading", { level: 1, name: "Collected E-Waste" })).toBeVisible();
    await expect(page.getByText("Lead-Acid Battery (Industrial)")).toBeVisible();
    await expect(page.getByText("Pending Sync: 3 Records")).toBeVisible();
    await expect(page.getByRole("heading", { name: "CRITICAL SAFETY" })).toBeVisible();
    await expectClean(page);
  });

  test("capture form validates the required serial field and announces the error", async ({
    page,
  }) => {
    await page.goto("/en/collector/capture");
    await page.getByRole("button", { name: "Register New Material" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Enter a serial number or brand name." }),
    ).toBeVisible();
    await expect(page.getByLabel("E-Waste Serial / Brand Name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await page.getByLabel("E-Waste Serial / Brand Name").fill("Model X");
    await page.getByRole("button", { name: "Register New Material" }).click();
    await expect(page.getByText(/Nothing is saved yet/)).toBeVisible();
    await expectClean(page);
  });

  test("account settings lead to the clear-cache confirmation without deleting anything", async ({
    page,
  }) => {
    await page.goto("/en/collector/profile");
    await expect(page.getByText("ST-CN-88029")).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Model Training Contribution" }),
    ).not.toBeChecked();
    await page.getByRole("link", { name: "Clear Local Records Cache" }).click();
    await expect(page).toHaveURL(/\/collector\/profile\/clear-cache$/);
    await expect(page.getByText("Destructive Action Warning")).toBeVisible();
    await page.getByRole("button", { name: "Yes, Clear All Offline Records" }).click();
    await expect(page.getByText("Nothing was deleted.")).toBeVisible();
    await expectClean(page);
  });
});

test.describe("onboarding", () => {
  test("language choice continues to the privacy step in the chosen language", async ({ page }) => {
    await page.goto("/en/onboarding");
    await expect(page.getByRole("heading", { level: 1, name: "ScrapTrace" })).toBeVisible();
    await page.getByRole("radio", { name: /Français/ }).check({ force: true });
    await page.getByRole("button", { name: "Confirm Language" }).click();
    await expect(page).toHaveURL(/\/fr\/onboarding\/privacy$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Confidentialité et gouvernance des données" }),
    ).toBeVisible();
  });

  test("privacy consent toggles the optional choice and is accessible", async ({ page }) => {
    await page.goto("/en/onboarding/privacy");
    await expect(page.getByText("Unselected")).toBeVisible();
    await page.getByRole("checkbox", { name: "Optional ML Training Reuse" }).check();
    await expect(page.getByText("Selected", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Accept Policies & Continue" })).toHaveAttribute(
      "href",
      "/en/collector",
    );
    await expectClean(page);
  });
});

test.describe("recycler screens", () => {
  test("home offers code entry, pending audits and the verified authority panel", async ({
    page,
  }) => {
    await page.goto("/en/recycler");
    await expect(
      page.getByRole("heading", { name: "Material Transfer Verification" }),
    ).toBeVisible();
    await expect(page.getByLabel("Identification code")).toBeVisible();
    await expect(page.getByText("Telecom Boards Batch A")).toBeVisible();
    await expect(page.getByText("142.8 kg Verified")).toBeVisible();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByText("This action becomes available in a later milestone."),
    ).toBeVisible();
    await expectClean(page);
  });

  test("intake shows the QR card, evidence card and approve action", async ({ page }) => {
    await page.goto("/en/recycler/intake");
    await expect(page.getByRole("heading", { name: "Scan Record QR Code" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Material Evidence Photo" })).toBeVisible();
    await expect(page.getByText("Verified GPS")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve Intake Receipt" })).toBeVisible();
    await expectClean(page);
  });
});

test.describe("desktop role screens", () => {
  test("reviewer queue filters the sample rows", async ({ page }) => {
    await page.goto("/en/review/queue");
    await expect(page.getByText("14 Records")).toBeVisible();
    await expect(page.getByText("ST-0941").locator("visible=true")).toBeVisible();
    await page.getByLabel("GPS verification").selectOption("unverified_gps");
    await expect(page.getByText("ST-0832").locator("visible=true")).toBeVisible();
    await expect(page.getByText("ST-0941")).toHaveCount(0);
    await page.getByLabel("Search Serial ST-…").fill("nothing");
    await expect(page.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
    await expectClean(page);
  });

  test("manager overview keeps estimates and verified outcomes separate", async ({ page }) => {
    await page.goto("/en/management");
    await expect(page.getByText("342 Devices")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Indicative Estimations Registry" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verified Outcome Receipts" })).toBeVisible();
    await expect(page.getByText("~12.4 Tons")).toBeVisible();
    await expectClean(page);
  });

  test("safety administration shows cards and the creation form", async ({ page }) => {
    await page.goto("/en/administration/safety");
    await expect(
      page.getByRole("heading", { name: "Mercury Vapour Precaution Guide (EN)" }),
    ).toBeVisible();
    await expect(page.getByLabel("Precaution Headline (Regulatory standard)")).toBeVisible();
    await page.getByRole("button", { name: "Publish Safety Guidance" }).click();
    await expect(
      page.getByText("This action becomes available in a later milestone."),
    ).toBeVisible();
    await expectClean(page);
  });

  test("model review shows metrics, image frame and correction form", async ({ page }) => {
    await page.goto("/en/administration/ml");
    await expect(page.getByText("94.2% Precision")).toBeVisible();
    await expect(page.getByLabel("Select Correct Device Material Category")).toHaveValue("pcbHigh");
    await page
      .getByRole("checkbox", { name: "Verify Image Resolution matches GPS Coordinates" })
      .check();
    await expect(page.getByRole("button", { name: "Commit Label Correction" })).toBeVisible();
    await expectClean(page);
  });

  test("Arabic manager dashboard renders translated content right-to-left", async ({ page }) => {
    await page.goto("/ar/management");
    await expect(
      page.getByRole("heading", { level: 1, name: "مؤشرات أداء برنامج تتبع واسترجاع النفايات" }),
    ).toBeVisible();
    await expect(page.getByText("٣٤٢")).toBeVisible();
    await expectClean(page);
  });
});
