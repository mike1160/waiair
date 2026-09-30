/**
 * Handing over between full-screen surfaces without stranding anyone [W/7].
 *
 * Three bugs, one shape: a one-way transition whose only exit was a single callback nobody guarded.
 *
 *   The opening screen faded itself to opacity 0 and dismissed itself from the fade's completion callback,
 *   having already set a flag that ignores every further tap. If that callback did not arrive — and first
 *   launch is the busiest the JS thread ever is, with prefs, tracked flights, the splash and two permission
 *   dialogs all landing at once — the traveller was left looking at a blank screen that answered nothing.
 *   Every path that clears the screen runs *after* that callback, the modal is fullScreen with an empty
 *   onRequestClose, and the "seen" flag is written in the same place, so a force-quit brought it straight
 *   back. That is the black frozen screen reported on a fresh iPhone.
 *
 *   The Gmail import screen watched AppState and, two seconds after the app became active with a sign-in in
 *   flight, dismissed the modal the native Google sheet was presented from. On a first-ever sign-in iOS shows
 *   its own "wants to use google.com" consent alert; dismissing that alert returns the app to active while
 *   the web sheet is still up, so the timer fired mid-consent and tore down the presenting view controller
 *   underneath its own presented sheet. Same symptom, different door.
 *
 *   And the fresh-install Google button handed over to nothing at all.
 *
 * So: a transition gets a fallback as well as its callback, a sign-in in flight is never interrupted, and
 * two full-screen surfaces are never swapped inside one commit.
 *
 * Pure, and unit-tested in lib/screenHandoff.test.ts.
 */

/** Grace on top of an exit animation before the fallback takes over. Long enough not to race a slow frame. */
export const EXIT_FALLBACK_GRACE_MS = 400;

/**
 * When to stop waiting for an exit animation's callback and hand over anyway.
 *
 * The handover must happen exactly once, so the caller pairs this with a latch — see `once` in the tests.
 */
export function exitFallbackMs(exitMs: number): number {
  const ms = Number(exitMs);
  if (!Number.isFinite(ms) || ms < 0) return EXIT_FALLBACK_GRACE_MS;
  return ms + EXIT_FALLBACK_GRACE_MS;
}

/**
 * The gap between dismissing one full-screen modal and presenting the next.
 *
 * Longer than the modal transition itself: iOS does not reliably present a full-screen modal while another
 * is still dismissing, and the two happening in one React commit is its own class of black screen.
 */
export const MODAL_HANDOFF_MS = 420;

/**
 * May the screen be dismissed right now, given a sign-in may be in flight? [W/7]
 *
 * This is the inversion. The old watchdog treated "the app became active" as proof the Google sheet had gone
 * and dismissed the screen; it is nothing of the kind, and dismissing the presenting modal while its sheet is
 * up is what froze the app. A sign-in in flight now means hands off, always — the sign-in's own promise says
 * what happened (lib/googleSignInError.ts classifies it), and that is the only thing that may act on it.
 */
export function mayDismissDuringSignIn(connecting: boolean): boolean {
  return !connecting;
}

/** How long a native sign-in may sit unresolved before the screen stops waiting and offers a retry. */
export const SIGN_IN_STALL_MS = 90_000;

export type SignInWatchdogAction =
  /** Keep waiting: the traveller is on Google's screens and nothing here should interfere. */
  | 'wait'
  /** Give up waiting and show a retry *inside* the screen. Never a dismissal. */
  | 'recover';

/**
 * What to do about a sign-in that has been running for `elapsedMs`.
 *
 * Deliberately not a function of app state. A first-ever sign-in involves a consent alert, an account picker
 * and a permissions screen, and the app goes active and inactive throughout — none of which says anything
 * about whether the sheet is still open.
 */
export function signInWatchdogAction(opts: {
  connecting: boolean;
  elapsedMs: number;
  stallMs?: number;
}): SignInWatchdogAction {
  const stall = opts.stallMs ?? SIGN_IN_STALL_MS;
  if (!opts.connecting) return 'wait';
  if (!Number.isFinite(opts.elapsedMs)) return 'wait';
  return opts.elapsedMs >= stall ? 'recover' : 'wait';
}
