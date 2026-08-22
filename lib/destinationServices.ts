import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatInTimeZone, getTimezoneOffset } from 'date-fns-tz';
import { AIRPORTS } from './airportsDb';
import { timezoneForIata } from './airportTz';
import { isoInAirportTzToUtcMs } from './localFlightTime';
import { recordFxRate } from './fxRateHistory';
export { timezoneForIata } from './airportTz';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const OPENWEATHER_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || process.env.EXPO_PUBLIC_OPENWEATHER_KEY || '';
const EXCHANGE_KEY = process.env.EXPO_PUBLIC_EXCHANGE_API_KEY || process.env.EXPO_PUBLIC_EXCHANGE_KEY || '';

const WEATHER_TTL_MS = 60 * 60 * 1000;
const FX_TTL_MS = 24 * 60 * 60 * 1000;
/** Country facts never expire — they don't change. */
const COUNTRY_TTL_MS = Number.POSITIVE_INFINITY;

export type WeatherKind = 'sun' | 'cloud' | 'rain' | 'storm' | 'snow' | 'fog';

export type WeatherSnapshot = {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  humid: boolean;
  description: string;
  icon: WeatherKind;
  landingTemp?: number;
  landingLabel?: string;
  windDeg?: number;
};

export type AqiHour = { time: string; aqi: number };

export type AqiSnapshot = {
  aqi: number;
  label: string;
  hourly?: AqiHour[];
};

export function aqiLabelFor(n: number): string {
  if (n <= 50) return 'Good';
  if (n <= 100) return 'Moderate';
  if (n <= 150) return 'Unhealthy';
  return 'Poor';
}

export function aqiColor(n: number): string {
  if (n <= 50) return '#22c55e';
  if (n <= 100) return '#EAB308';
  if (n <= 150) return '#F59E0B';
  return '#EF4444';
}

export type FxSnapshot = {
  destCode: string;
  localCode: string | null;
  localToDest: number | null;
  usdToDest: number | null;
};

export type LocalTimeSnapshot = {
  time: string;
  utcOffset: string;
  relative: string;
};

export type CountrySnapshot = {
  name: string;
  flag: string;
  capital: string;
  language: string;
  emergency: string;
  plugs: string;
  calling: string;
  currencyCode: string;
  currencyName: string;
};

const COUNTRY_CURRENCY: Record<string, string> = {
  TH: 'THB', NL: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR',
  US: 'USD', GB: 'GBP', SG: 'SGD', MY: 'MYR', ID: 'IDR', VN: 'VND', PH: 'PHP',
  AE: 'AED', QA: 'QAR', SA: 'SAR', JP: 'JPY', KR: 'KRW', CN: 'CNY', HK: 'HKD', TW: 'TWD',
  IN: 'INR', AU: 'AUD', NZ: 'NZD', CA: 'CAD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', TR: 'TRY',
  ZA: 'ZAR', BR: 'BRL', MX: 'MXN',
  BH: 'BHD', OM: 'OMR', KW: 'KWD', KH: 'KHR', LA: 'LAK', MM: 'MMK', BN: 'BND',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', EG: 'EGP', IL: 'ILS', PK: 'PKR',
  BD: 'BDT', LK: 'LKR', NP: 'NPR', KZ: 'KZT', UA: 'UAH', LU: 'EUR', MT: 'EUR', CY: 'EUR',
  IS: 'ISK',
};

/** IATA → local currency for airports in the app catalog. */
const AIRPORT_CURRENCY: Record<string, string> = Object.fromEntries(
  AIRPORTS.map(ap => {
    const code = COUNTRY_CURRENCY[ap.country];
    return code ? [ap.iata, code] as const : null;
  }).filter(Boolean) as [string, string][],
);

