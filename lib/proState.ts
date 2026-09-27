/**
 * Whether the app believes you are Pro [U/1].
 *
 * It used to believe only RevenueCat, and only at the moment it asked. The call was made once at launch,
 * and anything that was not a clear yes became a no:
 *
 *     .then(pro => setIsPro(pro))
 *     .catch(() => setIsPro(false))      // no network → you are not Pro any more
 *
 * So a paying traveller on a bad hotel connection — or in a plane, which is most of the point of this app —
 * opened it and found the Pro sections locked. Nothing had expired; the question had simply not arrived.
 * Meanwhile the app already keeps a durable note that the purchase happened
 * (services/SubscriptionManager.ts) and never looked at it.
 *
 * Two rules, and they are the whole of this file:
 *
 *   A stored purchase is believed until told otherwise.
 *   A check that *failed* is not an answer, and never takes Pro away. Only RevenueCat saying "no" does.
 *
 * The asymmetry is deliberate. Wrongly granting Pro for a while costs a subscription that was cancelled;
 * wrongly revoking it takes away something someone paid for, at the moment they are least able to fix it.
 *
 * Pure, and unit-tested in lib/proState.test.ts.
 */

/** What came back when the app asked. A failure is not a negative answer — that is the point. */
export type ProCheck =
  /** RevenueCat answered: this is authoritative, in both directions. */
  | { kind: 'answer'; pro: boolean }
  /** The question never got through: offline, timed out, threw. Says nothing about the entitlement. */
  | { kind: 'failed' };

/** The stored flag, as SubscriptionManager writes it ('1' for Pro). Anything else is not a yes. */
export function proFromStoredFlag(raw: string | null | undefined): boolean {
  return String(raw ?? '').trim() === '1';
}

/**
 * What the app should believe after a check.
 *
 * `betaMode` wins outright — a TestFlight build is Pro by construction and no check can change that.
 */
export function proAfterCheck(current: boolean, check: ProCheck, betaMode = false): boolean {
  if (betaMode) return true;
  if (!check || check.kind === 'failed') return current;
  return !!check.pro;
}

/**
 * What the app should believe at launch, before RevenueCat has said anything: the stored purchase, or
 * beta mode. Never a hopeful guess — only something that was actually written down.
 */
export function proAtLaunch(storedFlag: string | null | undefined, betaMode = false): boolean {
  return betaMode || proFromStoredFlag(storedFlag);
}
