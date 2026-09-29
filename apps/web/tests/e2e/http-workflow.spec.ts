import { expect, test, type Page } from "@playwright/test";

const API = process.env["NEXT_PUBLIC_API_BASE_URL"] ?? "http://127.0.0.1:8001";
const PASSWORD = process.env["SCRAPTRACE_E2E_DEMO_PASSWORD"];
const image = {
  name: "generated-test-item.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAgElEQVR4nNXOQREAIAzAsFKFyEEOUhGxB9coyNrnUiZxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEufvwNQDG9AB6JVEozMAAAAASUVORK5CYII=",
    "base64",
  ),
};

const responseData = async <T>(response: Awaited<ReturnType<Page["request"]["get"]>>) =>
  ((await response.json()) as { data: T }).data;

const signIn = async (page: Page, username: string) => {
  if (!PASSWORD) throw new Error("SCRAPTRACE_E2E_DEMO_PASSWORD is required");
  const failures: string[] = [];
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(API)) {
      failures.push(
        `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
      );
    }
  });
  await page.goto("/en/sign-in");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  const responsePromise = page.waitForResponse(
    (response) => response.url() === `${API}/v1/auth/sessions`,
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  const response = await responsePromise.catch(() => null);
  expect(
    response,
    failures.join("\n") || "The sign-in request received no response.",
  ).not.toBeNull();
  expect(response!.status(), await response!.text()).toBe(201);
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });
};

const signOut = async (page: Page) => {
  const response = await page.request.delete(`${API}/v1/auth/sessions/current`, {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(204);
};

const uploadImage = async (page: Page, index = 0) => {
  await page.locator('input[type="file"][accept^="image/"]').nth(index).setInputFiles(image);
};

test("real Collector → Recycler → Reviewer journey preserves one authoritative record", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "http-desktop", "The complete journey runs once on desktop.");

  await signIn(page, "collector.demo");
  await page.reload();
  await expect(page).toHaveURL(/\/collector/);

  await page.goto("/en/collector/capture");
  await uploadImage(page);
  await expect(page.getByText("2. Confirm the category")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Category").selectOption("televisions");
  const correction = page.getByLabel("Why is the suggestion wrong?");
  if (await correction.isVisible()) await correction.fill("Confirmed from the visible screen.");
  await page.getByLabel("Condition").selectOption("damaged");
  await page.getByLabel("Number of items").fill("1");
  await page.getByLabel("Approximate weight in kilograms").fill("20");
  const destination = page.getByLabel("Intended receiving location");
  const destinationValue = await destination.locator("option").nth(1).getAttribute("value");
  await destination.selectOption(destinationValue ?? "");

  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page).toHaveURL(/\/collector\/records\/[0-9a-f-]+$/);
  const recordId = page.url().split("/").at(-1)!;
  await page.reload();
  await expect(page.getByText("This record is still a draft")).toBeVisible();
  await page.getByRole("link", { name: "Resume and submit draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/collector/records/${recordId}/edit$`));
  await page.getByRole("button", { name: "Submit this record" }).click();
  await expect(page).toHaveURL(new RegExp(`/collector/records/${recordId}$`));
  await expect(page.getByText("Awaiting Handoff")).toBeVisible();

  const recordResponse = await page.request.get(`${API}/v1/recovery-records/${recordId}`);
  expect(recordResponse.ok()).toBe(true);
  const record = await responseData<{
    human_reference: string;
    original_image_evidence_id: string;
    business_state: string;
  }>(recordResponse);
  expect(record.business_state).toBe("awaiting_handoff");
  expect(JSON.stringify(record)).not.toContain("lookup_token");
  const evidenceResponse = await page.request.get(
    `${API}/v1/evidence/${record.original_image_evidence_id}/content`,
    { headers: { Accept: "image/*" } },
  );
  expect(evidenceResponse.ok()).toBe(true);
  expect(evidenceResponse.headers()["cache-control"]).toContain("no-store");

  const credentialsResponse = await page.request.get(
    `${API}/v1/recovery-records/${recordId}/qr-credentials`,
  );
  expect(credentialsResponse.ok()).toBe(true);
  const credentials = await responseData<{
    qr_payload: { contract_version: string; record_id: string; lookup_token: string };
    manual_transfer_code: string;
  }>(credentialsResponse);
  const qrText = [
    "SCRAPTRACE",
    credentials.qr_payload.contract_version,
    credentials.qr_payload.record_id,
    credentials.qr_payload.lookup_token,
  ].join(":");
  expect(credentials.qr_payload.record_id).toBe(recordId);
  expect(qrText).not.toContain(credentials.manual_transfer_code);

  await signOut(page);
  await signIn(page, "collector-two.demo");
  expect((await page.request.get(`${API}/v1/recovery-records/${recordId}`)).status()).toBe(404);
  expect(
    (
      await page.request.get(`${API}/v1/evidence/${record.original_image_evidence_id}/content`)
    ).status(),
  ).toBe(404);

  await signOut(page);
  await signIn(page, "recycler-ashanti.demo");
  const wrongFacilityLookup = await page.request.post(`${API}/v1/handoff-lookups`, {
    data: { manual_transfer_code: credentials.manual_transfer_code },
  });
  expect(wrongFacilityLookup.status()).toBe(403);

  await signOut(page);
  await signIn(page, "recycler.demo");
  await page.goto("/en/recycler/intake");
  await page.getByLabel("Transfer code").fill(credentials.manual_transfer_code);
  await page.getByRole("button", { name: "Look up this code" }).click();
  await expect(page.getByRole("heading", { name: "Confirm receipt" })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(qrText);
  await page.getByLabel("Received weight").fill("40");
  await page.getByLabel("Final price paid").fill("120");
  await uploadImage(page, 0);
  await uploadImage(page, 1);
  await page.getByRole("button", { name: "Confirm receipt" }).first().click();
  await page
    .getByRole("dialog", { name: "Confirm receipt of this record?" })
    .getByRole("button", { name: "Confirm receipt" })
    .click();
  await expect(page.getByRole("heading", { name: "Receipt recorded and flagged" })).toBeVisible();
  await expect(page.getByText(/differs from the declared weight/)).toBeVisible();

  await page.goto("/en/recycler/intake");
  await page.getByLabel("Transfer code").fill(credentials.manual_transfer_code);
  await page.getByRole("button", { name: "Look up this code" }).click();
  await expect(
    page.getByRole("heading", { name: "This record was already received" }),
  ).toBeVisible();

  await page.goto(`/en/recycler/records/${recordId}`);
  await page.getByRole("link", { name: "Record processing details" }).click();
  await page.getByLabel("Processing method").selectOption("material_recovery");
  await page.getByLabel("Processing result and notes").fill("Recovered material under test.");
  await page.getByRole("textbox", { name: "Material 1" }).fill("Lead glass");
  await page.getByRole("spinbutton", { name: "Weight 1" }).fill("6.5");
  await uploadImage(page);
  await page.getByRole("button", { name: "Submit processing" }).first().click();
  await page
    .getByRole("dialog", { name: "Submit these processing details?" })
    .getByRole("button", { name: "Submit processing" })
    .click();
  await expect(page.getByText("Record sent for review")).toBeVisible();

  await signOut(page);
  await signIn(page, "reviewer.demo");
  await page.goto("/en/review/queue");
  await page
    .getByRole("link", { name: record.human_reference })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByText("Handoff photograph").first()).toBeVisible();
  await page.getByRole("radio", { name: /Approve/ }).check();
  await page.getByLabel("Reason code").selectOption("WEIGHT_EXPLAINED");
  await page.getByLabel("Reviewer note").fill("The scale evidence explains the discrepancy.");
  await page.getByRole("button", { name: "Submit the decision" }).first().click();
  await page
    .getByRole("dialog", { name: "Submit this decision?" })
    .getByRole("button", { name: "Submit the decision" })
    .click();
  await expect(page.getByText(/Record approved/)).toBeVisible();
  await expect(page.getByText("This record holds a final decision")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit the decision" })).toHaveCount(0);

  const finalRecord = await responseData<{ record_id: string; business_state: string }>(
    await page.request.get(`${API}/v1/recovery-records/${recordId}`),
  );
  expect(finalRecord).toMatchObject({
    record_id: recordId,
    business_state: "approved_and_completed",
  });
});

