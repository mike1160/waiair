/** Empty-home sky collapse follows the software keyboard, not field focus. */

export type HomeKeyboardEvent = {
  height: number;
  duration?: number;
};

/** iOS UIKit duration is seconds; RN often already sends milliseconds. */
export function keyboardDurationMs(duration?: number): number {
  const d = Number(duration);
  if (!Number.isFinite(d) || d <= 0) return 250;
  return d < 10 ? Math.round(d * 1000) : Math.round(d);
}

export function keyboardHeightFromEvent(ev: { height?: number | null }): number {
  const h = Number(ev.height);
  return Number.isFinite(h) && h > 0 ? h : 0;
}

/** Collapse the search sky only while the keyboard occupies space. */
export function homeSearchCollapsed(keyboardHeight: number): boolean {
  return keyboardHeightFromEvent({ height: keyboardHeight }) > 0;
}

export function homeSearchKeyboardFromEvent(ev: HomeKeyboardEvent): {
  collapsed: boolean;
  height: number;
  durationMs: number;
} {
  const height = keyboardHeightFromEvent(ev);
  return {
    height,
    collapsed: height > 0,
    durationMs: keyboardDurationMs(ev.duration),
  };
}

/** Boarding-pass card + paste chrome hide with the keyboard, not focus. */
export function boardingPassCardVisible(keyboardVisible: boolean): boolean {
  return !keyboardVisible;
}
