import { describe, expect, it } from "vitest";
import { shouldShowRatingPrompt } from "./rating-prompt-threshold";

describe("shouldShowRatingPrompt", () => {
  it("doesn't show before the 3rd use", () => {
    expect(shouldShowRatingPrompt(2, { timesShown: 0, respondedForever: false })).toBe(false);
  });

  it("shows on the 3rd use if never shown before", () => {
    expect(shouldShowRatingPrompt(3, { timesShown: 0, respondedForever: false })).toBe(true);
  });

  it("keeps showing at any usage count past the 3rd, as long as it hasn't been shown yet", () => {
    expect(shouldShowRatingPrompt(7, { timesShown: 0, respondedForever: false })).toBe(true);
  });

  it("doesn't show again right after the 3rd-use prompt, before the 10th", () => {
    expect(shouldShowRatingPrompt(4, { timesShown: 1, respondedForever: false })).toBe(false);
  });

  it("shows a second time on the 10th use, if the first was dismissed (not responded)", () => {
    expect(shouldShowRatingPrompt(10, { timesShown: 1, respondedForever: false })).toBe(true);
  });

  it("never shows again once responded to, regardless of usage count", () => {
    expect(shouldShowRatingPrompt(100, { timesShown: 1, respondedForever: true })).toBe(false);
  });

  it("never shows a third time even if respondedForever wasn't set (defensive)", () => {
    expect(shouldShowRatingPrompt(50, { timesShown: 2, respondedForever: false })).toBe(false);
  });
});
