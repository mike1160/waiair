/** Return-chip date: no preselect; chips relative to outbound arrival in dest TZ. */

import { formatInTimeZone } from 'date-fns-tz';
import { timezoneForIata } from './airportTz.ts';
import {
  flightClockUtcMs,
  parseTimeMs,
  resolveArrivalIso,
  type FlightClockFields,
} from './flightTimes.ts';
import {
  dateOffsetDays,
  ymdFromDate,
  type SmartDateKind,
  type SmartQuery,
} from './smartQuery.ts';

export type HomeDateChoice =
  | { kind: 'unset' }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'ymd'; date: string };

export function addYmd(ymd: string, days: number): string {
  const t = Date.parse(`${String(ymd || '').slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(t)) return '';
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/** Dest-local calendar day of outbound arrival. Empty when the clock is unknown. */
export function outboundArrivalYmd(f: FlightClockFields): string {
  const iso = resolveArrivalIso(f);
  if (!iso) return '';
  const dest = String(f.destination || '').toUpperCase();
  const ms = flightClockUtcMs(iso, dest, f.destCountry) ?? parseTimeMs(iso);
  if (ms == null) {
    return String(iso).match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
  }
  const tz = timezoneForIata(dest, f.destCountry) || 'UTC';
  return formatInTimeZone(new Date(ms), tz, 'yyyy-MM-dd');
}

export function returnChipAnchorYmd(
  mem: { arrivalDayYmd?: string; travelDayYmd?: string },
  nowYmd: string,
): string {
  return String(mem.arrivalDayYmd || mem.travelDayYmd || nowYmd || '').slice(0, 10);
}

/** Arrival+1, +2, +3 (dest-local YMD). */
export function returnDateChipYmds(anchorYmd: string): [string, string, string] {
  return [addYmd(anchorYmd, 1), addYmd(anchorYmd, 2), addYmd(anchorYmd, 3)];
}

/** Label vs the user's today: Tomorrow only when that YMD is calendar-tomorrow. */
export function labelReturnDateChip(
  ymd: string,
  nowYmd: string,
  copy: { today: string; tomorrow: string; homeRelativeInDays: (n: number) => string },
): string {
  const offset = dateOffsetDays(ymd, nowYmd);
  if (offset <= 0) return copy.today;
  if (offset === 1) return copy.tomorrow;
  return copy.homeRelativeInDays(offset);
}

export function applyHomeDateChoice(
  q: SmartQuery,
  choice: HomeDateChoice,
  now: Date,
  locked: boolean,
): SmartQuery {
  if (choice.kind === 'unset') {
    return { ...q, dateKind: undefined, date: undefined, needsDate: true };
  }
  if (!locked && q.dateKind && q.dateKind !== 'today') return q;
  if (choice.kind === 'today') {
    return { ...q, dateKind: 'today', date: ymdFromDate(now), needsDate: false };
  }
  if (choice.kind === 'tomorrow') {
    const tom = new Date(now.getTime());
    tom.setDate(tom.getDate() + 1);
    return { ...q, dateKind: 'tomorrow', date: ymdFromDate(tom), needsDate: false };
  }
  const offset = dateOffsetDays(choice.date, ymdFromDate(now));
  const dateKind: SmartDateKind = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : 'absolute';
  return { ...q, dateKind, date: choice.date, needsDate: false };
}