const COUNTRY_EXTRAS: Record<string, { emergency: string; plugs: string }> = {
  TH: { emergency: '191 (police)', plugs: 'Type A/B/C' },
  NL: { emergency: '112', plugs: 'Type C/F' },
  DE: { emergency: '112', plugs: 'Type C/F' },
  FR: { emergency: '112', plugs: 'Type C/E' },
  GB: { emergency: '999', plugs: 'Type G' },
  US: { emergency: '911', plugs: 'Type A/B' },
  SG: { emergency: '999', plugs: 'Type G' },
  MY: { emergency: '999', plugs: 'Type G' },
  ID: { emergency: '110', plugs: 'Type C/F' },
  VN: { emergency: '113', plugs: 'Type A/C/F' },
  PH: { emergency: '911', plugs: 'Type A/B/C' },
  AE: { emergency: '999', plugs: 'Type G' },
  QA: { emergency: '999', plugs: 'Type D/G' },
  JP: { emergency: '110', plugs: 'Type A/B' },
  KR: { emergency: '112', plugs: 'Type C/F' },
  CN: { emergency: '110', plugs: 'Type A/C/I' },
  HK: { emergency: '999', plugs: 'Type G' },
  IN: { emergency: '112', plugs: 'Type C/D/M' },
  AU: { emergency: '000', plugs: 'Type I' },
  CA: { emergency: '911', plugs: 'Type A/B' },
};

/** Average gate-to-gate walking time (minutes). */
export const GATE_WALK_MIN: Record<string, number> = {
  AMS: 12, BKK: 20, DMK: 12, HKT: 5, SIN: 15, KUL: 10,
  CDG: 18, LHR: 18, FRA: 16, DXB: 18, DOH: 14, ICN: 14, NRT: 16, HKG: 12,
};

/** Taxi / transfer time to city centre. */
export const TAXI_TO_CENTER_MIN: Record<string, number> = {
  HKT: 45, BKK: 60, DMK: 40, CNX: 25,
  AMS: 30, SIN: 25, KUL: 45, CGK: 50, DPS: 35, MNL: 40,
  LHR: 50, CDG: 45, FRA: 25, DXB: 35, DOH: 30, HKG: 35,
};

export function currencyForCountry(country?: string): string {
  const cc = String(country || '').toUpperCase();
  return COUNTRY_CURRENCY[cc] || 'USD';
}

/** Local currency for an airport — null when unknown (FX UI falls back to USD only). */
export function currencyForAirport(iata?: string, country?: string): string | null {
  const code = String(iata || '').trim().toUpperCase();
  if (code && AIRPORT_CURRENCY[code]) return AIRPORT_CURRENCY[code];
  const cc = String(country || '').trim().toUpperCase();
  if (cc && COUNTRY_CURRENCY[cc]) return COUNTRY_CURRENCY[cc];
  return null;
}

function fxCrossRate(rates: Record<string, unknown>, from: string, to: string): number | null {
  const f = Number(rates[from]);
  const t = Number(rates[to]);
  if (!Number.isFinite(f) || !Number.isFinite(t) || f <= 0) return null;
  if (from === to) return 1;
  return t / f;
}

export function walkMinutes(hub?: string, sameTerminal?: boolean | null): number {
  const base = GATE_WALK_MIN[String(hub || '').toUpperCase()] ?? 12;
  if (sameTerminal === false) return Math.round(base * 1.35);
  if (sameTerminal === true) return Math.max(4, Math.round(base * 0.65));
  return base;
}

export function taxiMinutes(iata?: string): number | null {
  const n = TAXI_TO_CENTER_MIN[String(iata || '').toUpperCase()];
  return typeof n === 'number' ? n : null;
}

async function cacheGet<T>(key: string, ttl: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== 'number') return null;
    if (Number.isFinite(ttl) && Date.now() - parsed.ts > ttl) return null;
    return parsed.data as T;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* ignore */ }
}

function mapOpenWeatherIcon(main: string): WeatherKind {
  const m = String(main || '').toLowerCase();
  if (m === 'clear') return 'sun';
  if (m === 'clouds') return 'cloud';
  if (m === 'rain' || m === 'drizzle') return 'rain';
  if (m === 'thunderstorm') return 'storm';
  if (m === 'snow') return 'snow';
  return 'fog';
}

