import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { taxiMinutes } from './destinationServices';

const HOME_KEY = 'waiair.pickup.home.v1';
const PICKUP_KEY = 'waiair.pickup.flights.v1';

export const BAGGAGE_MIN = 20;
export const ARRIVALS_WALK_MIN = 10;

export type PickupHome = {
  lat: number;
  lon: number;
  label: string;
};

export type PickupEntry = {
  flightKey: string;
  flightNumber: string;
  destIata: string;
  destName: string;
  terminal: string;
  etaIso: string;
  driveMin: number;
  homeLabel: string;
  enabled: boolean;
  notifIds: string[];
  notifiedLanding?: boolean;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function loadPickupHome(): Promise<PickupHome | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) return null;
    return {
      lat: parsed.lat,
      lon: parsed.lon,
      label: String(parsed.label || 'Saved location'),
    };
  } catch {
    return null;
  }
}

export async function savePickupHome(home: PickupHome): Promise<void> {
  await AsyncStorage.setItem(HOME_KEY, JSON.stringify(home));
}

function labelFromGeocode(places: Location.LocationGeocodedAddress[]): string {
  const p = places[0];
  if (!p) return 'Saved location';
  return (
    p.district ||
    p.subregion ||
    p.name ||
    p.city ||
    p.street ||
    'Saved location'
  );
}

/** Ask for GPS once and persist a named home location. */
export async function capturePickupHome(): Promise<PickupHome | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    let label = 'Saved location';
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      label = labelFromGeocode(geo);
    } catch { /* keep fallback */ }
    const home = { lat, lon, label };
    await savePickupHome(home);
    return home;
  } catch {
    return null;
  }
}

