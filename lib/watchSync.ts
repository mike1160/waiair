import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import {
  formatDurationMs,
  liveStatusLabel,
  type FlightLike,
} from '../boardingCountdown';
import { formatAirportClock, resolveArrivalIso, resolveDepartureIso } from './flightTimes';
import { isoInAirportTzToUtcMs } from './localFlightTime';
import { getPrefs } from './prefs';

export const WATCH_APP_GROUP = 'group.com.waiair.WaiAir';
const FLIGHTS_KEY = 'watchTrackedFlights';
const SETTINGS_KEY = 'watchSettings';
const MAX_WATCH_FLIGHTS = 5;

export type WatchFlightPayload = {
  flightNumber: string;
  status: string;
  gate: string;
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  inboundFlightNumber: string;
  landsInLabel: string;
  countdownLabel: string;
  terminal: string;
};

export type WatchSettingsPayload = {
  airport: string;
  darkTheme: boolean;
};

export type WatchTrackedInput = {
  flightNumber: string;
  lastStatus: string;
  lastGate: string;
  flight: FlightLike & {
    number?: string;
    gate?: string;
    boardingGate?: string;
    terminal?: string;
    depTerminal?: string;
    origin?: string;
    destination?: string;
    inboundNumber?: string;
    codeshare?: string;
  };
};

const storage = new ExtensionStorage(WATCH_APP_GROUP);
let watchTimer: ReturnType<typeof setInterval> | null = null;
let lastPayload = '';

function flightNumberSlug(raw: string): string {
  return String(raw || '').replace(/\s+/g, '').toUpperCase();
}

function countdownToIso(
  iso: string,
  iata?: string,
  country?: string,
  now = Date.now(),
): string {
  const ms = isoInAirportTzToUtcMs(iso, iata, country);
  if (ms == null || ms <= now) return '';
  return formatDurationMs(ms - now);
}

export function mapFlightToWatchPayload(
  t: WatchTrackedInput,
  now = Date.now(),
): WatchFlightPayload {
  const f = t.flight;
  const hour12 = getPrefs().timeFormat === '12h';
  const depIso = f.departureTime || f.revisedTime || f.scheduledTime || resolveDepartureIso(f);
  const arrIso = f.arrivalTime || resolveArrivalIso(f) || '';
  const depCountdown = countdownToIso(depIso, f.origin, f.originCountry, now);
  const arrCountdown = countdownToIso(arrIso, f.destination, f.destCountry, now);
  const gate = String(f.gate || f.boardingGate || t.lastGate || '').trim();
  const status = liveStatusLabel(
    { ...f, status: f.status || t.lastStatus },
    now,
  );

  return {
    flightNumber: flightNumberSlug(f.number || t.flightNumber),
    status,
    gate,
    departureTime: formatAirportClock(depIso, f.origin, hour12, f.originCountry),
    arrivalTime: formatAirportClock(arrIso, f.destination, hour12, f.destCountry),
    origin: String(f.origin || '—').toUpperCase(),
    destination: String(f.destination || '—').toUpperCase(),
    inboundFlightNumber: flightNumberSlug(String(f.inboundNumber || f.codeshare || '')),
    landsInLabel: arrCountdown ? `Lands in ${arrCountdown}` : '',
    countdownLabel: depCountdown || arrCountdown,
    terminal: String(f.depTerminal || f.terminal || '').trim(),
  };
}

function settingsPayload(airportIata: string): WatchSettingsPayload {
  return {
    airport: String(airportIata || 'BKK').toUpperCase(),
    darkTheme: true,
  };
}

function pushWatchApplicationContext(context: Record<string, unknown>): void {
  const send = () => {
    try {
      const wc = require('react-native-watch-connectivity') as {
        updateApplicationContext: (payload: Record<string, unknown>) => void;
        transferUserInfo: (payload: Record<string, unknown>) => void;
      };
      // Application context = latest snapshot (delivered when Watch app activates).
      wc.updateApplicationContext(context);
      // User-info queue = reliable fallback when reachability is false (simulator).
      wc.transferUserInfo(context);
    } catch (e) {
      console.warn('[WatchSync] WatchConnectivity unavailable', e);
    }
  };
  send();
  // WCSession may not be activated on first tick after launch — retry briefly.
  setTimeout(send, 1500);
  setTimeout(send, 5000);
}

function pushWatchPayload(flightsJson: string, settingsJson: string): void {
  storage.set(FLIGHTS_KEY, flightsJson);
  storage.set(SETTINGS_KEY, settingsJson);
  try {
    ExtensionStorage.reloadWidget();
  } catch {
    /* widget reload optional until native build */
  }
  pushWatchApplicationContext({
    watchTrackedFlights: flightsJson,
    watchSettings: settingsJson,
  });
}

export async function syncWatchFromTracked(
  tracked: WatchTrackedInput[],
  airportIata: string,
  opts?: { force?: boolean },
): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const flights = tracked.slice(0, MAX_WATCH_FLIGHTS).map(t => mapFlightToWatchPayload(t));
  const flightsJson = JSON.stringify(flights);
  const settingsJson = JSON.stringify(settingsPayload(airportIata));
  const payload = `${flightsJson}|${settingsJson}`;

  if (!opts?.force && payload === lastPayload) return;
  lastPayload = payload;
  pushWatchPayload(flightsJson, settingsJson);
}

export function startWatchSync(
  getTracked: () => WatchTrackedInput[],
  getAirportIata: () => string,
): void {
  if (Platform.OS !== 'ios') return;
  stopWatchSync();

  const tick = () => {
    void syncWatchFromTracked(getTracked(), getAirportIata(), { force: true });
  };

  tick();
  watchTimer = setInterval(tick, 60_000);
}

export function stopWatchSync(): void {
  if (watchTimer) {
    clearInterval(watchTimer);
    watchTimer = null;
  }
}
