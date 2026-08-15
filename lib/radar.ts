import { fetchWithTimeout } from './net';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export const SEA_BBOX = { lamin: 0, lomin: 92, lamax: 28, lomax: 140 };
const MAX_AIRCRAFT = 500;
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

async function fetchOpenSky(): Promise<RadarAircraft[]> {
  const { lamin, lomin, lamax, lomax } = SEA_BBOX;
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const data = await jsonGet(url, 10000);
  const states = Array.isArray(data?.states) ? data.states : [];
  const list = fromOpenSkyStates(states);
  if (!list.length) throw new Error('OpenSky empty');
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

function normalizePayload(data: any): RadarAircraft[] {
  if (Array.isArray(data?.aircraft) && data.aircraft.length) {
    return data.aircraft.filter((a: RadarAircraft) =>
      a && Number.isFinite(a.lat) && Number.isFinite(a.lon),
    );
  }
  if (Array.isArray(data?.states)) return fromOpenSkyStates(data.states);
  if (Array.isArray(data?.ac)) return fromAdsbAc(data.ac);
  return [];
}

/** Proxy first, then OpenSky from the device, then adsb.lol. */
export async function fetchRadarSnapshot(centerLat = 13.75, centerLon = 100.5): Promise<RadarSnapshot> {
  try {
    const data = await jsonGet(
      `${PROXY}/radar?lamin=${SEA_BBOX.lamin}&lomin=${SEA_BBOX.lomin}&lamax=${SEA_BBOX.lamax}&lomax=${SEA_BBOX.lomax}`,
      8000,
    );
    const aircraft = capClosest(normalizePayload(data), centerLat, centerLon);
    if (aircraft.length) {
      return {
        aircraft,
        source: 'proxy',
        cached: !!data?.cached,
        at: Date.now(),
      };
    }
  } catch { /* fall through */ }

  try {
    const aircraft = capClosest(await fetchOpenSky(), centerLat, centerLon);
    return { aircraft, source: 'opensky', cached: false, at: Date.now() };
  } catch { /* fall through */ }

  const aircraft = capClosest(await fetchAdsb(), centerLat, centerLon);
  return { aircraft, source: 'adsb', cached: false, at: Date.now() };
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
