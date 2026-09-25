/**
 * A flight as the app knows it, turned into what the calendar needs.
 *
 * The app's flight objects carry a dozen clocks and two possible routes; lib/ical.ts takes one departure,
 * one arrival and two airports. The reduction happens here, through the same resolvers the cards use, so the
 * entry in the traveller's calendar cannot disagree with the card they tapped it from.
 */

import { airportRecByIata } from './airportsDb.ts';
import { formatFlightNumber } from './flightIdent.ts';
import { resolveArrivalIso, resolveDepartureIso, type FlightClockFields } from './flightTimes.ts';
import { t } from './i18n';
import { getPrefs } from './prefs.ts';
import type { IcalFlight, IcalLabels, IcalOptions } from './ical.ts';
import { getLocale } from './i18n';

/** Everything the calendar entry can read off a flight; all of it optional but the number. */
export type CalendarFlightInput = FlightClockFields & {
  number?: string;
  operatingNumber?: string;
  airline?: string;
  terminal?: string;
  depTerminal?: string;
  arrTerminal?: string;
  departureGate?: string;
  gate?: string;
  aircraft?: string;
};

/** The description's words, in the app's language. Only two of these are new — the rest the app already says. */
export function icalLabels(): IcalLabels {
  const copy = t();
  return {
    flight: copy.bookingCardFlight,
    from: copy.from,
    to: copy.to,
    departs: copy.departs,
    arrives: copy.arrives,
    terminal: copy.terminal,
    gate: copy.gateWord,
    aircraft: copy.myFlightAircraft,
    localTime: copy.calendarLocalTime,
    bookedVia: copy.calendarBookedVia,
    reminder: copy.calendarReminder,
  };
}

/** The clocks in the description follow the app's own 24h/12h setting, like every other clock in it. */
export function icalOptions(opts?: { hour12?: boolean }): IcalOptions {
  return {
    labels: icalLabels(),
    locale: getLocale() === 'zh' ? 'zh-CN' : getLocale(),
    hour12: opts?.hour12 ?? getPrefs().timeFormat === '12h',
  };
}

/**
 * One flight, reduced. `route` lets a screen pass the origin and destination it already worked out — the
 * detail screen resolves those against the board it came from, and its answer is the better one.
 */
export function icalFlightFrom(
  f: CalendarFlightInput,
  route?: { origin?: string; destination?: string },
): IcalFlight {
  const origin = String(route?.origin || f.origin || '').trim().toUpperCase();
  const destination = String(route?.destination || f.destination || '').trim().toUpperCase();
  const departureIso = resolveDepartureIso(f);
  const arrivalIso = resolveArrivalIso(f);
  return {
    flightNumber: formatFlightNumber({ number: f.number || '', operatingNumber: f.operatingNumber }),
    airline: f.airline,
    origin,
    destination,
    originName: airportRecByIata(origin)?.name || '',
    destName: airportRecByIata(destination)?.name || '',
    originCountry: f.originCountry,
    destCountry: f.destCountry,
    departureIso,
    arrivalIso,
    // The departure side is what a calendar entry is about: its terminal and gate, not the arrival's.
    terminal: String(f.depTerminal || f.terminal || '').trim(),
    gate: String(f.departureGate || f.gate || '').trim(),
    aircraft: String(f.aircraft || '').trim(),
  };
}
