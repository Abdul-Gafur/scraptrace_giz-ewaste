import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Trash2 } from "lucide-react";

import { EmptyState } from "@/components/feedback/states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioGroup, Switch } from "@/components/ui/choice-controls";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { STATUS_KEYS, StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";

import { bundles, renderWithIntl } from "./render";

vi.mock("@/i18n/navigation", async () => (await import("./navigation-mock")).navigationMock);

describe("shared components", () => {
  it("loading buttons announce busy state and cannot be activated again", async () => {
    const onClick = vi.fn();
    renderWithIntl(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("icon buttons expose their required accessible name", () => {
    renderWithIntl(<IconButton icon={Trash2} label="Delete record" />);
    expect(screen.getByRole("button", { name: "Delete record" })).toBeInTheDocument();
  });

  it("fields connect label, hint and validation error to the control", () => {
    renderWithIntl(
      <Field error="Required" hint="Printed on the label" label="Serial" required>
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText("Serial");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAccessibleDescription("Required Printed on the label");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("checkbox, switch and radio group work from the keyboard", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <>
        <Checkbox label="Safe storage" />
        <Switch label="Training" />
        <RadioGroup
          defaultValue="a"
          legend="Site"
          name="site"
          options={[
            { value: "a", label: "Certified" },
            { value: "b", label: "Collection point" },
          ]}
        />
      </>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Safe storage" });
    checkbox.focus();
    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
    const toggle = screen.getByRole("switch", { name: "Training" });
    toggle.focus();
    await user.keyboard(" ");
    expect(toggle).toBeChecked();
    const first = screen.getByRole("radio", { name: "Certified" });
    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Collection point" })).toBeChecked();
    expect(screen.getByRole("group", { name: "Site" })).toBeInTheDocument();
  });

  it("status badges always carry a text label, never colour alone", () => {
    renderWithIntl(
      <ul>
        {STATUS_KEYS.map((key) => (
          <li key={key}>
            <StatusBadge status={key} />
          </li>
        ))}
      </ul>,
    );
    for (const key of STATUS_KEYS) {
      expect(screen.getByText(bundles.en.status[key])).toBeInTheDocument();
    }
    expect(bundles.en.status).toEqual(
      expect.objectContaining({ awaiting_handoff: "Awaiting Handoff" }),
    );
  });

  it("danger alerts interrupt assistive technology and others do not", () => {
    renderWithIntl(
      <>
        <Alert title="Storage full" tone="danger" />
        <Alert title="Stale data" tone="warning" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Storage full");
    expect(screen.getByRole("status")).toHaveTextContent("Stale data");
  });

  it("dropdown menus open, move focus with arrow keys and return focus on Escape", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithIntl(
      <DropdownMenu
        items={[
          { id: "a", label: "First", onSelect },
          { id: "b", label: "Second" },
        ]}
        label="Actions"
        trigger={<span>Actions</span>}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const [first, second] = screen.getAllByRole("menuitem");
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(first).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("tooltips describe their trigger and dismiss with Escape", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <Tooltip content="Delete the record">
        <button type="button">Delete</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    await user.tab();
    expect(button).toHaveAccessibleDescription("Delete the record");
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-hidden", "false");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveAttribute("data-hidden", "true");
  });

  it("confirm dialogs open as modal and offer an explicit cancel", async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
    });
    const onClose = vi.fn();
    renderWithIntl(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Yes, clear"
        description="This removes cached records."
        destructive
        onClose={onClose}
        onConfirm={vi.fn()}
        open
        title="Clear cache"
      />,
    );
    expect(showModal).toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Clear cache" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("responsive tables keep a real table and a labelled card list", () => {
    renderWithIntl(
      <DataTable
        caption="Records"
        columns={[
          { key: "id", header: "Record ID", primary: true, cell: (row) => row.id },
          { key: "batch", header: "Batch", cell: (row) => row.batch },
        ]}
        getRowId={(row) => row.id}
        rows={[{ id: "ST-0941", batch: "Lead-Acid" }]}
      />,
    );
    expect(screen.getByRole("table", { name: "Records" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Batch" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Records" })).toBeInTheDocument();
  });

  it("pagination disables unavailable directions and reports the page", async () => {
    const onPageChange = vi.fn();
    renderWithIntl(<Pagination onPageChange={onPageChange} page={1} pageCount={3} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renders shared states in Arabic", () => {
    renderWithIntl(<EmptyState />, "ar");
    expect(screen.getByRole("heading", { name: bundles.ar.states.emptyTitle })).toBeInTheDocument();
  });

  it("has no automated accessibility violations across representative components", async () => {
    const { container } = renderWithIntl(
      <main>
        <h1>Showcase</h1>
        <Field hint="Hint" label="Serial">
          {(control) => <Input {...control} />}
        </Field>
        <Checkbox label="Safe" />
        <Switch label="Toggle" />
        <StatusBadge status="action_required" />
        <Alert title="Warning" tone="warning">
          Details
        </Alert>
        <Button variant="destructiveOutline">Clear</Button>
        <Pagination onPageChange={() => undefined} page={2} pageCount={3} />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
