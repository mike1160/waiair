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
};

export type FlightDetailBundle = {
  data: FAFlightDetail | any[] | null;
  source: DataSource;
  premium: boolean;
};

const CACHE_MAX_MS = 10 * 60 * 1000;

export async function saveCache(key: string, data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch { /* ignore */ }
}

export async function getCached(key: string): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const age = Date.now() - Number(parsed?.timestamp || 0);
    if (age > CACHE_MAX_MS) return null;
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export async function getDepartures(iata: string): Promise<FidsBundle> {
  const code = String(iata || '').toUpperCase();
  try {
    const data = await getADBDepartures(code);
    saveCache(`dep_${code}`, data).catch(() => {});
    return { data, source: 'live' };
  } catch {
    try {
      const data = await getOpenSkyFlights(code, 'dep');
      saveCache(`dep_${code}`, data).catch(() => {});
      return { data, source: 'live', normalized: true };
    } catch {
      const cached = await getCached(`dep_${code}`);
      return { data: Array.isArray(cached) ? cached : [], source: 'cached' };
    }
  }
}

export async function getArrivals(iata: string): Promise<FidsBundle> {
  const code = String(iata || '').toUpperCase();
  try {
    const data = await getADBArrivals(code);
    saveCache(`arr_${code}`, data).catch(() => {});
    return { data, source: 'live' };
  } catch {
    try {
      const data = await getOpenSkyFlights(code, 'arr');
      saveCache(`arr_${code}`, data).catch(() => {});
      return { data, source: 'live', normalized: true };
    } catch {
      const cached = await getCached(`arr_${code}`);
      return { data: Array.isArray(cached) ? cached : [], source: 'cached' };
    }
  }
}

export async function getFlightDetail(ident: string): Promise<FlightDetailBundle> {
  const clean = String(ident || '').replace(/\s+/g, '').toUpperCase();
  const userIsPro = await isPro();

  if (userIsPro && isFaEnabled()) {
    try {
      const data = await getFAFlightDetail(clean);
      saveCache(`flight_${clean}`, { premium: true, fa: data }).catch(() => {});
      return { data, source: 'live', premium: true };
    } catch (err) {
      console.warn('Premium live detail unavailable, using standard source');
    }
  }

  try {
    const data = await getADBFlight(clean);
    saveCache(`flight_${clean}`, { premium: false, adb: data }).catch(() => {});
    return { data, source: 'live', premium: false };
  } catch {
    const cached = await getCached(`flight_${clean}`);
    if (cached?.fa) return { data: cached.fa, source: 'cached', premium: !!cached.premium };
    if (Array.isArray(cached?.adb)) return { data: cached.adb, source: 'cached', premium: false };
    if (Array.isArray(cached)) return { data: cached, source: 'cached', premium: false };
    return { data: null, source: 'cached', premium: false };
  }
}
