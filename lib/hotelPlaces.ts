/**
 * Hotel autocomplete — client for the proxy's Google Places routes (proxy/hotelPlaces.js).
 * The Places API key never ships in the app. One session token per typing session keeps
 * Google billing at "autocomplete session" pricing (keystrokes + one details lookup).
 */
import * as Crypto from 'expo-crypto';
import { airportRecByIata } from './airportsDb';
import { getLocale } from './i18n';
import { fetchWithTimeout } from './net';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export type HotelSuggestion = { placeId: string; name: string; secondary: string };
export type HotelPlace = { placeId: string; name: string; address: string };

export const HOTEL_AUTOCOMPLETE_MIN_CHARS = 3;

export function newPlacesSession(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Lodging suggestions for `query`, biased toward the destination airport when known. Empty on any error. */
export async function suggestHotels(query: string, opts: { iata?: string; session: string; signal?: AbortSignal }): Promise<HotelSuggestion[]> {
  const q = String(query || '').trim();
  if (q.length < HOTEL_AUTOCOMPLETE_MIN_CHARS) return [];
  const params = new URLSearchParams({ q, lang: getLocale(), session: opts.session });
  const ap = airportRecByIata(opts.iata);
  if (ap && Number.isFinite(ap.lat) && Number.isFinite(ap.lon)) {
    params.set('lat', String(ap.lat));
    params.set('lng', String(ap.lon));
  }
  try {
    const res = await fetchWithTimeout(`${PROXY}/places/hotels/autocomplete?${params.toString()}`, { signal: opts.signal }, 6000);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json.filter(h => h && h.placeId && h.name) as HotelSuggestion[] : [];
  } catch {
    return [];
  }
}

/** Name + full address for a picked suggestion; null on any error. */
export async function hotelDetails(placeId: string, session: string): Promise<HotelPlace | null> {
  const params = new URLSearchParams({ lang: getLocale(), session });
  try {
    const res = await fetchWithTimeout(`${PROXY}/places/hotels/${encodeURIComponent(placeId)}?${params.toString()}`, {}, 6000);
    if (!res.ok) return null;
    const json = await res.json() as HotelPlace | null;
    return json && json.name ? json : null;
  } catch {
    return null;
  }
}
