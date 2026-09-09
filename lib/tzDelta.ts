/** Arrival timezone delta for the map-hero chip. Pure. */

import { getTimezoneOffset } from 'date-fns-tz';
import { timezoneForIata } from './airportTz.ts';

function offsetMinutes(timeZone: string, date = new Date()): number {
  return Math.round(getTimezoneOffset(timeZone, date) / 60000);
}

/** Dest minus origin, in minutes (DST-aware). Same zone → 0. */
export function arrivalTzDeltaMinutes(
  originIata?: string,
  destIata?: string,
  originCountry?: string,
  destCountry?: string,
  date = new Date(),
): number {
  const a = timezoneForIata(originIata, originCountry);
  const b = timezoneForIata(destIata, destCountry);
  return offsetMinutes(b, date) - offsetMinutes(a, date);
}

/** "+2 h" / "+5:30 h" / "-1:30 h". Null when the zones match. */
export function formatSignedTzDelta(offsetMin: number): string | null {
  if (!Number.isFinite(offsetMin) || offsetMin === 0) return null;
  const sign = offsetMin > 0 ? '+' : '-';
  const abs = Math.abs(Math.round(offsetMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `${sign}${h} h`;
  return `${sign}${h}:${String(m).padStart(2, '0')} h`;
}
