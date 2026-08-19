import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from './i18n';
import { buildNotificationData } from './notificationDeepLink';

const HOME_KEY = 'waiair.pickup.home.v1';
const PICKUP_KEY = 'waiair.pickup.flights.v1';

export const BAGGAGE_MIN = 20;
export const ARRIVALS_WALK_MIN = 10;

/** Official airport coords — never city-centre. Pickup = drive TO this airport. */
export const PICKUP_AIRPORT_COORDS: Record<string, { lat: number; lon: number; label: string }> = {
  BKK: { lat: 13.6811, lon: 100.7475, label: 'Suvarnabhumi' },
  DMK: { lat: 13.9126, lon: 100.6067, label: 'Don Mueang' },
  HKT: { lat: 8.1132, lon: 98.3017, label: 'Phuket airport' },
  AMS: { lat: 52.3105, lon: 4.7683, label: 'Schiphol' },
  SIN: { lat: 1.3644, lon: 103.9915, label: 'Changi' },
  KUL: { lat: 2.7456, lon: 101.7099, label: 'KLIA' },
};

const DRIVE_KMH = 80;
const TRAFFIC_FACTOR = 1.2;
const DRIVE_CAP_MIN = 180;
const TOO_FAR_KM = 500;
const DRIVE_MIN_MINUTES = 8;

export const TOO_FAR_DRIVE_MSG = 'Too far to drive · Consider taxi from airport';

export type AirportPin = {
  iata?: string;
  lat?: number;
  lon?: number;
  name?: string;
};

export type DriveEstimate = {
  minutes: number | null;
  tooFar: boolean;
  km: number;
  iata: string;
  label: string;
};

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
  /** Warm surprise-arrival notifications with pickup person's name */
  surpriseWelcome?: boolean;
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

function usableIata(code?: string): string {
  const c = String(code || '').trim().toUpperCase();
  if (!c || c === '—' || c === '-' || c === '???' || c === 'UNK') return '';
  return c;
}

function finiteCoord(lat?: number, lon?: number): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

/** Airport lat/lng: hardcoded table first, then caller coords. Never city centre. */
export function pickupAirportCoords(iata?: string, lat?: number, lon?: number): { lat: number; lon: number } | null {
  const known = PICKUP_AIRPORT_COORDS[usableIata(iata)];
  if (known) return { lat: known.lat, lon: known.lon };
  if (finiteCoord(lat, lon)) return { lat: lat!, lon: lon! };
  return null;
}

export function pickupAirportLabel(iata?: string, fallback?: string): string {
  const known = PICKUP_AIRPORT_COORDS[usableIata(iata)];
  if (known?.label) return known.label;
  const name = String(fallback || '').trim();
  if (name) return name;
  return usableIata(iata) || 'airport';
}

function driveMinutesFromKm(km: number): number {
  const raw = (km / DRIVE_KMH) * 60 * TRAFFIC_FACTOR;
  return Math.min(DRIVE_CAP_MIN, Math.max(DRIVE_MIN_MINUTES, Math.round(raw)));
}

/**
 * Drive time from the user to the arrival airport (where you meet them).
 * If that airport is >500 km away but the local/board airport is nearby
 * (e.g. Phuket user looking at a flight to BKK), use the local airport.
 */
export function estimateDriveToAirport(
  home: PickupHome | null,
  arrival: AirportPin,
  local?: AirportPin | null,
): DriveEstimate {
  const arrivalIata = usableIata(arrival.iata);
  const localIata = usableIata(local?.iata);
  const arrivalC = pickupAirportCoords(arrivalIata, arrival.lat, arrival.lon);
  const localC = local ? pickupAirportCoords(localIata, local.lat, local.lon) : null;

  let iata = arrivalIata || localIata;
  let coords = arrivalC || localC;
  let label = pickupAirportLabel(iata, arrival.name || local?.name);

  if (home && arrivalC && localC && arrivalIata && localIata && arrivalIata !== localIata) {
    const dArrival = haversineKm(home.lat, home.lon, arrivalC.lat, arrivalC.lon);
    const dLocal = haversineKm(home.lat, home.lon, localC.lat, localC.lon);
    const arrivalTooFar = dArrival > TOO_FAR_KM;
    const localNearby = dLocal <= TOO_FAR_KM;
    if ((arrivalTooFar && localNearby) || (localNearby && dLocal < dArrival)) {
      iata = localIata;
      coords = localC;
      label = pickupAirportLabel(localIata, local?.name);
    }
  } else if (!arrivalC && localC) {
    iata = localIata;
    coords = localC;
    label = pickupAirportLabel(localIata, local?.name);
  }

  if (!home || !coords) {
    return { minutes: null, tooFar: false, km: 0, iata, label };
  }

  const km = haversineKm(home.lat, home.lon, coords.lat, coords.lon);
  if (!Number.isFinite(km) || km <= 0) {
    return { minutes: DRIVE_MIN_MINUTES, tooFar: false, km: 0, iata, label };
  }
  if (km > TOO_FAR_KM) {
    return { minutes: null, tooFar: true, km, iata, label };
  }
  return { minutes: driveMinutesFromKm(km), tooFar: false, km, iata, label };
}

