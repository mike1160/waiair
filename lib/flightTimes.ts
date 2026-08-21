import { formatInTimeZone } from 'date-fns-tz';
import { timezoneForIata } from './airportTz';
import { isoInAirportTzToUtcMs, isoInIanaTzToUtcMs, normalizeFlightIso } from './localFlightTime';

/** Single source of truth: departure and arrival clocks must never collapse to the same ISO. */

export const EMPTY_CLOCK = '–:–';

export type FlightClockFields = {
  status?: string;
  scheduledTime?: string;
  revisedTime?: string;
  actualTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  /** FIDS board movement side — arrival boards store arrival in scheduledTime. */
  boardSide?: 'arrival' | 'departure' | 'both';
  origin?: string;
  destination?: string;
  originCountry?: string;
  destCountry?: string;
};

export function parseTimeMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(normalizeFlightIso(iso)).getTime();
  return Number.isFinite(t) ? t : null;
}

/** UTC instant of a FIDS clock at origin or destination IANA zone. */
export function flightClockUtcMs(
  iso?: string | null,
  iata?: string,
  country?: string,
): number | null {
  return isoInAirportTzToUtcMs(iso, iata, country) ?? parseTimeMs(iso);
}

function nonEmpty(iso?: string | null): string {
  const s = String(iso || '').trim();
  return s || '';
}

function sameClock(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ma = parseTimeMs(a);
  const mb = parseTimeMs(b);
  if (ma == null || mb == null) return false;
  return Math.abs(ma - mb) < 60 * 1000;
}

function firstDistinct(candidates: Array<string | undefined>, banned: string[]): string {
  for (const c of candidates) {
    const v = nonEmpty(c);
    if (!v) continue;
    if (banned.some(b => sameClock(v, b))) continue;
    return v;
  }
  return '';
}