function mapMeteoIcon(code: number): { icon: WeatherKind; label: string } {
  if (code === 0) return { icon: 'sun', label: 'Clear' };
  if (code >= 1 && code <= 3) return { icon: 'cloud', label: 'Partly cloudy' };
  if (code >= 45 && code <= 48) return { icon: 'fog', label: 'Foggy' };
  if (code >= 51 && code <= 67) return { icon: 'rain', label: 'Rain' };
  if (code >= 71 && code <= 77) return { icon: 'snow', label: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: 'rain', label: 'Showers' };
  if (code >= 95) return { icon: 'storm', label: 'Thunderstorm' };
  return { icon: 'cloud', label: 'Cloudy' };
}

function titleCase(s: string): string {
  return String(s || '').replace(/\b\w/g, c => c.toUpperCase());
}

async function fetchJson(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickLandingFromForecast(
  list: Array<{ dt?: number; main?: { temp?: number }; weather?: Array<{ description?: string; main?: string }> }>,
  landingMs?: number,
): { temp: number; label: string } | null {
  if (!landingMs || !Array.isArray(list) || !list.length) return null;
  let best = list[0];
  let bestDiff = Infinity;
  for (const item of list) {
    const t = Number(item.dt || 0) * 1000;
    if (!t) continue;
    const diff = Math.abs(t - landingMs);
    if (diff < bestDiff) {
      best = item;
      bestDiff = diff;
    }
  }
  const temp = Math.round(Number(best?.main?.temp));
  if (!Number.isFinite(temp)) return null;
  const label = titleCase(best?.weather?.[0]?.description || best?.weather?.[0]?.main || 'Cloudy');
  return { temp, label };
}

export async function fetchWeatherSnapshot(
  lat: number,
  lon: number,
  city: string,
  landingIso?: string,
  destIata?: string,
  destCountry?: string,
): Promise<WeatherSnapshot | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  const cacheKey = `waiair.wx.v2.${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = await cacheGet<WeatherSnapshot>(cacheKey, WEATHER_TTL_MS);
  if (cached) return cached;

  const landingMs = isoInAirportTzToUtcMs(landingIso, destIata, destCountry)
    ?? (landingIso ? new Date(String(landingIso).replace(' ', 'T')).getTime() : NaN);
  const landingQ = Number.isFinite(landingMs) ? `&landing=${encodeURIComponent(String(landingMs))}` : '';

  const fromProxy = await fetchJson(
    `${PROXY}/weather?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}${landingQ}`,
  );
  if (fromProxy?.temp != null) {
    const snap: WeatherSnapshot = {
      city: fromProxy.city || city,
      temp: Math.round(Number(fromProxy.temp)),
      feelsLike: Math.round(Number(fromProxy.feelsLike ?? fromProxy.temp)),
      humidity: Math.round(Number(fromProxy.humidity ?? 0)),
      humid: Number(fromProxy.humidity ?? 0) >= 70,
      description: titleCase(fromProxy.description || 'Clear'),
      icon: mapOpenWeatherIcon(fromProxy.iconMain || fromProxy.description || ''),
        landingTemp: fromProxy.landingTemp != null ? Math.round(Number(fromProxy.landingTemp)) : undefined,
        landingLabel: fromProxy.landingLabel || undefined,
        windDeg: Number.isFinite(Number(fromProxy.windDeg)) ? Number(fromProxy.windDeg) : undefined,
    };
    await cacheSet(cacheKey, snap);
    return snap;
  }

  if (OPENWEATHER_KEY) {
    const now = await fetchJson(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`,
    );
    if (now?.main) {
      let landingTemp: number | undefined;
      let landingLabel: string | undefined;
      if (Number.isFinite(landingMs)) {
        const fc = await fetchJson(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`,
        );
        const hit = pickLandingFromForecast(fc?.list || [], landingMs);
        if (hit) {
          landingTemp = hit.temp;
          landingLabel = hit.label;
        }
      }
      const humidity = Math.round(Number(now.main.humidity || 0));
      const snap: WeatherSnapshot = {
        city: now.name || city,
        temp: Math.round(Number(now.main.temp)),
        feelsLike: Math.round(Number(now.main.feels_like ?? now.main.temp)),
        humidity,
        humid: humidity >= 70,
        description: titleCase(now.weather?.[0]?.description || now.weather?.[0]?.main || 'Clear'),
        icon: mapOpenWeatherIcon(now.weather?.[0]?.main || ''),
        landingTemp,
        landingLabel,
        windDeg: Number.isFinite(Number(now.wind?.deg)) ? Number(now.wind.deg) : undefined,
      };
      await cacheSet(cacheKey, snap);
      return snap;
    }
  }

  const meteo = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weathercode,wind_direction_10m` +
    `&hourly=temperature_2m,weathercode&timezone=auto`,
  );
  const cur = meteo?.current;
  if (!cur) return null;
  const mapped = mapMeteoIcon(Number(cur.weathercode ?? -1));
  let landingTemp: number | undefined;
  let landingLabel: string | undefined;
  if (Number.isFinite(landingMs) && Array.isArray(meteo?.hourly?.time)) {
    const times: string[] = meteo.hourly.time;
    const temps: number[] = meteo.hourly.temperature_2m || [];
    const codes: number[] = meteo.hourly.weathercode || [];
    let bestI = 0;
    let bestDiff = Infinity;
    times.forEach((t, i) => {
      const ms = new Date(t).getTime();
      const diff = Math.abs(ms - landingMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestI = i;
      }
    });
    const t = Math.round(Number(temps[bestI]));
    if (Number.isFinite(t)) {
      landingTemp = t;
      landingLabel = mapMeteoIcon(Number(codes[bestI] ?? 1)).label;
    }
  }
  const humidity = Math.round(Number(cur.relative_humidity_2m ?? 0));
  const snap: WeatherSnapshot = {
    city,
    temp: Math.round(Number(cur.temperature_2m ?? 0)),
    feelsLike: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0)),
    humidity,
    humid: humidity >= 70,
    description: mapped.label,
    icon: mapped.icon,
    landingTemp,
    landingLabel,
    windDeg: Number.isFinite(Number(cur.wind_direction_10m)) ? Number(cur.wind_direction_10m) : undefined,
  };
  await cacheSet(cacheKey, snap);
  return snap;
}

