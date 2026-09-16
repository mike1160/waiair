/**
 * Inbound aircraft for a departure: previous flight of the same registration
 * that lands at this flight's origin before it leaves.
 *
 * HKT is Phuket, Thailand (Asia/Bangkok, UTC+7), not Hong Kong (HKG, UTC+8).
 */
import { usableAirportCode } from './airportCode.ts';
import { flightClockUtcMs } from './flightTimes.ts';
import { normalizeFlightIso } from './localFlightTime.ts';

export const MIN_TURNAROUND_MS = 30 * 60 * 1000;
export const MAX_INBOUND_LOOKBACK_MS = 36 * 60 * 60 * 1000;
/** Full inbound block only if not yet landed, or landed less than 3 h before our departure. */
export const INBOUND_TRACKING_WINDOW_MS = 3 * 60 * 60 * 1000;

export function shouldShowInboundTracking(
  inbound: Pick<InboundAircraftFlight, 'landed' | 'arrivalIso'>,
  opts: { depIso: string; originIata: string; originCountry?: string },
): boolean {
  if (!inbound.landed) return true;
  const origin = usableAirportCode(opts.originIata) || opts.originIata;
  const arrMs = flightClockUtcMs(inbound.arrivalIso, origin, opts.originCountry);
  const depMs = flightClockUtcMs(opts.depIso, origin, opts.originCountry);
  if (arrMs == null || depMs == null) return true;
  return depMs - arrMs < INBOUND_TRACKING_WINDOW_MS;
}

export type InboundAircraftFlight = {
  number: string;
  originCity: string;
  originIata: string;
  destination: string;
  scheduledArrival: string;
  revisedArrival: string;
  delayed: boolean;
  landed: boolean;
  arrivalIso: string;
  /** Minutes later than scheduled arrival; 0 if on time or unknown. */
  delayMin: number;
};

export type InboundPickOpts = {
  originIata: string;
  originCountry?: string;
  ourNumber: string;
  depIso: string;
};

function flightNumberSlug(raw: string): string {
  return String(raw || '').replace(/\s+/g, '').toUpperCase();
}

function adbTime(side: unknown, keys: string[]): string {
  if (!side || typeof side !== 'object') return '';
  const obj = side as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (!v) continue;
    if (typeof v === 'string' && v.trim()) return normalizeFlightIso(v);
    if (typeof v === 'object' && v) {
      const nested = v as Record<string, unknown>;
      const utc = nested.utc;
      const local = nested.local;
      if (typeof utc === 'string' && utc.trim()) return normalizeFlightIso(utc);
      if (typeof local === 'string' && local.trim()) return normalizeFlightIso(local);
    }
  }
  return '';
}

function airportCodeFrom(ap: unknown): string {
  if (!ap || typeof ap !== 'object') return '';
  const o = ap as Record<string, unknown>;
  return usableAirportCode(
    String(o.iata || o.iataCode || o.localCode || o.icao || o.icaoCode || ''),
  );
}

function airportCityFrom(ap: unknown, fallback = ''): string {
  if (!ap || typeof ap !== 'object') return fallback;
  const o = ap as Record<string, unknown>;
  const city = String(o.municipalityName || o.shortName || o.name || '').trim();
  if (city && city.toLowerCase() !== 'unknown') return city;
  return fallback;
}

export function aircraftFlightsFromJson(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.flights)) return o.flights;
  }
  return [];
}

export function parseAircraftFlightItem(raw: unknown): InboundAircraftFlight | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const dep = (item.departure && typeof item.departure === 'object') ? item.departure : {};
  const arr = (item.arrival && typeof item.arrival === 'object') ? item.arrival : {};
  const depAp = (dep as Record<string, unknown>).airport;
  const arrAp = (arr as Record<string, unknown>).airport;
  const number = String(item.number || '').trim();
  if (!number) return null;
  const originIata = airportCodeFrom(depAp);
  const destination = airportCodeFrom(arrAp);
  const scheduledArrival = adbTime(arr, ['scheduledTime']);
  const revisedArrival = adbTime(arr, ['runwayTime', 'actualTime', 'revisedTime', 'predictedTime']);
  const arrivalIso = revisedArrival || scheduledArrival;
  if (!arrivalIso) return null;
  const st = String(item.status || '').toLowerCase();
  const actual = adbTime(arr, ['runwayTime', 'actualTime']);
  const schedMs = scheduledArrival ? flightClockUtcMs(scheduledArrival, destination) : null;
  const lateMs = (actual || revisedArrival) ? flightClockUtcMs(actual || revisedArrival, destination) : null;
  const delayMin = (schedMs != null && lateMs != null) ? Math.round((lateMs - schedMs) / 60000) : 0;
  return {
    number,
    originCity: airportCityFrom(depAp, originIata),
    originIata,
    destination,
    scheduledArrival,
    revisedArrival,
    delayed: st.includes('delay') || delayMin > 5,
    landed: st === 'arrived' || st === 'landed' || !!actual,
    arrivalIso,
    delayMin: Math.max(0, delayMin),
  };
}

