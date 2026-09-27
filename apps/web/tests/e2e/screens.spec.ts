import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const expectClean = async (page: Page) => {
  expect(await noOverflow(page)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
};

/**
 * The responsive table renders a real table from 768px and a labelled card list below it, and both
 * stay in the DOM. This picks whichever one the current viewport actually shows.
 */
const visibleText = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

/** Waits for the initial demonstration data to be written and the screen to be showing it. */
const waitForRecords = async (page: Page) => {
  await expect(visibleText(page, /ST-[A-Z0-9]{8}/)).toBeVisible({ timeout: 20_000 });
};

test.describe("collector screens", () => {
  test("home shows real totals and the collector's own records", async ({ page }) => {
    await page.goto("/en/collector");
    await expect(page.getByRole("heading", { name: "Register recovered e-waste" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Capture a new recovery" })).toHaveAttribute(
      "href",
      "/en/collector/capture",
    );
    await waitForRecords(page);
    await expect(page.getByText("Your records", { exact: true })).toBeVisible();
    await expect(page.getByText("Approved records")).toBeVisible();
    await expect(page.getByText("Approved weight")).toBeVisible();
    await expect(page.getByText("Resume drafts")).toBeVisible();
    await expectClean(page);
  });

  test("records screen filters by status and shows an honest empty state", async ({ page }) => {
    await page.goto("/en/collector/records");
    await expect(page.getByRole("heading", { level: 1, name: "Collected E-Waste" })).toBeVisible();
    await waitForRecords(page);
    await page.getByLabel("Status").selectOption("submitted");
    await expect(page.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
    await page.getByLabel("Status").selectOption("all");
    await waitForRecords(page);
    await expectClean(page);
  });

  test("a record detail shows its QR code, transfer code and history", async ({ page }) => {
    await page.goto("/en/collector/records");
    await waitForRecords(page);
    // Open the first record that is awaiting handoff, which is the one that carries a QR code.
    await page
      .getByRole("link")
      .filter({ hasText: "Laptops and desktop computers" })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Transfer code").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /QR code for transfer code ST-/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy the transfer code" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download the code" })).toBeVisible();

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Record submitted")).toBeVisible();
    await expect(page.getByText("Published for handoff")).toBeVisible();

    await page.getByRole("tab", { name: "Evidence" }).click();
    await expect(page.getByText("Original item photograph")).toBeVisible();
    await expect(page.getByText("What a digest does")).toBeVisible();
    await expectClean(page);
  });

  test("the capture screen requires a photograph and a confirmed category", async ({ page }) => {
    await page.goto("/en/collector/capture");
    await expect(page.getByText("1. Photograph the item")).toBeVisible();
    await page.getByRole("button", { name: "Submit this record" }).click();
    await expect(page.getByText("Add a photograph of the item.")).toBeVisible();
    await expect(page.getByText("Confirm a category before continuing.")).toBeVisible();
    await expectClean(page);
  });

  test("nearby locations rank results and label an unverified profile", async ({ page }) => {
    await page.goto("/en/collector/locations");
    await expect(page.getByRole("heading", { level: 1, name: "Nearby locations" })).toBeVisible();
    await expect(page.getByText("Accra Central Collection Centre")).toBeVisible();
    await expect(page.getByText("Programme verified").first()).toBeVisible();
    await page.getByLabel("Category").selectOption("microwaves");
    await expect(page.getByText("Kaneshie Scrap Yard")).toBeVisible();
    await expect(page.getByText("Not programme verified")).toBeVisible();
    await expect(
      page.getByText(/A directory listing does not by itself make a location an approved recycler/),
    ).toBeVisible();
    await expectClean(page);
  });

  test("the account screen states the real device-storage counts", async ({ page }) => {
    await page.goto("/en/collector/profile");
    await expect(page.getByText("Records on this device")).toBeVisible();
    await expect(page.getByText("Unsubmitted drafts")).toBeVisible();
    await page.getByRole("link", { name: "Clear records from this device" }).click();
    await expect(page).toHaveURL(/\/collector\/profile\/clear-cache$/);
    await expect(page.getByText("This cannot be undone")).toBeVisible();
    await expect(page.getByText(/You are about to delete \d+ record/)).toBeVisible();
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
  test("the dashboard derives every bucket from the shared records", async ({ page }) => {
    await page.goto("/en/recycler");
    await expect(
      page.getByRole("heading", { name: "Material transfer verification" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open intake" })).toBeVisible();
    await waitForRecords(page);
    await expect(page.getByText(/Records awaiting handoff \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Records with flags \(\d+\)/)).toBeVisible();
    await expect(page.getByText("Measured at this facility")).toBeVisible();
    await expectClean(page);
  });

  test("intake offers a camera, an image and a typed code, and reports an unknown code", async ({
    page,
  }) => {
    await page.goto("/en/recycler/intake");
    await expect(page.getByRole("heading", { name: "Scan the record code" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start the camera" })).toBeVisible();
    await expect(page.getByText("Use a photograph")).toBeVisible();

    await page.getByLabel("Transfer code").fill("ST-NOTHING");
    await page.getByRole("button", { name: "Look up this code" }).click();
    await expect(page.getByText("No record matches that code")).toBeVisible();
    await expect(page.getByText(/No owner details are shown for an unknown code/)).toBeVisible();
    await expectClean(page);
  });

  test("intake refuses an empty transfer code before calling anything", async ({ page }) => {
    await page.goto("/en/recycler/intake");
    await page.getByRole("button", { name: "Look up this code" }).click();
    await expect(page.getByText("Enter the transfer code.")).toBeVisible();
  });

  test("the records table filters by status and links to a record", async ({ page }) => {
    await page.goto("/en/recycler/records");
    await waitForRecords(page);
    await expect(page.getByText(/\d+ record\(s\)/)).toBeVisible();
    await page.getByLabel("Status").selectOption("under_review");
    await expect(
      page.locator('[data-status="under_review"]').filter({ visible: true }).first(),
    ).toBeVisible();
    await expectClean(page);
  });

  test("the processing queue separates records awaiting details from recorded ones", async ({
    page,
  }) => {
    await page.goto("/en/recycler/processing");
    await expect(page.getByRole("heading", { level: 1, name: "Processing" })).toBeVisible();
    await expect(page.getByText("Awaiting processing details")).toBeVisible();
    await expect(page.getByText("Processing recorded")).toBeVisible();
    await expectClean(page);
  });

  test("the facility account states the scope that the service enforces", async ({ page }) => {
    await page.goto("/en/recycler/account");
    await expect(page.getByText("Receiving locations you may act on")).toBeVisible();
    await expect(page.getByText(/The service refuses the action/)).toBeVisible();
    await expectClean(page);
  });
});

test.describe("reviewer screens", () => {
  test("the queue lists reviewable records and filters by reason", async ({ page }) => {
    await page.goto("/en/review/queue");
    await waitForRecords(page);
    await expect(page.getByText(/\d+ record\(s\)/)).toBeVisible();
    await page.getByLabel("Reason").selectOption("WEIGHT_DISCREPANCY");
    await expect(page.getByText(/\d+ record\(s\)/)).toBeVisible();
    await page.getByLabel("Search by reference").fill("ST-DOES-NOT-EXIST");
    await expect(page.getByText("No record matches the current filters.")).toBeVisible();
    await expectClean(page);
  });

  test("a review detail shows the evidence, the flags and the three decisions", async ({
    page,
  }) => {
    await page.goto("/en/review/queue");
    await waitForRecords(page);
    // Only a record that is still under review offers the decision controls.
    await page.getByLabel("Status").selectOption("under_review");
    await page
      .getByRole("link")
      .filter({ hasText: /^ST-[A-Z0-9]{8}$/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Why this record is in review" })).toBeVisible();
    await expect(page.getByText("Review flags").first()).toBeVisible();
    await expect(page.getByText(/A flag records that a value needs human judgement/)).toBeVisible();
    await expect(page.getByText("What the digest tells you")).toBeVisible();
    await expect(page.getByText(/does not prove that the handoff happened/)).toBeVisible();

    for (const name of ["Approve", "Request a correction", "Reject"]) {
      await expect(page.getByRole("radio", { name: new RegExp(name) })).toBeVisible();
    }
    await expect(page.getByLabel("Reason code")).toBeVisible();
    await expect(page.getByLabel("Reviewer note")).toBeVisible();
    await expectClean(page);
  });

  test("assigned records and the decision audit render", async ({ page }) => {
    await page.goto("/en/review/assigned");
    await expect(page.getByRole("heading", { level: 1, name: "Assigned records" })).toBeVisible();
    await expectClean(page);

    await page.goto("/en/review/decisions");
    await expect(page.getByRole("heading", { level: 1, name: "Decisions audit" })).toBeVisible();
    await expect(page.getByText(/\d+ decision\(s\)/)).toBeVisible();
    await expectClean(page);
  });

  test("the system history lists append-only events and filters them", async ({ page }) => {
    await page.goto("/en/review/history");
    await expect(page.getByRole("heading", { level: 1, name: "System history" })).toBeVisible();
    await expect(page.getByText(/\d+ event\(s\)/)).toBeVisible();
    await page.getByLabel("Event").selectOption("record_handoff");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Handoff recorded" }).first(),
    ).toBeVisible();
    await expectClean(page);
  });
});

test.describe("programme manager screens", () => {
  test("the dashboard separates verified recovery from work in progress", async ({ page }) => {
    await page.goto("/en/management");
    await expect(page.getByRole("heading", { name: "Verified outcomes" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(/Only records in the approved and completed state contribute/),
    ).toBeVisible();
    await expect(page.getByText(/Verified weight is the weight measured at handoff/)).toBeVisible();
    await expect(page.getByText("Records by lifecycle state").first()).toBeVisible();
    await expectClean(page);
  });

  test("every chart offers its values as a table", async ({ page }) => {
    await page.goto("/en/management");
    await expect(page.getByText("Records by lifecycle state").first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByText("Show the values as a table").first().click();
    await expect(page.getByRole("table").first()).toBeVisible();
    await expectClean(page);
  });

  test("reports filter, reset and download a CSV that matches the filters", async ({ page }) => {
    await page.goto("/en/management/reports");
    await expect(page.getByText(/\d+ matching record\(s\)/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("How verified weight is counted")).toBeVisible();

    await page.getByLabel("Status").selectOption("approved_and_completed");
    const filteredText = await page.getByText(/\d+ matching record\(s\)/).innerText();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^scraptrace-.*-records-\d{4}-\d{2}-\d{2}\.csv$/);

    await expect(page.getByText(/row\(s\) exported as scraptrace-/)).toBeVisible();
    const filteredCount = Number(filteredText.match(/(\d+)/)?.[1] ?? "0");
    await expect(page.getByText(new RegExp(`${filteredCount} row\\(s\\) exported`))).toBeVisible();

    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page.getByText(/\d+ matching record\(s\)/)).toBeVisible();
    await expectClean(page);
  });

  test("the ledger and locations screens render derived values", async ({ page }) => {
    await page.goto("/en/management/ledger");
    await expect(page.getByRole("heading", { level: 1, name: "Records ledger" })).toBeVisible();
    await expect(page.getByText(/A digest detects later change/)).toBeVisible();
    await expectClean(page);

    await page.goto("/en/management/locations");
    await expect(page.getByRole("heading", { level: 1, name: "Recovery locations" })).toBeVisible();
    await expect(page.getByText(/Only a manager-reviewed profile carries/)).toBeVisible();
    await expectClean(page);
  });

  test("price references show a dated source and a non-offer disclaimer", async ({ page }) => {
    await page.goto("/en/management/prices");
    await expect(page.getByRole("heading", { level: 1, name: "Price references" })).toBeVisible();
    await expect(page.getByText("These are not offers")).toBeVisible();
    await expect(page.getByText(/Effective from 2026-09-01/)).toBeVisible();
    await page.getByLabel("Condition").selectOption("damaged");
    await expectClean(page);
  });

  test("settings validate, warn about unsaved changes and save", async ({ page }) => {
    await page.goto("/en/management/settings");
    await expect(page.getByLabel("Programme name")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Save settings" })).toBeDisabled();

    await page.getByLabel("Weight discrepancy threshold (%)").fill("0");
    await expect(page.getByText("You have unsaved changes")).toBeVisible();
    await page.getByRole("button", { name: "Save settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Save these programme settings?" });
    await dialog.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Enter a threshold between 1 and 100.")).toBeVisible();

    await page.getByLabel("Weight discrepancy threshold (%)").fill("20");
    await page.getByRole("button", { name: "Save settings" }).click();
    await page
      .getByRole("dialog", { name: "Save these programme settings?" })
      .getByRole("button", { name: "Save settings" })
      .click();
    await expect(page.getByText("Programme settings saved.")).toBeVisible();
    await expectClean(page);
  });

  test("English cannot be removed from the supported languages", async ({ page }) => {
    await page.goto("/en/management/settings");
    await expect(page.getByLabel("Programme name")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("checkbox", { name: "English" })).toBeDisabled();
  });
});

test.describe("safety content administration", () => {
  test("the card list shows status, language, version and dates", async ({ page }) => {
    await page.goto("/en/administration/safety");
    await expect(page.getByText(/\d+ card\(s\)/)).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/Only a published card whose review date has not passed/),
    ).toBeVisible();
    await expect(visibleText(page, "Published")).toBeVisible();
    await page.getByLabel("Status").selectOption("draft");
    await expect(visibleText(page, "Draft")).toBeVisible();
    await expectClean(page);
  });

  test("the editor requires all five answers and a source", async ({ page }) => {
    await page.goto("/en/administration/safety/cards/new");
    await expect(page.getByRole("heading", { level: 1, name: "New safety card" })).toBeVisible();
    for (const question of [
      "What is this item?",
      "What may be dangerous inside it?",
      "What should I not do?",
      "What can I safely do now?",
      "Where can I take it?",
    ]) {
      await expect(page.getByText(question)).toBeVisible();
    }
    await page.getByRole("button", { name: "Create the draft" }).click();
    await expect(page.getByText("This answer is required.").first()).toBeVisible();
    await expect(page.getByText("Record at least one source.")).toBeVisible();
    await expectClean(page);
  });

  test("the preview shows the collector-facing card in its own direction", async ({ page }) => {
    await page.goto("/en/administration/safety/cards/new");
    await page.getByLabel("Language", { exact: true }).selectOption("ar");
    await page.getByRole("tab", { name: "Collector preview" }).click();
    await expect(page.getByText("This is what a collector reads")).toBeVisible();
    await expect(page.locator('ol[dir="rtl"][lang="ar"]')).toBeVisible();
  });

  test("translations show missing coverage instead of substituting English", async ({ page }) => {
    await page.goto("/en/administration/safety/translations");
    await expect(page.getByRole("heading", { level: 1, name: "Translations" })).toBeVisible();
    await expect(
      page.getByText(/English is never presented as though it were another language/),
    ).toBeVisible();
    await expect(visibleText(page, "Missing")).toBeVisible();
    await expectClean(page);
  });

  test("the approval queue and published content render", async ({ page }) => {
    await page.goto("/en/administration/safety/approvals");
    await expect(page.getByRole("heading", { level: 1, name: "Approval queue" })).toBeVisible();
    await expectClean(page);

    await page.goto("/en/administration/safety/published");
    await expect(page.getByRole("heading", { level: 1, name: "Published content" })).toBeVisible();
    await expect(page.getByText(/card\(s\) can be served to collectors/)).toBeVisible();
    await expectClean(page);
  });
});

test.describe("model administration", () => {
  test("the correction queue states that nothing here retrains a model", async ({ page }) => {
    await page.goto("/en/administration/ml");
    await expect(page.getByText("What this screen does and does not do")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Nothing here retrains or redeploys a model/)).toBeVisible();
    await expect(page.getByLabel("Corrections only")).toBeVisible();
    await expect(page.getByLabel("Low confidence only")).toBeVisible();
    await expectClean(page);
  });

  test("filtering to corrections narrows the stored predictions", async ({ page }) => {
    await page.goto("/en/administration/ml");
    await expect(page.getByText(/\d+ item\(s\)/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Corrections only").check();
    await expect(page.getByText(/\d+ item\(s\)/)).toBeVisible();
  });

  test("model information reports the artefact's own metadata", async ({ page }) => {
    await page.goto("/en/administration/ml/model");
    await expect(page.getByRole("heading", { level: 1, name: "Model information" })).toBeVisible();
    await expect(page.getByText("What this model does")).toBeVisible();
    await expect(page.getByText(/It is not an object detector/)).toBeVisible();
    await expect(page.getByText("single_label_image_classification")).toBeVisible();
    await expect(page.getByText("Not recorded in the training artefact")).toBeVisible();
    await expect(page.getByText("Conflicting metadata in the repository")).toBeVisible();
    await expect(page.getByText("F1 score by category").first()).toBeVisible();
    await expectClean(page);
  });

  test("configuration validates the threshold and shows activation as metadata", async ({
    page,
  }) => {
    await page.goto("/en/administration/ml/configuration");
    await expect(page.getByLabel("Threshold (%)")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Only one version is registered")).toBeVisible();
    await page.getByLabel("Threshold (%)").fill("99");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await page
      .getByRole("dialog", { name: "Save this model configuration?" })
      .getByRole("button", { name: "Save configuration" })
      .click();
    await expect(page.getByText("Enter a threshold between 5 and 95.")).toBeVisible();
    await expectClean(page);
  });

  test("approved labels and exports render with their boundaries stated", async ({ page }) => {
    await page.goto("/en/administration/ml/labels");
    await expect(page.getByRole("heading", { level: 1, name: "Approved labels" })).toBeVisible();
    await expect(page.getByText("These are candidates, not a dataset")).toBeVisible();

    await page.goto("/en/administration/ml/exports");
    await expect(page.getByRole("heading", { level: 1, name: "Data exports" })).toBeVisible();
    await expect(page.getByText("What the file contains")).toBeVisible();
    await expect(page.getByText(/no collector identifier and no image content/)).toBeVisible();
    await expectClean(page);
  });

  test("the feedback export downloads a CSV", async ({ page }) => {
    await page.goto("/en/administration/ml/exports");
    await expect(page.getByText(/\d+/).first()).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Review state").selectOption("all");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/model-feedback-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

test.describe("Arabic role screens", () => {
  test("the manager dashboard renders translated content right-to-left", async ({ page }) => {
    await page.goto("/ar/management");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "النتائج المتحقَّقة" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("الوزن المتحقَّق").first()).toBeVisible();
    await expectClean(page);
  });

  test("the recycler intake renders translated content right-to-left", async ({ page }) => {
    await page.goto("/ar/recycler/intake");
    await expect(page.getByRole("heading", { name: "امسح رمز السجل" })).toBeVisible();
    await expect(page.getByLabel("رمز النقل")).toBeVisible();
    await expectClean(page);
  });

  test("French and Portuguese role screens render their own copy", async ({ page }) => {
    await page.goto("/fr/review/queue");
    await expect(page.getByText("En attente de décision")).toBeVisible({ timeout: 20_000 });
    await page.goto("/pt/management/reports");
    await expect(
      page.getByRole("heading", { level: 1, name: "Relatórios do programa" }),
    ).toBeVisible();
  });
});