function aqiLabel(n: number): string {
  return aqiLabelFor(n);
}

function parseAqiHourly(json: any): AqiHour[] {
  const times: string[] = Array.isArray(json?.hourly?.time) ? json.hourly.time : [];
  const vals: unknown[] = Array.isArray(json?.hourly?.us_aqi) ? json.hourly.us_aqi : [];
  const now = Date.now() - 20 * 60 * 1000;
  const out: AqiHour[] = [];
  for (let i = 0; i < times.length && out.length < 12; i++) {
    const ms = new Date(times[i]).getTime();
    const aqi = Math.round(Number(vals[i]));
    if (!Number.isFinite(ms) || ms < now || !Number.isFinite(aqi) || aqi < 0) continue;
    out.push({ time: String(times[i]), aqi });
  }
  return out;
}

/** US AQI via Open-Meteo (same provider as weather). Cached for offline. */
export async function fetchAqiSnapshot(lat: number, lon: number): Promise<AqiSnapshot | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  const cacheKey = `waiair.aqi.v2.${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = await cacheGet<AqiSnapshot>(cacheKey, WEATHER_TTL_MS);
  if (cached && cached.hourly && cached.hourly.length >= 6) return cached;
  const json = await fetchJson(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=us_aqi&hourly=us_aqi&forecast_days=2&timezone=auto`,
  );
  const aqi = Math.round(Number(json?.current?.us_aqi ?? cached?.aqi));
  if (!Number.isFinite(aqi) || aqi < 0) return cached ?? null;
  const snap: AqiSnapshot = {
    aqi,
    label: aqiLabel(aqi),
    hourly: parseAqiHourly(json),
  };
  await cacheSet(cacheKey, snap);
  return snap;
}

