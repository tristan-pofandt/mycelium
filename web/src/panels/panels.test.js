import { describe, expect, it } from "vitest";
import { panels, panelsFor } from "./index.js";

describe("panel registry", () => {
  it("gives every panel an id, title, requires list and component", () => {
    for (const p of panels) {
      expect(p.id).toMatch(/^[a-z-]+$/);
      expect(p.title).toBeTruthy();
      expect(Array.isArray(p.requires)).toBe(true);
      expect(p.component).toBeTypeOf("function");
    }
  });

  it("hides panels whose capabilities the app lacks", () => {
    expect(panelsFor([]).every((p) => p.requires.length === 0)).toBe(true);
  });
});
