import { screen } from "@testing-library/react";

import { useNumber } from "@/i18n/use-number";

import { renderWithIntl } from "./render";

function Sample() {
  const number = useNumber();
  return (
    <p>
      {number(1429.4)} | {number(10.12, 2)} | {number(342)}
    </p>
  );
}

describe("useNumber", () => {
  it("uses Latin digits in English", () => {
    renderWithIntl(<Sample />);
    expect(screen.getByText("1,429.4 | 10.12 | 342")).toBeInTheDocument();
  });

  it("uses Arabic-Indic digits in Arabic, as in the approved design", () => {
    renderWithIntl(<Sample />, "ar");
    expect(screen.getByText(/١٬٤٢٩٫٤/)).toBeInTheDocument();
    expect(screen.getByText(/٣٤٢/)).toBeInTheDocument();
  });
});
