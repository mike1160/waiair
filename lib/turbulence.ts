/** Route turbulence estimate via WaiAir proxy (Open-Meteo wind / shear). */

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export type TurbulenceSeverity = 'smooth' | 'light' | 'moderate' | 'severe';

export type TurbulenceForecast = {
  overall: TurbulenceSeverity;
  peak: TurbulenceSeverity;
  region: string;
  windowStart: string;
  windowEnd: string;
  /** 0–10 bar fill level */
  barLevel: number;
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
    const r = await fetch(`${PROXY}/turbulence?${q.toString()}`);
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
    const data: TurbulenceForecast = {
      overall,
      peak,
      region: String(json.region),
      windowStart: String(json.windowStart || ''),
      windowEnd: String(json.windowEnd || ''),
      barLevel: Number(json.barLevel) || barLevelForSeverity(peak),
    };
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
