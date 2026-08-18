import { describe, expect, it } from "vitest";
import { isDoubleTap } from "./double-tap";

describe("isDoubleTap", () => {
  it("is false when there's no prior tap", () => {
    expect(isDoubleTap(null, 1000, 10, 10)).toBe(false);
  });

  it("is true for two taps close in time and position", () => {
    const prev = { time: 1000, x: 10, y: 10 };
    expect(isDoubleTap(prev, 1200, 12, 11)).toBe(true);
  });

  it("is false when the second tap arrives too slowly", () => {
    const prev = { time: 1000, x: 10, y: 10 };
    expect(isDoubleTap(prev, 1301, 10, 10)).toBe(false);
  });

  it("is false when the second tap lands too far away", () => {
    const prev = { time: 1000, x: 10, y: 10 };
    expect(isDoubleTap(prev, 1100, 200, 200)).toBe(false);
  });

  it("doesn't chain: a third tap right after a counted double-tap needs its own fresh pair", () => {
    const firstPair = { time: 1000, x: 10, y: 10 };
    expect(isDoubleTap(firstPair, 1100, 12, 11)).toBe(true);
    // Caller resets to null after consuming a double-tap (see editor.ts) —
    // a third tap right after should not itself count as a double-tap.
    expect(isDoubleTap(null, 1150, 12, 11)).toBe(false);
  });
});
