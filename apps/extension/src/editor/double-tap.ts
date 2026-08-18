// Touch has no dblclick equivalent — this replaces it for re-entering
// text-edit mode on a pending text shape (see editor.ts's pointerdown
// handler). Two taps within DOUBLE_TAP_MS and DOUBLE_TAP_PX of each other
// count as a double-tap; DOUBLE_TAP_PX is generous relative to mouse
// dblclick's effectively-zero tolerance, since a real double-tap's two
// contact points are never pixel-identical.
export type TapState = { time: number; x: number; y: number } | null;

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;

export function isDoubleTap(prev: TapState, now: number, x: number, y: number): boolean {
  return prev !== null && now - prev.time < DOUBLE_TAP_MS && Math.hypot(x - prev.x, y - prev.y) < DOUBLE_TAP_PX;
}
