import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Table } from "./charts.jsx";
import { HoldButton, Picker, Switch } from "./ui.jsx";
import { TaskChip } from "./tasks.jsx";

describe("shared pieces", () => {
  it("sorts a table by a column, numbers as numbers, with aria-sort", () => {
    render(<Table caption="t" head={["Route", "Calls"]} rows={[["/a", "9"], ["/b", "120"], ["/c", "1,644"]]} />);
    fireEvent.click(screen.getByRole("button", { name: /Calls/ }));
    expect(screen.getByRole("columnheader", { name: /Calls/ }).getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getAllByRole("rowheader").map((c) => c.textContent)).toEqual(["/a", "/b", "/c"]);
    fireEvent.click(screen.getByRole("button", { name: /Calls/ }));
    expect(screen.getAllByRole("rowheader").map((c) => c.textContent)).toEqual(["/c", "/b", "/a"]);
  });

  it("shows an empty state instead of an empty table", () => {
    render(<Table caption="t" head={["A"]} rows={[]} empty="No requests yet." />);
    expect(screen.getByText("No requests yet.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("is a real switch", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Ride board on" />);
    const sw = screen.getByRole("switch", { name: "Ride board on" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("confirms only after a full hold, from the keyboard too", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(<HoldButton onConfirm={onConfirm}>Hold to sign out everyone</HoldButton>);
    const b = screen.getByRole("button", { name: "Hold to sign out everyone" });
    fireEvent.keyDown(b, { key: " " });
    act(() => vi.advanceTimersByTime(600));
    fireEvent.keyUp(b, { key: " " }); // let go early: cancelled
    act(() => vi.advanceTimersByTime(1000));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.keyDown(b, { key: " " });
    act(() => vi.advanceTimersByTime(1250));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("picks with the keyboard", () => {
    const onChange = vi.fn();
    render(<Picker label="App" value="all" onChange={onChange} options={[{ value: "all", label: "All apps" }, { value: "reroute", label: "Reroute" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "App: All apps" }));
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("reroute");
  });

  it("says a task's state in words", () => {
    render(<TaskChip task={{ state: "failed", name: "Save settings", arg: "plan cap 25", t0: 0, ms: 420, detail: "The app answered 502." }} onRetry={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("Save settings, plan cap 25: Failed, 0.4 s. The app answered 502.");
    expect(screen.getByRole("button", { name: "Retry Save settings" })).toBeTruthy();
  });
});
