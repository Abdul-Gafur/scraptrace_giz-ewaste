import { screen } from "@testing-library/react";

import { useDate } from "@/i18n/use-date";

import { renderWithIntl } from "./render";

function Sample() {
  const date = useDate();
  return <p>{date("2026-09-24")}</p>;
}

describe("useDate", () => {
  it("formats a programme date in the active locale", () => {
    renderWithIntl(<Sample />);
    expect(screen.getByText("Sep 24, 2026")).toBeInTheDocument();
  });

  it("reads the date in UTC so the rendered day never shifts with the viewer's zone", () => {
    const { unmount } = renderWithIntl(<Sample />, "fr");
    expect(screen.getByText("24 sept. 2026")).toBeInTheDocument();
    unmount();
  });

  it("uses Arabic-Indic digits in Arabic", () => {
    renderWithIntl(<Sample />, "ar");
    expect(screen.getByText(/٢٠٢٦/)).toBeInTheDocument();
  });
});
