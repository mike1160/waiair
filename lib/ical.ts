/**
 * A flight as a calendar entry (RFC 5545), so a trip can live in the traveller's own agenda.
 *
 * Everything here is pure text: the times come in as the wall clocks the airports show — the same strings
 * the rest of the app reads — and go out as UTC instants, because that is the only way a calendar in Bangkok
 * and a calendar in Amsterdam can agree on when a flight leaves. The local clocks are still written into the
 * description, where a human reads them and no software has to interpret them.
 *
 * No React Native, no Expo, no file system: writing the file and opening the share sheet is
 * services/calendarExport.ts. This part is testable on its own, which is the point — a calendar file that is
 * one character off is rejected without explanation by every app that reads it.
 */

import { knownTimeZone } from './airportTz.ts';
import { isoInAirportTzToUtcMs } from './localFlightTime.ts';

/** One flight, already resolved by the caller (routes and clocks are the app's own business). */
export interface IcalFlight {
  flightNumber: string;
  airline?: string;
  origin?: string;
  destination?: string;
  /** Full airport names for LOCATION; the IATA code is used when a name is unknown. */
  originName?: string;
  destName?: string;
  originCountry?: string;
  destCountry?: string;
  /** Wall clock at the departure airport, as the app resolves it. */
  departureIso?: string;
  /** Wall clock at the arrival airport. */
  arrivalIso?: string;
  terminal?: string;
  gate?: string;
  aircraft?: string;
}

/** The words in the description, in the traveller's language. */
export interface IcalLabels {
  flight: string;
  from: string;
  to: string;
  departs: string;
  arrives: string;
  terminal: string;
  gate: string;
  aircraft: string;
  /** "(local time)", after each clock. */
  localTime: string;
  bookedVia: string;
  reminder: string;
}

export interface IcalOptions {
  labels: IcalLabels;
  /** BCP 47 tag for the human-readable clocks in the description. */
  locale?: string;
  hour12?: boolean;
  /** Fixed clock for DTSTAMP; the tests rely on it. */
  dtstampMs?: number;
}

/** Three hours before departure, and the day before. */
export const ALARM_TRIGGERS = ['-PT3H', '-P1D'] as const;

const CRLF = '\r\n';

/** YYYYMMDDTHHMMSSZ — the only time format a calendar may be handed. */
export function icalUtcStamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`
    + `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * RFC 5545 text escaping. Backslash first — escaping it after the others would escape their backslashes too.
 */
