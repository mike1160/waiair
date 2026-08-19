import AsyncStorage from '@react-native-async-storage/async-storage';
import { airportRecByIata } from './airportsDb';
import { haversineKm } from './eu261';
import { isoInAirportTzToUtcMs } from './localFlightTime';
import { loadFlightHistory, type HistoryFlight } from './proStorage';

export const PASSPORT_STORAGE_KEY = 'waiair.passport.v1';

export type PassportEntry = {
  id: string;
  flightNumber: string;
  originIata: string;
  destIata: string;
  originCity?: string;
  destCity?: string;
  originCountry?: string;
  destCountry?: string;
  airline?: string;
  airlineCode?: string;
  depTimeIso: string;
  arrTimeIso: string;
  scheduledTime: string;
  actualTime: string;
  delayMin: number;
  distanceKm: number;
  durationMs: number;
  altitudeFt?: number | null;
  landedAt: string;
  welcomeMessage?: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
};

export type PassportStats = {
  totalFlights: number;
  totalKm: number;
  totalDurationMs: number;
  countries: string[];
  airports: string[];
  airlines: string[];
};

export type MemoryCardData = {
  flightNumber: string;
  airlineCode: string;
  airline?: string;
  originIata: string;
  destIata: string;
  originCity: string;
  destCity: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  depTimeIso: string;
  arrTimeIso: string;
  dateIso: string;
  durationMs?: number | null;
  distanceKm?: number | null;
  altitudeFt?: number | null;
  delayMin: number;
  welcomeMessage?: string;
};

type FlightLike = {
  number: string;
  airline?: string;
  airlineCode?: string;
  origin?: string;
  originCity?: string;
  originCountry?: string;
  destination?: string;
  destCity?: string;
  destCountry?: string;
  scheduledTime?: string;
  actualTime?: string;
  revisedTime?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  departureTime?: string;
  arrivalTime?: string;
  actualDeparture?: string;
  actualArrival?: string;
  delay?: number;
  altitudeFt?: number;
};

type AirportLike = {
  iata: string;
  lat?: number;
  lon?: number;
};

type AirportLookup = (iata: string) => { lat?: number; lon?: number; city?: string; country?: string } | undefined;

function entryId(dateIso: string, flightNumber: string): string {
  const day = (dateIso || new Date().toISOString()).slice(0, 10);
  const num = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  return `${day}:${num}`;
}

export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  const base = 0x1f1e6;
  return String.fromCodePoint(base + code.toUpperCase().charCodeAt(0) - 65)
    + String.fromCodePoint(base + code.toUpperCase().charCodeAt(1) - 65);
}

function hasGeo(lat?: number, lon?: number): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

function coordsForIata(iata: string, hub: AirportLike, lookup: AirportLookup) {
  if (!iata) return { lat: undefined as number | undefined, lon: undefined as number | undefined };
  if (iata === hub.iata && hasGeo(hub.lat, hub.lon)) return { lat: hub.lat, lon: hub.lon };
  const ap = lookup(iata);
  return { lat: ap?.lat, lon: ap?.lon };
}

function parseRouteIatas(route: string): { origin?: string; dest?: string } {
  const m = String(route || '').match(/([A-Z]{3})\s*[→\-–>]\s*([A-Z]{3})/i);
  if (!m) return {};
  return { origin: m[1].toUpperCase(), dest: m[2].toUpperCase() };
}

function estimateCruiseAltFt(distanceKm?: number | null): number {
  if (!distanceKm || distanceKm < 200) return 18000;
  if (distanceKm < 800) return 28000;
  if (distanceKm < 2000) return 35000;
  return 39000;
}

function durationFromTimes(
  depIso: string,
  arrIso: string,
  originIata?: string,
  destIata?: string,
  originCountry?: string,
  destCountry?: string,
): number {
  const a = isoInAirportTzToUtcMs(depIso, originIata, originCountry);
  const b = isoInAirportTzToUtcMs(arrIso, destIata, destCountry);
  if (a == null || b == null || b <= a) return 0;
  return b - a;
}

export function buildPassportEntry(
  f: FlightLike,
  hub: AirportLike,
  lookup: AirportLookup,
  opts?: { welcomeMessage?: string; landedAt?: string },
): PassportEntry {
  const originIata = String(f.origin || '').toUpperCase();
  const destIata = String(f.destination || '').toUpperCase();
  const oCoords = coordsForIata(originIata, hub, lookup);
  const dCoords = coordsForIata(destIata, hub, lookup);
  let distanceKm = 0;
  if (hasGeo(oCoords.lat, oCoords.lon) && hasGeo(dCoords.lat, dCoords.lon)) {
    distanceKm = Math.round(haversineKm(oCoords.lat!, oCoords.lon!, dCoords.lat!, dCoords.lon!));
  }
  const depIso = f.actualDeparture || f.departureTime || f.scheduledDeparture || f.scheduledTime || '';
  const arrIso = f.actualArrival || f.arrivalTime || f.scheduledArrival || f.revisedTime || f.actualTime || '';
  const landedAt = opts?.landedAt || arrIso || new Date().toISOString();
  const durationMs = durationFromTimes(depIso, arrIso, originIata, destIata, f.originCountry, f.destCountry);
  const originAp = lookup(originIata);
  const destAp = lookup(destIata);
  return {
    id: entryId(landedAt, f.number),
    flightNumber: String(f.number || '').replace(/\s+/g, '').toUpperCase(),
    originIata,
    destIata,
    originCity: f.originCity || originAp?.city,
    destCity: f.destCity || destAp?.city,
    originCountry: f.originCountry || originAp?.country,
    destCountry: f.destCountry || destAp?.country,
    airline: f.airline,
    airlineCode: f.airlineCode,
    depTimeIso: depIso,
    arrTimeIso: arrIso,
    scheduledTime: f.scheduledTime || depIso,
    actualTime: f.actualTime || f.revisedTime || arrIso,
    delayMin: f.delay || 0,
    distanceKm,
    durationMs,
    altitudeFt: f.altitudeFt ?? estimateCruiseAltFt(distanceKm),
    landedAt,
    welcomeMessage: opts?.welcomeMessage,
    originLat: oCoords.lat,
    originLon: oCoords.lon,
    destLat: dCoords.lat,
    destLon: dCoords.lon,
  };
}

