/** "Destination backgrounds" setting (AsyncStorage) and the arrival-airport photo from the proxy. */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithTimeout } from './net';
import {
  DESTINATION_BACKGROUNDS_KEY,
  destinationPhotoIata,
  parseDestinationBackgroundsEnabled,
  toDestinationPhoto,
  type DestinationPhoto,
} from './destinationPhoto';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const PHOTO_TIMEOUT_MS = 8000;

let enabled = true;
let loaded: Promise<boolean> | null = null;
const listeners = new Set<(on: boolean) => void>();

export function loadDestinationBackgroundsEnabled(): Promise<boolean> {
  if (!loaded) {
    loaded = AsyncStorage.getItem(DESTINATION_BACKGROUNDS_KEY)
      .then(raw => {
        enabled = parseDestinationBackgroundsEnabled(raw);
        return enabled;
      })
      .catch(() => enabled);
  }
  return loaded;
}

export async function setDestinationBackgroundsEnabled(on: boolean): Promise<void> {
  enabled = on;
  loaded = Promise.resolve(on);
  listeners.forEach(fn => fn(on));
  try {
    await AsyncStorage.setItem(DESTINATION_BACKGROUNDS_KEY, on ? 'true' : 'false');
  } catch { /* the in-memory value still applies this session */ }
}

export function useDestinationBackgroundsEnabled(): boolean {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    let alive = true;
    loadDestinationBackgroundsEnabled().then(v => { if (alive) setOn(v); });
    listeners.add(setOn);
    return () => {
      alive = false;
      listeners.delete(setOn);
    };
  }, []);
  return on;
}

/** One request per airport per app session (the proxy caches each airport 24h); a null result is retried next time. */
const photoRequests = new Map<string, Promise<DestinationPhoto | null>>();

export function fetchDestinationPhoto(iata: string): Promise<DestinationPhoto | null> {
  const code = destinationPhotoIata(iata);
  if (!code) return Promise.resolve(null);
  let request = photoRequests.get(code);
  if (!request) {
    request = fetchWithTimeout(`${PROXY}/photos/destination/${code}`, {}, PHOTO_TIMEOUT_MS)
      .then(res => (res.ok ? res.json() : null))
      .then(toDestinationPhoto)
      .catch(() => null);
    photoRequests.set(code, request);
    request.then(photo => { if (!photo) photoRequests.delete(code); });
  }
  return request;
}

/** Background photo for the arrival airport; null when the setting is off, the code is unusable or no photo exists. */
export function useDestinationPhoto(iata?: string | null): DestinationPhoto | null {
  const on = useDestinationBackgroundsEnabled();
  const code = destinationPhotoIata(iata);
  const [photo, setPhoto] = useState<DestinationPhoto | null>(null);
  useEffect(() => {
    setPhoto(null);
    if (!on || !code) return;
    let alive = true;
    fetchDestinationPhoto(code).then(p => { if (alive) setPhoto(p); });
    return () => { alive = false; };
  }, [on, code]);
  return on ? photo : null;
}