async function osrmMinutes(from: PickupHome, lat: number, lon: number): Promise<number | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${lon},${lat}` +
      '?overview=false&alternatives=false';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const sec = Number(json?.routes?.[0]?.duration);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return Math.max(8, Math.round(sec / 60));
  } catch {
    return null;
  }
}

export async function estimateDriveMinutes(
  home: PickupHome,
  airportLat?: number,
  airportLon?: number,
  iata?: string,
): Promise<number> {
  if (
    airportLat != null && airportLon != null &&
    Number.isFinite(airportLat) && Number.isFinite(airportLon) &&
    !(airportLat === 0 && airportLon === 0)
  ) {
    const routed = await osrmMinutes(home, airportLat, airportLon);
    if (routed != null) return routed;
    const km = haversineKm(home.lat, home.lon, airportLat, airportLon);
    if (Number.isFinite(km) && km > 0) {
      return Math.max(12, Math.round((km / 35) * 60));
    }
  }
  return taxiMinutes(iata) ?? 45;
}

export function leaveAtMs(etaMs: number, driveMin: number): number {
  return etaMs + (BAGGAGE_MIN + ARRIVALS_WALK_MIN) * 60_000 - driveMin * 60_000;
}

async function loadAllPickups(): Promise<Record<string, PickupEntry>> {
  try {
    const raw = await AsyncStorage.getItem(PICKUP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveAllPickups(map: Record<string, PickupEntry>): Promise<void> {
  await AsyncStorage.setItem(PICKUP_KEY, JSON.stringify(map));
}

export async function loadPickup(flightKey: string): Promise<PickupEntry | null> {
  const map = await loadAllPickups();
  return map[flightKey] || null;
}

export async function isPickupEnabled(flightKey: string): Promise<boolean> {
  const e = await loadPickup(flightKey);
  return !!e?.enabled;
}

async function cancelIds(ids: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  for (const id of ids) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ignore */ }
  }
}

async function scheduleAt(date: Date, title: string, body: string, data: Record<string, string>): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (date.getTime() <= Date.now() + 15_000) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data,
        ...(Platform.OS === 'android' ? { channelId: 'flights' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
  } catch {
    return null;
  }
}

function clockLabel(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export async function schedulePickupNotifications(entry: PickupEntry): Promise<PickupEntry> {
  await cancelIds(entry.notifIds || []);
  const ids: string[] = [];
  const etaMs = new Date(entry.etaIso).getTime();
  if (!Number.isFinite(etaMs)) {
    const next = { ...entry, notifIds: [] };
    const map = await loadAllPickups();
    map[entry.flightKey] = next;
    await saveAllPickups(map);
    return next;
  }
  const leaveMs = leaveAtMs(etaMs, entry.driveMin);
  const num = entry.flightNumber;
  const dest = entry.destIata;

  const t90 = new Date(etaMs - 90 * 60_000);
  const id90 = await scheduleAt(
    t90,
    `${num} on time`,
    `Flight on time, plan to leave at ${clockLabel(leaveMs)}`,
    { kind: 'pickup', flightKey: entry.flightKey },
  );
  if (id90) ids.push(id90);

  const t30 = new Date(leaveMs - 30 * 60_000);
  const id30 = await scheduleAt(
    t30,
    'Leave in 30 min',
    `Leave in 30 min to be there on time · ${dest}`,
    { kind: 'pickup', flightKey: entry.flightKey },
  );
  if (id30) ids.push(id30);

  const idLeave = await scheduleAt(
    new Date(leaveMs),
    `Leave now for ${dest}`,
    `Drive ~${entry.driveMin} min · Baggage ~${BAGGAGE_MIN} min · Arrivals hall`,
    { kind: 'pickup', flightKey: entry.flightKey },
  );
  if (idLeave) ids.push(idLeave);

  const next = { ...entry, notifIds: ids, enabled: true };
  const map = await loadAllPickups();
  map[entry.flightKey] = next;
  await saveAllPickups(map);
  return next;
}

export async function enablePickup(entry: Omit<PickupEntry, 'enabled' | 'notifIds' | 'notifiedLanding'>): Promise<PickupEntry> {
  return schedulePickupNotifications({
    ...entry,
    enabled: true,
    notifIds: [],
    notifiedLanding: false,
  });
}

export async function disablePickup(flightKey: string): Promise<void> {
  const map = await loadAllPickups();
  const existing = map[flightKey];
  if (existing) await cancelIds(existing.notifIds || []);
  delete map[flightKey];
  await saveAllPickups(map);
}

export async function refreshPickupEta(flightKey: string, etaIso: string, terminal?: string): Promise<void> {
  const map = await loadAllPickups();
  const existing = map[flightKey];
  if (!existing?.enabled) return;
  if (existing.etaIso === etaIso && (!terminal || existing.terminal === terminal)) return;
  await schedulePickupNotifications({
    ...existing,
    etaIso,
    terminal: terminal || existing.terminal,
  });
}

export async function notifyPickupLanding(opts: {
  flightKey: string;
  flightNumber: string;
  destIata: string;
  terminal?: string;
}): Promise<void> {
  const map = await loadAllPickups();
  const existing = map[opts.flightKey];
  if (!existing?.enabled || existing.notifiedLanding) return;
  existing.notifiedLanding = true;
  await saveAllPickups(map);
  if (Platform.OS === 'web') return;
  const hall = opts.terminal
    ? (opts.terminal.toUpperCase().startsWith('T') ? opts.terminal : `T${opts.terminal}`)
    : '';
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `✈️ ${opts.flightNumber} just landed at ${opts.destIata}`,
        body: [
          'Leave now → arrive in time to meet them',
          `Baggage takes ~${BAGGAGE_MIN} min`,
          hall ? `Arrivals hall ${hall}` : null,
        ].filter(Boolean).join(' · '),
        sound: true,
        data: { kind: 'pickup-landed', flightKey: opts.flightKey },
        ...(Platform.OS === 'android' ? { channelId: 'flights-urgent' } : {}),
      },
      trigger: null,
    });
  } catch { /* ignore */ }
}

export async function notifyPickupGate(flightKey: string, flightNumber: string, gate: string): Promise<void> {
  const map = await loadAllPickups();
  const existing = map[flightKey];
  if (!existing?.enabled || !gate) return;
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Gate changed to ${gate}`,
        body: `Update your meeting point · ${flightNumber}`,
        sound: true,
        data: { kind: 'pickup-gate', flightKey },
        ...(Platform.OS === 'android' ? { channelId: 'flights-urgent' } : {}),
      },
      trigger: null,
    });
  } catch { /* ignore */ }
}

export async function pickupEnabledForNumber(flightNumber: string): Promise<boolean> {
  const map = await loadAllPickups();
  const slug = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  return Object.values(map).some(e => e.enabled && String(e.flightNumber).replace(/\s+/g, '').toUpperCase() === slug);
}