test("HTTP mode restores sessions and renders every supported locale", async ({ page }) => {
  await signIn(page, "collector.demo");
  for (const locale of ["en", "fr", "ar", "pt"] as const) {
    await page.goto(`/${locale}/collector`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    if (locale === "ar") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  }
  await page.reload();
  await expect(page).toHaveURL(/\/pt\/collector/);
});

test("isolated reviewer decisions reject and request correction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "http-desktop", "Review decisions run once on desktop.");
  await signIn(page, "reviewer.demo");

  const rejectedId = "0199c009-0009-7009-8009-000000000009";
  await page.goto(`/en/review/queue/${rejectedId}`);
  await expect(page.getByRole("heading", { name: "Why this record is in review" })).toBeVisible();
  await page.getByRole("radio", { name: /Reject/ }).check();
  await page.getByLabel("Reason code").selectOption("WEIGHT_UNEXPLAINED");
  await page
    .getByLabel("Reviewer note")
    .fill("The submitted scale evidence does not explain the weight.");
  const decisionRequest = page.waitForRequest(
    (request) => request.url() === `${API}/v1/review-decisions` && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Submit the decision" }).first().click();
  await page
    .getByRole("dialog", { name: "Submit this decision?" })
    .getByRole("button", { name: "Submit the decision" })
    .click();
  const posted = (await decisionRequest).postDataJSON() as {
    idempotency: { idempotency_key: string };
  };
  await expect(page.getByText(/Record rejected/)).toBeVisible();
  const repeated = await page.request.post(`${API}/v1/review-decisions`, {
    data: {
      ...posted,
      idempotency: {
        ...posted.idempotency,
        idempotency_key: `${posted.idempotency.idempotency_key}-again`,
      },
    },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(repeated.status()).toBe(409);
  const rejected = await responseData<{ business_state: string }>(
    await page.request.get(`${API}/v1/recovery-records/${rejectedId}`),
  );
  expect(rejected.business_state).toBe("rejected");

  const correctionId = "0199c008-0008-7008-8008-000000000008";
  await page.goto(`/en/review/queue/${correctionId}`);
  await expect(page.getByRole("heading", { name: "Why this record is in review" })).toBeVisible();
  await page.getByRole("radio", { name: /Request a correction/ }).check();
  await page.getByLabel("Reason code").selectOption("ADDITIONAL_EVIDENCE_REQUIRED");
  await page.getByLabel("Reviewer note").fill("The scale display cannot be read.");
  await page.getByLabel("Correction requested").fill("Supply a clear scale photograph.");
  await page.getByRole("button", { name: "Submit the decision" }).first().click();
  await page
    .getByRole("dialog", { name: "Submit this decision?" })
    .getByRole("button", { name: "Submit the decision" })
    .click();
  await expect(page.getByText("Correction requested. The record stays in review.")).toBeVisible();
  const corrected = await responseData<{
    business_state: string;
    review: { review_state: string };
  }>(await page.request.get(`${API}/v1/recovery-records/${correctionId}`));
  expect(corrected.business_state).toBe("under_review");
  expect(corrected.review.review_state).toBe("awaiting_information");
});

test("mobile collector appraises, confirms and submits to the real API", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "http-mobile", "Mobile capture runs on the mobile viewport.");
  await signIn(page, "collector.demo");
  await page.goto("/en/collector/capture");
  const appraisalRequest = page.waitForResponse(
    (response) => response.url() === `${API}/v1/vision/appraise` && response.status() === 200,
  );
  await uploadImage(page);
  const appraisal = await appraisalRequest;
  const prediction = (await appraisal.json()) as { outcome: string; model_version: string };
  expect(["classified", "unable_to_classify"]).toContain(prediction.outcome);
  expect(prediction.model_version).toBeTruthy();
  await expect(page.getByText("2. Confirm the category")).toBeVisible();
  await page.getByLabel("Category").selectOption("televisions");
  const correction = page.getByLabel("Why is the suggestion wrong?");
  if (await correction.isVisible())
    await correction.fill("Manually verified on the mobile screen.");
  await page.getByLabel("Condition").selectOption("damaged");
  await page.getByLabel("Number of items").fill("1");
  await page.getByLabel("Approximate weight in kilograms").fill("16");
  const destination = page.getByLabel("Intended receiving location");
  const destinationValue = await destination.locator("option").nth(1).getAttribute("value");
  await destination.selectOption(destinationValue ?? "");
  await page.getByRole("button", { name: "Submit this record" }).click();
  await expect(page).toHaveURL(/\/collector\/records\/[0-9a-f-]+$/, { timeout: 30_000 });
  const recordId = page.url().split("/").at(-1)!;
  const record = await responseData<{ business_state: string; vision_result?: object }>(
    await page.request.get(`${API}/v1/recovery-records/${recordId}`),
  );
  expect(record.business_state).toBe("awaiting_handoff");
  if (prediction.outcome === "classified") expect(record.vision_result).toBeDefined();
});
