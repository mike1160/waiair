/** Route turbulence estimate via WaiAir proxy (Open-Meteo wind / shear). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from './i18n';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const STORAGE_PREFIX = 'waiair.turbulence.v1:';
const FETCH_TIMEOUT_MS = 8000;
const DISK_REFRESH_MS = 3 * 60 * 60 * 1000;

export type TurbulenceSeverity = 'smooth' | 'light' | 'moderate' | 'severe';

export type TurbulenceZone = {
  lat: number;
  lon: number;
  severity: TurbulenceSeverity;
  frac?: number;
  time?: string;
};

export type TurbulenceForecast = {
  overall: TurbulenceSeverity;
  peak: TurbulenceSeverity;
  region: string;
  windowStart: string;
  windowEnd: string;
  /** 0–10 bar fill level */
  barLevel: number;
  zones?: TurbulenceZone[];
  bumpMinutes?: number;
  cruiseAltitudeFt?: number;
  peakTime?: string;
};

const forecastCache = new Map<string, { at: number; data: TurbulenceForecast | null }>();
const CACHE_MS = 30 * 60 * 1000;

function cacheKey(origin: string, dest: string, date: string, depIso: string, durationMin: number): string {
  return `${origin}|${dest}|${date}|${depIso}|${durationMin}`;
}

export function severityRank(s: TurbulenceSeverity): number {
  switch (s) {
    case 'smooth': return 0;
    case 'light': return 1;
    case 'moderate': return 2;
    case 'severe': return 3;
    default: return 0;
  }
}

export function barLevelForSeverity(s: TurbulenceSeverity): number {
  switch (s) {
    case 'smooth': return 2;
    case 'light': return 4;
    case 'moderate': return 7;
    case 'severe': return 10;
    default: return 2;
  }
}

export function isAlertSeverity(s: TurbulenceSeverity): boolean {
  return s === 'moderate' || s === 'severe';
}

function parseSeverity(raw: unknown): TurbulenceSeverity | null {
  const s = String(raw || '');
  if (s === 'smooth' || s === 'light' || s === 'moderate' || s === 'severe') return s;
  return null;
}

function parseZones(raw: unknown): TurbulenceZone[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: TurbulenceZone[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const severity = parseSeverity(r.severity);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !severity) continue;
    out.push({
      lat,
      lon,
      severity,
      frac: Number.isFinite(Number(r.frac)) ? Number(r.frac) : undefined,
      time: r.time ? String(r.time) : undefined,
    });
  }
  return out.length ? out : undefined;
}

export function cruiseAltitudeFtForDuration(durationMin?: number): number {
  const m = Math.max(30, Math.round(durationMin || 120));
  if (m < 80) return 25000;
  if (m < 150) return 33000;
  if (m < 280) return 35000;
  return 38000;
}

function bumpMinutesFromZones(zones: TurbulenceZone[] | undefined, durationMin: number, peak: TurbulenceSeverity): number {
  if (zones?.length) {
    const bump = zones.filter(z => z.severity !== 'smooth').length;
    return Math.round((bump / zones.length) * Math.max(30, durationMin));
  }
  if (peak === 'smooth') return 0;
  const frac = peak === 'light' ? 0.12 : peak === 'moderate' ? 0.22 : 0.3;
  return Math.round(Math.max(30, durationMin) * frac);
}

export function enrichTurbulenceForecast(
  data: TurbulenceForecast,
  durationMin?: number,
): TurbulenceForecast {
  const dur = Math.max(30, Math.round(durationMin || 120));
  return {
    ...data,
    bumpMinutes: data.bumpMinutes ?? bumpMinutesFromZones(data.zones, dur, data.peak),
    cruiseAltitudeFt: data.cruiseAltitudeFt || cruiseAltitudeFtForDuration(dur),
    peakTime: data.peakTime || data.windowStart || '',
  };
}

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

function interpolateGC(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  t: number,
): { lat: number; lon: number } {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ));
  if (!(d > 1e-6)) return a;
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  return {
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lon: toDeg(Math.atan2(y, x)),
  };
}

