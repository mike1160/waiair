/**
 * Keeping a text field above the keyboard [W/5].
 *
 * The briefing's free-text question sits at the bottom of the hub, inside a plain ScrollView with no keyboard
 * handling — so the keyboard opened straight over it and the traveller could not see what they were typing.
 *
 * Nothing resizes the window on either platform: iOS never has, and Android has not since Expo SDK 54 made
 * edge-to-edge the default (SDK 57 has no opt-out), which is what turned `adjustResize` into a no-op. So the
 * amount the content has to move is the app's own arithmetic, and it is this file.
 *
 * Deliberately not a KeyboardAvoidingView around the screen: that re-lays-out everything on the hub for the
 * sake of one field, and its `height` behaviour is the thing that edge-to-edge broke in the first place.
 *
 * Pure, and unit-tested in lib/keyboardScroll.test.ts.
 */

/** Breathing room between the field and the top of the keyboard. */
export const KEYBOARD_REVEAL_MARGIN = 12;

/**
 * Where to scroll so the field clears the keyboard, or null when it already does.
 *
 * All four numbers are in the same space: `inputBottomY` and `keyboardTopY` are window coordinates (what
 * measureInWindow reports), `scrollY` is the ScrollView's current offset. Null means leave the scroll alone —
 * scrolling a field that is already visible drags the screen for no reason.
 */
export function keyboardScrollTarget(opts: {
  inputBottomY: number;
  keyboardTopY: number;
  scrollY: number;
  margin?: number;
}): number | null {
  const { inputBottomY, keyboardTopY, scrollY } = opts;
  const margin = opts.margin ?? KEYBOARD_REVEAL_MARGIN;
  if (![inputBottomY, keyboardTopY, scrollY].every(n => Number.isFinite(n))) return null;
  // No keyboard reported, or a nonsensical one: nothing to get out of the way of.
  if (keyboardTopY <= 0) return null;
  const overlap = inputBottomY + margin - keyboardTopY;
  if (overlap <= 0) return null;
  // Never scroll past the top: a short page with a tall keyboard would otherwise jump backwards.
  return Math.max(0, scrollY + overlap);
}

/** The keyboard's top edge in window coordinates. 0 when the keyboard is closed. */
export function keyboardTopY(windowHeight: number, keyboardHeight: number): number {
  if (!Number.isFinite(windowHeight) || !Number.isFinite(keyboardHeight)) return 0;
  if (keyboardHeight <= 0) return 0;
  return Math.max(0, windowHeight - keyboardHeight);
}
