import { expect, test, type Page } from "@playwright/test";

/**
 * Cross-role end-to-end scenarios.
 *
 * Each test drives one browser context through several role workspaces. The record store lives in
 * the browser, so navigating from the collector workspace to the recycler workspace is exactly how a
 * demonstration hands one record between roles.
 *
 * Only deterministic inputs are used: a fixed photograph, typed transfer codes and explicit waits on
 * content. No test depends on a timer.
 */

/** A small, deterministic JPEG-labelled payload. Content only has to be stable, not a real image. */
const photograph = (name: string) => ({
  name: `${name}.jpg`,
  mimeType: "image/jpeg",
  buffer: Buffer.from(`scraptrace-e2e-${name}`),
});

/**
 * The responsive table renders a real table from 768px and a labelled card list below it, and both
 * stay in the DOM. This picks whichever one the current viewport actually shows.
 */
const visibleText = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

const waitForRepository = async (page: Page) => {
  await expect(visibleText(page, /ST-[A-Z0-9]{8}/)).toBeVisible({ timeout: 20_000 });
};

/** Captures and submits a record, returning its transfer code. */
const captureRecord = async (
  page: Page,
  options: { readonly declaredWeightKg: string; readonly photographName: string },
): Promise<string> => {
  await page.goto("/en/collector/capture");
  await page
    .locator('input[type="file"][accept^="image/"]')
    .first()
    .setInputFiles(photograph(options.photographName));

  // The category selector appears once the suggestion has been made.
  await expect(page.getByText("2. Confirm the category")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Category").selectOption("televisions");
  const reason = page.getByLabel("Why is the suggestion wrong?");
  if (await reason.isVisible()) {
    await reason.fill("The photographed item is a television.");
  }

  await page.getByLabel("Condition").selectOption("damaged");
  await page.getByLabel("Number of items").fill("1");
  await page.getByLabel("Approximate weight in kilograms").fill(options.declaredWeightKg);
  const destination = page.getByLabel("Intended receiving location");
  const recyclerOption = await destination
    .locator("option", { hasText: "Tema Licensed Recycling Works" })
    .getAttribute("value");
  await destination.selectOption(recyclerOption ?? "");

  await expect(page.getByText("Approved guidance")).toBeVisible();

  await page.getByRole("button", { name: "Submit this record" }).click();
  await expect(page).toHaveURL(/\/collector\/records\/[0-9a-f-]+$/, { timeout: 20_000 });

  const code = await page
    .getByText(/^ST-[A-Z0-9]{8,16}$/)
    .first()
    .innerText();
  expect(code).toMatch(/^ST-[A-Z0-9]{8,16}$/);
  return code;
};

/** Confirms receipt at intake for a transfer code, with the required evidence. */
const confirmReceipt = async (
  page: Page,
  options: { readonly code: string; readonly measuredWeightKg: string; readonly label: string },
) => {
  await page.goto("/en/recycler/intake");
  await page.getByLabel("Transfer code").fill(options.code);
  await page.getByRole("button", { name: "Look up this code" }).click();

  await expect(page.getByRole("heading", { name: "Confirm receipt" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "What the collector submitted" })).toBeVisible();

  await page.getByLabel("Received weight").fill(options.measuredWeightKg);
  await page.getByLabel("Final price paid").fill("120");

  const uploads = page.locator('input[type="file"][accept^="image/"]');
  await uploads.nth(0).setInputFiles(photograph(`${options.label}-handoff`));
  await uploads.nth(1).setInputFiles(photograph(`${options.label}-scale`));

  await page.getByRole("button", { name: "Confirm receipt" }).first().click();
  await page
    .getByRole("dialog", { name: "Confirm receipt of this record?" })
    .getByRole("button", { name: "Confirm receipt" })
    .click();
};

/** Records processing for the currently received record and returns the resulting panel text. */
const recordProcessing = async (page: Page, label: string) => {
  await page.getByRole("link", { name: "Record processing details" }).first().click();
  await expect(page.getByRole("heading", { name: "Processing details" })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByLabel("Processing method").selectOption("material_recovery");
  await page
    .getByLabel("Processing result and notes")
    .fill("Material recovery with weighbridge evidence.");
  await page.getByRole("textbox", { name: "Material 1" }).fill("Lead glass");
  await page.getByRole("spinbutton", { name: "Weight 1" }).fill("6.5");
  await page
    .locator('input[type="file"][accept^="image/"]')
    .first()
    .setInputFiles(photograph(`${label}-processing`));

  await page.getByRole("button", { name: "Submit processing" }).first().click();
  await page
    .getByRole("dialog", { name: "Submit these processing details?" })
    .getByRole("button", { name: "Submit processing" })
    .click();
};

test.describe("scenario A: a successful recovery", () => {
  test("a collector's record reaches the programme report through every role", async ({ page }) => {
    const code = await captureRecord(page, {
      declaredWeightKg: "20",
      photographName: "scenario-a",
    });

    // The QR code and the transfer code are both available to present.
    await expect(
      page.getByRole("img", { name: `QR code for transfer code ${code}` }),
    ).toBeVisible();
    await expect(page.getByText("Awaiting Handoff")).toBeVisible();

    await confirmReceipt(page, { code, measuredWeightKg: "21", label: "scenario-a" });
    await expect(page.getByRole("heading", { name: "Receipt recorded" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/No flags were raised/)).toBeVisible();

    await recordProcessing(page, "scenario-a");
    await expect(page.getByText("Record complete")).toBeVisible({ timeout: 20_000 });

    await expect(
      page.getByText(/the record is approved and counts towards verified recovery/),
    ).toBeVisible();

    // The collector sees the same record, now approved.
    await page.goto("/en/collector/records");
    await waitForRepository(page);
    await page.getByLabel("Search by reference").fill(code);
    await expect(page.locator('[data-status="approved_and_completed"]').first()).toBeVisible();

    // The programme manager's report includes it and the CSV download reflects it.
    await page.goto("/en/management/reports");
    await expect(page.getByText(/\d+ matching record\(s\)/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Status").selectOption("approved_and_completed");
    await expect(visibleText(page, code)).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    const file = await download;
    const stream = await file.createReadStream();
    const csv = (await new Response(stream as unknown as ReadableStream).text()).replace(/^﻿/, "");
    expect(csv.split("\r\n")[0]).toContain("record_reference");
    expect(csv).toContain(code);
    expect(csv).toContain("approved_and_completed");
    // The row is marked as counting towards verified weight.
    const row = csv.split("\r\n").find((line) => line.startsWith(code));
    expect(row?.endsWith("yes")).toBe(true);
  });
});

test.describe("scenario B: a discrepancy that a reviewer approves", () => {
  test("a materially different weight goes to review and then into verified totals", async ({
    page,
  }) => {
    const code = await captureRecord(page, {
      declaredWeightKg: "20",
      photographName: "scenario-b",
    });

    await confirmReceipt(page, { code, measuredWeightKg: "40", label: "scenario-b" });
    await expect(page.getByRole("heading", { name: "Receipt recorded and flagged" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Review flags").first()).toBeVisible();
    await expect(
      page.getByText(
        /Received weight differs from the declared weight beyond the programme threshold/,
      ),
    ).toBeVisible();
    await expect(page.getByText(/A flag records that a value needs human judgement/)).toBeVisible();

    await recordProcessing(page, "scenario-b");
    await expect(page.getByText("Record sent for review")).toBeVisible({ timeout: 20_000 });

    // The reviewer finds it in the queue and inspects the evidence.
    await page.goto("/en/review/queue");
    await waitForRepository(page);
    await page.getByLabel("Search by reference").fill(code);
    await page.getByRole("link", { name: code }).filter({ visible: true }).first().click();

    await expect(page.getByRole("heading", { name: "Why this record is in review" })).toBeVisible();
    await expect(page.getByRole("term").filter({ hasText: "Weight difference" })).toBeVisible();
    await expect(page.getByText("Handoff photograph").first()).toBeVisible();
    await expect(page.getByText("Weight measurement").first()).toBeVisible();
    await expect(page.getByText("Processing completion").first()).toBeVisible();

    await page.getByRole("radio", { name: /Approve/ }).check();
    await page.getByLabel("Reason code").selectOption("WEIGHT_EXPLAINED");
    await page
      .getByLabel("Reviewer note")
      .fill("The scale photograph matches the recorded weight; the declaration was low.");
    await page.getByRole("button", { name: "Submit the decision" }).first().click();
    await page
      .getByRole("dialog", { name: "Submit this decision?" })
      .getByRole("button", { name: "Submit the decision" })
      .click();

    await expect(
      page.getByText("Record approved. It now counts towards verified recovery."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("This record holds a final decision")).toBeVisible();

    // It has left the queue and appears in verified reporting.
    await page.goto("/en/review/queue");
    await waitForRepository(page);
    await page.getByLabel("Search by reference").fill(code);
    await expect(page.getByText("No record matches the current filters.")).toBeVisible();

    await page.goto("/en/management/reports");
    await expect(page.getByText(/\d+ matching record\(s\)/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Status").selectOption("approved_and_completed");
    await expect(visibleText(page, code)).toBeVisible();
  });
});

test.describe("scenario C: a non-approval outcome", () => {
  test("a rejected record changes state and is excluded from verified totals", async ({ page }) => {
    const code = await captureRecord(page, {
      declaredWeightKg: "20",
      photographName: "scenario-c",
    });
    await confirmReceipt(page, { code, measuredWeightKg: "45", label: "scenario-c" });
    await expect(page.getByRole("heading", { name: "Receipt recorded and flagged" })).toBeVisible({
      timeout: 20_000,
    });
    await recordProcessing(page, "scenario-c");
    await expect(page.getByText("Record sent for review")).toBeVisible({ timeout: 20_000 });

    await page.goto("/en/review/queue");
    await waitForRepository(page);
    await page.getByLabel("Search by reference").fill(code);
    await page.getByRole("link", { name: code }).filter({ visible: true }).first().click();

    await page.getByRole("radio", { name: /Reject/ }).check();
    await page.getByLabel("Reason code").selectOption("WEIGHT_UNEXPLAINED");
    await page
      .getByLabel("Reviewer note")
      .fill("The scale photograph shows a different item; this cannot be verified.");
    await page.getByRole("button", { name: "Submit the decision" }).first().click();
    await page
      .getByRole("dialog", { name: "Submit this decision?" })
      .getByRole("button", { name: "Submit the decision" })
      .click();

    await expect(
      page.getByText("Record rejected. It does not count towards verified recovery."),
    ).toBeVisible({ timeout: 20_000 });

    // Excluded from the verified selection, present in the rejected selection.
    await page.goto("/en/management/reports");
    await expect(page.getByText(/\d+ matching record\(s\)/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Status").selectOption("approved_and_completed");
    await expect(page.getByText(code)).toHaveCount(0);
    await page.getByLabel("Status").selectOption("rejected");
    await expect(visibleText(page, code)).toBeVisible();
  });

  test("a correction request keeps the record under review", async ({ page }) => {
    const code = await captureRecord(page, {
      declaredWeightKg: "20",
      photographName: "scenario-c2",
    });
    await confirmReceipt(page, { code, measuredWeightKg: "45", label: "scenario-c2" });
    await recordProcessing(page, "scenario-c2");
    await expect(page.getByText("Record sent for review")).toBeVisible({ timeout: 20_000 });

    await page.goto("/en/review/queue");
    await waitForRepository(page);
    await page.getByLabel("Search by reference").fill(code);
    await page.getByRole("link", { name: code }).filter({ visible: true }).first().click();

    await page.getByRole("radio", { name: /Request a correction/ }).check();
    await page.getByLabel("Reason code").selectOption("ADDITIONAL_EVIDENCE_REQUIRED");
    await page.getByLabel("Reviewer note").fill("The scale reading is not legible.");
    await page
      .getByLabel("Correction requested")
      .fill("Supply a clear photograph of the scale display.");
    await page.getByRole("button", { name: "Submit the decision" }).first().click();
    await page
      .getByRole("dialog", { name: "Submit this decision?" })
      .getByRole("button", { name: "Submit the decision" })
      .click();

    await expect(page.getByText("Correction requested. The record stays in review.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Awaiting information")).toBeVisible();
  });
});

test.describe("scenario D: safety guidance", () => {
  test("an unapproved card is not served, and a published one is", async ({ page }) => {
    // Portuguese televisions has no seeded card, so the collector starts with the fallback.
    await page.goto("/pt/collector/capture");
    await page
      .locator('input[type="file"][accept^="image/"]')
      .first()
      .setInputFiles(photograph("scenario-d"));
    await expect(page.getByText("2. Confirmar a categoria")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Categoria").first().selectOption("televisions");
    await expect(page.getByText("Sem guia aprovado para este item e idioma").first()).toBeVisible();

    // The safety administrator writes, approves and publishes the missing card.
    await page.goto("/en/administration/safety/cards/new");
    await expect(page.getByRole("heading", { level: 1, name: "New safety card" })).toBeVisible();
    await page.getByLabel("Category").selectOption("televisions");
    await page.getByLabel("Language", { exact: true }).selectOption("pt");

    const questions = [
      "1. What is this item?",
      "2. What may be dangerous inside it?",
      "3. What should I not do?",
      "4. What can I safely do now?",
      "5. Where can I take it?",
    ];
    const answers = [
      "Um televisor com ecra de vidro.",
      "O vidro pode conter chumbo e quebrar em lascas.",
      "Nao parta o ecra nem queime o aparelho.",
      "Mantenha o aparelho em pe e afastado de criancas.",
      "Leve-o a um reciclador verificado pelo programa.",
    ];
    for (const [index, label] of questions.entries()) {
      await page.getByLabel(label).fill(answers[index] ?? "");
    }
    await page.getByLabel("Source 1 title").fill("Basel Convention technical guidelines");
    await page
      .getByLabel("Source 1 reference")
      .fill("Basel Convention Secretariat, e-waste guidelines");

    await page.getByRole("button", { name: "Create the draft" }).click();
    await expect(page).toHaveURL(/\/administration\/safety\/cards\/[0-9a-f-]+$/, {
      timeout: 20_000,
    });
    await expect(page.getByText("Draft created.")).toBeVisible();

    // A draft is still not served.
    await page.goto("/pt/collector/capture");
    await page
      .locator('input[type="file"][accept^="image/"]')
      .first()
      .setInputFiles(photograph("scenario-d"));
    await expect(page.getByText("2. Confirmar a categoria")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Categoria").first().selectOption("televisions");
    await expect(page.getByText("Sem guia aprovado para este item e idioma").first()).toBeVisible();

    // Approve and publish it.
    await page.goto("/en/administration/safety");
    await expect(page.getByText(/\d+ card\(s\)/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Status", { exact: true }).selectOption("draft");
    await page.getByLabel("Language", { exact: true }).selectOption("pt");
    await page.getByRole("link", { name: "Televisions" }).first().click();

    await page.getByRole("tab", { name: "Approval" }).click();
    await page.getByLabel("Approved by").fill("Programme safety review panel");
    await page.getByRole("button", { name: "Record the approval" }).click();
    await page
      .getByRole("dialog", { name: "Record this approval?" })
      .getByRole("button", { name: "Record the approval" })
      .click();
    await expect(page.getByText("Approval recorded.")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("tab", { name: "Approval" }).click();
    await page.getByRole("button", { name: "Publish" }).first().click();
    await page
      .getByRole("dialog", { name: "Publish this card?" })
      .getByRole("button", { name: "Publish" })
      .click();
    await expect(page.getByText("Card published. Collectors see it now.")).toBeVisible({
      timeout: 20_000,
    });

    // The collector now reads the approved Portuguese card.
    await page.goto("/pt/collector/capture");
    await page
      .locator('input[type="file"][accept^="image/"]')
      .first()
      .setInputFiles(photograph("scenario-d"));
    await expect(page.getByText("2. Confirmar a categoria")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Categoria").first().selectOption("televisions");
    await expect(page.getByText("Orientação aprovada").first()).toBeVisible();
    await expect(page.getByText("Um televisor com ecra de vidro.")).toBeVisible();
  });

  test("a language with no approved card shows the referral, not English", async ({ page }) => {
    await page.goto("/ar/collector/capture");
    await page
      .locator('input[type="file"][accept^="image/"]')
      .first()
      .setInputFiles(photograph("scenario-d2"));
    await expect(page.getByText("٢. أكّد الفئة")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("الفئة").first().selectOption("microwaves");
    await expect(page.getByText("لا يوجد دليل معتمد لهذه القطعة وهذه اللغة").first()).toBeVisible();
    await expect(
      page.getByText("اتصل بموقع استلام مُتحقَّق من البرنامج أو بفني مدرَّب."),
    ).toBeVisible();
  });
});

test.describe("scenario E: authorization", () => {
  test("each role's workspace offers only its own destinations", async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === "mobile-chromium";
    const navigationName = mobile ? "Mobile navigation" : "Primary navigation";

    const expectations = [
      { path: "/en/collector", present: "Capture", absent: ["Review Queue", "Safety Cards"] },
      { path: "/en/recycler/intake", present: "Intake", absent: ["Review Queue", "Overview"] },
      { path: "/en/review/queue", present: "Review Queue", absent: ["Intake", "Safety Cards"] },
      { path: "/en/management", present: "Overview", absent: ["Intake", "Review Queue"] },
      {
        path: "/en/administration/safety",
        present: "Safety Cards",
        absent: ["Overview", "Correction Queue"],
      },
      {
        path: "/en/administration/ml",
        present: "Correction Queue",
        absent: ["Overview", "Safety Cards"],
      },
    ] as const;

    for (const { path, present, absent } of expectations) {
      await page.goto(path);
      const navigation = page.getByRole("navigation", { name: navigationName });
      await expect(navigation.getByRole("link", { name: present })).toBeVisible();
      for (const name of absent) {
        await expect(navigation.getByRole("link", { name })).toHaveCount(0);
      }
    }
  });

  test("a reviewer's decision controls are absent on a record a reviewer may not decide", async ({
    page,
  }) => {
    // A record that is not under review is read-only for the reviewer.
    await page.goto("/en/review/decisions");
    await expect(page.getByText(/\d+ decision\(s\)/)).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole("link")
      .filter({ hasText: /^ST-[A-Z0-9]{8}$/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByText("This record holds a final decision").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit the decision" })).toHaveCount(0);
  });

  test("the recycler cannot open processing for a record it has not received", async ({ page }) => {
    await page.goto("/en/recycler/records");
    await waitForRepository(page);
    await page.getByLabel("Status").selectOption("awaiting_handoff");
    await page
      .getByRole("link")
      .filter({ hasText: /^ST-[A-Z0-9]{8}$/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByText("Next step").first()).toBeVisible();
    await expect(
      page.getByText("Scan the collector's code at intake to record receipt."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Record processing details" })).toHaveCount(0);
  });
});