export type TurbulenceRoutePoint = {
  latitude: number;
  longitude: number;
  severity: TurbulenceSeverity;
};

/** Colored great-circle samples for the route map overlay. */
export function turbulenceRoutePoints(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  forecast: TurbulenceForecast,
  samples = 16,
): TurbulenceRoutePoint[] {
  const origin = { lat: originLat, lon: originLon };
  const dest = { lat: destLat, lon: destLon };
  const zones = (forecast.zones || []).filter(z => Number.isFinite(z.lat) && Number.isFinite(z.lon));
  if (zones.length >= 2) {
    return zones.map(z => ({ latitude: z.lat, longitude: z.lon, severity: z.severity }));
  }
  const n = Math.max(4, samples);
  const pts: TurbulenceRoutePoint[] = [];
  for (let i = 0; i < n; i++) {
    const tFrac = i / (n - 1);
    const p = interpolateGC(origin, dest, tFrac);
    let severity = forecast.overall;
    if (forecast.peak !== 'smooth' && tFrac > 0.32 && tFrac < 0.72) severity = forecast.peak;
    pts.push({ latitude: p.lat, longitude: p.lon, severity });
  }
  return pts;
}

export function turbulencePolylines(points: TurbulenceRoutePoint[]): Array<{
  severity: TurbulenceSeverity;
  coordinates: Array<{ latitude: number; longitude: number }>;
}> {
  if (points.length < 2) return [];
  const lines: Array<{ severity: TurbulenceSeverity; coordinates: Array<{ latitude: number; longitude: number }> }> = [];
  let coords = [{ latitude: points[0].latitude, longitude: points[0].longitude }];
  let sev = points[0].severity;
  for (let i = 1; i < points.length; i++) {
    const pt = { latitude: points[i].latitude, longitude: points[i].longitude };
    if (points[i].severity === sev) {
      coords.push(pt);
      continue;
    }
    coords.push(pt);
    if (coords.length >= 2) lines.push({ severity: sev, coordinates: coords });
    coords = [pt];
    sev = points[i].severity;
  }
  if (coords.length >= 2) lines.push({ severity: sev, coordinates: coords });
  return lines;
}

export function zoneColor(s: TurbulenceSeverity): string {
  switch (s) {
    case 'light': return '#F59E0B';
    case 'moderate': return '#EF4444';
    case 'severe': return '#B91C1C';
    default: return '#22C55E';
  }
}

/** Overlay on the route: green / amber / red (moderate+severe share red). */
export function overlayZoneColor(s: TurbulenceSeverity): string {
  if (s === 'light') return '#F59E0B';
  if (s === 'moderate' || s === 'severe') return '#EF4444';
  return '#22C55E';
}

export function severityAtRouteFrac(forecast: TurbulenceForecast, t: number): TurbulenceSeverity {
  const frac = Math.max(0, Math.min(1, t));
  const zones = forecast.zones;
  if (zones?.length) {
    const withFrac = zones.filter(z => z.frac != null && Number.isFinite(z.frac));
    if (withFrac.length) {
      let best = withFrac[0];
      let bestDist = Math.abs((best.frac ?? 0) - frac);
      for (const z of withFrac) {
        const d = Math.abs((z.frac ?? 0) - frac);
        if (d < bestDist) {
          best = z;
          bestDist = d;
        }
      }
      return best.severity;
    }
    const i = Math.min(zones.length - 1, Math.round(frac * (zones.length - 1)));
    return zones[i].severity;
  }
  if (forecast.peak !== 'smooth' && frac > 0.32 && frac < 0.72) return forecast.peak;
  return forecast.overall;
}

