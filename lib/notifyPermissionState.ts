/**
 * Whether the notification permission question has been answered yet [W/14].
 *
 * `ensureNotifyPermission()` is the first await in addTrackByNumber, and on a fresh install it puts up the
 * system permission dialog — on Android 13+ the POST_NOTIFICATIONS runtime prompt. On every later launch the
 * status is already decided and it returns at once. That asymmetry is exactly the shape of "the first import
 * does nothing, the second launch works", and nothing recorded which side of it the app was on.
 *
 * So the call writes down where it got to, and the import screen can say whether the permission question
 * finished or is still hanging. A store rather than a return value, because the interesting case is the one
 * where the call has not come back at all.
 *
 * Diagnostic only: nothing here changes what ensureNotifyPermission decides or returns.
 *
 * Pure, and unit-tested in lib/notifyPermissionState.test.ts.
 */

export type NotifyPermissionPhase =
  /** Never asked in this session. */
  | 'unknown'
  /** Asked, still waiting — the case worth seeing. */
  | 'pending'
  | 'granted'
  | 'denied'
  /** The call threw. */
  | 'error';

export type NotifyPermissionSnapshot = {
  phase: NotifyPermissionPhase;
  /** How long the question has been open, or how long it took. 0 when it was never asked. */
  waitedMs: number;
};

let phase: NotifyPermissionPhase = 'unknown';
let askedAt = 0;
let settledMs = 0;

/** The permission question is being asked now. */
export function markNotifyAsked(now = Date.now()): void {
  phase = 'pending';
  askedAt = now;
  settledMs = 0;
}

/** It came back. `granted` maps from the boolean the caller already has. */
export function markNotifyResolved(
  result: NotifyPermissionPhase | boolean,
  now = Date.now(),
): void {
  phase = typeof result === 'boolean' ? (result ? 'granted' : 'denied') : result;
  settledMs = askedAt ? Math.max(0, now - askedAt) : 0;
}

/**
 * Where the question stands. While pending, `waitedMs` grows — a large number next to `pending` is the
 * evidence that the dialog never came back.
 */
export function notifySnapshot(now = Date.now()): NotifyPermissionSnapshot {
  if (phase === 'pending') return { phase, waitedMs: askedAt ? Math.max(0, now - askedAt) : 0 };
  return { phase, waitedMs: settledMs };
}

/** Tests only: forget everything. */
export function resetNotifyState(): void {
  phase = 'unknown';
  askedAt = 0;
  settledMs = 0;
}
