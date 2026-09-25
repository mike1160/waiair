/**
 * Restaurants for a neighbourhood: the proxy lookup plus the caches.
 * Three layers, so a neighbourhood is never fetched twice: an in-session map (kept until the app restarts),
 * the AsyncStorage cache (24h), and an in-flight map so two taps in a row share one request.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithTimeout } from './net';
import {
  parseRestaurants,
  parseRestaurantsCache,
  restaurantsCacheKey,
  restaurantsCacheValue,
  restaurantsUrl,
  type Restaurant,
} from './restaurants';
import { PROXY_BASE } from './proxyUrl.ts';

const PROXY = PROXY_BASE;
const REQUEST_TIMEOUT_MS = 10_000;

/** Neighbourhoods already loaded this app session — the same chip never costs a second lookup. */
const session = new Map<string, Restaurant[]>();
const inFlight = new Map<string, Promise<Restaurant[]>>();

/**
 * The restaurants for one neighbourhood. Always resolves — an empty list means "nothing found",
 * which is remembered too, so a quiet neighbourhood is not looked up again on every tap.
 */
export async function fetchRestaurants(
  area: string,
  city: string,
  lang?: string,
  lat?: number | null,
  lng?: number | null,
): Promise<Restaurant[]> {
  const key = restaurantsCacheKey(area, city);
  const url = restaurantsUrl(PROXY, area, city, lang, lat, lng);
  if (!key || !url) return [];

  const seen = session.get(key);
  if (seen) return seen;
  const running = inFlight.get(key);
  if (running) return running;

  const request = (async () => {
    const cached = parseRestaurantsCache(await AsyncStorage.getItem(key).catch(() => null));
    if (cached) {
      session.set(key, cached);
      return cached;
    }
    const list = await fetchWithTimeout(url, {}, REQUEST_TIMEOUT_MS)
      .then(res => (res.ok ? res.json() : null))
      .then(parseRestaurants)
      .catch(() => null);
    // A failed request is not cached: the next tap tries again. An empty answer is.
    if (list == null) return [];
    session.set(key, list);
    await AsyncStorage.setItem(key, restaurantsCacheValue(list)).catch(() => {});
    return list;
  })().finally(() => { inFlight.delete(key); });

  inFlight.set(key, request);
  return request;
}

export type RestaurantsState = {
  list: Restaurant[];
  loading: boolean;
  /** True once a lookup came back with nothing — the section then says so instead of showing an empty list. */
  empty: boolean;
};

/**
 * The restaurants for the picked neighbourhood; nothing is fetched until one is picked.
 * Re-picking a neighbourhood loaded earlier this session is instant and costs no request.
 */
export function useRestaurants(
  area: string | null,
  city: string,
  lang?: string,
  lat?: number | null,
  lng?: number | null,
): RestaurantsState {
  const [state, setState] = useState<RestaurantsState>({ list: [], loading: false, empty: false });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    if (!area) {
      setState({ list: [], loading: false, empty: false });
      return undefined;
    }
    const cached = session.get(restaurantsCacheKey(area, city));
    if (cached) {
      setState({ list: cached, loading: false, empty: cached.length === 0 });
      return undefined;
    }
    let current = true;
    setState({ list: [], loading: true, empty: false });
    void fetchRestaurants(area, city, lang, lat, lng).then(list => {
      if (!current || !alive.current) return;
      setState({ list, loading: false, empty: list.length === 0 });
    });
    return () => { current = false; };
  }, [area, city, lang, lat, lng]);

  return state;
}

/** The picked neighbourhood, with tapping the same chip again closing it. */
export function useNeighbourhoodSelection(): [string | null, (area: string) => void] {
  const [area, setArea] = useState<string | null>(null);
  const toggle = useCallback((next: string) => {
    setArea(prev => (prev === next ? null : next));
  }, []);
  return [area, toggle];
}
