import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bars } from "./charts.jsx";
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

  it("names status in words, not colour alone", () => {
    render(<><StatusBadge status="down" /><StatusBadge status={null} /></>);
    expect(screen.getByText("Down")).toBeTruthy();
    expect(screen.getByText("Unknown")).toBeTruthy();
  });
});
