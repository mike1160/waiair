/**
 * The two subscription buttons, and why they stopped answering [W/18].
 *
 * "Manage subscription" called onClose() and THEN presented RevenueCat's Customer Center — so Settings slid
 * away, the home screen appeared, and the native sheet was asked to present from a view controller that was
 * already being dismissed. That is the same hazard [W/7] documented for the Gmail flow, and it was never
 * cleaned up here.
 *
 * What made it worse is that the failure is silent and sticky. `setBusy(false)` lives in a `finally`, so a
 * native promise that never resolves never runs it; SettingsScreen is kept mounted behind a `visible` prop,
 * so that `busy` survives closing and reopening; and both buttons are `disabled={busy}`. One hung
 * presentation therefore kills manage AND restore for the rest of the app's life.
 *
 * So every native call gets a deadline, and the outcome is always something the traveller can see. Neither
 * call is given a different job — this is about making sure they finish and say so.
 *
 * Pure, and unit-tested in lib/subscriptionAction.test.ts.
 */

/** How long a native subscription call may take before the screen stops waiting for it. */
export const SUBSCRIPTION_TIMEOUT_MS = 15000;

export type TimedOutcome<T> =
  | { kind: 'done'; value: T }
  | { kind: 'failed'; error: unknown }
  | { kind: 'timeout' };

/**
 * Run a native call against a deadline.
 *
 * Always settles: the promise's own result, its error, or a timeout. The caller can therefore put its busy
 * flag down unconditionally, which is the whole point — a `finally` that never runs is how this broke.
 *
 * `sleep` is injected so the tests need no real clock.
 */
export async function withSubscriptionTimeout<T>(
  work: () => Promise<T>,
  opts: { timeoutMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<TimedOutcome<T>> {
  const ms = opts.timeoutMs ?? SUBSCRIPTION_TIMEOUT_MS;
  const sleep = opts.sleep || ((n: number) => new Promise<void>(r => { setTimeout(r, n); }));
  const timeout = sleep(ms).then(() => ({ kind: 'timeout' } as const));
  const done = (async () => {
    try {
      return { kind: 'done', value: await work() } as const;
    } catch (error) {
      return { kind: 'failed', error } as const;
    }
  })();
  return Promise.race([done, timeout]);
}

export type RestoreNote =
  /** Pro is active again. */
  | 'restored'
  /** The call worked and there was nothing to restore — the case that used to show an invisible toast. */
  | 'none'
  /** Something came back, but not an entitlement: credits, or a purchase whose entitlement is inactive. */
  | 'partial'
  | 'failed'
  | 'timeout';

/** RevenueCat's own wording for "there was nothing to restore". Matched loosely, never relied upon alone. */
const NO_PURCHASES = /no previous purchases/i;

/**
 * Which outcome to put on screen.
 *
 * `partial` is kept apart from `failed` because the traveller can act on it — there were purchases, the
 * entitlement simply is not active — while a failure is ours to explain.
 */
export function restoreNoteFor(outcome: TimedOutcome<{ ok: boolean; message?: string }>): RestoreNote {
  if (outcome.kind === 'timeout') return 'timeout';
  if (outcome.kind === 'failed') return 'failed';
  const value = outcome.value;
  if (value?.ok) return 'restored';
  const message = String(value?.message || '');
  if (!message) return 'failed';
  return NO_PURCHASES.test(message) ? 'none' : 'partial';
}
