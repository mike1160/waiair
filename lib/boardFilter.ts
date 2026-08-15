/** Board freshness + FIDS poll cadence. */

export const FIDS_LIST_MS = 60 * 1000;
export const FIDS_BOARDING_MS = 30 * 1000;
export const FIDS_ENROUTE_MS = 60 * 1000;
export const FIDS_SCHEDULED_FAR_MS = 5 * 60 * 1000;
export const TRACK_POLL_MS = 30 * 1000;
export const LIVE_STALE_MS = 2 * 60 * 1000;
export const DEPARTED_HIDE_MS = 2 * 60 * 60 * 1000;
export const LIVE_ACTIVITY_TICK_MS = 2 * 60 * 1000;

export type BoardFlight = {
  status?: string;
  scheduledTime?: string;
  revisedTime?: string;
  actualTime?: string;
  departureTime?: string;
  arrivalTime?: string;
};

export function parseTimeMs(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(String(iso).trim().replace(' ', 'T')).getTime();
  return Number.isFinite(t) ? t : null;
}

export function flightBoardDate(f: BoardFlight): string {
  const iso = f.scheduledTime || f.revisedTime || f.departureTime || f.arrivalTime || '';
  const m = String(iso).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

export function shiftDateKey(dayKey: string, days: number): string {
  const m = String(dayKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dayKey;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return dt.toISOString().slice(0, 10);
}

export function shouldShowOnBoard(
  f: BoardFlight,
  dayKey: string,
  type: 'arrival' | 'departure',
  now = Date.now(),
  opts?: { keepCompleted?: boolean },
): boolean {
  const key = flightBoardDate(f);
  if (key && key !== dayKey) return false;
  if (opts?.keepCompleted) return true;

  if (type === 'departure') {
    const left = f.status === 'en-route' || f.status === 'landed' || !!f.actualTime;
    if (left) {
      const depMs = parseTimeMs(f.actualTime || f.departureTime || f.revisedTime || f.scheduledTime);
      if (depMs && now - depMs > DEPARTED_HIDE_MS) return false;
    }
  } else if (f.status === 'landed') {
    const arrMs = parseTimeMs(f.actualTime || f.arrivalTime || f.revisedTime || f.scheduledTime);
    if (arrMs && now - arrMs > DEPARTED_HIDE_MS) return false;
  }
  return true;
}

/** Fastest interval required by the current board: 30s near boarding, else 60s. */
export function fidsPollIntervalMs(flights: BoardFlight[], now = Date.now()): number {
  const hot = flights.some(f => {
    const st = String(f.status || '');
    if (st === 'boarding' || st === 'en-route') return true;
    const dep = parseTimeMs(f.departureTime || f.revisedTime || f.scheduledTime);
    if (!dep) return false;
    const mins = (dep - now) / 60000;
    return mins <= 45 && mins >= -5;
  });
  return hot ? FIDS_BOARDING_MS : FIDS_LIST_MS;
}

export function isLiveStale(lastFetchAt: number | null, now = Date.now()): boolean {
  if (!lastFetchAt) return true;
  return now - lastFetchAt > LIVE_STALE_MS;
}
