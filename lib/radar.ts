import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithTimeout } from './net';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export const SEA_BBOX = { lamin: 0, lomin: 92, lamax: 28, lomax: 140 };
export const RADAR_NEAR_KM = 250;
export const RADAR_NEAR_COUNT = 20;
const MAX_AIRCRAFT = 500;
const CACHE_PREFIX = 'waiair.radar.pos.';
const FT_PER_M = 3.281;
const KT_PER_MS = 1.944;

export type RadarAircraft = {
  id: string;
  cs: string;
  country: string;
  lat: number;
  lon: number;
  altM: number | null;
  spdMs: number | null;
  hdg: number | null;
  vr: number | null;
  reg: string;
};

export type RadarSnapshot = {
  aircraft: RadarAircraft[];
  source: 'proxy' | 'opensky' | 'adsb';
  cached: boolean;
  at: number;
};

const HUBS = [
  { lat: 13.75, lon: 100.50 }, // BKK
  { lat: 8.11, lon: 98.31 },   // HKT
  { lat: 1.35, lon: 103.82 },  // SIN
  { lat: 2.75, lon: 101.71 },  // KUL
  { lat: -8.75, lon: 115.17 }, // DPS
  { lat: 18.77, lon: 98.96 },  // CNX
];

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function inSea(lat: number, lon: number): boolean {
  return lat >= SEA_BBOX.lamin && lat <= SEA_BBOX.lamax
    && lon >= SEA_BBOX.lomin && lon <= SEA_BBOX.lomax;
}

export function fromOpenSkyStates(states: unknown[]): RadarAircraft[] {
  const out: RadarAircraft[] = [];
  for (const raw of states || []) {
    if (!Array.isArray(raw)) continue;
    const lon = num(raw[5]);
    const lat = num(raw[6]);
    if (lat == null || lon == null || !inSea(lat, lon)) continue;
    const id = String(raw[0] || '').trim();
    if (!id) continue;
    out.push({
      id,
      cs: String(raw[1] || id).trim() || id,
      country: String(raw[2] || '').trim(),
      lon,
      lat,
      altM: num(raw[7]),
      spdMs: num(raw[9]),
      hdg: num(raw[10]),
      vr: num(raw[11]),
      reg: '',
    });
  }
  return out;
}

export function fromAdsbAc(list: unknown[]): RadarAircraft[] {
  const out: RadarAircraft[] = [];
  for (const raw of list || []) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    const lat = num(a.lat);
    const lon = num(a.lon);
    if (lat == null || lon == null || !inSea(lat, lon)) continue;
    const id = String(a.hex || '').trim();
    if (!id) continue;
    const altFt = a.alt_baro === 'ground' ? 0 : num(a.alt_baro);
    const gsKt = num(a.gs);
    const vrFpm = num(a.baro_rate);
    out.push({
      id,
      cs: String(a.flight || id).trim() || id,
      country: '',
      lon,
      lat,
      altM: altFt == null ? null : altFt / FT_PER_M,
      spdMs: gsKt == null ? null : gsKt / KT_PER_MS,
      hdg: num(a.track) ?? num(a.true_heading),
      vr: vrFpm == null ? null : vrFpm / FT_PER_M / 60,
      reg: String(a.r || '').trim(),
    });
  }
  return out;
}

function capClosest(list: RadarAircraft[], lat: number, lon: number, max = MAX_AIRCRAFT): RadarAircraft[] {
  if (list.length <= max) return list;
  return list
    .map(a => ({ a, d: (a.lat - lat) ** 2 + (a.lon - lon) ** 2 }))
    .sort((x, y) => x.d - y.d)
    .slice(0, max)
    .map(x => x.a);
}

export function bboxAround(lat: number, lon: number, km: number) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.25, Math.cos((lat * Math.PI) / 180)));
  return {
    lamin: lat - dLat,
    lamax: lat + dLat,
    lomin: lon - dLon,
    lomax: lon + dLon,
  };
}

