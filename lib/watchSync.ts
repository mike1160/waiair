import { Platform, TurboModuleRegistry } from 'react-native';
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

let storage: ExtensionStorage | null = null;
let watchTimer: ReturnType<typeof setInterval> | null = null;
let lastPayload = '';
let wcRetryTimers: ReturnType<typeof setTimeout>[] = [];

function getWatchStorage(): ExtensionStorage | null {
  try {
    if (!storage) storage = new ExtensionStorage(WATCH_APP_GROUP);
    return storage;
  } catch (e) {
    console.warn('[WatchSync] ExtensionStorage unavailable', e);
    return null;
  }
}

type WatchConnectivityApi = {
  updateApplicationContext: (payload: Record<string, unknown>) => void;
  getIsPaired?: () => Promise<boolean>;
};

let watchConnectivity: WatchConnectivityApi | null | undefined;

function loadWatchConnectivity(): WatchConnectivityApi | null {
  if (watchConnectivity !== undefined) return watchConnectivity;
  if (Platform.OS !== 'ios') {
    watchConnectivity = null;
    return null;
  }
  // require() calls getEnforcing() and redboxes if the native module is missing.
  if (TurboModuleRegistry.get('WatchConnectivity') == null) {
    watchConnectivity = null;
    return null;
  }
  try {
    watchConnectivity = require('react-native-watch-connectivity') as WatchConnectivityApi;
    return watchConnectivity;
  } catch {
    // Silent fail in simulator — WatchConnectivity
    // not available without physical Apple Watch
    watchConnectivity = null;
    return null;
  }
}

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
  const send = async () => {
    try {
      const wc = loadWatchConnectivity();
      if (!wc?.updateApplicationContext) return;
      try {
        if (typeof wc.getIsPaired === 'function') {
          const paired = await wc.getIsPaired();
          if (!paired) return;
        }
      } catch {
        return;
      }
      // Do not call transferUserInfo: native WCSession throws NSException
      // if the session is not yet activated (no Watch / first launch).
      wc.updateApplicationContext(context);
    } catch (e) {
      console.warn('[WatchSync] WatchConnectivity unavailable', e);
    }
  };
  void send();
  wcRetryTimers.forEach(clearTimeout);
  wcRetryTimers = [
    setTimeout(() => { void send(); }, 2000),
    setTimeout(() => { void send(); }, 6000),
  ];
}

function pushWatchPayload(flightsJson: string, settingsJson: string): void {
  try {
    const store = getWatchStorage();
    store?.set(FLIGHTS_KEY, flightsJson);
    store?.set(SETTINGS_KEY, settingsJson);
  } catch (e) {
    console.warn('[WatchSync] App Group write failed', e);
  }
  try {
    ExtensionStorage.reloadWidget();
  } catch {
    /* widget reload optional */
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
  try {
    const flights = tracked.slice(0, MAX_WATCH_FLIGHTS).map(t => mapFlightToWatchPayload(t));
    const flightsJson = JSON.stringify(flights);
    const settingsJson = JSON.stringify(settingsPayload(airportIata));
    const payload = `${flightsJson}|${settingsJson}`;

    if (!opts?.force && payload === lastPayload) return;
    lastPayload = payload;
    pushWatchPayload(flightsJson, settingsJson);
  } catch (e) {
    console.warn('[WatchSync] sync failed', e);
  }
}

export function startWatchSync(
  getTracked: () => WatchTrackedInput[],
  getAirportIata: () => string,
): void {
  if (Platform.OS !== 'ios') return;
  try {
    stopWatchSync();

    const tick = () => {
      try {
        void syncWatchFromTracked(getTracked(), getAirportIata(), { force: true });
      } catch (e) {
        console.warn('[WatchSync] tick failed', e);
      }
    };

    tick();
    watchTimer = setInterval(tick, 60_000);
  } catch (e) {
    console.warn('[WatchSync] start failed', e);
  }
}

export function stopWatchSync(): void {
  try {
    if (watchTimer) {
      clearInterval(watchTimer);
      watchTimer = null;
    }
    wcRetryTimers.forEach(clearTimeout);
    wcRetryTimers = [];
  } catch {
    /* ignore */
  }
}