export function typicalDurationMs(
  originLat?: number | null,
  originLon?: number | null,
  destLat?: number | null,
  destLon?: number | null,
): number | null {
  if (originLat == null || originLon == null || destLat == null || destLon == null) return null;
  const r = 6371;
  const p1 = originLat * Math.PI / 180;
  const p2 = destLat * Math.PI / 180;
  const dLat = (destLat - originLat) * Math.PI / 180;
  const dLon = (destLon - originLon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  const km = 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
  if (!(km > 30)) return 45 * 60 * 1000;
  const cruiseH = km / 780;
  const blockH = cruiseH + 0.7;
  return Math.round(Math.min(18, Math.max(0.75, blockH)) * 3600 * 1000);
}

function addMs(iso: string, ms: number, iata?: string, country?: string): string {
  const t = isoInAirportTzToUtcMs(iso, iata, country) ?? parseTimeMs(iso);
  if (t == null) return '';
  return new Date(t + ms).toISOString();
}

function arrivalAnchorIso(f: FlightClockFields): string {
  return firstDistinct([
    f.actualArrival,
    f.estimatedArrival,
    f.scheduledArrival,
    f.arrivalTime,
    f.boardSide === 'arrival' ? (f.revisedTime || f.scheduledTime || f.actualTime) : '',
  ], []);
}

export function offsetIso(iso: string, ms: number, iata?: string, country?: string): string {
  return addMs(iso, ms, iata, country);
}

export function resolveDepartureIso(
  f: FlightClockFields,
  opts?: { durationMs?: number | null },
): string {
  const arrivalBanned = [
    f.actualArrival, f.estimatedArrival, f.scheduledArrival, f.arrivalTime,
  ].filter(Boolean) as string[];

  const known = f.boardSide === 'arrival'
    ? firstDistinct([
      f.actualDeparture,
      f.estimatedDeparture,
      f.scheduledDeparture,
      f.departureTime,
    ], arrivalBanned)
    : firstDistinct([
      f.actualDeparture,
      f.actualTime,
      f.estimatedDeparture,
      f.departureTime,
      f.boardSide === 'departure' || f.boardSide === 'both' || !f.boardSide
        ? (f.revisedTime || f.scheduledTime)
        : '',
      f.scheduledDeparture,
    ], arrivalBanned);
  if (known) return known;

  // FIDS arrivals often have no departure.scheduled — infer from arrival minus block time.
  const duration = opts?.durationMs && opts.durationMs > 15 * 60 * 1000 ? opts.durationMs : null;
  const arrIso = arrivalAnchorIso(f);
  if (duration && arrIso) {
    const calc = addMs(arrIso, -duration, f.destination, f.destCountry);
    if (calc && !sameClock(calc, arrIso)) return calc;
  }
  return '';
}

export function resolveArrivalIso(
  f: FlightClockFields,
  opts?: { durationMs?: number | null },
): string {
  const depIso = resolveDepartureIso(f);
  const depBanned = [
    depIso,
    f.actualDeparture,
    f.estimatedDeparture,
    f.scheduledDeparture,
    f.departureTime,
  ].filter(Boolean) as string[];

  if (f.boardSide === 'departure' || f.boardSide === 'both' || !f.boardSide) {
    depBanned.push(f.scheduledTime || '', f.revisedTime || '', f.actualTime || '');
  }

  const estimated = firstDistinct([
    f.estimatedArrival,
    f.boardSide === 'arrival' ? f.revisedTime : '',
  ], depBanned);

  const scheduled = firstDistinct([
    f.scheduledArrival,
    f.boardSide === 'arrival' ? f.scheduledTime : '',
  ], depBanned);

  const actualArr = firstDistinct([
    f.actualArrival,
    f.boardSide === 'arrival' ? f.actualTime : '',
  ], depBanned);

  const stored = firstDistinct([f.arrivalTime], depBanned);

  // 1. estimated arrival  2. scheduled arrival  3. stored arrival (if distinct)
  const known = actualArr || estimated || scheduled || stored;
  if (known) return known;

  // 4. actualDeparture + flight duration
  const duration = opts?.durationMs && opts.durationMs > 15 * 60 * 1000 ? opts.durationMs : null;
  if (depIso && duration) {
    const calc = addMs(depIso, duration, f.origin, f.originCountry);
    if (calc && !sameClock(calc, depIso)) return calc;
  }

  return '';
}

/** True when dep and arr are the same UTC instant (origin TZ vs dest TZ). */
export function clocksAreSame(
  depIso: string,
  arrIso: string,
  f?: Pick<FlightClockFields, 'origin' | 'destination' | 'originCountry' | 'destCountry'>,
): boolean {
  if (!depIso || !arrIso) return false;
  const a = flightClockUtcMs(depIso, f?.origin, f?.originCountry);
  const b = flightClockUtcMs(arrIso, f?.destination, f?.destCountry);
  if (a != null && b != null) return Math.abs(a - b) < 60 * 1000;
  return sameClock(depIso, arrIso);
}

/** 0–1 progress: (now - actualDeparture) / (estimatedArrival - actualDeparture). */
export function flightProgressPct(
  f: FlightClockFields,
  now = Date.now(),
  opts?: { durationMs?: number | null },
): number {
  const st = String(f.status || '').toLowerCase();
  if (st === 'landed') return 1;
  if (st === 'cancelled' || st === 'canceled') return 0;

  const depIso = f.actualDeparture || resolveDepartureIso(f);
  const depMs = flightClockUtcMs(depIso, f.origin, f.originCountry);
  const departed = st === 'en-route'
    || st === 'departed'
    || !!f.actualDeparture
    || (!!f.actualTime && f.boardSide !== 'arrival')
    || (depMs != null && depMs <= now);
  if (!departed) return 0;
  const arrIso = resolveArrivalIso(f, opts);
  const arrMs = flightClockUtcMs(arrIso, f.destination, f.destCountry);
  if (depMs == null || arrMs == null || !(arrMs > depMs) || clocksAreSame(depIso, arrIso, f)) {
    if (st === 'en-route' || st === 'departed' || (depMs != null && depMs <= now)) return 0.15;
    if (st === 'boarding') return 0;
    return 0;
  }
  const raw = (now - depMs) / (arrMs - depMs);
  return Math.min(1, Math.max(0, raw));
}

export function baggageIso(arrIso: string, mins = 20, destIata?: string, destCountry?: string): string {
  if (!arrIso) return '';
  return addMs(arrIso, mins * 60 * 1000, destIata, destCountry);
}

export function formatClockInZone(
  iso?: string | null,
  timeZone?: string,
  hour12 = false,
): string {
  if (!iso) return EMPTY_CLOCK;
  const ms = timeZone
    ? isoInIanaTzToUtcMs(iso, timeZone)
    : parseTimeMs(iso);
  if (ms == null) return EMPTY_CLOCK;
  if (timeZone) return formatMsInZone(ms, timeZone, hour12);
  try {
    return formatInTimeZone(new Date(ms), 'UTC', hour12 ? 'hh:mm a' : 'HH:mm');
  } catch {
    return EMPTY_CLOCK;
  }
}

function formatMsInZone(ms: number, timeZone: string, hour12 = false): string {
  try {
    return formatInTimeZone(new Date(ms), timeZone, hour12 ? 'hh:mm a' : 'HH:mm');
  } catch {
    try {
      return new Date(ms).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12,
        timeZone,
      });
    } catch {
      return EMPTY_CLOCK;
    }
  }
}

/**
 * Display a flight clock in the airport IANA zone (Europe/Amsterdam, Asia/Bangkok, …).
 * Departure → origin IATA, arrival → destination IATA. DST via date-fns-tz.
 */
