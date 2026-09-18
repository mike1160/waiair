/**
 * Photos for the hotel card and the country card (proxy /photos/place) — pure helpers, no React Native imports.
 * The proxy holds the Unsplash key and tries the phrases in order, so these lists are the search priority.
 */

import { toDestinationPhoto, type DestinationPhoto } from './destinationPhoto.ts';

export const HOTEL_PHOTO_TTL_MS = 24 * 60 * 60 * 1000;
export const COUNTRY_PHOTO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PLACE_PHOTO_KEY_PREFIX = 'waiair.placePhoto.v1';

export type PlacePhotoKind = 'hotel' | 'country';

export type PlacePhotoCacheEntry = {
  at: number;
  photo: DestinationPhoto | null;
};

function clean(raw?: string | null): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

/** Hotel name first, then the city, so "Holiday Inn Bangkok" can fall back to "Bangkok hotel". */
export function hotelPhotoQueries(name?: string | null, city?: string | null): string[] {
  const hotel = clean(name);
  const place = clean(city);
  const out: string[] = [];
  if (hotel.length >= 3) out.push(hotel);
  if (place.length >= 2) out.push(`${place} hotel`, `${place} travel`);
  return out;
}

/** Country landmarks first; skyline and temple are the fallbacks. */
export function countryPhotoQueries(country?: string | null): string[] {
  const name = clean(country);
  if (name.length < 3) return [];
  return [`${name} landmark`, `${name} skyline`, `${name} temple`];
}

/** Cache key per hotel name / per country, so one subject costs one lookup per TTL. */
export function placePhotoKey(kind: PlacePhotoKind, subject?: string | null): string {
  const id = clean(subject).toLowerCase();
  return id ? `${PLACE_PHOTO_KEY_PREFIX}.${kind}.${id}` : '';
}

export function placePhotoTtl(kind: PlacePhotoKind): number {
  return kind === 'country' ? COUNTRY_PHOTO_TTL_MS : HOTEL_PHOTO_TTL_MS;
}

/** Stored entry → photo. Expired, malformed or "no photo" all read as null, so the card stays white. */
export function parsePlacePhotoCache(raw: string | null | undefined, ttlMs: number, now = Date.now()): DestinationPhoto | null {
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as Partial<PlacePhotoCacheEntry> | null;
    const at = Number(entry?.at);
    if (!Number.isFinite(at) || now - at >= ttlMs) return null;
    return toDestinationPhoto(entry?.photo ?? null);
  } catch {
    return null;
  }
}

/** A remembered lookup, including a remembered "nothing found" (so it is not retried every render). */
export function placePhotoCacheValue(photo: DestinationPhoto | null, now = Date.now()): string {
  return JSON.stringify({ at: now, photo } satisfies PlacePhotoCacheEntry);
}

/** Proxy URL for the phrase list (at most 3, the proxy's own limit). */
export function placePhotoUrl(proxyBase: string, queries: string[]): string {
  const base = String(proxyBase || '').replace(/\/$/, '');
  const qs = queries
    .map(q => clean(q))
    .filter(q => q.length >= 3)
    .slice(0, 3)
    .map(q => `q=${encodeURIComponent(q)}`)
    .join('&');
  return qs ? `${base}/photos/place?${qs}` : '';
}