export function icalEscape(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Content lines are at most 75 octets, continued with a leading space. Counted in bytes, not characters: a
 * Thai airport name is three bytes a letter, and a line split through the middle of one arrives as mojibake.
 */
export function foldIcalLine(line: string): string {
  const bytes = [...line].map(ch => ({ ch, size: new TextEncoder().encode(ch).length }));
  const out: string[] = [];
  let current = '';
  let size = 0;
  // The continuation space costs an octet, so every line after the first may hold one byte less.
  for (const { ch, size: chSize } of bytes) {
    const limit = out.length === 0 ? 75 : 74;
    if (size + chSize > limit) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += chSize;
  }
  out.push(current);
  return out.join(`${CRLF} `);
}

function code(value?: string): string {
  return String(value || '').trim().toUpperCase();
}

/**
 * A label the board shows in capitals ("TERMINAL") would shout inside a calendar description, so an
 * all-uppercase label is written as a sentence. Scripts without capitals are left exactly as they are.
 */
export function sentenceLabel(label: string): string {
  const raw = String(label || '').trim();
  if (!raw || raw !== raw.toLocaleUpperCase() || raw === raw.toLocaleLowerCase()) return raw;
  const lower = raw.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

/** "Thai Airways TG208 · HKT → BKK" */
export function icalSummary(f: IcalFlight): string {
  const airline = String(f.airline || '').trim();
  const head = [airline && airline !== '—' ? airline : '', String(f.flightNumber || '').trim()]
    .filter(Boolean).join(' ');
  const route = [code(f.origin), code(f.destination)].filter(Boolean).join(' → ');
  return [head, route].filter(Boolean).join(' · ');
}

/** "Phuket International Airport (HKT)", or whichever half of that is known. */
export function icalLocation(f: IcalFlight): string {
  const name = String(f.originName || '').trim();
  const iata = code(f.origin);
  if (name && iata) return `${name} (${iata})`;
  return name || iata;
}

function departureUtcMs(f: IcalFlight): number | null {
  return isoInAirportTzToUtcMs(f.departureIso, code(f.origin), f.originCountry);
}

function arrivalUtcMs(f: IcalFlight): number | null {
  return isoInAirportTzToUtcMs(f.arrivalIso, code(f.destination), f.destCountry);
}

/** The local clock a person reads: "Sun 27 Sep 13:00", in the airport's own timezone. */
function localClock(iso: string | undefined, iata: string, country: string | undefined, opts: IcalOptions): string {
  const ms = isoInAirportTzToUtcMs(iso, iata, country);
  if (ms == null) return '';
  // No zone on file: leave it to the device rather than pretend the airport is on UTC.
  const tz = knownTimeZone(iata, country) || '';
  try {
    return new Intl.DateTimeFormat(opts.locale || 'en', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: !!opts.hour12,
      ...(tz ? { timeZone: tz } : {}),
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

function descriptionLines(f: IcalFlight, opts: IcalOptions): string[] {
  const L = opts.labels;
  const label = (s: string) => sentenceLabel(s);
  const depClock = localClock(f.departureIso, code(f.origin), f.originCountry, opts);
  const arrClock = localClock(f.arrivalIso, code(f.destination), f.destCountry, opts);
  const place = (name?: string, iata?: string) => {
    const n = String(name || '').trim();
    const k = code(iata);
    return n && k ? `${n} (${k})` : (n || k);
  };
  const withLocal = (clock: string) => [clock, L.localTime].filter(Boolean).join(' ');

  return [
    `${label(L.flight)}: ${String(f.flightNumber || '').trim()}`,
    `${label(L.from)}: ${place(f.originName, f.origin)}`,
    `${label(L.to)}: ${place(f.destName, f.destination)}`,
    depClock ? `${label(L.departs)}: ${withLocal(depClock)}` : '',
    arrClock ? `${label(L.arrives)}: ${withLocal(arrClock)}` : '',
    // Terminal, gate and aircraft are left out entirely when the flight has not been given them yet.
    String(f.terminal || '').trim() ? `${label(L.terminal)}: ${String(f.terminal).trim()}` : '',
    String(f.gate || '').trim() ? `${label(L.gate)}: ${String(f.gate).trim()}` : '',
    String(f.aircraft || '').trim() ? `${label(L.aircraft)}: ${String(f.aircraft).trim()}` : '',
    L.bookedVia,
  ].filter(Boolean);
}

/**
 * A stable id, so importing the same flight twice updates the entry instead of adding a second one.
 */
export function icalUid(f: IcalFlight, startMs: number): string {
  const day = icalUtcStamp(startMs).slice(0, 8);
  const parts = [String(f.flightNumber || 'flight').trim().toUpperCase(), day, code(f.origin)].filter(Boolean);
  return `${parts.join('-')}@waiair.app`;
}

function vevent(f: IcalFlight, opts: IcalOptions): string[] {
  const startMs = departureUtcMs(f);
  // Nothing to put in a calendar without a departure: the entry would have no place in time.
  if (startMs == null) return [];
  const endMs = arrivalUtcMs(f);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${icalUid(f, startMs)}`,
    `DTSTAMP:${icalUtcStamp(opts.dtstampMs ?? Date.now())}`,
    `DTSTART:${icalUtcStamp(startMs)}`,
    // An arrival that is missing, unreadable or before the departure is left out rather than invented.
    endMs != null && endMs > startMs ? `DTEND:${icalUtcStamp(endMs)}` : '',
    `SUMMARY:${icalEscape(icalSummary(f))}`,
    `LOCATION:${icalEscape(icalLocation(f))}`,
    `DESCRIPTION:${icalEscape(descriptionLines(f, opts).join('\n'))}`,
  ].filter(Boolean);
  for (const trigger of ALARM_TRIGGERS) {
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER:${trigger}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${icalEscape(opts.labels.reminder)}`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/** The whole file: one VEVENT per flight, in the order given. */
export function buildIcal(flights: IcalFlight[], opts: IcalOptions): string {
  const events = (flights || [])
    .filter(f => f && String(f.flightNumber || '').trim())
    .flatMap(f => vevent(f, opts));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WaiAir//WaiAir//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcalLine).join(CRLF)}${CRLF}`;
}

/** True when there is at least one flight the calendar can take. */
export function hasIcalEvents(flights: IcalFlight[], opts: IcalOptions): boolean {
  return (flights || []).some(f => f && String(f.flightNumber || '').trim() && vevent(f, opts).length > 0);
}

/** `TG208-2026-09-27.ics`, and `TG208-2026-09-27-trip.ics` when the file holds a whole trip. */
export function icalFileName(flights: IcalFlight[]): string {
  const list = (flights || []).filter(f => f && String(f.flightNumber || '').trim());
  const first = list[0];
  const number = String(first?.flightNumber || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'flight';
  const startMs = first ? departureUtcMs(first) : null;
  const day = startMs == null
    ? ''
    : `${icalUtcStamp(startMs).slice(0, 4)}-${icalUtcStamp(startMs).slice(4, 6)}-${icalUtcStamp(startMs).slice(6, 8)}`;
  const tail = list.length > 1 ? '-trip' : '';
  return `${[number || 'flight', day].filter(Boolean).join('-')}${tail}.ics`;
}