export function leaveAtMs(etaMs: number, driveMin: number): number {
  return etaMs + (BAGGAGE_MIN + ARRIVALS_WALK_MIN) * 60_000 - driveMin * 60_000;
}

export function minutesUntilLeave(etaIso: string, driveMin: number): number | null {
  const etaMs = new Date(etaIso).getTime();
  if (!Number.isFinite(etaMs) || !Number.isFinite(driveMin)) return null;
  return Math.round((leaveAtMs(etaMs, driveMin) - Date.now()) / 60_000);
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

function pickupAlertsKey(flightKey: string): string {
  return `pickupAlertsEnabled_${flightKey}`;
}

export async function loadPickupAlertsEnabled(flightKey: string): Promise<boolean> {
  if (!flightKey) return false;
  try {
    const raw = await AsyncStorage.getItem(pickupAlertsKey(flightKey));
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    const e = await loadPickup(flightKey);
    return !!e?.enabled;
  } catch {
    return false;
  }
}

export async function savePickupAlertsEnabled(flightKey: string, enabled: boolean): Promise<void> {
  if (!flightKey) return;
  await AsyncStorage.setItem(pickupAlertsKey(flightKey), enabled ? 'true' : 'false');
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
  if (entry.surpriseWelcome) {
    const person = await loadPickupPerson(entry.flightKey);
    return scheduleSurpriseWelcomeNotifications(entry, person);
  }
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

  const copy = t();
  const t90 = new Date(etaMs - 90 * 60_000);
  const id90 = await scheduleAt(
    t90,
    copy.flightOnTime(num),
    copy.flightOnTimeLeaveAt(clockLabel(leaveMs)),
    buildNotificationData({ flightNumber: num, kind: 'pickup', flightKey: entry.flightKey }),
  );
  if (id90) ids.push(id90);

  const t30 = new Date(leaveMs - 30 * 60_000);
  const id30 = await scheduleAt(
    t30,
    copy.leaveIn30Min,
    copy.leaveIn30MinBody(dest),
    buildNotificationData({ flightNumber: num, kind: 'pickup', flightKey: entry.flightKey }),
  );
  if (id30) ids.push(id30);

  const idLeave = await scheduleAt(
    new Date(leaveMs),
    copy.leaveNowFor(dest),
    copy.leaveNowBody(entry.driveMin, BAGGAGE_MIN),
    buildNotificationData({ flightNumber: num, kind: 'pickup', flightKey: entry.flightKey }),
  );
  if (idLeave) ids.push(idLeave);

  const next = { ...entry, notifIds: ids, enabled: true };
  const map = await loadAllPickups();
  map[entry.flightKey] = next;
  await saveAllPickups(map);
  return next;
}

export async function scheduleSurpriseWelcomeNotifications(
  entry: PickupEntry,
  person: PickupPerson | null,
): Promise<PickupEntry> {
  await cancelIds(entry.notifIds || []);
  const ids: string[] = [];
  const etaMs = new Date(entry.etaIso).getTime();
  const name = String(person?.name || '').trim() || 'them';
  if (!Number.isFinite(etaMs)) {
    const next = { ...entry, notifIds: [], surpriseWelcome: true };
    const map = await loadAllPickups();
    map[entry.flightKey] = next;
    await saveAllPickups(map);
    return next;
  }
  const leaveMs = leaveAtMs(etaMs, entry.driveMin);
  const copy = t();

  const id2h = await scheduleAt(
    new Date(leaveMs - 2 * 60 * 60_000),
    copy.surpriseT2hTitle(name),
    copy.surpriseT2hBody(name, clockLabel(leaveMs)),
    buildNotificationData({
      flightNumber: entry.flightNumber,
      kind: 'surprise-welcome',
      flightKey: entry.flightKey,
      type: 'pickup',
    }),
  );
  if (id2h) ids.push(id2h);

  const id45 = await scheduleAt(
    new Date(leaveMs - 45 * 60_000),
    copy.surpriseT45Title,
    copy.surpriseT45Body(name),
    buildNotificationData({
      flightNumber: entry.flightNumber,
      kind: 'surprise-welcome',
      flightKey: entry.flightKey,
      type: 'pickup',
    }),
  );
  if (id45) ids.push(id45);

  const idLeave = await scheduleAt(
    new Date(leaveMs),
    copy.surpriseLeaveTitle,
    copy.surpriseLeaveBody(name),
    buildNotificationData({
      flightNumber: entry.flightNumber,
      kind: 'surprise-welcome',
      flightKey: entry.flightKey,
      type: 'pickup',
    }),
  );
  if (idLeave) ids.push(idLeave);

  const next = { ...entry, notifIds: ids, enabled: true, surpriseWelcome: true };
  const map = await loadAllPickups();
  map[entry.flightKey] = next;
  await saveAllPickups(map);
  return next;
}

export async function loadSurpriseWelcomeEnabled(flightKey: string): Promise<boolean> {
  const e = await loadPickup(flightKey);
  return !!e?.surpriseWelcome;
}

export async function setSurpriseWelcomeEnabled(
  flightKey: string,
  enabled: boolean,
  person: PickupPerson | null,
): Promise<PickupEntry | null> {
  const map = await loadAllPickups();
  const existing = map[flightKey];
  if (!existing?.enabled) return null;
  if (enabled && !String(person?.name || '').trim()) return null;
  const next = { ...existing, surpriseWelcome: enabled };
  if (enabled) {
    return scheduleSurpriseWelcomeNotifications(next, person);
  }
  next.surpriseWelcome = false;
  map[flightKey] = next;
  await saveAllPickups(map);
  return schedulePickupNotifications(next);
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
  const copy = t();
  const person = await loadPickupPerson(opts.flightKey);
  const name = String(person?.name || '').trim();
  const hall = opts.terminal
    ? (opts.terminal.toUpperCase().startsWith('T') ? opts.terminal : `T${opts.terminal}`)
    : '';
  try {
    if (existing.surpriseWelcome && name) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: copy.surpriseLandedTitle(name),
          body: copy.surpriseLandedBody(name, BAGGAGE_MIN),
          sound: true,
          data: buildNotificationData({
            flightNumber: opts.flightNumber,
            kind: 'surprise-landed',
            flightKey: opts.flightKey,
            type: 'pickup',
          }),
          ...(Platform.OS === 'android' ? { channelId: 'flights-urgent' } : {}),
        },
        trigger: null,
      });
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.justLandedAt(opts.flightNumber, opts.destIata),
        body: [
          copy.leaveNowMeetThem,
          copy.baggageTakes(BAGGAGE_MIN),
          hall ? copy.arrivalsHall(hall) : null,
        ].filter(Boolean).join(' · '),
        sound: true,
        data: buildNotificationData({
          flightNumber: opts.flightNumber,
          kind: 'pickup-landed',
          flightKey: opts.flightKey,
          type: 'pickup',
        }),
        ...(Platform.OS === 'android' ? { channelId: 'flights-urgent' } : {}),
      },
      trigger: null,
    });
  } catch { /* ignore */ }
}