export type WeatherStationHour = { time: string; temp: number; humidity?: number };

export type WeatherStationSnapshot = {
  name: string;
  region?: string;
  elevationM?: number;
  timezone?: string;
  observedAt?: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  dewPoint?: number;
  pressureHpa?: number;
  windKmh?: number;
  windDeg?: number;
  windGustKmh?: number;
  cloudCover?: number;
  visibilityKm?: number;
  precipitationMm?: number;
  description: string;
  icon: WeatherKind;
  aqi?: number;
  aqiLabel?: string;
  hourly: WeatherStationHour[];
};

export function windCompass(deg?: number): string {
  if (deg == null || !Number.isFinite(deg)) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function finiteNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseWxHourly(json: any): WeatherStationHour[] {
  const times: string[] = Array.isArray(json?.hourly?.time) ? json.hourly.time : [];
  const temps: unknown[] = Array.isArray(json?.hourly?.temperature_2m) ? json.hourly.temperature_2m : [];
  const hums: unknown[] = Array.isArray(json?.hourly?.relative_humidity_2m) ? json.hourly.relative_humidity_2m : [];
  const now = Date.now() - 20 * 60 * 1000;
  const out: WeatherStationHour[] = [];
  for (let i = 0; i < times.length && out.length < 12; i++) {
    const ms = new Date(times[i]).getTime();
    const temp = Math.round(Number(temps[i]));
    if (!Number.isFinite(ms) || ms < now || !Number.isFinite(temp)) continue;
    const humidity = Math.round(Number(hums[i]));
    out.push({
      time: String(times[i]),
      temp,
      humidity: Number.isFinite(humidity) ? humidity : undefined,
    });
  }
  return out;
}

/** Nearest Open-Meteo observation (forecast grid) + reverse-geocoded station name. */
export async function fetchWeatherStation(lat: number, lon: number): Promise<WeatherStationSnapshot | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  const cacheKey = `waiair.station.v1.${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = await cacheGet<WeatherStationSnapshot>(cacheKey, WEATHER_TTL_MS);
  if (cached && cached.hourly.length >= 6) return cached;

  const [meteo, geo, aqi] = await Promise.all([
    fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,` +
      `precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,` +
      `wind_gusts_10m,visibility` +
      `&hourly=temperature_2m,relative_humidity_2m&forecast_days=2` +
      `&wind_speed_unit=kmh&timezone=auto`,
    ),
    fetchJson(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`,
    ),
    fetchAqiSnapshot(lat, lon),
  ]);

  const cur = meteo?.current;
  if (!cur) return cached ?? null;
  const mapped = mapMeteoIcon(Number(cur.weather_code ?? cur.weathercode ?? -1));
  const place = geo?.results?.[0];
  const visM = finiteNum(cur.visibility);
  const snap: WeatherStationSnapshot = {
    name: String(place?.name || '').trim(),
    region: [place?.admin1, place?.country].filter(Boolean).join(', ') || undefined,
    elevationM: finiteNum(meteo?.elevation),
    timezone: String(meteo?.timezone || '').trim() || undefined,
    observedAt: cur.time ? String(cur.time) : undefined,
    temp: Math.round(Number(cur.temperature_2m ?? 0)),
    feelsLike: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0)),
    humidity: Math.round(Number(cur.relative_humidity_2m ?? 0)),
    dewPoint: finiteNum(cur.dew_point_2m) != null ? Math.round(Number(cur.dew_point_2m)) : undefined,
    pressureHpa: finiteNum(cur.pressure_msl) != null ? Math.round(Number(cur.pressure_msl)) : undefined,
    windKmh: finiteNum(cur.wind_speed_10m) != null ? Math.round(Number(cur.wind_speed_10m)) : undefined,
    windDeg: finiteNum(cur.wind_direction_10m),
    windGustKmh: finiteNum(cur.wind_gusts_10m) != null ? Math.round(Number(cur.wind_gusts_10m)) : undefined,
    cloudCover: finiteNum(cur.cloud_cover) != null ? Math.round(Number(cur.cloud_cover)) : undefined,
    visibilityKm: visM != null ? Math.round((visM / 1000) * 10) / 10 : undefined,
    precipitationMm: finiteNum(cur.precipitation),
    description: mapped.label,
    icon: mapped.icon,
    aqi: aqi?.aqi,
    aqiLabel: aqi?.label,
    hourly: parseWxHourly(meteo),
  };
  await cacheSet(cacheKey, snap);
  return snap;
}

export function arrivalTzDeltaHours(
  originIata?: string,
  destIata?: string,
  originCountry?: string,
  destCountry?: string,
): number {
  const a = timezoneForIata(originIata, originCountry);
  const b = timezoneForIata(destIata, destCountry);
  return Math.round((tzOffsetMinutes(b) - tzOffsetMinutes(a)) / 60);
}

export async function fetchFxSnapshot(
  originIata?: string,
  originCountry?: string,
  destIata?: string,
  destCountry?: string,
): Promise<FxSnapshot | null> {
  const destCode = currencyForAirport(destIata, destCountry) || currencyForCountry(destCountry) || 'USD';
  const localCode = currencyForAirport(originIata, originCountry);
  const cacheKey = `waiair.fx.v2.${localCode || 'USD'}.${destCode}`;
  const cached = await cacheGet<FxSnapshot>(cacheKey, FX_TTL_MS);
  if (cached) {
    await recordFxRate(destCode, cached.usdToDest);
    return cached;
  }

  const fromProxy = await fetchJson(`${PROXY}/fx?base=EUR`);
  const rates = fromProxy?.rates
    || (EXCHANGE_KEY
      ? (await fetchJson(`https://v6.exchangerate-api.com/v6/${EXCHANGE_KEY}/latest/EUR`))?.conversion_rates
      : null)
    || (await fetchJson('https://open.er-api.com/v6/latest/EUR'))?.rates;

  if (!rates || typeof rates !== 'object') return null;
  const snap: FxSnapshot = {
    destCode,
    localCode,
    localToDest: localCode ? fxCrossRate(rates, localCode, destCode) : null,
    usdToDest: fxCrossRate(rates, 'USD', destCode),
  };
  await cacheSet(cacheKey, snap);
  await recordFxRate(destCode, snap.usdToDest);
  return snap;
}

