import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_KEY = 'waiair.recentSearches.v1';
const AIRPORT_KEY = 'waiair.recentAirports.v1';
const MAX = 5;

export type RecentAirport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
};

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadRecentSearches(): Promise<string[]> {
  return (await readList<string>(SEARCH_KEY)).map(String).filter(Boolean).slice(0, MAX);
}

export async function pushRecentSearch(q: string): Promise<string[]> {
  const clean = String(q || '').trim();
  if (clean.length < 2) return loadRecentSearches();
  const prev = await loadRecentSearches();
  const next = [clean, ...prev.filter(x => x.toLowerCase() !== clean.toLowerCase())].slice(0, MAX);
  await AsyncStorage.setItem(SEARCH_KEY, JSON.stringify(next));
  return next;
}

export async function removeRecentSearch(q: string): Promise<string[]> {
  const prev = await loadRecentSearches();
  const next = prev.filter(x => x.toLowerCase() !== String(q || '').toLowerCase());
  await AsyncStorage.setItem(SEARCH_KEY, JSON.stringify(next));
  return next;
}

export async function loadRecentAirports(): Promise<RecentAirport[]> {
  const list = await readList<RecentAirport>(AIRPORT_KEY);
  return list.filter(a => a?.iata).slice(0, MAX);
}

export async function pushRecentAirport(a: RecentAirport): Promise<RecentAirport[]> {
  if (!a?.iata) return loadRecentAirports();
  const prev = await loadRecentAirports();
  const next = [a, ...prev.filter(x => x.iata !== a.iata)].slice(0, MAX);
  await AsyncStorage.setItem(AIRPORT_KEY, JSON.stringify(next));
  return next;
}
