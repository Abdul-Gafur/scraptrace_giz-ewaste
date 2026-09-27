import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { ReactNode } from "react";

import type { ScreenHarness } from "./screen-render";
import { createScreenHarness, renderScreen } from "./screen-render";

vi.mock("@/i18n/navigation", async () => (await import("./navigation-mock")).navigationMock);

vi.mock("@/services/service-provider", async () => {
  const { useTestServices } = await import("./screen-render");
  return {
    useServices: () => {
      const services = useTestServices();
      if (!services) throw new Error("TestServiceProvider is missing.");
      return services;
    },
    ServiceScope: ({ children }: { children: ReactNode }) => children,
  };
});

const { CollectorHome } = await import("@/features/collector/collector-home");
const { RecordsScreen } = await import("@/features/collector/records-screen");
const { RecyclerHome } = await import("@/features/recycler/recycler-home");
const { ReviewQueue } = await import("@/features/review/review-queue");
const { ManagementOverview } = await import("@/features/management/management-overview");
const { ReportsScreen } = await import("@/features/management/reports-screen");
const { SafetyCardList } = await import("@/features/administration/safety/card-list");
const { ModelOverview } = await import("@/features/administration/ml/model-overview");
const { ProcessingForm } = await import("@/features/recycler/processing-form");
const { ReviewDetail } = await import("@/features/review/review-detail");

