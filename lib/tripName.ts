/**
 * What to call a trip, worked out from the flights in it.
 *
 * "Bangkok · 27 sep" for one flight, "Amsterdam · 27 sep–5 okt" when the last leg brings you home again,
 * "Bangkok → Amsterdam · 27 sep" for anything else. Nothing is stored: the name is computed every time from
 * the flights themselves, so a changed date or an added leg renames the trip without anything to migrate.
 *
 * Pure, and the words come in from the caller — the same arrangement as lib/tripOrchestrator.ts, which this
 * sits next to: a module that has to run under `node --test` cannot reach lib/i18n.ts.
 */

import { airportRecByIata } from './airportsDb.ts';
import { DATE_LOCALE_TAGS } from './homeReturnDate.ts';
import { distanceKm } from './matchScore.ts';

/** One leg, as little of it as the name needs. */
export interface TripNameFlight {
  origin?: string;
  destination?: string;
  /** Wall clock of the departure; only its date is used. */
  departureIso?: string;
  /** City names the caller already localized, per IATA code. */
  originCity?: string;
  destCity?: string;
}

/** The three sentences, in the traveller's language. */
export interface TripNameCopy {
  /** "{destination} · {date}" */
  to: (destination: string, date: string) => string;
  /** "{destination} · {from}–{to}" */
  roundtrip: (destination: string, from: string, to: string) => string;
  /** "{origin} → {destination} · {date}" */
  multi: (origin: string, destination: string, date: string) => string;
}

export interface TripNameOptions {
  locale: string;
  copy: TripNameCopy;
  /** The localized city for an airport; lib/cityLocalized.ts in the app, anything in a test. */
  cityFor?: (iata: string, fallback: string) => string;
}

/**
 * How near the last arrival has to be to the first departure for the trip to count as a return. Fifty
 * kilometres, so Heathrow and Gatwick are the same trip home while Amsterdam and Brussels are not.
 */
export const ROUNDTRIP_KM = 50;

function iata(v?: string): string {
  return String(v || '').trim().toUpperCase();
}

function ymd(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim());
  return m ? m[0].slice(0, 10) : '';
}

/**
 * "27 sep" / "Sep 27" / "9月27日" — whatever the language's own short date is. Intl decides; writing month
 * names by hand would be eleven tables to keep right.
 */
export function tripDate(iso: string | undefined, locale: string): string {
  const day = ymd(iso);
  if (!day) return '';
  const [y, m, d] = day.split('-').map(Number);
  // Midday, so no timezone can move the date to the day before.
  const at = new Date(y, m - 1, d, 12, 0, 0);
  /*
   * English trips read "Sep 27", the way the flight world writes a date, while the app's date chips use
   * en-GB ("27 Sept") because that is what the rest of the interface has always said. The one place the two
   * meet is here, and the trip name follows the spec it was asked for.
   */
  const tag = String(locale || '') === 'en' ? 'en-US' : (DATE_LOCALE_TAGS[String(locale || '')] || 'en-US');
  try {
    return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }).format(at);
  } catch {
    return day;
  }
}

function cityOf(code: string, fallback: string | undefined, opts: TripNameOptions): string {
  const rec = airportRecByIata(code);
  const plain = String(fallback || rec?.city || '').trim() || code;
  if (!code) return plain;
  return opts.cityFor ? opts.cityFor(code, plain) || plain : plain;
}

/** Does the journey end where it began — the same airport, or one close enough to be the same city? */
export function isRoundtrip(flights: TripNameFlight[]): boolean {
  const list = usable(flights);
  if (list.length < 2) return false;
  const start = iata(list[0].origin);
  const end = iata(list[list.length - 1].destination);
  if (!start || !end) return false;
  if (start === end) return true;
  const a = airportRecByIata(start);
  const b = airportRecByIata(end);
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return false;
  return distanceKm(a.lat, a.lon, b.lat, b.lon) <= ROUNDTRIP_KM;
}

/** Legs with a date, in departure order: a flight with no date cannot name or bound a trip. */
function usable(flights: TripNameFlight[]): TripNameFlight[] {
  return (flights || [])
    .filter(f => !!f && !!ymd(f.departureIso))
    .slice()
    .sort((a, b) => ymd(a.departureIso).localeCompare(ymd(b.departureIso)));
}

/**
 * The trip's name, or '' when the flights do not say enough for one — an empty string shows nothing at all,
 * which is better than a header with a dash in it.
 */
export function tripName(flights: TripNameFlight[], opts: TripNameOptions): string {
  const list = usable(flights);
  if (!list.length) return '';
  const first = list[0];
  const last = list[list.length - 1];
  const firstDate = tripDate(first.departureIso, opts.locale);
  if (!firstDate) return '';

  const destination = cityOf(iata(first.destination), first.destCity, opts);
  if (!destination) return '';

  if (list.length === 1) return opts.copy.to(destination, firstDate);

  if (list.length === 2 && isRoundtrip(list)) {
    const backDate = tripDate(last.departureIso, opts.locale);
    // Both legs on one day is a day return: one date says it better than "27 sep–27 sep".
    if (!backDate || backDate === firstDate) return opts.copy.to(destination, firstDate);
    return opts.copy.roundtrip(destination, firstDate, backDate);
  }

  const lastDestination = cityOf(iata(last.destination), last.destCity, opts);
  // Everything else is a journey through several places: where it starts out for, and where it ends up.
  if (!lastDestination || lastDestination === destination) return opts.copy.to(destination, firstDate);
  return opts.copy.multi(destination, lastDestination, firstDate);
}