export async function notifyPickupGate(
  flightKey: string,
  flightNumber: string,
  gate: string,
  opts?: { arrivalsBoard?: boolean },
): Promise<void> {
  const map = await loadAllPickups();
  const existing = map[flightKey];
  if (!existing?.enabled) return;
  if (!opts?.arrivalsBoard && !gate) return;
  if (Platform.OS === 'web') return;
  const copy = t();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts?.arrivalsBoard
          ? copy.updateMeetingPoint(flightNumber)
          : copy.gateChangedTo(gate),
        body: opts?.arrivalsBoard
          ? copy.checkArrivalsBoard
          : copy.updateMeetingPoint(flightNumber),
        sound: true,
        data: buildNotificationData({
          flightNumber,
          kind: 'pickup-gate',
          flightKey,
          type: 'pickup',
        }),
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

const PERSON_KEY = 'waiair.pickup.person.v1';

export type PickupPerson = {
  name: string;
  photoUri?: string;
};

const NAME_COLORS = [
  '#E57373', '#F06292', '#BA68C8', '#9575CD',
  '#7986CB', '#64B5F6', '#4FC3F7', '#4DB6AC',
  '#81C784', '#AED581', '#FFD54F', '#FFB74D',
  '#FF8A65', '#A1887F',
];

export function colorForPickupName(name: string): string {
  const s = String(name || '').trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return NAME_COLORS[Math.abs(h) % NAME_COLORS.length];
}

export function initialsForPickupName(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
}

export function pickupLeaveClock(etaIso: string, driveMin: number): string {
  const etaMs = new Date(etaIso).getTime();
  if (!Number.isFinite(etaMs) || !Number.isFinite(driveMin)) return '';
  return clockLabel(leaveAtMs(etaMs, driveMin));
}

async function loadAllPersons(): Promise<Record<string, PickupPerson>> {
  try {
    const raw = await AsyncStorage.getItem(PERSON_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveAllPersons(map: Record<string, PickupPerson>): Promise<void> {
  await AsyncStorage.setItem(PERSON_KEY, JSON.stringify(map));
}

export async function loadPickupPerson(flightKey: string): Promise<PickupPerson | null> {
  if (!flightKey) return null;
  const map = await loadAllPersons();
  const p = map[flightKey];
  if (!p || !String(p.name || '').trim()) return null;
  return {
    name: String(p.name).trim(),
    photoUri: p.photoUri ? String(p.photoUri) : undefined,
  };
}

export async function savePickupPerson(flightKey: string, person: PickupPerson): Promise<void> {
  if (!flightKey) return;
  const map = await loadAllPersons();
  const name = String(person.name || '').trim();
  if (!name) {
    delete map[flightKey];
  } else {
    map[flightKey] = {
      name,
      photoUri: person.photoUri || undefined,
    };
  }
  await saveAllPersons(map);
}