/** EUR-base rates table for multi-currency conversion UIs. */
export async function fetchEurFxRates(): Promise<Record<string, number> | null> {
  const cacheKey = 'waiair.fx.eur.all.v1';
  const cached = await cacheGet<Record<string, number>>(cacheKey, FX_TTL_MS);
  if (cached) return cached;

  const fromProxy = await fetchJson(`${PROXY}/fx?base=EUR`);
  const rates = fromProxy?.rates
    || (EXCHANGE_KEY
      ? (await fetchJson(`https://v6.exchangerate-api.com/v6/${EXCHANGE_KEY}/latest/EUR`))?.conversion_rates
      : null)
    || (await fetchJson('https://open.er-api.com/v6/latest/EUR'))?.rates;

  if (!rates || typeof rates !== 'object') return null;
  const out: Record<string, number> = { EUR: 1 };
  for (const [code, raw] of Object.entries(rates)) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) out[code] = n;
  }
  await cacheSet(cacheKey, out);
  return out;
}

export function fxConvert(
  rates: Record<string, unknown>,
  amount: number,
  from: string,
  to: string,
): number | null {
  const cross = fxCrossRate(rates, from, to);
  if (cross == null || !Number.isFinite(amount)) return null;
  return amount * cross;
}

function formatUtcOffset(timeZone: string, date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(date)
      .find(p => p.type === 'timeZoneName')?.value || '';
    const asUtc = name.replace(/^GMT/i, 'UTC').replace(/([+-])0+(\d)/, '$1$2');
    if (/^UTC[+-]\d/.test(asUtc)) return asUtc;
  } catch { /* Hermes often lacks shortOffset */ }
  return formatOffsetMinutes(tzOffsetMinutes(timeZone, date));
}

