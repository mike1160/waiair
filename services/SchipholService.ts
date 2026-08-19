import { airportDateKey, localDateKey } from '../lib/localFlightTime';
import { fetchWithTimeout } from '../lib/net';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const SCHIPHOL_BASE = 'https://api.schiphol.nl/public-flights';
const APP_ID = process.env.EXPO_PUBLIC_SCHIPHOL_APP_ID || '';
const APP_KEY = process.env.EXPO_PUBLIC_SCHIPHOL_APP_KEY || '';
const RESOURCE_VERSION = 'v4';
const LOOKUP_TTL_MS = 45 * 1000;
const BOARD_TTL_MS = 60 * 1000;
const BOARD_MAX_PAGES = 4;

export type SchipholDirection = 'A' | 'D';

export type SchipholAirportOps = {
  flightName: string;
  direction: SchipholDirection | '';
  gate: string;
  terminal: string;
  baggage: string;
};

export type SchipholEnrichable = {
  number: string;
  operatingNumber?: string;
  origin?: string;
  destination?: string;
  gate?: string;
  terminal?: string;
  depTerminal?: string;
  arrTerminal?: string;
  baggage?: string;
  scheduledTime?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
};

type CacheEntry<T> = { at: number; value: T };
const lookupCache = new Map<string, CacheEntry<SchipholAirportOps | null>>();
const boardCache = new Map<string, CacheEntry<Map<string, SchipholAirportOps>>>();

const SCHIPHOL_HEADERS = {
  Accept: 'application/json',
  ResourceVersion: RESOURCE_VERSION,
  app_id: APP_ID,
  app_key: APP_KEY,
};

export function isAmsAirport(code?: string): boolean {
  const c = String(code || '').trim().toUpperCase();
  return c === 'AMS' || c === 'EHAM';
}

export function schipholFlightNames(number: string, operatingNumber?: string): string[] {
  const out: string[] = [];
  for (const raw of [number, operatingNumber]) {
    const slug = String(raw || '').replace(/\s+/g, '').toUpperCase();
    if (!slug) continue;
    const m = slug.match(/^([A-Z]{2,3})(\d{1,4}[A-Z]?)$/);
    if (!m) {
      out.push(slug);
      continue;
    }
    const prefix = m[1];
    const rawNum = m[2];
    const stripped = rawNum.replace(/^0+/, '') || '0';
    out.push(`${prefix}${stripped}`, `${prefix}${rawNum}`, slug);
  }
  return [...new Set(out)];
}

function readCache<T>(map: Map<string, CacheEntry<T>>, key: string, ttl: number): T | undefined {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttl) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

function amsScheduleDate(iso?: string): string {
  if (iso) {
    const normalized = String(iso).trim().replace(' ', 'T');
    const ms = new Date(normalized).getTime();
    if (Number.isFinite(ms)) return localDateKey(new Date(ms), 'Europe/Amsterdam');
  }
  return airportDateKey('AMS');
}

function pickDates(flight: SchipholEnrichable, destAms: boolean): string[] {
  const iso = destAms
    ? (flight.scheduledArrival || flight.scheduledTime || flight.scheduledDeparture)
    : (flight.scheduledDeparture || flight.scheduledTime || flight.scheduledArrival);
  const primary = amsScheduleDate(iso);
  const today = airportDateKey('AMS');
  return [...new Set([primary, today])];
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function beltsFromClaim(claim: unknown): string {
  if (!claim || typeof claim !== 'object') return '';
  const belts = (claim as { belts?: unknown }).belts;
  if (!Array.isArray(belts)) return '';
  return belts.map(b => str(b)).filter(Boolean).join('/');
}

function opsFromRaw(raw: any): SchipholAirportOps | null {
  if (!raw || typeof raw !== 'object') return null;
  const flightName = str(raw.flightName || `${raw.prefixIATA || ''}${raw.flightNumber || ''}`).toUpperCase();
  const direction = raw.flightDirection === 'A' || raw.flightDirection === 'D' ? raw.flightDirection : '';
  const gate = str(raw.gate);
  const terminal = str(raw.terminal);
  const baggage = beltsFromClaim(raw.baggageClaim);
  if (!flightName && !gate && !terminal && !baggage) return null;
  return { flightName, direction, gate, terminal, baggage };
}

function indexOps(list: SchipholAirportOps[]): Map<string, SchipholAirportOps> {
  const map = new Map<string, SchipholAirportOps>();
  for (const ops of list) {
    for (const name of schipholFlightNames(ops.flightName)) {
      const prev = map.get(name);
      if (!prev) {
        map.set(name, ops);
        continue;
      }
      map.set(name, {
        ...prev,
        gate: ops.gate || prev.gate,
        terminal: ops.terminal || prev.terminal,
        baggage: ops.baggage || prev.baggage,
      });
    }
  }
  return map;
}

async function schipholJson(pathAndQuery: string): Promise<any> {
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  try {
    const viaProxy = await fetchWithTimeout(
      `${PROXY}/schiphol${path}`,
      { headers: { Accept: 'application/json' } },
      8000,
    );
    if (viaProxy.ok) return viaProxy.json();
  } catch { /* fall through to direct */ }

  if (!APP_ID || !APP_KEY) throw new Error('SCHIPHOL_NO_KEY');
  const res = await fetchWithTimeout(`${SCHIPHOL_BASE}${path}`, { headers: SCHIPHOL_HEADERS }, 8000);
  if (!res.ok) throw Object.assign(new Error(`SCHIPHOL_${res.status}`), { status: res.status });
  return res.json();
}

async function queryFlights(params: Record<string, string>): Promise<SchipholAirportOps[]> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const data = await schipholJson(`/flights?${q.toString()}`);
  const rows = Array.isArray(data?.flights) ? data.flights : Array.isArray(data) ? data : [];
  return rows.map(opsFromRaw).filter((x: SchipholAirportOps | null): x is SchipholAirportOps => !!x);
}

