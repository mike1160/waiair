/** How getDepartures/getArrivals recover after an upstream failure.
 *
 *  200-empty (ADB_DEP_EMPTY / ADB_ARR_EMPTY) is "no data" → empty, never throw.
 *  Timeout / non-200: cache if we have flights, else throw — never disguise as [].
 *
 *  Callers of fetchFIDS (the only getDepartures/getArrivals consumers):
 *  - Home empty / add-flight lookup: catch → timeout/proxy copy (never empty)
 *  - Board load(): catch → cache or loadTimeout; other-day empty board (intentional)
 *  - runRouteSearch: catch → empty route hits (intentional)
 *  - Second-airport arrivals: catch → empty on first pull; silent poll keeps previous
 *  - Global place search: catch → empty hits; one side may still succeed (allSettled)
 *  - Detail baggage enrich: catch → leave flight unchanged
 *  Not callers (tracked snapshots only): tracked home poll, widget, watchSync.
 *  Inbound aircraft uses /aircraft, not FIDS.
 */

export type FidsRecoverAction = 'cache' | 'empty' | 'opensky' | 'throw';

export function isFidsEmptySentinel(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : '';
  return msg === 'ADB_DEP_EMPTY' || msg === 'ADB_ARR_EMPTY';
}

export function recoverFidsError(input: {
  error: unknown;
  hasDate: boolean;
  offsetDays: number;
  cachedCount: number;
  openSkyCount?: number;
}): FidsRecoverAction {
  const cached = input.cachedCount > 0;
  if (isFidsEmptySentinel(input.error)) {
    if (!input.hasDate && !input.offsetDays && (input.openSkyCount ?? 0) > 0) return 'opensky';
    return cached ? 'cache' : 'empty';
  }
  if (input.hasDate || input.offsetDays) {
    return cached ? 'cache' : 'throw';
  }
  if ((input.openSkyCount ?? 0) > 0) return 'opensky';
  if (cached) return 'cache';
  return 'throw';
}

/** Board footer: generic "no flights" only when load() did not already set an error banner. */
export function showBoardEmptyCopy(opts: {
  error: string;
  routeMode: boolean;
  hasQuery: boolean;
}): boolean {
  return !(opts.error && !opts.routeMode && !opts.hasQuery);
}