export function pickInboundAircraftFlight(
  candidates: InboundAircraftFlight[],
  opts: InboundPickOpts,
): InboundAircraftFlight | null {
  const origin = usableAirportCode(opts.originIata);
  const ours = flightNumberSlug(opts.ourNumber);
  const depMs = flightClockUtcMs(opts.depIso, origin, opts.originCountry);
  if (!origin || depMs == null) return null;

  let best: InboundAircraftFlight | null = null;
  let bestMs = -Infinity;
  for (const c of candidates) {
    if (!c) continue;
    const dest = usableAirportCode(c.destination);
    if (dest !== origin) continue;
    const num = flightNumberSlug(c.number);
    if (num && num === ours) continue;
    // Match the planned rotation on scheduled arrival so a late inbound is
    // still picked after its revised time slips past our departure.
    const schedIso = c.scheduledArrival || c.arrivalIso || c.revisedArrival;
    const schedMs = flightClockUtcMs(schedIso, origin, opts.originCountry);
    if (schedMs == null || schedMs >= depMs) continue;
    const plannedGap = depMs - schedMs;
    if (plannedGap < MIN_TURNAROUND_MS) continue;
    if (plannedGap > MAX_INBOUND_LOOKBACK_MS) continue;
    if (schedMs <= bestMs) continue;
    bestMs = schedMs;
    best = c;
  }
  return best;
}

/** Minimum inbound delay (minutes) before we warn that the departure may slip. */
export const LATE_AIRCRAFT_MIN_DELAY = 15;

export type LateAircraftWarning = {
  inboundDelayMin: number;
  turnaroundImpossible: boolean;
};

/** Minutes the inbound is later than its scheduled arrival. */
export function inboundArrivalDelayMin(inbound: Pick<InboundAircraftFlight, 'scheduledArrival' | 'revisedArrival' | 'arrivalIso' | 'delayMin' | 'destination'>): number {
  if (typeof inbound.delayMin === 'number' && inbound.delayMin > 0) return inbound.delayMin;
  const sched = inbound.scheduledArrival;
  const actual = inbound.revisedArrival || inbound.arrivalIso;
  if (!sched || !actual) return 0;
  const dest = usableAirportCode(inbound.destination) || inbound.destination;
  const schedMs = flightClockUtcMs(sched, dest);
  const lateMs = flightClockUtcMs(actual, dest);
  if (schedMs == null || lateMs == null) return 0;
  return Math.max(0, Math.round((lateMs - schedMs) / 60000));
}

/**
 * Warn when the inbound is ≥15 min late and (still airborne or the remaining
 * turnaround cannot make the scheduled departure).
 */
export function lateAircraftWarning(opts: {
  inbound: InboundAircraftFlight;
  depIso: string;
  originIata: string;
  originCountry?: string;
}): LateAircraftWarning | null {
  const delayMin = inboundArrivalDelayMin(opts.inbound);
  if (delayMin < LATE_AIRCRAFT_MIN_DELAY) return null;
  const origin = usableAirportCode(opts.originIata) || opts.originIata;
  const arrMs = flightClockUtcMs(opts.inbound.arrivalIso, origin, opts.originCountry);
  const depMs = flightClockUtcMs(opts.depIso, origin, opts.originCountry);
  const turnaroundImpossible = arrMs != null && depMs != null
    && (arrMs + MIN_TURNAROUND_MS) > depMs;
  return { inboundDelayMin: delayMin, turnaroundImpossible };
}