export function formatAirportClock(
  iso?: string | null,
  iata?: string,
  hour12 = false,
  country?: string,
): string {
  const tz = timezoneForIata(iata, country);
  const ms = isoInAirportTzToUtcMs(iso, iata, country);
  if (ms == null) return EMPTY_CLOCK;
  return formatMsInZone(ms, tz, hour12);
}

/** Always `${IATA} time` — never city name or "local". */
export function airportClockLabel(
  _city?: string,
  iata?: string,
  ..._unused: unknown[]
): string {
  const code = String(iata || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return `${code} time`;
  return '';
}

/** "15:20 AMS time" */
export function formatAirportClockLabeled(
  iso?: string | null,
  iata?: string,
  hour12 = false,
  country?: string,
): string {
  const clock = formatAirportClock(iso, iata, hour12, country);
  const suffix = airportClockLabel('', iata);
  if (clock === EMPTY_CLOCK) return clock;
  return suffix ? `${clock} ${suffix}` : clock;
}

/** "Arrives 19:31 JFK time" */
export function formatArrivesClockLabeled(
  iso?: string | null,
  iata?: string,
  hour12 = false,
  country?: string,
): string {
  const labeled = formatAirportClockLabeled(iso, iata, hour12, country);
  if (labeled === EMPTY_CLOCK) return labeled;
  return `Arrives ${labeled}`;
}

export function formatAirportDate(
  iso?: string | null,
  iata?: string,
  country?: string,
): string {
  const tz = timezoneForIata(iata, country);
  const ms = isoInAirportTzToUtcMs(iso, iata, country);
  if (ms == null) return '';
  try {
    return formatInTimeZone(new Date(ms), tz, 'd MMM yyyy');
  } catch {
    return '';
  }
}

export function enrouteRangeLabel(
  depIso: string,
  arrIso: string,
  fmtDep: (iso: string) => string,
  fmtArr?: (iso: string) => string,
  f?: Pick<FlightClockFields, 'origin' | 'destination' | 'originCountry' | 'destCountry'>,
): string {
  const fmtA = fmtArr || fmtDep;
  const d = depIso ? fmtDep(depIso) : '';
  const a = arrIso ? fmtA(arrIso) : '';
  if (d && a && d !== a && !clocksAreSame(depIso, arrIso, f)) return `${d} – ${a}`;
  if (a && a !== EMPTY_CLOCK) return a;
  return '';
}

/** Three canonical flights used to lock the arrival/departure split. */
export function verifyFlightTimeFixtures(
  fmt: (iso: string) => string = (iso) => {
    if (!iso) return EMPTY_CLOCK;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return EMPTY_CLOCK;
    return d.toISOString().slice(11, 16);
  },
): { number: string; dep: string; arr: string; progress: number }[] {
  const now = Date.parse('2026-08-15T12:00:00Z');
  const samples: Array<{ number: string; f: FlightClockFields; durationMs?: number }> = [
    {
      number: 'TG931',
      durationMs: 11 * 3600 * 1000,
      f: {
        status: 'en-route',
        boardSide: 'both',
        scheduledDeparture: '2026-08-15T01:00:00Z',
        actualDeparture: '2026-08-15T01:12:00Z',
        estimatedDeparture: '2026-08-15T01:12:00Z',
        scheduledArrival: '2026-08-15T12:20:00Z',
        estimatedArrival: '2026-08-15T12:35:00Z',
        departureTime: '2026-08-15T01:12:00Z',
        arrivalTime: '2026-08-15T12:35:00Z',
        scheduledTime: '2026-08-15T01:00:00Z',
        revisedTime: '2026-08-15T01:12:00Z',
        actualTime: '2026-08-15T01:12:00Z',
      },
    },
    {
      number: 'SQ972',
      f: {
        status: 'en-route',
        boardSide: 'departure',
        scheduledTime: '2026-08-15T10:00:00Z',
        revisedTime: '2026-08-15T10:00:00Z',
        actualTime: '2026-08-15T10:08:00Z',
        departureTime: '2026-08-15T10:08:00Z',
        scheduledDeparture: '2026-08-15T10:00:00Z',
        actualDeparture: '2026-08-15T10:08:00Z',
        arrivalTime: '',
      },
      durationMs: 2.2 * 3600 * 1000,
    },
    {
      number: 'EK373',
      f: {
        status: 'scheduled',
        boardSide: 'arrival',
        scheduledTime: '2026-08-15T14:40:00Z',
        revisedTime: '2026-08-15T14:55:00Z',
        scheduledArrival: '2026-08-15T14:40:00Z',
        estimatedArrival: '2026-08-15T14:55:00Z',
        arrivalTime: '2026-08-15T14:55:00Z',
        departureTime: '2026-08-15T13:10:00Z',
        scheduledDeparture: '2026-08-15T13:10:00Z',
      },
    },
  ];

  const out = samples.map(({ number, f, durationMs }) => {
    const dep = resolveDepartureIso(f);
    const arr = resolveArrivalIso(f, { durationMs });
    if (!dep) throw new Error(`${number}: missing departure`);
    if (!arr) throw new Error(`${number}: missing arrival`);
    if (clocksAreSame(dep, arr, f)) throw new Error(`${number}: dep and arr collapsed to ${dep}`);
    const progress = flightProgressPct(f, now, { durationMs });
    if (number === 'SQ972' && !(progress > 0 && progress < 1)) {
      throw new Error(`${number}: expected in-flight progress, got ${progress}`);
    }
    if (number === 'EK373' && progress !== 0) {
      throw new Error(`${number}: scheduled flight should be 0% progress, got ${progress}`);
    }
    return { number, dep: fmt(dep), arr: fmt(arr), progress };
  });

  const sq324ArrUtc = '2026-08-16T05:15:00.000Z';
  const ams = formatAirportClock(sq324ArrUtc, 'AMS');
  const bkk = formatAirportClock(sq324ArrUtc, 'BKK');
  if (ams !== '07:15') throw new Error(`SQ324 AMS clock expected 07:15, got ${ams}`);
  if (bkk !== '12:15') throw new Error(`SQ324 BKK clock expected 12:15, got ${bkk}`);

  // Winter: Europe/Amsterdam is UTC+1 (last Sunday Oct → last Sunday Mar). Bangkok is always UTC+7.
  const sq324ArrUtcWinter = '2026-01-16T05:15:00.000Z';
  const amsWinter = formatAirportClock(sq324ArrUtcWinter, 'AMS');
  const bkkWinter = formatAirportClock(sq324ArrUtcWinter, 'BKK');
  if (amsWinter !== '06:15') throw new Error(`SQ324 winter AMS clock expected 06:15, got ${amsWinter}`);
  if (bkkWinter !== '12:15') throw new Error(`SQ324 winter BKK clock expected 12:15, got ${bkkWinter}`);

  // Naive FIDS walls: AMS 14:15 summer and BKK 06:15 next day are 11h apart, not 16h (device TZ).
  const naiveDep = '2026-08-19T14:15:00';
  const naiveArr = '2026-08-20T06:15:00';
  if (formatAirportClock(naiveDep, 'AMS') !== '14:15') {
    throw new Error(`naive AMS clock expected 14:15, got ${formatAirportClock(naiveDep, 'AMS')}`);
  }
  if (formatAirportClock(naiveArr, 'BKK') !== '06:15') {
    throw new Error(`naive BKK clock expected 06:15, got ${formatAirportClock(naiveArr, 'BKK')}`);
  }
  const naiveDepMs = isoInAirportTzToUtcMs(naiveDep, 'AMS', 'NL');
  const naiveArrMs = isoInAirportTzToUtcMs(naiveArr, 'BKK', 'TH');
  if (naiveDepMs == null || naiveArrMs == null) throw new Error('naive AMS/BKK instants missing');
  const naiveBlock = naiveArrMs - naiveDepMs;
  if (naiveBlock !== 11 * 3600 * 1000) {
    throw new Error(`AMS→BKK naive block expected 11h, got ${naiveBlock / 3600000}h`);
  }
  if (clocksAreSame(naiveDep, naiveArr, {
    origin: 'AMS', destination: 'BKK', originCountry: 'NL', destCountry: 'TH',
  })) {
    throw new Error('AMS 14:15 and BKK 06:15 must not collapse as the same clock');
  }

  if (airportClockLabel('Amsterdam', 'AMS', 'SIN') !== 'AMS time') {
    throw new Error(`SQ324 label expected AMS time, got ${airportClockLabel('Amsterdam', 'AMS', 'SIN')}`);
  }
  const labeledAms = formatAirportClockLabeled(sq324ArrUtc, 'AMS');
  const labeledBkk = formatAirportClockLabeled(sq324ArrUtc, 'BKK');
  if (labeledAms !== '07:15 AMS time') throw new Error(`labeled AMS expected 07:15 AMS time, got ${labeledAms}`);
  if (labeledBkk !== '12:15 BKK time') throw new Error(`labeled BKK expected 12:15 BKK time, got ${labeledBkk}`);
  const arrivesJfk = formatArrivesClockLabeled('2026-08-16T23:31:00.000Z', 'JFK');
  if (arrivesJfk !== 'Arrives 19:31 JFK time') {
    throw new Error(`JFK arrival label expected Arrives 19:31 JFK time, got ${arrivesJfk}`);
  }

  return out;
}
