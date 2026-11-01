import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bars, CountUp, Stat } from "./charts.jsx";
import { StatusBadge } from "./panels/Status.jsx";

describe("charts", () => {
  it("gives a stacked chart a legend and an exact table", () => {
    render(<Bars title="Cost per day" format={(v) => `$${v}`}
      series={[{ key: "a", label: "Claude Code", color: "red" }, { key: "b", label: "App APIs", color: "blue" }]}
      rows={[{ label: "2026-10-30", values: { a: 1, b: 2 } }]} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "2026-10-30" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "$2" })).toBeTruthy();
  });

  it("pairs each stat's label with its value for screen readers", () => {
    render(<dl><Stat label="Requests (24 h)" value="726" note="0 errors" /></dl>);
    expect(screen.getByRole("term").textContent).toBe("Requests (24 h)");
    expect(screen.getAllByRole("definition").map((d) => d.textContent)).toEqual(["726", "0 errors"]);
  });

  it("counts up from zero without flashing the final value, and gives screen readers only the final value", () => {
    const { container } = render(<CountUp value={1644} format={(v) => v.toLocaleString("en")} />);
    const [visible, spoken] = container.querySelectorAll("span");
    expect(visible.getAttribute("aria-hidden")).toBe("true");
    expect(visible.textContent).toBe("0"); // the climb starts at zero before the first paint
    expect(spoken.textContent).toBe("1,644");
  });

  it("shows the value at once with reduced motion", () => {
    document.documentElement.dataset.motion = "reduced";
    const { container } = render(<CountUp value={94.95} format={(v) => `${v}%`} />);
    expect(container.querySelector("span").textContent).toBe("94.95%");
    delete document.documentElement.dataset.motion;
  });

  it("names status in words, not colour alone", () => {
    render(<><StatusBadge status="down" /><StatusBadge status={null} /></>);
    expect(screen.getByText("Down")).toBeTruthy();
    expect(screen.getByText("Unknown")).toBeTruthy();
  });
});
