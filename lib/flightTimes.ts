import { timezoneForIata } from './airportTz';

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
};

export function parseTimeMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(String(iso).trim().replace(' ', 'T')).getTime();
  return Number.isFinite(t) ? t : null;
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

function addMs(iso: string, ms: number): string {
  const t = parseTimeMs(iso);
  if (t == null) return '';
  return new Date(t + ms).toISOString();
}

export function resolveDepartureIso(f: FlightClockFields): string {
  const arrivalBanned = [
    f.actualArrival, f.estimatedArrival, f.scheduledArrival, f.arrivalTime,
  ].filter(Boolean) as string[];

  if (f.boardSide === 'arrival') {
    return firstDistinct([
      f.actualDeparture,
      f.estimatedDeparture,
      f.scheduledDeparture,
      f.departureTime,
    ], arrivalBanned);
  }

  return firstDistinct([
    f.actualDeparture,
    f.actualTime,
    f.estimatedDeparture,
    f.departureTime,
    f.boardSide === 'departure' || f.boardSide === 'both' || !f.boardSide
      ? (f.revisedTime || f.scheduledTime)
      : '',
    f.scheduledDeparture,
  ], arrivalBanned);
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
  const known = estimated || (f.status === 'landed' ? actualArr : '') || scheduled || stored || actualArr;
  if (known) return known;

  // 4. actualDeparture + flight duration
  const duration = opts?.durationMs && opts.durationMs > 15 * 60 * 1000 ? opts.durationMs : null;
  if (depIso && duration) {
    const calc = addMs(depIso, duration);
    if (calc && !sameClock(calc, depIso)) return calc;
  }

  return '';
}

export function clocksAreSame(depIso: string, arrIso: string): boolean {
  return !!depIso && !!arrIso && sameClock(depIso, arrIso);
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

  const departed = st === 'en-route'
    || !!f.actualDeparture
    || (!!f.actualTime && f.boardSide !== 'arrival');
  if (!departed) return 0;

  const depIso = f.actualDeparture || resolveDepartureIso(f);
  const arrIso = resolveArrivalIso(f, opts);
  const depMs = parseTimeMs(depIso);
  const arrMs = parseTimeMs(arrIso);
  if (depMs == null || arrMs == null || !(arrMs > depMs) || clocksAreSame(depIso, arrIso)) {
    if (st === 'en-route') return 0.5;
    if (st === 'boarding') return 0;
    return 0;
  }
  const raw = (now - depMs) / (arrMs - depMs);
  return Math.min(1, Math.max(0, raw));
}

export function baggageIso(arrIso: string, mins = 20): string {
  if (!arrIso) return '';
  return addMs(arrIso, mins * 60 * 1000);
}

export function formatClockInZone(
  iso?: string | null,
  timeZone?: string,
  hour12 = false,
): string {
  if (!iso) return EMPTY_CLOCK;
  const ms = parseTimeMs(iso);
  if (ms == null) return EMPTY_CLOCK;
  try {
    return new Date(ms).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12,
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return EMPTY_CLOCK;
  }
}

/**
 * Display a flight clock in the airport's local timezone (IATA → IANA).
 * Departure → origin IATA, arrival → destination IATA.
 */
export function formatAirportClock(
  iso?: string | null,
  iata?: string,
  hour12 = false,
  country?: string,
): string {
  const tz = iata || country ? timezoneForIata(iata, country) : '';
  if (tz) return formatClockInZone(iso, tz, hour12);

  const s = String(iso || '').trim();
  if (s && /[+-]\d{2}:?\d{2}$/.test(s) && !/Z$/i.test(s)) {
    const m = s.match(/[ T](\d{2}):(\d{2})/);
    if (m) {
      if (!hour12) return `${m[1]}:${m[2]}`;
      const h = Number(m[1]);
      const min = Number(m[2]);
      const am = h < 12;
      return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
    }
  }
  return formatClockInZone(iso, undefined, hour12);
}

/** "Amsterdam time" when origin/dest TZ differ, otherwise "local". */
export function airportClockLabel(city?: string, iata?: string, otherIata?: string): string {
  if (iata && otherIata && timezoneForIata(iata) !== timezoneForIata(otherIata)) {
    const short = String(city || '')
      .replace(/\s+(International\s+)?Airport.*$/i, '')
      .split(',')[0]
      .trim();
    if (short && short.length <= 18) return `${short} time`;
    if (iata) return `${iata} time`;
  }
  return 'local';
}

export function enrouteRangeLabel(
  depIso: string,
  arrIso: string,
  fmtDep: (iso: string) => string,
  fmtArr?: (iso: string) => string,
): string {
  const fmtA = fmtArr || fmtDep;
  const d = depIso ? fmtDep(depIso) : '';
  const a = arrIso ? fmtA(arrIso) : '';
  if (d && a && d !== a && !clocksAreSame(depIso, arrIso)) return `${d} – ${a}`;
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
        departureTime: '2026-08-15T08:10:00Z',
        scheduledDeparture: '2026-08-15T08:10:00Z',
      },
    },
  ];

  const out = samples.map(({ number, f, durationMs }) => {
    const dep = resolveDepartureIso(f);
    const arr = resolveArrivalIso(f, { durationMs });
    if (!dep) throw new Error(`${number}: missing departure`);
    if (!arr) throw new Error(`${number}: missing arrival`);
    if (clocksAreSame(dep, arr)) throw new Error(`${number}: dep and arr collapsed to ${dep}`);
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
  if (airportClockLabel('Amsterdam', 'AMS', 'SIN') !== 'Amsterdam time') {
    throw new Error(`SQ324 label expected Amsterdam time, got ${airportClockLabel('Amsterdam', 'AMS', 'SIN')}`);
  }

  return out;
}