export function nearestWithin(
  list: RadarAircraft[],
  lat: number,
  lon: number,
  km = RADAR_NEAR_KM,
  limit = RADAR_NEAR_COUNT,
): RadarAircraft[] {
  const box = bboxAround(lat, lon, km);
  return list
    .filter(a => a.lat >= box.lamin && a.lat <= box.lamax && a.lon >= box.lomin && a.lon <= box.lomax)
    .map(a => ({ a, d: (a.lat - lat) ** 2 + (a.lon - lon) ** 2 }))
    .sort((x, y) => x.d - y.d)
    .slice(0, limit)
    .map(x => x.a);
}

export function mergeAircraft(current: RadarAircraft[], incoming: RadarAircraft[]): RadarAircraft[] {
  return mergeById([incoming, current]);
}

function cacheKey(iata: string): string {
  return CACHE_PREFIX + String(iata || '').trim().toUpperCase();
}

export async function readRadarCache(iata: string): Promise<RadarSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(iata));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const aircraft = Array.isArray(parsed?.aircraft) ? parsed.aircraft as RadarAircraft[] : [];
    if (!aircraft.length) return null;
    return {
      aircraft,
      source: parsed.source === 'opensky' || parsed.source === 'adsb' ? parsed.source : 'proxy',
      cached: true,
      at: Number(parsed.at) || 0,
    };
  } catch {
    return null;
  }
}

export async function writeRadarCache(iata: string, snap: RadarSnapshot): Promise<void> {
  if (!iata || !snap.aircraft.length) return;
  try {
    await AsyncStorage.setItem(cacheKey(iata), JSON.stringify({
      aircraft: snap.aircraft,
      source: snap.source,
      at: snap.at || Date.now(),
    }));
  } catch { /* ignore */ }
}

function mergeById(lists: RadarAircraft[][]): RadarAircraft[] {
  const map = new Map<string, RadarAircraft>();
  for (const list of lists) {
    for (const a of list) {
      if (!map.has(a.id)) map.set(a.id, a);
    }
  }
  return [...map.values()];
}

async function jsonGet(url: string, timeoutMs: number): Promise<any> {
  const res = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json' },
  }, timeoutMs);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.json();
}

async function fetchAdsbPoint(
  lat: number,
  lon: number,
  radiusKm: number,
  timeoutMs: number,
): Promise<RadarAircraft[]> {
  const data = await jsonGet(
    `https://api.adsb.lol/v2/point/${lat}/${lon}/${radiusKm}`,
    timeoutMs,
  );
  const ac = Array.isArray(data?.ac) ? data.ac : [];
  const list = fromAdsbAc(ac);
  if (!list.length) throw new Error('adsb.lol point empty');
  return list;
}

async function fetchAdsb(): Promise<RadarAircraft[]> {
  const results = await Promise.allSettled(
    HUBS.map(h => jsonGet(`https://api.adsb.lol/v2/lat/${h.lat}/lon/${h.lon}/dist/250`, 10000)),
  );
  const lists: RadarAircraft[][] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const ac = Array.isArray(r.value?.ac) ? r.value.ac : [];
    lists.push(fromAdsbAc(ac));
  }
  const merged = mergeById(lists);
  if (!merged.length) throw new Error('adsb.lol empty');
  return merged;
}

function coerceAircraft(raw: any): RadarAircraft | null {
  if (!raw || typeof raw !== 'object') return null;
  let lat = num(raw.lat ?? raw.latitude);
  let lon = num(raw.lon ?? raw.lng ?? raw.longitude);
  if (lat == null || lon == null) return null;
  if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
    const swap = lat; lat = lon; lon = swap;
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const id = String(raw.id || raw.hex || raw.icao24 || '').trim();
  if (!id) return null;
  return {
    id,
    cs: String(raw.cs || raw.callsign || raw.flight || id).trim() || id,
    country: String(raw.country || '').trim(),
    lat,
    lon,
    altM: num(raw.altM ?? raw.alt),
    spdMs: num(raw.spdMs ?? raw.velocity),
    hdg: num(raw.hdg ?? raw.heading ?? raw.track),
    vr: num(raw.vr),
    reg: String(raw.reg || raw.r || '').trim(),
  };
}