export function applySchipholOps<T extends SchipholEnrichable>(flight: T, ops: SchipholAirportOps | null): T {
  if (!ops) return flight;
  const originAms = isAmsAirport(flight.origin);
  const destAms = isAmsAirport(flight.destination);
  if (!originAms && !destAms) return flight;

  const gate = ops.gate || flight.gate || '';
  const baggage = destAms ? (ops.baggage || flight.baggage || '') : (flight.baggage || '');
  const depTerminal = originAms ? (ops.terminal || flight.depTerminal || '') : (flight.depTerminal || '');
  const arrTerminal = destAms ? (ops.terminal || flight.arrTerminal || '') : (flight.arrTerminal || '');
  const terminal = originAms
    ? (depTerminal || flight.terminal || '')
    : (arrTerminal || flight.terminal || '');

  if (
    gate === (flight.gate || '') &&
    terminal === (flight.terminal || '') &&
    depTerminal === (flight.depTerminal || '') &&
    arrTerminal === (flight.arrTerminal || '') &&
    baggage === (flight.baggage || '')
  ) {
    return flight;
  }

  return {
    ...flight,
    gate,
    terminal,
    depTerminal,
    arrTerminal,
    baggage,
  };
}

export async function lookupSchipholOps(flight: SchipholEnrichable): Promise<SchipholAirportOps | null> {
  const originAms = isAmsAirport(flight.origin);
  const destAms = isAmsAirport(flight.destination);
  if (!originAms && !destAms) return null;

  const names = schipholFlightNames(flight.number, flight.operatingNumber);
  if (!names.length) return null;
  const direction: SchipholDirection | '' = originAms && !destAms ? 'D' : destAms && !originAms ? 'A' : '';
  const dates = pickDates(flight, destAms);

  const cacheKey = `${names[0]}|${direction}|${dates[0]}`;
  const cached = readCache(lookupCache, cacheKey, LOOKUP_TTL_MS);
  if (cached !== undefined) return cached;

  let found: SchipholAirportOps | null = null;
  try {
    for (const date of dates) {
      for (const flightName of names) {
        const params: Record<string, string> = {
          flightName,
          scheduleDate: date,
          includedelays: 'false',
          page: '0',
        };
        if (direction) params.flightDirection = direction;
        const hits = await queryFlights(params);
        found = hits.find(h => schipholFlightNames(h.flightName).includes(flightName)) || hits[0] || null;
        if (found && (found.gate || found.terminal || found.baggage)) break;
      }
      if (found && (found.gate || found.terminal || found.baggage)) break;
    }
  } catch (e) {
    console.warn('[Schiphol] lookup failed', e);
    found = null;
  }

  lookupCache.set(cacheKey, { at: Date.now(), value: found });
  return found;
}

export async function fetchSchipholBoard(
  direction: SchipholDirection,
  scheduleDate?: string,
): Promise<Map<string, SchipholAirportOps>> {
  const date = scheduleDate || airportDateKey('AMS');
  const key = `${direction}|${date}`;
  const cached = readCache(boardCache, key, BOARD_TTL_MS);
  if (cached) return cached;

  const all: SchipholAirportOps[] = [];
  try {
    for (let page = 0; page < BOARD_MAX_PAGES; page++) {
      const hits = await queryFlights({
        flightDirection: direction,
        scheduleDate: date,
        includedelays: 'false',
        page: String(page),
        sort: '+scheduleTime',
      });
      if (!hits.length) break;
      all.push(...hits);
      if (hits.length < 20) break;
    }
  } catch (e) {
    console.warn('[Schiphol] board fetch failed', e);
  }

  const indexed = indexOps(all);
  boardCache.set(key, { at: Date.now(), value: indexed });
  return indexed;
}

export async function enrichFlightWithSchiphol<T extends SchipholEnrichable>(flight: T): Promise<T> {
  if (!isAmsAirport(flight.origin) && !isAmsAirport(flight.destination)) return flight;
  try {
    const ops = await lookupSchipholOps(flight);
    return applySchipholOps(flight, ops);
  } catch {
    return flight;
  }
}

export async function enrichAmsBoard<T extends SchipholEnrichable>(
  flights: T[],
  type: 'arrival' | 'departure',
  scheduleDate?: string,
): Promise<T[]> {
  if (!flights.length) return flights;
  try {
    const board = await fetchSchipholBoard(type === 'arrival' ? 'A' : 'D', scheduleDate);
    if (!board.size) return flights;
    return flights.map(f => {
      const names = schipholFlightNames(f.number, f.operatingNumber);
      const ops = names.map(n => board.get(n)).find(Boolean) || null;
      return applySchipholOps(f, ops || null);
    });
  } catch {
    return flights;
  }
}
