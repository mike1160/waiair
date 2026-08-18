import { parseTimeMs } from './boardFilter';
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
  const ms = parseTimeMs(iso);
  if (!ms) return null;
  const tz = timezoneForIata(iata, country);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date(ms));
    const h = Number(parts.find(p => p.type === 'hour')?.value);
    return Number.isFinite(h) ? h : null;
  } catch {
    return null;
  }
}

export function landedWithinMs(iso: string | undefined, windowMs: number): boolean {
  const ms = parseTimeMs(iso);
  if (!ms) return false;
  return Date.now() - ms <= windowMs;
}