export function passportEntryToMemoryCard(entry: PassportEntry): MemoryCardData {
  return {
    flightNumber: entry.flightNumber,
    airlineCode: entry.airlineCode || entry.flightNumber.slice(0, 2),
    airline: entry.airline,
    originIata: entry.originIata,
    destIata: entry.destIata,
    originCity: entry.originCity || entry.originIata,
    destCity: entry.destCity || entry.destIata,
    originLat: entry.originLat,
    originLon: entry.originLon,
    destLat: entry.destLat,
    destLon: entry.destLon,
    depTimeIso: entry.depTimeIso,
    arrTimeIso: entry.arrTimeIso,
    dateIso: entry.landedAt || entry.scheduledTime,
    durationMs: entry.durationMs,
    distanceKm: entry.distanceKm,
    altitudeFt: entry.altitudeFt,
    delayMin: entry.delayMin,
    welcomeMessage: entry.welcomeMessage,
  };
}

function historyToPassportEntry(h: HistoryFlight): PassportEntry | null {
  const { origin, dest } = parseRouteIatas(h.route);
  if (!origin || !dest) return null;
  const landedAt = h.landedAt || h.actualTime || h.scheduledTime;
  const durationMs = durationFromTimes(h.scheduledTime, h.actualTime || h.landedAt, origin, dest);
  return {
    id: entryId(landedAt, h.flightNumber),
    flightNumber: h.flightNumber.replace(/\s+/g, '').toUpperCase(),
    originIata: origin,
    destIata: dest,
    depTimeIso: h.scheduledTime,
    arrTimeIso: h.actualTime || h.landedAt,
    scheduledTime: h.scheduledTime,
    actualTime: h.actualTime,
    delayMin: h.delay || 0,
    distanceKm: 0,
    durationMs,
    landedAt,
  };
}

function mergeEntries(primary: PassportEntry[], extra: PassportEntry[]): PassportEntry[] {
  const map = new Map<string, PassportEntry>();
  for (const e of [...primary, ...extra]) {
    const prev = map.get(e.id);
    if (!prev) map.set(e.id, e);
    else if (e.distanceKm > 0 && prev.distanceKm === 0) map.set(e.id, { ...prev, ...e });
  }
  return [...map.values()].sort((a, b) => {
    const ta = new Date(a.landedAt || 0).getTime();
    const tb = new Date(b.landedAt || 0).getTime();
    return tb - ta;
  });
}

async function readPassportStore(): Promise<PassportEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(PASSPORT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(e => e?.flightNumber) : [];
  } catch {
    return [];
  }
}

async function writePassportStore(entries: PassportEntry[]): Promise<void> {
  await AsyncStorage.setItem(PASSPORT_STORAGE_KEY, JSON.stringify(entries));
}

export async function loadPassportEntries(): Promise<PassportEntry[]> {
  const stored = await readPassportStore();
  const history = await loadFlightHistory();
  const fromHistory = history.map(historyToPassportEntry).filter(Boolean) as PassportEntry[];
  return mergeEntries(stored, fromHistory);
}

export async function savePassportEntry(entry: PassportEntry): Promise<boolean> {
  const items = await readPassportStore();
  if (items.some(e => e.id === entry.id)) return false;
  items.unshift(entry);
  await writePassportStore(items);
  return true;
}

export async function hasPassportEntry(id: string): Promise<boolean> {
  const items = await loadPassportEntries();
  return items.some(e => e.id === id);
}

function isoCountry(code?: string, iata?: string): string {
  const fromField = String(code || '').trim().toUpperCase();
  if (fromField.length === 2) return fromField;
  const fromIata = String(airportRecByIata(iata)?.country || '').trim().toUpperCase();
  return fromIata.length === 2 ? fromIata : '';
}

export function computePassportStats(entries: PassportEntry[]): PassportStats {
  const countries = new Set<string>();
  const airports = new Set<string>();
  const airlines = new Set<string>();
  let totalKm = 0;
  let totalDurationMs = 0;
  for (const e of entries) {
    const originCc = isoCountry(e.originCountry, e.originIata);
    const destCc = isoCountry(e.destCountry, e.destIata);
    if (originCc) countries.add(originCc);
    if (destCc) countries.add(destCc);
    if (e.originIata) airports.add(e.originIata.toUpperCase());
    if (e.destIata) airports.add(e.destIata.toUpperCase());
    if (e.airline) airlines.add(e.airline);
    else if (e.airlineCode) airlines.add(e.airlineCode);
    totalKm += e.distanceKm || 0;
    totalDurationMs += e.durationMs || 0;
  }
  return {
    totalFlights: entries.length,
    totalKm,
    totalDurationMs,
    countries: [...countries],
    airports: [...airports],
    airlines: [...airlines],
  };
}

export function formatPassportKm(km: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(km));
}

export function formatPassportDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatPassportHours(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}
