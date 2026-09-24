/**
 * When to stop calling Schiphol's flight API.
 *
 * The API answers a malformed or unauthorised request with 4xx, and no number of retries changes that: the
 * keys are missing, expired, or the request no longer matches the version the API expects. Every AMS board
 * was still asking — four pages, eight seconds each, on every search — for gate and belt data that was never
 * going to arrive. The board itself is unaffected either way; the enrichment is extra.
 *
 * So after such an answer the calls stop for a while, and the app says so once instead of on every search.
 *
 * Pure: the state is held by the caller (services/SchipholService.ts), the rules live here and are tested.
 */

/** How long to leave it alone after the API says the request cannot work. */
export const SCHIPHOL_COOLDOWN_MS = 30 * 60 * 1000;

export type SchipholBreaker = { openedAt: number; status: number } | null;

/**
 * A status that will not fix itself on retry: the request was refused, not delayed. A timeout or a 5xx is a
 * bad moment rather than a broken setup, and those keep their existing behaviour — one failed call, no board.
 */
export function isConfigFailure(status?: number | null): boolean {
  const code = Number(status);
  return code === 400 || code === 401 || code === 403 || code === 404;
}

/** The breaker after a failed call: open on a refusal, unchanged on anything else. */
export function afterFailure(state: SchipholBreaker, status: number | null | undefined, now: number): SchipholBreaker {
  if (!isConfigFailure(status)) return state;
  return { openedAt: now, status: Number(status) };
}

/** True while the calls should stay stopped. */
export function isOpen(state: SchipholBreaker, now: number): boolean {
  if (!state) return false;
  return now - state.openedAt < SCHIPHOL_COOLDOWN_MS;
}

/** A success clears it, so a fixed key starts working again without a restart. */
export function afterSuccess(): SchipholBreaker {
  return null;
}