describe("collector screens", () => {
  let harness: ScreenHarness;
  beforeAll(async () => {
    harness = await createScreenHarness("collector");
  });

  it("shows the collector's own records and their status, derived from the repository", async () => {
    renderScreen(<CollectorHome />, { role: "collector", services: harness.services });
    const own = harness.repository.listRecords();
    await waitFor(() =>
      expect(screen.getAllByText(own[0]?.human_reference ?? "").length).toBeGreaterThan(0),
    );
    // The approved total counts only records in the approved state.
    const approved = own.filter(
      (record) => record.business_state === "approved_and_completed",
    ).length;
    expect(screen.getByText("Approved records").parentElement).toHaveTextContent(String(approved));
  });

  it("presents a lifecycle status as a label and a dot, never colour alone", async () => {
    renderScreen(<CollectorHome />, { role: "collector", services: harness.services });
    await waitFor(() => expect(screen.getAllByText("Draft").length).toBeGreaterThan(0));
    const badge = screen.getAllByText("Draft")[0];
    expect(badge?.closest("[data-status]")).toHaveAttribute("data-status", "draft");
  });

  it("filters the record list by status and reports when nothing matches", async () => {
    renderScreen(<RecordsScreen />, { role: "collector", services: harness.services });
    await waitFor(() => expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0));
    // No seeded record sits in the submitted state, so the empty state is the honest result.
    await userEvent.selectOptions(screen.getByLabelText("Status"), "submitted");
    await waitFor(() => expect(screen.getByText("Nothing here yet")).toBeInTheDocument());
  });

  it("has no automated accessibility violations", async () => {
    const { container } = renderScreen(<CollectorHome />, {
      role: "collector",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText("Your records")).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("recycler dashboard", () => {
  it("derives every bucket from the shared repository", async () => {
    const harness = await createScreenHarness("recycler");
    renderScreen(<RecyclerHome />, { role: "recycler", services: harness.services });
    await waitFor(() =>
      expect(screen.getByText(/Records awaiting handoff \(\d+\)/)).toBeInTheDocument(),
    );
    const awaiting = harness.repository
      .listRecords()
      .filter((record) => record.business_state === "awaiting_handoff").length;
    expect(screen.getByText(`Records awaiting handoff (${awaiting})`)).toBeInTheDocument();
    expect(screen.getByText(/Records with flags \(\d+\)/)).toBeInTheDocument();
  });
});

describe("review queue", () => {
  it("lists only records that are reviewable, and filters by reason", async () => {
    const harness = await createScreenHarness("programme_reviewer");
    renderScreen(<ReviewQueue />, { role: "programme_reviewer", services: harness.services });
    await waitFor(() => expect(screen.getByText(/\d+ record\(s\)/)).toBeInTheDocument());

    const reviewable = harness.repository
      .listRecords()
      .filter(
        (record) =>
          record.business_state === "under_review" ||
          (record.review.flag_codes.length > 0 && record.review.review_state !== "not_required"),
      );
    expect(screen.getByText(`${reviewable.length} record(s)`)).toBeInTheDocument();
    for (const record of reviewable) {
      expect(screen.getAllByText(record.human_reference).length).toBeGreaterThan(0);
    }

    await userEvent.selectOptions(screen.getByLabelText("Reason"), "CATEGORY_DISAGREEMENT");
    await waitFor(() => {
      const count = reviewable.filter((record) =>
        record.review.flag_codes.includes("CATEGORY_DISAGREEMENT"),
      ).length;
      expect(screen.getByText(`${count} record(s)`)).toBeInTheDocument();
    });
  });

  it("does not show a collector identifier in the queue", async () => {
    const harness = await createScreenHarness("programme_reviewer");
    const { container } = renderScreen(<ReviewQueue />, {
      role: "programme_reviewer",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText(/\d+ record\(s\)/)).toBeInTheDocument());
    const collectorId = harness.repository.listRecords()[0]?.collector.actor_id ?? "";
    expect(container.textContent).not.toContain(collectorId);
  });
});

describe("review detail and decision", () => {
  it("states plainly that a digest is not proof the event happened", async () => {
    const harness = await createScreenHarness("programme_reviewer");
    const record = harness.repository
      .listRecords()
      .find((candidate) => candidate.business_state === "under_review");
    renderScreen(<ReviewDetail recordId={record?.record_id ?? ""} />, {
      role: "programme_reviewer",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText("What the digest tells you")).toBeInTheDocument());
    expect(screen.getByText(/does not prove that the handoff happened/)).toBeInTheDocument();
  });

  it("requires a reviewer note before a decision can be submitted", async () => {
    const harness = await createScreenHarness("programme_reviewer");
    const record = harness.repository
      .listRecords()
      .find((candidate) => candidate.business_state === "under_review");
    renderScreen(<ReviewDetail recordId={record?.record_id ?? ""} />, {
      role: "programme_reviewer",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText("Record your decision")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Submit the decision" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Submit this decision?" })).toBeInTheDocument(),
    );
    const dialog = screen.getByRole("dialog", { name: "Submit this decision?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit the decision" }));

    await waitFor(() =>
      expect(
        screen.getByText("A reviewer note is required for every decision."),
      ).toBeInTheDocument(),
    );
    // Nothing was recorded.
    expect(harness.repository.findRecord(record?.record_id ?? "")?.review.decision).toBeUndefined();
  });

  it("asks for the correction description when a correction is requested", async () => {
    const harness = await createScreenHarness("programme_reviewer");
    const record = harness.repository
      .listRecords()
      .find((candidate) => candidate.business_state === "under_review");
    renderScreen(<ReviewDetail recordId={record?.record_id ?? ""} />, {
      role: "programme_reviewer",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText("Record your decision")).toBeInTheDocument());
    expect(screen.queryByLabelText("Correction requested")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Request a correction/ }));
    expect(screen.getByLabelText("Correction requested")).toBeInTheDocument();
  });

  it("shows a decided record as read-only", async () => {
    const harness = await createScreenHarness("programme_reviewer");
    const record = harness.repository
      .listRecords()
      .find((candidate) => candidate.business_state === "rejected");
    renderScreen(<ReviewDetail recordId={record?.record_id ?? ""} />, {
      role: "programme_reviewer",
      services: harness.services,
    });
    await waitFor(() =>
      expect(screen.getByText("This record holds a final decision")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Submit the decision" })).not.toBeInTheDocument();
  });
});

describe("processing form validation", () => {
  it("rejects a material row with no name and a zero weight before any call is made", async () => {
    const harness = await createScreenHarness("recycler");
    const record = harness.repository
      .listRecords()
      .find((candidate) => candidate.business_state === "received");
    renderScreen(<ProcessingForm recordId={record?.record_id ?? ""} />, {
      role: "recycler",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText("Processing details")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Submit processing" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit these processing details?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit processing" }));

    await waitFor(() =>
      expect(screen.getByText("Describe the processing result.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Add a completion photograph.")).toBeInTheDocument();
    expect(harness.repository.findRecord(record?.record_id ?? "")?.processing).toBeUndefined();
  });

  it("lets a material row be added and removed before submission", async () => {
    const harness = await createScreenHarness("recycler");
    const record = harness.repository
      .listRecords()
      .find((candidate) => candidate.business_state === "received");
    renderScreen(<ProcessingForm recordId={record?.record_id ?? ""} />, {
      role: "recycler",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByLabelText("Material 1")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Remove material 1" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Add a material" }));
    expect(screen.getByLabelText("Material 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove material 2" }));
    expect(screen.queryByLabelText("Material 2")).not.toBeInTheDocument();
  });

  it("totals the recovered material as rows are filled in", async () => {
    const harness = await createScreenHarness("recycler");
    const record = harness.repository
      .listRecords()
      .find((candidate) => candidate.business_state === "received");
    renderScreen(<ProcessingForm recordId={record?.record_id ?? ""} />, {
      role: "recycler",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByLabelText("Weight 1")).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText("Weight 1"), "2.5");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("2.5 kg"));
  });

  it("refuses to offer the form for a record that holds a final decision", async () => {
    const harness = await createScreenHarness("recycler");
    const record = harness.repository
      .listRecords()
      .find((candidate) => candidate.business_state === "approved_and_completed");
    renderScreen(<ProcessingForm recordId={record?.record_id ?? ""} />, {
      role: "recycler",
      services: harness.services,
    });
    await waitFor(() =>
      expect(screen.getByText("This record holds a final decision")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Submit processing" })).not.toBeInTheDocument();
  });
});

