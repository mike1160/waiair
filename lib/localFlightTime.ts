import { parseTimeMs } from './boardFilter';
import { timezoneForIata } from './airportTz';

export function localDateKey(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
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