function normalizePayload(data: any): RadarAircraft[] {
  if (Array.isArray(data?.aircraft) && data.aircraft.length) {
    return data.aircraft.map(coerceAircraft).filter((a: RadarAircraft | null): a is RadarAircraft => !!a);
  }
  if (Array.isArray(data?.states)) return fromOpenSkyStates(data.states);
  if (Array.isArray(data?.ac)) return fromAdsbAc(data.ac);
  return [];
}

async function fetchRadarBbox(
  bbox: { lamin: number; lomin: number; lamax: number; lomax: number },
  centerLat: number,
  centerLon: number,
  timeoutMs: number,
): Promise<RadarSnapshot> {
  const q = `lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;

  try {
    const aircraft = capClosest(await fetchAdsb(), centerLat, centerLon);
    if (aircraft.length) {
      return { aircraft, source: 'adsb', cached: false, at: Date.now() };
    }
  } catch { /* fall through */ }

  try {
    const data = await jsonGet(`${PROXY}/radar?${q}`, timeoutMs);
    const aircraft = capClosest(normalizePayload(data), centerLat, centerLon);
    if (aircraft.length) {
      return { aircraft, source: 'proxy', cached: !!data?.cached, at: Date.now() };
    }
  } catch { /* fall through */ }

  return { aircraft: [], source: 'adsb', cached: false, at: Date.now() };
}

/** Aircraft within ~250 km of the airport — first paint. */
export async function fetchRadarNear(
  centerLat: number,
  centerLon: number,
  km = RADAR_NEAR_KM,
): Promise<RadarSnapshot> {
  let snap: RadarSnapshot;
  try {
    const aircraft = capClosest(
      await fetchAdsbPoint(centerLat, centerLon, km, 4000),
      centerLat,
      centerLon,
    );
    snap = { aircraft, source: 'adsb', cached: false, at: Date.now() };
  } catch {
    const bbox = bboxAround(centerLat, centerLon, km);
    snap = await fetchRadarBbox(bbox, centerLat, centerLon, 4000);
  }
  return {
    ...snap,
    aircraft: nearestWithin(snap.aircraft, centerLat, centerLon, km, RADAR_NEAR_COUNT),
  };
}

/** Full SEA snapshot. */
export async function fetchRadarSnapshot(centerLat = 13.75, centerLon = 100.5): Promise<RadarSnapshot> {
  return fetchRadarBbox(SEA_BBOX, centerLat, centerLon, 8000);
}

export function headingCompass(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return '—';
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const i = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return labels[i];
}

export function fmtCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} · ${Math.abs(lon).toFixed(2)}°${ew}`;
}

export function altFeet(altM: number | null | undefined): string {
  if (altM == null || !Number.isFinite(altM)) return '—';
  return `${Math.round(altM * FT_PER_M).toLocaleString('en-US')} ft`;
}

export function speedKnots(spdMs: number | null | undefined): string {
  if (spdMs == null || !Number.isFinite(spdMs)) return '—';
  return `${Math.round(spdMs * KT_PER_MS)} knots`;
}

export function climbLabel(vr: number | null | undefined): string {
  if (vr == null || !Number.isFinite(vr)) return 'Level';
  if (vr > 0.8) return 'Climbing';
  if (vr < -0.8) return 'Descending';
  return 'Level';
}

export function countNear(list: RadarAircraft[], lat: number, lon: number, km = 90): number {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.3, Math.cos(lat * Math.PI / 180)));
  let n = 0;
  for (const a of list) {
    if (Math.abs(a.lat - lat) <= dLat && Math.abs(a.lon - lon) <= dLon) n++;
  }
  return n;
}

export const COUNTRY_FLAG: Record<string, string> = {
  Thailand: '🇹🇭', Singapore: '🇸🇬', Malaysia: '🇲🇾', Indonesia: '🇮🇩',
  Vietnam: '🇻🇳', 'China': '🇨🇳', Japan: '🇯🇵', India: '🇮🇳',
  Australia: '🇦🇺', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧',
  'Korea, Republic of': '🇰🇷', 'South Korea': '🇰🇷', Philippines: '🇵🇭',
  'Hong Kong': '🇭🇰', Taiwan: '🇹🇼', Cambodia: '🇰🇭', Laos: '🇱🇦',
  Myanmar: '🇲🇲', 'United Arab Emirates': '🇦🇪', Qatar: '🇶🇦',
};
