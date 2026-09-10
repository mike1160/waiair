/** Tracked-home / detail nav title: "{destination city} · {relative day}". */

import { formatInTimeZone } from 'date-fns-tz';
import { airportRecByIata } from './airportsDb.ts';
import { timezoneForIata } from './airportTz.ts';
import { getLocalizedCity } from './cityLocalized.ts';
import { dateFnsLocale } from './dateLocale.ts';
import { homeRelativeDayOffset } from './homeNow.ts';

export function formatOriginCalendarDay(
  depMs: number,
  originIata: string | undefined,
  originCountry: string | undefined,
  locale: string,
): string {
  const tz = timezoneForIata(originIata, originCountry) || 'UTC';
  return formatInTimeZone(new Date(depMs), tz, 'EEE d MMM', { locale: dateFnsLocale(locale) });
}

export function homeTripDayLabel(opts: {
  offset: number;
  depMs: number | null;
  originIata?: string;
  originCountry?: string;
  locale: string;
  today: string;
  tomorrow: string;
}): string {
  if (!(opts.offset > 0)) return opts.today;
  if (opts.offset === 1) return opts.tomorrow;
  if (opts.depMs != null && Number.isFinite(opts.depMs)) {
    return formatOriginCalendarDay(opts.depMs, opts.originIata, opts.originCountry, opts.locale);
  }
  return '';
}

export function formatHomeTripTitle(city: string, day: string): string {
  const c = String(city || '').trim();
  const d = String(day || '').trim();
  if (c && d) return `${c} · ${d}`;
  return c || d;
}

export function homeTripTitle(opts: {
  destIata?: string;
  destCity?: string;
  originIata?: string;
  originCountry?: string;
  depMs: number | null;
  now: number;
  locale: string;
  today: string;
  tomorrow: string;
}): string {
  const dest = String(opts.destIata || '').trim().toUpperCase();
  const rec = dest ? airportRecByIata(dest) : undefined;
  const city = dest
    ? getLocalizedCity(dest, opts.locale, opts.destCity || rec?.city || dest)
    : String(opts.destCity || '').trim();
  const offset = homeRelativeDayOffset(opts.depMs, opts.now, opts.originIata, opts.originCountry);
  const day = homeTripDayLabel({
    offset,
    depMs: opts.depMs,
    originIata: opts.originIata,
    originCountry: opts.originCountry,
    locale: opts.locale,
    today: opts.today,
    tomorrow: opts.tomorrow,
  });
  return formatHomeTripTitle(city, day);
}
