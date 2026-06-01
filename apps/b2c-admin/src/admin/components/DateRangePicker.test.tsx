import { render, screen } from "../../test/render.js";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DateRangePicker } from "./DateRangePicker.js";

describe("DateRangePicker", () => {
  it("renders the selected date range and can clear it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DateRangePicker
        value={{ from: "2026-05-01", to: "2026-05-07" }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Zakres dat")).toHaveValue(
      "01.05.2026 - 07.05.2026",
    );

    await user.click(screen.getByLabelText("Zakres dat"));
    await user.click(
      screen.getByRole("button", { hidden: true, name: "Wyczyść" }),
    );

    expect(onChange).toHaveBeenCalledWith({ from: "", to: "" });
  });
});
