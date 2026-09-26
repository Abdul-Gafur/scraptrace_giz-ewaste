import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The navigation destinations that have no Figma frame. Each is a real screen built from the
 * contracts, so these tests assert what the screen actually shows, not that a route resolves.
 */

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const expectClean = async (page: Page) => {
  expect(await noOverflow(page)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
};

test.describe("collector sections", () => {
  test("nearby locations come from the location service and keep their freshness", async ({
    page,
  }) => {
    await page.goto("/en/collector/locations");
    await expect(page.getByText("Riverside Collection Centre")).toBeVisible();
    await expect(
      page.getByText("Programme verified").locator("visible=true").first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Directory freshness" })).toBeVisible();

    await page.getByLabel("Facility type").selectOption("scrapyard");
    await expect(page.getByText("North Industrial Scrapyard")).toBeVisible();
    await expect(page.getByText("Riverside Collection Centre")).toHaveCount(0);

    // A category no listed facility accepts must reach the safe-holding message, not an
    // empty list.
    await page.getByLabel("Facility type").selectOption("all");
    await page.getByLabel("Category", { exact: false }).first().selectOption("refrigerators");
    await expect(page.getByText("North Industrial Scrapyard")).toBeVisible();
    await expectClean(page);
  });
});

test.describe("recycler sections", () => {
  test("received batches filter by handoff state and search by record", async ({ page }) => {
    await page.goto("/en/recycler/records");
    await expect(page.getByRole("heading", { level: 1, name: "Received Batches" })).toBeVisible();
    await expect(page.getByText("ST-0941").locator("visible=true").first()).toBeVisible();
    await page.getByLabel("Search record ST-…").fill("ST-0192");
    await expect(page.getByText("ST-0941")).toHaveCount(0);
    await page.getByLabel("Search record ST-…").fill("nothing");
    await expect(page.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
    await expectClean(page);
  });

  test("processing shows the recovery method, progress and the evidence rule", async ({ page }) => {
    await page.goto("/en/recycler/processing");
    await expect(page.getByText("Material recovery")).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Disassembly progress" }).first(),
    ).toHaveAttribute("aria-valuenow", "65");
    await expect(
      page.getByRole("heading", { name: "Evidence required before completion" }),
    ).toBeVisible();
    await expectClean(page);
  });

  test("facility account shows verification and notification switches", async ({ page }) => {
    await page.goto("/en/recycler/account");
    await expect(page.getByText("RY-9921-EM")).toBeVisible();
    await expect(page.getByRole("switch", { name: "New intake alerts" })).not.toBeChecked();
    await page.getByRole("switch", { name: "New intake alerts" }).check();
    await expect(page.getByRole("switch", { name: "New intake alerts" })).toBeChecked();
    await expectClean(page);
  });
});

test.describe("reviewer sections", () => {
  test("assigned records filter by priority and never recommend an outcome", async ({ page }) => {
    await page.goto("/en/review/assigned");
    await expect(page.getByText("High priority").locator("visible=true").first()).toBeVisible();
    await page.getByRole("combobox").selectOption("high");
    await expect(page.getByText("ST-0832").locator("visible=true").first()).toBeVisible();
    await expect(page.getByText("ST-0941")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Flags are indicators, not decisions" }),
    ).toBeVisible();
    await expectClean(page);
  });

  test("decisions audit filters decisions and says the log is append-only", async ({ page }) => {
    await page.goto("/en/review/decisions");
    await page.getByRole("combobox").selectOption("reject");
    await expect(page.getByText("ST-0655").locator("visible=true").first()).toBeVisible();
    await expect(page.getByText("ST-0192")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Decisions are append-only" })).toBeVisible();
    await expectClean(page);
  });

  test("system history lists contract events per record", async ({ page }) => {
    await page.goto("/en/review/history");
    await expect(
      page.getByText("Flagged for review").locator("visible=true").first(),
    ).toBeVisible();
    await page.getByRole("combobox").selectOption("ST-0941");
    await expect(page.getByText("Record submitted").locator("visible=true").first()).toBeVisible();
    await expect(page.getByText("Flagged for review")).toHaveCount(0);
    await expectClean(page);
  });
});

test.describe("manager sections", () => {
  test("records ledger paginates and separates verified weight", async ({ page }) => {
    await page.goto("/en/management/ledger");
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Next" }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(page.getByText("ST-0612").locator("visible=true").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coarse areas only" })).toBeVisible();
    await expectClean(page);
  });

  test("recovery locations tie verification to the last review", async ({ page }) => {
    await page.goto("/en/management/locations");
    await expect(page.getByText("Not verified").locator("visible=true").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verification expires" })).toBeVisible();
    await expectClean(page);
  });

  test("price references lead with the indicative warning", async ({ page }) => {
    await page.goto("/en/management/prices");
    await expect(page.getByRole("heading", { name: "Indicative reference prices" })).toBeVisible();
    await expect(page.getByText("7.40 USD / kg").locator("visible=true").first()).toBeVisible();
    await expectClean(page);
  });

  test("system reports offer scoped reports whose generation is deferred", async ({ page }) => {
    await page.goto("/en/management/reports");
    await expect(page.getByRole("heading", { name: "Recovery summary" })).toBeVisible();
    await page.getByRole("button", { name: "Generate the Recovery summary report" }).click();
    await expect(
      page.getByText("This action becomes available in a later milestone."),
    ).toBeVisible();
    await expectClean(page);
  });

  test("programme settings show the contract schema versions in use", async ({ page }) => {
    await page.goto("/en/management/settings");
    await expect(page.getByText("Contract schema version")).toBeVisible();
    await expect(page.getByLabel("Offline record retention")).toHaveValue("30");
    await expectClean(page);
  });
});

test.describe("administration sections", () => {
  test("safety translations filter by language and keep approval separate", async ({ page }) => {
    await page.goto("/en/administration/safety/translations");
    await page.getByRole("combobox").selectOption("ar");
    await expect(page.getByText("Draft").locator("visible=true").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Translations keep their source" }),
    ).toBeVisible();
    await expectClean(page);
  });

  test("approval queue names the author and defers approval", async ({ page }) => {
    await page.goto("/en/administration/safety/approvals");
    await expect(page.getByText("SC-11")).toBeVisible();
    await page.getByRole("button", { name: "Approve Lithium battery fire risk" }).click();
    await expect(
      page.getByText("This action becomes available in a later milestone."),
    ).toBeVisible();
    await expectClean(page);
  });

  test("published content shows versions and the next review date", async ({ page }) => {
    await page.goto("/en/administration/safety/published");
    await expect(page.getByText("2.0.0").locator("visible=true").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Published content expires" })).toBeVisible();
    await expectClean(page);
  });

  test("approved labels distinguish corrections from confirmed predictions", async ({ page }) => {
    await page.goto("/en/administration/ml/labels");
    await expect(page.getByText("Human correction").locator("visible=true").first()).toBeVisible();
    await expect(
      page.getByText("Prediction confirmed").locator("visible=true").first(),
    ).toBeVisible();
    await page.getByRole("combobox").selectOption("glass");
    await expect(page.getByText("EV-2280").locator("visible=true").first()).toBeVisible();
    await expect(page.getByText("EV-2291")).toHaveCount(0);
    await expectClean(page);
  });

  test("model information reports precision per category as decision support", async ({ page }) => {
    await page.goto("/en/administration/ml/model");
    await expect(page.getByText("1.3.0")).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Printed Circuit Boards (High Grade)" }),
    ).toHaveAttribute("aria-valuenow", "96");
    await expect(page.getByRole("heading", { name: "Decision support only" })).toBeVisible();
    await expectClean(page);
  });

  test("data exports lead with the training-reuse consent rule", async ({ page }) => {
    await page.goto("/en/administration/ml/exports");
    await expect(
      page.getByRole("heading", { name: "Exports respect the training-reuse choice" }),
    ).toBeVisible();
    await expect(page.getByText("Failed").locator("visible=true").first()).toBeVisible();
    await expectClean(page);
  });
});

test.describe("registration", () => {
  test("validates the request and reports that nothing is submitted", async ({ page }) => {
    await page.goto("/en/register");
    await page.getByRole("button", { name: "Request access" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Enter the name to register." }),
    ).toBeVisible();
    await page.getByLabel("Full name").fill("A. Mensah");
    await page.getByLabel("Organisation or collection node").fill("Riverside Collection Centre");
    await page.getByLabel("Programme invitation code").fill("ST-1");
    await page.getByRole("button", { name: "Request access" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Use at least six characters." }),
    ).toBeVisible();
    await page.getByLabel("Programme invitation code").fill("ST-INV-4821");
    await page.getByRole("button", { name: "Request access" }).click();
    await expect(page.getByText("Nothing was submitted.")).toBeVisible();
    await expectClean(page);
  });
});

test.describe("Arabic sections", () => {
  test("the ledger renders right-to-left with Arabic-Indic digits", async ({ page }) => {
    await page.goto("/ar/management/ledger");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("١٢٫٨").locator("visible=true").first()).toBeVisible();
    await expectClean(page);
  });
});