export async function fetchTurbulenceForecast(opts: {
  origin: string;
  destination: string;
  date: string;
  departureIso?: string;
  durationMin?: number;
}): Promise<TurbulenceForecast | null> {
  const origin = String(opts.origin || '').trim().toUpperCase();
  const destination = String(opts.destination || '').trim().toUpperCase();
  const date = String(opts.date || '').trim();
  if (!origin || !destination || origin === destination || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const depIso = opts.departureIso || '';
  const durationMin = Math.max(30, Math.min(960, Math.round(opts.durationMin || 120)));
  const key = cacheKey(origin, destination, date, depIso, durationMin);
  const hit = forecastCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  try {
    const q = new URLSearchParams({
      origin,
      dest: destination,
      date,
      durationMin: String(durationMin),
    });
    if (depIso) q.set('departure', depIso);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let r: Response;
    try {
      r = await fetch(`${PROXY}/turbulence?${q.toString()}`, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) {
      forecastCache.set(key, { at: Date.now(), data: null });
      return null;
    }
    const json = await r.json();
    if (!json || json.unavailable) {
      forecastCache.set(key, { at: Date.now(), data: null });
      return null;
    }
    const overall = json.overall as TurbulenceSeverity;
    const peak = json.peak as TurbulenceSeverity;
    if (!overall || !peak || !json.region) {
      forecastCache.set(key, { at: Date.now(), data: null });
      return null;
    }
    const data: TurbulenceForecast = enrichTurbulenceForecast({
      overall,
      peak,
      region: String(json.region),
      windowStart: String(json.windowStart || ''),
      windowEnd: String(json.windowEnd || ''),
      barLevel: Number(json.barLevel) || barLevelForSeverity(peak),
      zones: parseZones(json.zones),
      bumpMinutes: Number.isFinite(Number(json.bumpMinutes)) ? Number(json.bumpMinutes) : undefined,
      cruiseAltitudeFt: Number.isFinite(Number(json.cruiseAltitudeFt)) ? Number(json.cruiseAltitudeFt) : undefined,
      peakTime: json.peakTime ? String(json.peakTime) : undefined,
    }, durationMin);
    forecastCache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    forecastCache.set(key, { at: Date.now(), data: null });
    return null;
  }
}

export function flightDateKey(iso?: string): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export type TurbulenceFlightInput = {
  id?: string;
  number?: string;
  origin?: string;
  destination?: string;
  status?: string;
  gate?: string;
  scheduledTime?: string;
  scheduledDeparture?: string;
  departureTime?: string;
  estimatedDeparture?: string;
  scheduledArrival?: string;
  arrivalTime?: string;
  estimatedArrival?: string;
};

function diskKey(flightId: string): string {
  return STORAGE_PREFIX + String(flightId || '').trim();
}

export function turbulenceFlightCacheId(f: TurbulenceFlightInput, trackKey?: string): string {
  const id = String(trackKey || f.id || '').trim();
  if (id) return id;
  const num = String(f.number || '').replace(/\s+/g, '').toUpperCase();
  return `${num}|${f.scheduledTime || f.scheduledDeparture || ''}`;
}

export function durationMinFromFlight(f: TurbulenceFlightInput): number {
  const dep = f.scheduledDeparture || f.departureTime || f.estimatedDeparture || f.scheduledTime;
  const arr = f.scheduledArrival || f.arrivalTime || f.estimatedArrival;
  if (dep && arr) {
    const a = new Date(dep).getTime();
    const b = new Date(arr).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      return Math.max(30, Math.min(960, Math.round((b - a) / 60000)));
    }
  }
  return 120;
}

/** Prefetch at check-in (T-24h), gate assignment, or boarding — never once airborne. */
export function shouldPrefetchTurbulence(opts: {
  status?: string;
  minutesUntilDeparture?: number | null;
  hasGate?: boolean;
}): boolean {
  const status = String(opts.status || '').toLowerCase();
  if (status === 'en-route' || status === 'landed' || status === 'cancelled') return false;
  if (status === 'boarding') return true;
  if (opts.hasGate) return true;
  const mins = opts.minutesUntilDeparture;
  if (mins != null && Number.isFinite(mins) && mins <= 24 * 60 && mins >= -15) return true;
  return false;
}

type DiskRow = { ts: number; data: TurbulenceForecast };

function parseDiskRow(raw: string | null): DiskRow | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DiskRow>;
    if (!parsed || typeof parsed.ts !== 'number' || !parsed.data) return null;
    const d = parsed.data;
    if (!d.overall || !d.peak || !d.region) return null;
    return { ts: parsed.ts, data: enrichTurbulenceForecast(d as TurbulenceForecast) };
  } catch {
    return null;
  }
}

