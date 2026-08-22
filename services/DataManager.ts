import AsyncStorage from '@react-native-async-storage/async-storage';
import { isPro } from './SubscriptionManager';
import { getFAFlightDetail, isFaEnabled, type FAFlightDetail } from './FlightAwareService';
import { getADBDepartures, getADBArrivals, getADBFlight } from './AeroDataBoxService';
import { getOpenSkyFlights } from './OpenSkyService';

export type DataSource = 'live' | 'cached';

export type FidsBundle = {
  data: any[];
  source: DataSource;
  normalized?: boolean;
  stale?: boolean;
  cachedAt?: number;
};

export type FlightDetailBundle = {
  data: FAFlightDetail | any[] | null;
  source: DataSource;
  premium: boolean;
};

type CacheEntry = {
  data: any;
  timestamp: number;
};

const CACHE_MAX_MS = 24 * 60 * 60 * 1000;
const TRACKED_CACHE_MAX_MS = 48 * 60 * 60 * 1000;

function maxAgeForKey(key: string): number {
  return key.startsWith('flight_') ? TRACKED_CACHE_MAX_MS : CACHE_MAX_MS;
}

export async function saveCache(key: string, data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch { /* ignore */ }
}

async function readCacheEntry(key: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.data == null) return null;
    return {
      data: parsed.data,
      timestamp: Number(parsed.timestamp || 0),
    };
  } catch {
    return null;
  }
}

export async function getCached(key: string): Promise<any | null> {
  const entry = await readCacheEntry(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  if (age > maxAgeForKey(key)) return null;
  return entry.data;
}

function cachedFids(entry: CacheEntry | null): FidsBundle {
  if (!entry || !Array.isArray(entry.data)) {
    return { data: [], source: 'cached', stale: false };
  }
  const age = Date.now() - entry.timestamp;
  return {
    data: entry.data,
    source: 'cached',
    stale: true,
    cachedAt: entry.timestamp || Date.now() - age,
  };
}

export async function getDepartures(iata: string, offsetDays = 0, date?: string, arrIata?: string): Promise<FidsBundle> {
  const code = String(iata || '').toUpperCase();
  const arr = String(arrIata || '').toUpperCase();
  const cacheKey = `dep_${code}_${date || offsetDays || 0}${arr ? `_${arr}` : ''}`;
  try {
    const data = await getADBDepartures(code, offsetDays, date, arr || undefined);
    saveCache(cacheKey, data).catch(() => {});
    return { data, source: 'live', stale: false };
  } catch {
    if (offsetDays) {
      return cachedFids(await readCacheEntry(cacheKey));
    }
    try {
      const data = await getOpenSkyFlights(code, 'dep');
      saveCache(cacheKey, data).catch(() => {});
      return { data, source: 'live', normalized: true, stale: false };
    } catch {
      return cachedFids(await readCacheEntry(cacheKey));
    }
  }
}

export async function getArrivals(iata: string, offsetDays = 0, date?: string): Promise<FidsBundle> {
  const code = String(iata || '').toUpperCase();
  const cacheKey = `arr_${code}_${date || offsetDays || 0}`;
  try {
    const data = await getADBArrivals(code, offsetDays, date);
    saveCache(cacheKey, data).catch(() => {});
    return { data, source: 'live', stale: false };
  } catch {
    if (offsetDays) {
      return cachedFids(await readCacheEntry(cacheKey));
    }
    try {
      const data = await getOpenSkyFlights(code, 'arr');
      saveCache(cacheKey, data).catch(() => {});
      return { data, source: 'live', normalized: true, stale: false };
    } catch {
      return cachedFids(await readCacheEntry(cacheKey));
    }
  }
}

export async function getFlightDetail(ident: string, signal?: AbortSignal): Promise<FlightDetailBundle> {
  const clean = String(ident || '').replace(/\s+/g, '').toUpperCase();
  const userIsPro = await isPro();

  if (userIsPro && isFaEnabled()) {
    try {
      const data = await getFAFlightDetail(clean, signal);
      saveCache(`flight_${clean}`, { premium: true, fa: data }).catch(() => {});
      return { data, source: 'live', premium: true };
    } catch (err) {
      console.warn('Premium live detail unavailable, using standard source');
    }
  }

  try {
    const data = await getADBFlight(clean, signal);
    saveCache(`flight_${clean}`, { premium: false, adb: data }).catch(() => {});
    return { data, source: 'live', premium: false };
  } catch {
    const entry = await readCacheEntry(`flight_${clean}`);
    const cached = entry?.data;
    if (cached?.fa) return { data: cached.fa, source: 'cached', premium: !!cached.premium };
    if (Array.isArray(cached?.adb)) return { data: cached.adb, source: 'cached', premium: false };
    if (Array.isArray(cached)) return { data: cached, source: 'cached', premium: false };
    return { data: null, source: 'cached', premium: false };
  }
}
