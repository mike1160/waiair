import { fromZonedTime, getTimezoneOffset } from 'date-fns-tz';
import { knownTimeZone, timezoneForIata } from './airportTz';

/** YYYY-MM-DD in a specific IANA timezone — never uses device local date. */
export function localDateKey(d: Date, timeZone: string): string {
  const tz = String(timeZone || '').trim() || 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch { /* fall through */ }
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;
  } catch { /* fall through */ }
  return d.toISOString().slice(0, 10);
}

/** Calendar today at an airport (IANA from catalog) — ignores device timezone. */
export function airportDateKey(iata?: string, country?: string, d = new Date()): string {
  const tz = knownTimeZone(iata, country) ?? 'UTC';
  return localDateKey(d, tz);
}

export function localHourFromIso(iso?: string, iata?: string, country?: string): number | null {
  if (!iso) return null;
  const ms = isoInAirportTzToUtcMs(iso, iata, country);
  if (ms == null) return null;
  const tz = timezoneForIata(iata, country);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date(ms));
    const h = Number(parts.find(p => p.type === 'hour')?.value) % 24;
    return Number.isFinite(h) ? h : null;
  } catch {
    return null;
  }
}

export function landedWithinMs(
  iso: string | undefined,
  windowMs: number,
  iata?: string,
  country?: string,
): boolean {
  if (!iso) return false;
  const ms = isoInAirportTzToUtcMs(iso, iata, country);
  if (ms == null) return false;
  return Date.now() - ms <= windowMs;
}

const WALL_RE = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/** AeroDataBox sends `2026-08-21 16:05+07:00` (no seconds). Hermes Date.parse often returns NaN without `:00`. */
export function normalizeFlightIso(iso?: string | null): string {
  const s = String(iso || '').trim().replace(' ', 'T');
  if (!s) return '';
  return s.replace(/T(\d{2}:\d{2})(?!:)/, 'T$1:00');
}

/** UTC offset of an IANA zone at an instant — DST via date-fns-tz getTimezoneOffset. */
export function tzOffsetMsAt(utcMs: number, timeZone: string): number {
  try {
    const off = getTimezoneOffset(timeZone, utcMs);
    return Number.isFinite(off) ? off : 0;
  } catch {
    return 0;
  }
}

/** Interpret Y-M-D H:m as a wall clock in `timeZone` and return the UTC instant. */
export function wallClockInZoneToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number | null {
  if (!timeZone) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const wall = `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
  try {
    const ms = fromZonedTime(wall, timeZone).getTime();
    if (Number.isFinite(ms)) return ms;
  } catch { /* fall through */ }
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let t = utcGuess;
  try {
    for (let i = 0; i < 3; i++) {
      t = utcGuess - tzOffsetMsAt(t, timeZone);
    }
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/**
 * FIDS clock → UTC instant in an IANA zone (Europe/Amsterdam, Asia/Bangkok, …).
 * - `2026-08-16T05:15:00Z` and `…+02:00` are absolute instants (DST applied when displaying).
 * - Naive `2026-08-16T14:15:00` is wall clock in `timeZone` — never a hardcoded +1/+2/+7.
 */
export function isoInIanaTzToUtcMs(iso?: string | null, timeZone?: string): number | null {
  const s = normalizeFlightIso(iso);
  if (!s) return null;
  const tz = String(timeZone || '').trim() || 'UTC';
  const m = s.match(WALL_RE);
  const hasExplicitOffset = /[+-]\d{2}:?\d{2}$/.test(s) && !/Z$/i.test(s);
  const hasZ = /Z$/i.test(s);

  if (hasExplicitOffset || hasZ) {
    const ms = Date.parse(s);
    if (Number.isFinite(ms)) return ms;
  }

  if (m) {
    const wall = wallClockInZoneToUtcMs(
      Number(m[1]), Number(m[2]), Number(m[3]),
      Number(m[4]), Number(m[5]), Number(m[6] || 0),
      tz,
    );
    if (wall != null) return wall;
  }

  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

/** Same as isoInIanaTzToUtcMs, using the airport catalog (AMS → Europe/Amsterdam, BKK → Asia/Bangkok). */
export function isoInAirportTzToUtcMs(
  iso?: string | null,
  iata?: string,
  country?: string,
): number | null {
  return isoInIanaTzToUtcMs(iso, timezoneForIata(iata, country));
}

/** True when `now` is after the FIDS clock, compared in the airport's timezone. */
export function isPastAirportLocal(
  iso: string | undefined,
  iata: string | undefined,
  country?: string,
  now = Date.now(),
): boolean {
  const ms = isoInAirportTzToUtcMs(iso, iata, country);
  return ms != null && now > ms;
}
