/**
 * Hotel and country card photos: the proxy lookup plus the on-device cache (24h per hotel, 7 days per country).
 * A photo never blocks a card: the hook starts at null and the card renders white until a photo arrives.
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithTimeout } from './net';
import { toDestinationPhoto, type DestinationPhoto } from './destinationPhoto';
import { useDestinationBackgroundsEnabled } from './destinationBackgrounds';
import {
  parsePlacePhotoCache,
  placePhotoCacheValue,
  placePhotoKey,
  placePhotoTtl,
  placePhotoUrl,
  type PlacePhotoKind,
} from './placePhoto';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const PHOTO_TIMEOUT_MS = 8000;

/** One request per subject per app session, shared by every card showing it. */
const inFlight = new Map<string, Promise<DestinationPhoto | null>>();

export async function fetchPlacePhoto(
  kind: PlacePhotoKind,
  subject: string,
  queries: string[],
  offset?: number | null,
): Promise<DestinationPhoto | null> {
  const key = placePhotoKey(kind, subject);
  const url = placePhotoUrl(PROXY, queries, offset);
  if (!key || !url) return null;

  const cached = parsePlacePhotoCache(await AsyncStorage.getItem(key).catch(() => null), placePhotoTtl(kind));
  if (cached) return cached;

  const running = inFlight.get(key);
  if (running) return running;

  const request = fetchWithTimeout(url, {}, PHOTO_TIMEOUT_MS)
    .then(res => (res.ok ? res.json() : null))
    .then(toDestinationPhoto)
    .catch(() => null)
    .then(async photo => {
      // A miss is remembered too, so a hotel without a photo is not looked up on every open.
      await AsyncStorage.setItem(key, placePhotoCacheValue(photo)).catch(() => {});
      return photo;
    })
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, request);
  return request;
}

/**
 * Photo for a hotel name or a country, or null (no subject, no photo, offline, or destination backgrounds off).
 * Null means the card keeps its plain background — that is the fallback, not an error.
 */
export function usePlacePhoto(
  kind: PlacePhotoKind,
  subject?: string | null,
  queries: string[] = [],
  /** Row index in a list, so neighbours that share a fallback phrase do not show the same photo. */
  offset?: number | null,
): DestinationPhoto | null {
  const on = useDestinationBackgroundsEnabled();
  const key = placePhotoKey(kind, subject);
  const search = queries.filter(Boolean).join('|');
  const [photo, setPhoto] = useState<DestinationPhoto | null>(null);
  useEffect(() => {
    setPhoto(null);
    if (!on || !key || !search) return undefined;
    let alive = true;
    void fetchPlacePhoto(kind, String(subject || ''), search.split('|'), offset)
      .then(p => { if (alive) setPhoto(p); });
    return () => { alive = false; };
  }, [on, kind, key, search, subject, offset]);
  return on ? photo : null;
}