function formatOffsetMinutes(mins: number): string {
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, '0')}`;
}

function tzOffsetMinutes(timeZone: string, date = new Date()): number {
  return Math.round(getTimezoneOffset(timeZone, date) / 60000);
}

export function localTimeSnapshot(
  iata?: string,
  country?: string,
  relativeTo?: { iata?: string; city?: string; country?: string },
): LocalTimeSnapshot {
  const tz = timezoneForIata(iata, country);
  let time = '--:--';
  try {
    time = formatInTimeZone(new Date(), tz, 'HH:mm');
  } catch { /* ignore */ }

  const utcOffset = formatUtcOffset(tz);

  const otherIata = String(relativeTo?.iata || '').toUpperCase();
  const otherTz = otherIata
    ? timezoneForIata(otherIata, relativeTo?.country)
    : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const otherLabel = (relativeTo?.city || otherIata || 'you').trim();
  const diffH = Math.round((tzOffsetMinutes(tz) - tzOffsetMinutes(otherTz)) / 60);
  let relative = otherIata ? `Same time as ${otherLabel}` : 'Same time as you';
  if (diffH > 0) relative = `${diffH} hour${diffH === 1 ? '' : 's'} ahead of ${otherLabel}`;
  if (diffH < 0) relative = `${Math.abs(diffH)} hour${diffH === -1 ? '' : 's'} behind ${otherLabel}`;

  return { time, utcOffset, relative };
}

export async function fetchCountrySnapshot(country?: string): Promise<CountrySnapshot | null> {
  const cc = String(country || '').toUpperCase();
  if (cc.length !== 2) return null;
  const cacheKey = `waiair.country.v1.${cc}`;
  const cached = await cacheGet<CountrySnapshot>(cacheKey, COUNTRY_TTL_MS);
  if (cached) return cached;

  const extras = COUNTRY_EXTRAS[cc] || { emergency: '112', plugs: '—' };
  const fromProxy = await fetchJson(`${PROXY}/country/${encodeURIComponent(cc)}`);
  const direct = fromProxy?.name
    ? null
    : await fetchJson(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(cc)}?fields=name,capital,languages,currencies,idd,cca2,flag,flags`);
  const raw = fromProxy?.name ? fromProxy : (Array.isArray(direct) ? direct[0] : direct);

  if (!raw) {
    const fallback: CountrySnapshot = {
      name: cc,
      flag: '',
      capital: '',
      language: '',
      emergency: extras.emergency,
      plugs: extras.plugs,
      calling: '',
      currencyCode: currencyForCountry(cc),
      currencyName: '',
    };
    return fallback;
  }

  const languages = raw.languages && typeof raw.languages === 'object'
    ? Object.values(raw.languages).filter(Boolean).slice(0, 2).join(', ')
    : '';
  const currencies = raw.currencies && typeof raw.currencies === 'object'
    ? Object.entries(raw.currencies) as Array<[string, { name?: string }]>
    : [];
  const root = raw.idd?.root || '';
  const suffix = Array.isArray(raw.idd?.suffixes) ? raw.idd.suffixes[0] : '';
  const snap: CountrySnapshot = {
    name: raw.name?.common || cc,
    flag: raw.flag || raw.flags?.emoji || '',
    capital: Array.isArray(raw.capital) ? raw.capital[0] : (raw.capital || ''),
    language: String(languages),
    emergency: extras.emergency,
    plugs: extras.plugs,
    calling: `${root}${suffix || ''}`.trim(),
    currencyCode: currencies[0]?.[0] || currencyForCountry(cc),
    currencyName: currencies[0]?.[1]?.name || '',
  };
  await cacheSet(cacheKey, snap);
  return snap;
}

export function formatRate(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
