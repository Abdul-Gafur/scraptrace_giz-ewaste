import {
  EvidenceIdSchema,
  UserRoleSchema,
  VisionAppraisalResponseSchema,
  getLanguageDirection,
} from "@scraptrace/contracts";
import { NextIntlClientProvider } from "next-intl";
import { axe } from "jest-axe";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import pt from "../../messages/pt.json";
import { canEnterRoute } from "@/auth/route-policy";
import { StatusPanel } from "@/components/feedback/status-panel";
import { PageHeading } from "@/components/ui/content";
import { DemoAccessForm } from "@/features/authentication/demo-access-form";
import { createMockServices } from "@/services/mocks/mock-services";
import { FIXTURE_IDS } from "@/services/mocks/deterministic-fixtures";

const keys = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keys(nested, prefix ? `${prefix}.${key}` : key),
  );
};

describe("frontend foundation", () => {
  it("renders the application page foundation", () => {
    render(<PageHeading description="Foundation description">Collector home</PageHeading>);
    expect(screen.getByRole("heading", { name: "Collector home" })).toBeInTheDocument();
    expect(screen.getByText("Foundation description")).toBeInTheDocument();
  });

  it("loads all locale bundles with the same required keys", () => {
    const expected = keys(en).sort();
    expect(keys(fr).sort()).toEqual(expected);
    expect(keys(ar).sort()).toEqual(expected);
    expect(keys(pt).sort()).toEqual(expected);
  });

  it("uses RTL for Arabic and LTR for the other supported languages", () => {
    expect(getLanguageDirection("ar")).toBe("rtl");
    expect(getLanguageDirection("en")).toBe("ltr");
    expect(getLanguageDirection("fr")).toBe("ltr");
    expect(getLanguageDirection("pt")).toBe("ltr");
  });

  it("imports a contract schema and validates the mock vision response", async () => {
    const response = await createMockServices({ delayMilliseconds: 0 }).vision.appraise({
      evidence_id: EvidenceIdSchema.parse(FIXTURE_IDS.evidence),
    });
    expect(VisionAppraisalResponseSchema.safeParse(response).success).toBe(true);
  });

  it("rejects a contract-invalid fixture", () => {
    expect(
      VisionAppraisalResponseSchema.safeParse({ outcome: "classified", category: "unknown" })
        .success,
    ).toBe(false);
  });

  it("evaluates centralized route roles and permissions", () => {
    const allowed = canEnterRoute({
      path: "/en/recycler",
      userRole: UserRoleSchema.enum.recycler,
      context: {
        owns_resource: false,
        assigned_programme: false,
        assigned_facility: true,
        assigned_review: false,
        personal_data_required: false,
      },
    });
    const denied = canEnterRoute({
      path: "/en/recycler",
      userRole: UserRoleSchema.enum.collector,
      context: {
        owns_resource: true,
        assigned_programme: false,
        assigned_facility: false,
        assigned_review: false,
        personal_data_required: false,
      },
    });
    expect(allowed).toBe(true);
    expect(denied).toBe(false);
  });

  it("renders a screen-reader-friendly permission denied state", () => {
    render(
      <StatusPanel tone="permission" title="Access restricted" description="Not available." />,
    );
    expect(screen.getByRole("heading", { name: "Access restricted" })).toBeInTheDocument();
  });

  it("renders a recoverable error state", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(
      <StatusPanel
        tone="error"
        title="Could not load"
        description="Try again."
        actionLabel="Retry"
        onAction={retry}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("provides accessible form validation and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <DemoAccessForm />
      </NextIntlClientProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const input = screen.getByRole("textbox", { name: "Development access code" });
    expect(input).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a development access code.");
  });
});
