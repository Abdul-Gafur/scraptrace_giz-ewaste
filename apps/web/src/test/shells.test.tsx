import { UserRoleSchema, type UserRole } from "@scraptrace/contracts";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import { AdministrationShell } from "@/components/layout/administration-shell";
import { AppShell } from "@/components/layout/app-shell";
import { AuthShell } from "@/components/layout/auth-shell";
import { CollectorShell } from "@/components/layout/collector-shell";
import { OperationalShell } from "@/components/layout/operational-shell";
import { PublicShell } from "@/components/layout/public-shell";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { getNavigationForRole, ROLE_WORKSPACES } from "@/navigation/navigation-config";

import { navigationState } from "./navigation-mock";
import { bundles, renderWithIntl } from "./render";

vi.mock("@/i18n/navigation", async () => (await import("./navigation-mock")).navigationMock);

const role = UserRoleSchema.enum;

beforeEach(() => {
  navigationState.pathname = "/";
  navigationState.replace.mockClear();
});

const mobileNavigation = () => screen.getByRole("navigation", { name: "Mobile navigation" });
const sidebar = () => screen.getByRole("navigation", { name: "Primary navigation" });

describe("collector shell", () => {
  it("renders bottom navigation with the five Figma destinations and marks the current page", () => {
    navigationState.pathname = "/collector/records";
    renderWithIntl(
      <CollectorShell>
        <h1>Records</h1>
      </CollectorShell>,
    );
    const links = within(mobileNavigation()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Home",
      "Capture",
      "Records",
      "Nearby",
      "Account",
    ]);
    expect(within(mobileNavigation()).getByRole("link", { name: "Records" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(mobileNavigation()).getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("provides a main landmark, desktop sidebar and breadcrumb", () => {
    navigationState.pathname = "/collector/capture";
    renderWithIntl(
      <CollectorShell>
        <h1>Capture</h1>
      </CollectorShell>,
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(within(sidebar()).getAllByRole("link")).toHaveLength(5);
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByText("Capture")).toHaveAttribute("aria-current", "page");
  });

  it("opens the mobile menu drawer with the full navigation", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
    renderWithIntl(
      <CollectorShell>
        <h1>Home</h1>
      </CollectorShell>,
    );
    const open = screen.getByRole("button", { name: "Open navigation" });
    await userEvent.click(open);
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    expect(within(drawer).getByRole("navigation", { name: "Menu navigation" })).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "Sign out" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });
});

describe("operational and administration shells", () => {
  it.each([
    [
      role.recycler,
      "/recycler/intake",
      ["Intake", "Received", "Processing", "Account"],
      "operational",
    ],
    [
      role.programme_reviewer,
      "/review/queue",
      ["Review Queue", "Assigned Records", "Decisions Audit", "System History"],
      "operational",
    ],
    [role.programme_manager, "/management", ["Overview", "Records Ledger"], "operational"],
    [
      role.safety_content_administrator,
      "/administration/safety",
      ["Safety Cards", "Translations", "Approval Queue", "Published Content"],
      "administration",
    ],
    [
      role.data_ml_reviewer,
      "/administration/ml",
      ["Correction Queue", "Approved Labels", "Model Information", "Data Exports"],
      "administration",
    ],
  ] as const)("renders the %s workspace", (userRole, pathname, labels, kind) => {
    navigationState.pathname = pathname;
    const Shell = kind === "administration" ? AdministrationShell : OperationalShell;
    const { container } = renderWithIntl(
      <Shell role={userRole}>
        <h1>Title</h1>
      </Shell>,
    );
    expect(container.querySelector(`[data-shell="${kind}"]`)).not.toBeNull();
    const links = within(sidebar()).getAllByRole("link");
    for (const label of labels) {
      expect(links.some((link) => link.textContent === label)).toBe(true);
    }
    expect(
      within(sidebar())
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page"),
    ).toHaveLength(1);
    expect(screen.getAllByText(bundles.en.roles[userRole]).length).toBeGreaterThan(0);
  });

  it("never renders navigation belonging to another role", () => {
    navigationState.pathname = "/review/queue";
    renderWithIntl(
      <OperationalShell role={role.programme_reviewer}>
        <h1>Queue</h1>
      </OperationalShell>,
    );
    const hrefs = within(sidebar())
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs.every((href) => href?.startsWith("/review"))).toBe(true);
  });

  // Six shells, each mounted with its providers and then scanned by axe: slower than the
  // default per-test budget allows.
  it("previews every role through the shared frame without accessibility violations", async () => {
    for (const userRole of UserRoleSchema.options) {
      navigationState.pathname = ROLE_WORKSPACES[userRole].home;
      const { container, unmount } = renderWithIntl(
        <AppShell kind={ROLE_WORKSPACES[userRole].shell} role={userRole}>
          <h1>Title</h1>
        </AppShell>,
      );
      expect(getNavigationForRole(userRole).length).toBeGreaterThan(0);
      // jsdom applies no responsive CSS, so both breakpoint-specific headers are present at
      // once. Landmark uniqueness is verified in a real browser by the Playwright axe run.
      const results = await axe(container, {
        rules: {
          "landmark-no-duplicate-banner": { enabled: false },
          "landmark-unique": { enabled: false },
        },
      });
      expect(results).toHaveNoViolations();
      unmount();
    }
  }, 30_000);
});

describe("public and authentication shells", () => {
  it("render brand, language control and a main landmark", () => {
    const { unmount } = renderWithIntl(
      <PublicShell>
        <h1>Welcome</h1>
      </PublicShell>,
    );
    expect(screen.getByRole("link", { name: "ScrapTrace" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Language: English" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    unmount();
    renderWithIntl(
      <AuthShell>
        <h1>Sign in</h1>
      </AuthShell>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

describe("language switching and RTL", () => {
  it("lists all four languages, marks the current one and switches locale", async () => {
    navigationState.pathname = "/collector";
    renderWithIntl(<LanguageSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Language: English" }));
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "English",
      "Français",
      "العربية",
      "Português",
    ]);
    expect(items[0]).toHaveAttribute("aria-checked", "true");
    await userEvent.click(items[2]!);
    expect(navigationState.replace).toHaveBeenCalledWith("/collector", { locale: "ar" });
  });

  it("renders the collector shell with Arabic navigation labels", () => {
    navigationState.pathname = "/collector";
    renderWithIntl(
      <CollectorShell>
        <h1>الرئيسية</h1>
      </CollectorShell>,
      "ar",
    );
    const labels = within(
      screen.getByRole("navigation", { name: bundles.ar.shell.mobileNavigation }),
    )
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual([
      bundles.ar.navigation.home,
      bundles.ar.navigation.capture,
      bundles.ar.navigation.records,
      bundles.ar.navigation.locations,
      bundles.ar.navigation.profile,
    ]);
  });

  it("renders French and Portuguese navigation without missing messages", () => {
    for (const locale of ["fr", "pt"] as const) {
      navigationState.pathname = "/management";
      const { unmount } = renderWithIntl(
        <OperationalShell role={role.programme_manager as UserRole}>
          <h1>x</h1>
        </OperationalShell>,
        locale,
      );
      const labels = within(
        screen.getByRole("navigation", { name: bundles[locale].shell.primaryNavigation }),
      )
        .getAllByRole("link")
        .map((link) => link.textContent);
      expect(labels).toContain(bundles[locale].navigation.recordsLedger);
      unmount();
    }
  });
});