export async function getCachedTurbulence(flightId: string): Promise<TurbulenceForecast | null> {
  const id = String(flightId || '').trim();
  if (!id) return null;
  try {
    return parseDiskRow(await AsyncStorage.getItem(diskKey(id)))?.data ?? null;
  } catch {
    return null;
  }
}

async function saveCachedTurbulence(flightId: string, data: TurbulenceForecast): Promise<void> {
  const id = String(flightId || '').trim();
  if (!id) return;
  try {
    await AsyncStorage.setItem(diskKey(id), JSON.stringify({ ts: Date.now(), data } satisfies DiskRow));
  } catch {
    /* ignore */
  }
}

export async function prefetchTurbulenceForFlight(opts: {
  flightId: string;
  origin: string;
  destination: string;
  date: string;
  departureIso?: string;
  durationMin?: number;
}): Promise<TurbulenceForecast | null> {
  const flightId = String(opts.flightId || '').trim();
  if (!flightId) return null;
  let existing: DiskRow | null = null;
  try {
    existing = parseDiskRow(await AsyncStorage.getItem(diskKey(flightId)));
  } catch {
    existing = null;
  }
  if (existing && Date.now() - existing.ts < DISK_REFRESH_MS) return existing.data;

  const data = await fetchTurbulenceForecast({
    origin: opts.origin,
    destination: opts.destination,
    date: opts.date,
    departureIso: opts.departureIso,
    durationMin: opts.durationMin,
  });
  if (data) {
    await saveCachedTurbulence(flightId, data);
    return data;
  }
  return existing?.data ?? null;
}

/** Cache-first load; fetches and stores by flightId when the cache is empty or stale. */
export async function loadTurbulenceForecast(opts: {
  flightId: string;
  origin: string;
  destination: string;
  date: string;
  departureIso?: string;
  durationMin?: number;
  allowNetwork?: boolean;
}): Promise<TurbulenceForecast | null> {
  const cached = await getCachedTurbulence(opts.flightId);
  if (opts.allowNetwork === false) {
    return cached ? enrichTurbulenceForecast(cached, opts.durationMin) : null;
  }
  const fresh = await prefetchTurbulenceForFlight(opts);
  const data = fresh || cached;
  return data ? enrichTurbulenceForecast(data, opts.durationMin) : null;
}

export async function maybePrefetchTurbulence(
  f: TurbulenceFlightInput,
  opts?: {
    trackKey?: string;
    durationMin?: number;
    minutesUntilDeparture?: number | null;
    hasGate?: boolean;
  },
): Promise<TurbulenceForecast | null> {
  if (!shouldPrefetchTurbulence({
    status: f.status,
    minutesUntilDeparture: opts?.minutesUntilDeparture ?? null,
    hasGate: opts?.hasGate ?? !!String(f.gate || '').trim(),
  })) {
    return null;
  }
  const origin = String(f.origin || '').trim().toUpperCase();
  const destination = String(f.destination || '').trim().toUpperCase();
  if (!origin || !destination) return null;
  const depIso = f.scheduledDeparture || f.departureTime || f.estimatedDeparture || f.scheduledTime || '';
  return prefetchTurbulenceForFlight({
    flightId: turbulenceFlightCacheId(f, opts?.trackKey),
    origin,
    destination,
    date: flightDateKey(depIso),
    departureIso: depIso,
    durationMin: opts?.durationMin ?? durationMinFromFlight(f),
  });
}

export function turbulenceAlertCopy(
  forecast: TurbulenceForecast,
  flightNumber: string,
): { title: string; body: string } {
  const copy = t();
  const severity = forecast.peak === 'severe' ? copy.turbulenceSevere : copy.turbulenceModerate;
  const num = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  return {
    title: copy.turbulenceForecast,
    body: copy.turbulenceAlertBody(
      severity,
      forecast.region,
      num,
      forecast.windowStart || '',
      forecast.windowEnd || '',
    ),
  };
}
