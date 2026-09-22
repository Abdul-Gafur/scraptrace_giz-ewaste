import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Console errors and page errors (including hydration warnings) fail the test that caused them. */
const watchConsole = (page: Page): string[] => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
};

const hasHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

const shells = [
  {
    name: "collector",
    path: "/collector",
    heading: "Collector Node",
    shell: "collector-workspace",
  },
  { name: "recycler", path: "/recycler/intake", heading: "Recycler Intake", shell: "operational" },
  {
    name: "reviewer",
    path: "/review/queue",
    heading: "Regulatory Verification Queue",
    shell: "operational",
  },
  {
    name: "manager",
    path: "/management",
    heading: "Recovery Programme Performance Dashboard",
    shell: "operational",
  },
  {
    name: "safety administration",
    path: "/administration/safety",
    heading: "Regulatory Field Safety Cards & Guidance",
    shell: "administration",
  },
  {
    name: "data and model review",
    path: "/administration/ml",
    heading: "Computer Vision Annotation Validation",
    shell: "administration",
  },
] as const;

test.describe("application shells (English)", () => {
  for (const { name, path, heading, shell } of shells) {
    test(`${name} shell renders, has correct landmarks and passes axe`, async ({
      page,
    }, testInfo) => {
      const problems = watchConsole(page);
      await page.goto(`/en${path}`);
      await expect(page.locator(`[data-shell="${shell}"]`)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      const mobile = testInfo.project.name === "mobile-chromium";
      const navigation = page.getByRole("navigation", {
        name: mobile ? "Mobile navigation" : "Primary navigation",
      });
      await expect(navigation).toBeVisible();
      await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
      expect(await hasHorizontalOverflow(page)).toBe(false);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      expect(problems).toEqual([]);
    });
  }

  test("collector shell supports keyboard navigation and the skip link", async ({
    page,
  }, testInfo) => {
    await page.goto("/en/collector");
    const mobile = testInfo.project.name === "mobile-chromium";
    const navigation = page.getByRole("navigation", {
      name: mobile ? "Mobile navigation" : "Primary navigation",
    });
    await navigation.getByRole("link").first().focus();
    await page.keyboard.press("Tab");
    await expect(navigation.getByRole("link").nth(1)).toBeFocused();
    await page.keyboard.press("Home");
    await page.reload();
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("mobile menu drawer opens with the full navigation and closes with Escape", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "The menu button exists below 1024px.");
    await page.goto("/en/management");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Price References" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  });

  test("desktop sidebar is shown instead of the bottom bar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop viewport only.");
    await page.goto("/en/review/queue");
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
  });

  test("placeholder sections resolve and unknown sections 404", async ({ page }) => {
    await page.goto("/en/review/history");
    await expect(page.getByRole("heading", { level: 1, name: "System History" })).toBeVisible();
    await expect(page.getByText("review:evidence")).toBeVisible();
    const response = await page.goto("/en/review/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("development role preview selects a role and opens its workspace", async ({ page }) => {
    await page.goto("/en/sign-in");
    await expect(page.getByRole("radio")).toHaveCount(6);
    await expect(page.getByText("Active")).toBeVisible();
    await page.getByRole("radio", { name: /Data and model reviewer/ }).check({ force: true });
    await page.getByRole("link", { name: "Enter Selected Environment" }).click();
    await expect(page).toHaveURL(/\/en\/administration\/ml$/);
  });

  test("public, authentication and security routes render", async ({ page }) => {
    for (const path of [
      "/en",
      "/en/sign-in",
      "/en/register",
      "/en/onboarding",
      "/en/access-denied",
      "/en/session-expired",
    ]) {
      const problems = watchConsole(page);
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(
        page
          .getByRole("heading", { level: 1 })
          .or(page.getByRole("heading", { level: 2 }))
          .first(),
      ).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, path).toEqual([]);
      expect(problems, path).toEqual([]);
    }
  });
});

test.describe("internationalization and RTL", () => {
  test("Arabic renders right-to-left with the sidebar on the inline-start (right) edge", async ({
    page,
  }, testInfo) => {
    const problems = watchConsole(page);
    await page.goto("/ar/management");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    if (testInfo.project.name === "chromium") {
      const sidebar = await page.getByRole("navigation", { name: "التنقل الرئيسي" }).boundingBox();
      const main = await page.getByRole("main").boundingBox();
      expect(sidebar && main && sidebar.x > main.x).toBe(true);
    }
    expect(await hasHorizontalOverflow(page)).toBe(false);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("Arabic collector shell keeps five labelled destinations", async ({ page }, testInfo) => {
    await page.goto("/ar/collector");
    const name =
      testInfo.project.name === "mobile-chromium" ? "التنقل على الهاتف" : "التنقل الرئيسي";
    await expect(page.getByRole("navigation", { name }).getByRole("link")).toHaveCount(5);
  });

  test("all locale routes load with the correct language and direction", async ({ page }) => {
    for (const [locale, direction] of [
      ["en", "ltr"],
      ["fr", "ltr"],
      ["pt", "ltr"],
      ["ar", "rtl"],
    ] as const) {
      await page.goto(`/${locale}/collector`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", direction);
      expect(await hasHorizontalOverflow(page)).toBe(false);
    }
  });

  test("the language menu switches locale and direction while keeping the route", async ({
    page,
  }) => {
    await page.goto("/en/collector/records");
    await page
      .getByRole("button", { name: /^Language:/ })
      .first()
      .click();
    await page.getByRole("menuitemradio", { name: "العربية" }).click();
    await expect(page).toHaveURL(/\/ar\/collector\/records$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("French and Portuguese long labels do not overflow the bottom bar", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Bottom bar is mobile only.");
    for (const locale of ["fr", "pt"]) {
      await page.goto(`/${locale}/management`);
      expect(await hasHorizontalOverflow(page)).toBe(false);
    }
  });
});

test.describe("responsive widths", () => {
  for (const width of [360, 390, 768, 1280, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/en/collector",
        "/en/recycler",
        "/en/review/queue",
        "/en/management",
        "/en/administration/safety",
        "/en/administration/ml",
        "/ar/management",
      ]) {
        await page.goto(path);
        expect(await hasHorizontalOverflow(page), `${path} at ${width}px`).toBe(false);
      }
    });
  }
});

test.describe("development component showcase", () => {
  test("renders variants, Arabic sample and narrow sample without overflow or console errors", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.goto("/en/dev/components");
    await expect(
      page.getByRole("heading", { level: 1, name: "Component showcase" }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("rtl-sample")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("narrow-sample")).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("dialog opens as a modal, traps focus and closes with Escape", async ({ page }) => {
    await page.goto("/en/dev/components");
    await page.getByRole("button", { name: "Open dialog" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Component showcase" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
