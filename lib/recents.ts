import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_KEY = 'waiair.recentSearches.v1';
const AIRPORT_KEY = 'waiair.recentAirports.v1';
const MAX_SEARCHES = 3;
const MAX = 5;

function recentSearchKey(q: string): string {
  return String(q || '').trim().toUpperCase().replace(/\s+/g, '');
}

function canonicalRecentSearch(q: string): string {
  const trimmed = String(q || '').trim();
  const key = recentSearchKey(trimmed);
  if (/^[A-Z]{1,3}\d{1,4}[A-Z]?$/.test(key)) return key;
  return trimmed;
}

function dedupeSearches(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const item = canonicalRecentSearch(raw);
    if (item.length < 2) continue;
    const key = recentSearchKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, MAX_SEARCHES);
}

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
  const raw = (await readList<string>(SEARCH_KEY)).map(String).filter(Boolean);
  const next = dedupeSearches(raw);
  const collapsed = raw.length !== next.length
    || raw.slice(0, next.length).some((x, i) => canonicalRecentSearch(x) !== next[i]);
  if (collapsed) {
    try { await AsyncStorage.setItem(SEARCH_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export async function pushRecentSearch(q: string): Promise<string[]> {
  const canonical = canonicalRecentSearch(q);
  if (canonical.length < 2) return loadRecentSearches();
  const key = recentSearchKey(canonical);
  const prev = await loadRecentSearches();
  const next = [canonical, ...prev.filter(x => recentSearchKey(x) !== key)].slice(0, MAX_SEARCHES);
  await AsyncStorage.setItem(SEARCH_KEY, JSON.stringify(next));
  return next;
}

export async function removeRecentSearch(q: string): Promise<string[]> {
  const prev = await loadRecentSearches();
  const key = recentSearchKey(q);
  const next = prev.filter(x => recentSearchKey(x) !== key);
  await AsyncStorage.setItem(SEARCH_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([SEARCH_KEY, AIRPORT_KEY]);
  } catch { /* ignore */ }
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