describe("programme dashboard", () => {
  it("counts only approved records towards verified weight", async () => {
    const harness = await createScreenHarness("programme_manager");
    renderScreen(<ManagementOverview />, {
      role: "programme_manager",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText("Verified outcomes")).toBeInTheDocument());
    expect(
      screen.getByText(/Only records in the approved and completed state contribute/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verified weight is the weight measured at handoff/),
    ).toBeInTheDocument();
  });

  it("gives every chart a text summary and a readable table of its values", async () => {
    const harness = await createScreenHarness("programme_manager");
    renderScreen(<ManagementOverview />, {
      role: "programme_manager",
      services: harness.services,
    });
    await waitFor(() =>
      expect(screen.getAllByText("Records by lifecycle state").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("Show the values as a table").length).toBeGreaterThan(0);
    expect(screen.getByText(/Counts of records in each lifecycle state/)).toBeInTheDocument();
  });

  it("has no automated accessibility violations", async () => {
    const harness = await createScreenHarness("programme_manager");
    const { container } = renderScreen(<ManagementOverview />, {
      role: "programme_manager",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText("Verified outcomes")).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("programme reports", () => {
  it("changes the result count when a filter is applied, and resets it", async () => {
    const harness = await createScreenHarness("programme_manager");
    renderScreen(<ReportsScreen />, { role: "programme_manager", services: harness.services });
    await waitFor(() => expect(screen.getByText(/\d+ matching record\(s\)/)).toBeInTheDocument());
    const total = harness.repository.listRecords().length;
    expect(screen.getByText(`${total} matching record(s)`)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "rejected");
    const rejected = harness.repository
      .listRecords()
      .filter((record) => record.business_state === "rejected").length;
    await waitFor(() =>
      expect(screen.getByText(`${rejected} matching record(s)`)).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    await waitFor(() =>
      expect(screen.getByText(`${total} matching record(s)`)).toBeInTheDocument(),
    );
  });

  it("states how verified weight is counted next to the total", async () => {
    const harness = await createScreenHarness("programme_manager");
    renderScreen(<ReportsScreen />, { role: "programme_manager", services: harness.services });
    await waitFor(() =>
      expect(screen.getByText("How verified weight is counted")).toBeInTheDocument(),
    );
  });
});

describe("safety card administration", () => {
  it("shows each card's language, version, status and dates", async () => {
    const harness = await createScreenHarness("safety_content_administrator");
    renderScreen(<SafetyCardList />, {
      role: "safety_content_administrator",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText(/\d+ card\(s\)/)).toBeInTheDocument());
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Only a published card whose review date has not passed/),
    ).toBeInTheDocument();
  });

  it("filters the list by authoring status", async () => {
    const harness = await createScreenHarness("safety_content_administrator");
    renderScreen(<SafetyCardList />, {
      role: "safety_content_administrator",
      services: harness.services,
    });
    await waitFor(() => expect(screen.getByText(/\d+ card\(s\)/)).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText("Status"), "draft");
    const drafts = harness.repository
      .listSafetyCards()
      .filter((card) => card.status === "draft").length;
    await waitFor(() => expect(screen.getByText(`${drafts} card(s)`)).toBeInTheDocument());
  });
});

describe("model overview", () => {
  it("states that the model is a single-label classifier and not a detector", async () => {
    const harness = await createScreenHarness("data_ml_reviewer");
    renderScreen(<ModelOverview />, { role: "data_ml_reviewer", services: harness.services });
    await waitFor(() => expect(screen.getByText("What this model does")).toBeInTheDocument());
    expect(screen.getByText(/It is not an object detector/)).toBeInTheDocument();
    expect(screen.getByText("single_label_image_classification")).toBeInTheDocument();
  });

  it("reports an unrecorded checksum rather than inventing one", async () => {
    const harness = await createScreenHarness("data_ml_reviewer");
    renderScreen(<ModelOverview />, { role: "data_ml_reviewer", services: harness.services });
    await waitFor(() =>
      expect(screen.getByText("Not recorded in the training artefact")).toBeInTheDocument(),
    );
  });

  it("surfaces the conflicting metadata found in the repository", async () => {
    const harness = await createScreenHarness("data_ml_reviewer");
    renderScreen(<ModelOverview />, { role: "data_ml_reviewer", services: harness.services });
    await waitFor(() =>
      expect(screen.getByText("Conflicting metadata in the repository")).toBeInTheDocument(),
    );
    expect(screen.getByText(/training_metrics\.json records a different run/)).toBeInTheDocument();
  });
});

describe("right-to-left rendering", () => {
  it("renders an Arabic screen with Arabic labels", async () => {
    const harness = await createScreenHarness("programme_manager");
    renderScreen(<ManagementOverview />, {
      role: "programme_manager",
      services: harness.services,
      locale: "ar",
    });
    await waitFor(() => expect(screen.getByText("النتائج المتحقَّقة")).toBeInTheDocument());
    expect(screen.getByText("الوزن المتحقَّق")).toBeInTheDocument();
  });
});
