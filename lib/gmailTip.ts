/**
 * When to mention Gmail — once, and only after the app has already proved useful.
 *
 * Connecting a mailbox is a lot to ask of someone who has not seen the app work yet, so it is no longer part
 * of getting in. The first tracked flight is the moment it makes sense: the app has done something, and the
 * offer is to do it automatically from now on. Said once, never again after "Later".
 *
 * Pure: storage lives in the caller, the rule is unit-tested here.
 */

/** Remembered when the tip is waved away, so it never comes back. */
export const GMAIL_TIP_DISMISSED_KEY = 'onboarding:gmailTipDismissed';

/**
 * Long enough to be read and acted on. Ten seconds turned out to be easy to miss, and a tip that is missed
 * is not remembered either — it simply comes back on the next launch.
 */
export const GMAIL_TIP_MS = 20_000;

export type GmailTipState = {
  /** How many flights the traveller is following. */
  trackedCount: number;
  /** Already signed in with Google: there is nothing to offer. */
  gmailConnected: boolean;
  /** "Later" was tapped, on this or any earlier run. */
  dismissed: boolean;
  /** Shown once already this run: saying it twice in one session is nagging. */
  shownThisSession?: boolean;
};

export function shouldShowGmailTip(state: GmailTipState): boolean {
  if (!state) return false;
  if (state.gmailConnected) return false;
  if (state.dismissed || state.shownThisSession) return false;
  // Not before the first flight: the tip is a discovery, not a step.
  return Number(state.trackedCount) >= 1;
}

export function dismissedFromStored(raw?: string | null): boolean {
  return String(raw || '') === '1';
}
