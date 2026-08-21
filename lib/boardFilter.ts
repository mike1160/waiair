import { isoInIanaTzToUtcMs, normalizeFlightIso } from './localFlightTime';

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

export function parseTimeMs(iso?: string, timeZone?: string): number | null {
  if (!iso) return null;
  if (timeZone) {
    const zoned = isoInIanaTzToUtcMs(iso, timeZone);
    if (zoned != null) return zoned;
  }
  const t = new Date(normalizeFlightIso(iso)).getTime();
  return Number.isFinite(t) ? t : null;
}

export function flightBoardDate(f: BoardFlight, timeZone?: string): string {
  const iso = f.scheduledTime || f.revisedTime || f.departureTime || f.arrivalTime || '';
  if (timeZone) {
    const ms = isoInIanaTzToUtcMs(iso, timeZone);
    if (ms) {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(ms));
      } catch { /* fall through */ }
    }
  }
  const m = String(iso).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

export function shiftDateKey(dayKey: string, days: number): string {
  const m = String(dayKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dayKey;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return dt.toISOString().slice(0, 10);
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calendar label in airport-local YYYY-MM-DD → "14 Aug". */
export function formatDayShort(dayKey: string): string {
  const m = String(dayKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${Number(m[3])} ${SHORT_MONTHS[Number(m[2]) - 1]}`;
}

export function shouldShowOnBoard(
  _f: BoardFlight,
  _dayKey: string,
  _type: 'arrival' | 'departure',
  _now = Date.now(),
  _opts?: { keepCompleted?: boolean; timeZone?: string },
): boolean {
  return true;
}

/** Fastest interval required by the current board: 30s near boarding, else 60s. */
export function fidsPollIntervalMs(flights: BoardFlight[], now = Date.now(), timeZone?: string): number {
  const hot = flights.some(f => {
    const st = String(f.status || '');
    if (st === 'boarding' || st === 'en-route') return true;
    const dep = parseTimeMs(f.departureTime || f.revisedTime || f.scheduledTime, timeZone);
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
