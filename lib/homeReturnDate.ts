/** Return-chip date: no preselect; chips relative to outbound arrival in dest TZ. */

import { formatInTimeZone } from 'date-fns-tz';
import { timezoneForIata } from './airportTz.ts';
import {
  flightClockUtcMs,
  parseTimeMs,
  resolveArrivalIso,
  type FlightClockFields,
} from './flightTimes.ts';
import { addLocalDays, toLocalDateString } from './localFlightTime.ts';
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
  const day = String(ymd || '').slice(0, 10);
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return toLocalDateString(addLocalDays(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), days));
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

/** Map a BCBP / scanned YMD onto the home date chip (today, tomorrow, or a picked day). */
export function homeDateChoiceFromYmd(ymd: string | undefined, now = new Date()): HomeDateChoice {
  const day = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { kind: 'today' };
  const offset = dateOffsetDays(day, ymdFromDate(now));
  if (offset <= 0) return { kind: 'today' };
  if (offset === 1) return { kind: 'tomorrow' };
  return { kind: 'ymd', date: day };
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
  if (!locked && q.dateKind) return q;
  if (choice.kind === 'today') {
    return { ...q, dateKind: 'today', date: ymdFromDate(now), needsDate: false };
  }
  if (choice.kind === 'tomorrow') {
    return { ...q, dateKind: 'tomorrow', date: ymdFromDate(addLocalDays(now, 1)), needsDate: false };
  }
  const offset = dateOffsetDays(choice.date, ymdFromDate(now));
  const dateKind: SmartDateKind = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : 'absolute';
  return { ...q, dateKind, date: choice.date, needsDate: false };
}

/**
 * The app's language codes as the BCP 47 tags Intl wants. One map, so a date in the trip name and a date on
 * a chip cannot be formatted by two different ideas of what "nl" means.
 */
export const DATE_LOCALE_TAGS: Record<string, string> = {
  en: 'en-GB',
  nl: 'nl-NL',
  de: 'de-DE',
  es: 'es-ES',
  id: 'id-ID',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ru: 'ru-RU',
  vi: 'vi-VN',
  th: 'th-TH',
  zh: 'zh-CN',
};

/** Chip label after picking a day: "vr 19 sep" / "Fri 19 Sep". */
export function formatPickDateChip(ymd: string, locale?: string): string {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const tag = DATE_LOCALE_TAGS[String(locale || '')] || 'en-GB';
  try {
    return new Intl.DateTimeFormat(tag, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(d).replace(/,/g, '');
  } catch {
    return `${Number(m[3])} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]}`;
  }
}
