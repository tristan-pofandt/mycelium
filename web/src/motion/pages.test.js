import { describe, expect, it } from "vitest";
import { movePill } from "./pages.js";

// A stand-in for the pill element: records the keyframes it is asked to play.
const fakePill = () => {
  const pill = { style: {}, played: null, getAnimations: () => [], animate(frames) { pill.played = frames; return {}; } };
  return pill;
};
const edges = (clipPath) => clipPath.match(/inset\(([\d.]+)px ([\d.]+)px ([\d.]+)px ([\d.]+)px/).slice(1).map(Number); // top right bottom left

describe("stretching nav pill", () => {
  it("lets the leading edge move first in either direction, and ends exactly on the new tab", () => {
    const a = { l: 10, r: 300, top: 4, bottom: 4 }, b = { l: 200, r: 110, top: 4, bottom: 4 };
    const right = fakePill();
    movePill(right, a, b);
    const [, r1, , l1] = edges(right.played[6].clipPath); // a quarter of the way in
    expect(a.r - r1).toBeGreaterThan(l1 - a.l); // moving right: the right edge has travelled further
    expect(edges(right.played.at(-1).clipPath)).toEqual([4, 110, 4, 200]);

    const left = fakePill();
    movePill(left, b, a);
    const [, r2, , l2] = edges(left.played[6].clipPath);
    expect(b.l - l2).toBeGreaterThan(r2 - b.r); // moving left: the left edge leads
  });

  it("places the pill without animating on first paint or when nothing moves", () => {
    const p = fakePill();
    expect(movePill(p, null, { l: 5, r: 5, top: 4, bottom: 4 })).toBeNull();
    expect(p.played).toBeNull();
    expect(p.style.clipPath).toContain("inset(4px 5px 4px 5px");
  });
});
