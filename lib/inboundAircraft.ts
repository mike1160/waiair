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
    const arrIso = c.arrivalIso || c.revisedArrival || c.scheduledArrival;
    const arrMs = flightClockUtcMs(arrIso, origin, opts.originCountry);
    if (arrMs == null || arrMs >= depMs) continue;
    const gap = depMs - arrMs;
    if (gap < MIN_TURNAROUND_MS) continue;
    if (gap > MAX_INBOUND_LOOKBACK_MS) continue;
    if (arrMs <= bestMs) continue;
    bestMs = arrMs;
    best = c;
  }
  return best;
}
