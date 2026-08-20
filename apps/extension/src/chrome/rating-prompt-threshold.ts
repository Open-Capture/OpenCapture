// Pure — no chrome.storage, no `ext` import — so it's unit-testable
// without stubbing the WebExtension globals, same pattern as
// editor/double-tap.ts's isDoubleTap().

// Ask once after the 3rd real capture. If dismissed with "Not now" rather
// than answered, ask once more at the 10th — then stop for good either
// way. Any star tap (even a low one, routed to feedback instead of the
// store) also stops it for good immediately; a real signal is a real
// signal regardless of which way it was routed.
export const RATING_PROMPT_THRESHOLDS = [3, 10] as const;

export interface RatingPromptState {
  timesShown: number;
  respondedForever: boolean;
}

export const DEFAULT_RATING_PROMPT_STATE: RatingPromptState = { timesShown: 0, respondedForever: false };

/** `state.timesShown` doubles as "which threshold index we're waiting
 * on": 0 means still waiting on the first (3rd-use) prompt, 1 means the
 * first was dismissed and we're waiting on the second (10th-use) one. */
export function shouldShowRatingPrompt(usageCount: number, state: RatingPromptState): boolean {
  if (state.respondedForever) return false;
  return RATING_PROMPT_THRESHOLDS.some((threshold, i) => usageCount >= threshold && state.timesShown === i);
}
