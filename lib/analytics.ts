/**
 * Product analytics: five events, opt-in only, anonymous install id.
 * Native Firebase is used when the native module is present; otherwise a mock sink.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { timezoneForIata } from './airportTz.ts';
import {
  flightClockUtcMs,
  resolveArrivalIso,
  resolveDepartureIso,
  type FlightClockFields,
} from './flightTimes.ts';
import type { ModuleId } from './modules.ts';

export const ANALYTICS_CONSENT_KEY = 'waiair.analytics.consent.v1';
export const ANALYTICS_DEBUG_KEY = 'waiair.analytics.debug.v1';
export const ANALYTICS_LIFETIME_KEY = 'waiair.analytics.lifetime.v1';

export const SEARCH_INPUT_TYPES = ['place', 'flight_number', 'unknown'] as const;
export type SearchInputType = (typeof SEARCH_INPUT_TYPES)[number];

export const FLIGHT_ADDED_SOURCES = ['search', 'boarding_pass', 'email', 'calendar', 'other'] as const;
export type FlightAddedSource = (typeof FLIGHT_ADDED_SOURCES)[number];

export const JOURNEY_PHASES = ['pre_departure', 'airport', 'in_flight', 'arrived'] as const;
export type JourneyPhase = (typeof JOURNEY_PHASES)[number];

export const PRESET_MODES = ['quick', 'traveller', 'pro', 'custom'] as const;
export type AnalyticsMode = (typeof PRESET_MODES)[number];

export const MODULE_USED_IDS = [
  'journey_phase',
  'weather',
  'transport',
  'lounge',
  'inbound_tracking',
  'connection_risk',
  'immigration',
  'radar',
  'turbulence',
  'fids_board',
  'miles_compensation',
  'morning_briefing',
] as const satisfies readonly ModuleId[];

const SESSION_ONCE_MODULES: ReadonlySet<ModuleId> = new Set(['fids_board', 'morning_briefing']);

const AIRPORT_WINDOW_MIN = 180;
const FLIGHT_NUMBER_RE = /^[A-Z]{1,3}\s?\d{1,4}[A-Z]?$/i;

export const EVENT_NAMES = [
  'search_started',
  'flight_added',
  'app_opened_on_travel_day',
  'module_used',
  'second_flight_added',
] as const;
export type AnalyticsEventName = (typeof EVENT_NAMES)[number];

export type AnalyticsParams = Record<string, string | number>;

export type LoggedEvent = {
  name: AnalyticsEventName;
  params: AnalyticsParams;
};

export type AnalyticsConsent = 'granted' | 'denied';

export type AnalyticsStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type AnalyticsSink = {
  logEvent(name: string, params: AnalyticsParams): Promise<void>;
  setCollectionEnabled(enabled: boolean): Promise<void>;
  setConsent(input: {
    analytics_storage: boolean;
    ad_storage: boolean;
    ad_user_data: boolean;
    ad_personalization: boolean;
  }): Promise<void>;
};

export type TravelDayFlight = FlightClockFields & {
  status?: string;
  origin?: string;
  destination?: string;
  originCountry?: string;
  destCountry?: string;
};

type LifetimeState = {
  count: number;
  firstAddedAt: number;
};

type Context = {
  mode: AnalyticsMode;
  phase: JourneyPhase;
};

const memory = new Map<string, string>();

const memoryStore: AnalyticsStore = {
  async getItem(key) {
    return memory.get(key) ?? null;
  },
  async setItem(key, value) {
    memory.set(key, value);
  },
};

export function createMemorySink(): AnalyticsSink & { events: LoggedEvent[] } {
  const events: LoggedEvent[] = [];
  return {
    events,
    async logEvent(name, params) {
      events.push({ name: name as AnalyticsEventName, params: { ...params } });
    },
    async setCollectionEnabled() { /* mock */ },
    async setConsent() { /* mock */ },
  };
}

let store: AnalyticsStore = memoryStore;
let sink: AnalyticsSink = createMemorySink();
let consent: AnalyticsConsent | null = null;
let debugLogging = false;
let context: Context = { mode: 'traveller', phase: 'pre_departure' };
let sessionOnceFired = new Set<ModuleId>();
let lastSearchRaw: string | null = null;
const mockEvents: LoggedEvent[] = [];

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function logDebug(name: string, params: AnalyticsParams): void {
  if (!debugLogging && !isDev()) return;
  console.log('[analytics]', name, params);
}

export function classifySearchInput(raw: string, placeMatched: boolean): SearchInputType {
  const q = String(raw || '').trim();
  if (FLIGHT_NUMBER_RE.test(q)) return 'flight_number';
  if (placeMatched) return 'place';
  return 'unknown';
}

export function daysBeforeDeparture(depUtcMs: number | null | undefined, now = Date.now()): number {
  if (depUtcMs == null || !Number.isFinite(depUtcMs)) return 0;
  return Math.floor((depUtcMs - now) / 86_400_000);
}

export function mapLiveBoardPhase(
  live: string,
  minutesUntilDep: number | null | undefined,
): JourneyPhase {
  const phase = String(live || '');
  if (phase === 'landed') return 'arrived';
  if (phase === 'departed' || phase === 'enRoute') return 'in_flight';
  if (phase === 'boarding' || phase === 'gateClosed') return 'airport';
  if (
    minutesUntilDep != null
    && Number.isFinite(minutesUntilDep)
    && minutesUntilDep >= 0
    && minutesUntilDep <= AIRPORT_WINDOW_MIN
  ) {
    return 'airport';
  }
  return 'pre_departure';
}

function calendarDayInTz(ms: number, iata?: string, country?: string): string {
  const tz = timezoneForIata(iata, country) || 'UTC';
  return formatInTimeZone(new Date(ms), tz, 'yyyy-MM-dd');
}

export function isOnTravelDay(flight: TravelDayFlight, now = Date.now()): boolean {
  const status = String(flight.status || '').toLowerCase();
  if (status === 'cancelled') return false;
  const depIso = resolveDepartureIso(flight);
  const arrIso = resolveArrivalIso(flight);
  const depMs = flightClockUtcMs(depIso, flight.origin, flight.originCountry);
  const arrMs = flightClockUtcMs(arrIso, flight.destination, flight.destCountry);
  const depToday = depMs != null
    && calendarDayInTz(now, flight.origin, flight.originCountry)
      === calendarDayInTz(depMs, flight.origin, flight.originCountry);
  const arrToday = arrMs != null
    && calendarDayInTz(now, flight.destination, flight.destCountry)
      === calendarDayInTz(arrMs, flight.destination, flight.destCountry);
  return depToday || arrToday;
}

const PHASE_RANK: Record<JourneyPhase, number> = {
  in_flight: 0,
  airport: 1,
  arrived: 2,
  pre_departure: 3,
};

export function pickTravelDayFlight(
  flights: TravelDayFlight[],
  now = Date.now(),
  livePhaseFor: (f: TravelDayFlight) => string = f => String(f.status || ''),
  minutesUntilDepFor: (f: TravelDayFlight) => number | null = () => null,
): { flight: TravelDayFlight; phase: JourneyPhase } | null {
  let best: { flight: TravelDayFlight; phase: JourneyPhase } | null = null;
  for (const flight of flights) {
    if (!isOnTravelDay(flight, now)) continue;
    const phase = mapLiveBoardPhase(livePhaseFor(flight), minutesUntilDepFor(flight));
    if (!best || PHASE_RANK[phase] < PHASE_RANK[best.phase]) {
      best = { flight, phase };
    }
  }
  return best;
}

export function isAllowedSearchInputType(value: unknown): value is SearchInputType {
  return SEARCH_INPUT_TYPES.includes(value as SearchInputType);
}

export function isAllowedFlightAddedSource(value: unknown): value is FlightAddedSource {
  return FLIGHT_ADDED_SOURCES.includes(value as FlightAddedSource);
}

export function isAllowedJourneyPhase(value: unknown): value is JourneyPhase {
  return JOURNEY_PHASES.includes(value as JourneyPhase);
}

export function isAllowedModuleId(value: unknown): value is ModuleId {
  return (MODULE_USED_IDS as readonly string[]).includes(value as ModuleId);
}

export function isAllowedMode(value: unknown): value is AnalyticsMode {
  return PRESET_MODES.includes(value as AnalyticsMode);
}

export function validateEvent(name: AnalyticsEventName, params: AnalyticsParams): boolean {
  switch (name) {
    case 'search_started':
      return isAllowedSearchInputType(params.input_type)
        && Number.isInteger(params.raw_length)
        && (params.raw_length as number) >= 0
        && !('query' in params)
        && !('raw' in params);
    case 'flight_added':
      return isAllowedFlightAddedSource(params.source)
        && Number.isInteger(params.days_before_departure);
    case 'app_opened_on_travel_day':
      return isAllowedJourneyPhase(params.phase);
    case 'module_used':
      return isAllowedModuleId(params.module)
        && isAllowedMode(params.mode)
        && isAllowedJourneyPhase(params.flight_phase);
    case 'second_flight_added':
      return Number.isInteger(params.days_since_first_flight)
        && (params.days_since_first_flight as number) >= 0;
    default:
      return false;
  }
}

function containsForbidden(params: AnalyticsParams): boolean {
  const blob = JSON.stringify(params).toLowerCase();
  return /@/.test(blob) || /pnr/.test(blob);
}

async function readConsent(): Promise<AnalyticsConsent | null> {
  const raw = await store.getItem(ANALYTICS_CONSENT_KEY);
  if (raw === 'granted' || raw === 'denied') return raw;
  return null;
}

async function readLifetime(): Promise<LifetimeState> {
  try {
    const raw = await store.getItem(ANALYTICS_LIFETIME_KEY);
    if (!raw) return { count: 0, firstAddedAt: 0 };
    const parsed = JSON.parse(raw) as Partial<LifetimeState>;
    const count = Number(parsed.count) || 0;
    const firstAddedAt = Number(parsed.firstAddedAt) || 0;
    return { count, firstAddedAt };
  } catch {
    return { count: 0, firstAddedAt: 0 };
  }
}

async function writeLifetime(state: LifetimeState): Promise<void> {
  await store.setItem(ANALYTICS_LIFETIME_KEY, JSON.stringify(state));
}

async function applyConsentToSink(next: AnalyticsConsent | null): Promise<void> {
  const granted = next === 'granted';
  await sink.setCollectionEnabled(granted);
  await sink.setConsent({
    analytics_storage: granted,
    ad_storage: false,
    ad_user_data: false,
    ad_personalization: false,
  });
}

async function emit(name: AnalyticsEventName, params: AnalyticsParams): Promise<boolean> {
  if (consent !== 'granted') return false;
  if (!validateEvent(name, params) || containsForbidden(params)) return false;
  logDebug(name, params);
  mockEvents.push({ name, params: { ...params } });
  try {
    await sink.logEvent(name, params);
  } catch {
    /* offline buffer is native; mock ignores */
  }
  return true;
}

export function setAnalyticsStore(next: AnalyticsStore): void {
  store = next;
}

export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

export function setAnalyticsContext(next: Partial<Context>): void {
  if (next.mode && isAllowedMode(next.mode)) context.mode = next.mode;
  if (next.phase && isAllowedJourneyPhase(next.phase)) context.phase = next.phase;
}

export function getAnalyticsContext(): Context {
  return { ...context };
}

export async function initAnalytics(opts?: {
  store?: AnalyticsStore;
  sink?: AnalyticsSink;
}): Promise<void> {
  if (opts?.store) store = opts.store;
  if (opts?.sink) sink = opts.sink;
  consent = await readConsent();
  const debugRaw = await store.getItem(ANALYTICS_DEBUG_KEY);
  debugLogging = debugRaw === 'true';
  await applyConsentToSink(consent);
}

export async function getAnalyticsConsent(): Promise<AnalyticsConsent | null> {
  if (consent) return consent;
  consent = await readConsent();
  return consent;
}

export async function setAnalyticsConsent(granted: boolean): Promise<void> {
  consent = granted ? 'granted' : 'denied';
  await store.setItem(ANALYTICS_CONSENT_KEY, consent);
  await applyConsentToSink(consent);
}

export async function setAnalyticsDebugLogging(enabled: boolean): Promise<void> {
  debugLogging = enabled;
  await store.setItem(ANALYTICS_DEBUG_KEY, enabled ? 'true' : 'false');
}

export async function getAnalyticsDebugLogging(): Promise<boolean> {
  if (debugLogging) return true;
  const raw = await store.getItem(ANALYTICS_DEBUG_KEY);
  debugLogging = raw === 'true';
  return debugLogging;
}

export function getLoggedEvents(): LoggedEvent[] {
  return mockEvents.map(e => ({ name: e.name, params: { ...e.params } }));
}

export function resetSearchStartedDedupe(): void {
  lastSearchRaw = null;
}

export async function trackSearchStarted(input: {
  raw: string;
  placeMatched?: boolean;
}): Promise<boolean> {
  const raw = String(input.raw || '');
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (lastSearchRaw === trimmed) return false;
  lastSearchRaw = trimmed;
  return emit('search_started', {
    input_type: classifySearchInput(raw, !!input.placeMatched),
    raw_length: trimmed.length,
  });
}

export async function trackFlightAdded(input: {
  source: FlightAddedSource;
  depUtcMs?: number | null;
  now?: number;
}): Promise<boolean> {
  const now = input.now ?? Date.now();
  const source = isAllowedFlightAddedSource(input.source) ? input.source : 'other';
  const added = await emit('flight_added', {
    source,
    days_before_departure: daysBeforeDeparture(input.depUtcMs, now),
  });
  if (!added) return false;

  const life = await readLifetime();
  const nextCount = life.count + 1;
  const firstAddedAt = life.firstAddedAt || now;
  await writeLifetime({ count: nextCount, firstAddedAt });
  if (nextCount === 2) {
    await emit('second_flight_added', {
      days_since_first_flight: Math.max(0, Math.floor((now - firstAddedAt) / 86_400_000)),
    });
  }
  return true;
}

export async function trackAppOpenedOnTravelDay(
  flights: TravelDayFlight[],
  opts?: {
    now?: number;
    livePhaseFor?: (f: TravelDayFlight) => string;
    minutesUntilDepFor?: (f: TravelDayFlight) => number | null;
  },
): Promise<boolean> {
  const now = opts?.now ?? Date.now();
  const picked = pickTravelDayFlight(
    flights,
    now,
    opts?.livePhaseFor,
    opts?.minutesUntilDepFor,
  );
  if (!picked) return false;
  context.phase = picked.phase;
  return emit('app_opened_on_travel_day', { phase: picked.phase });
}

export async function trackModuleUsed(
  module: ModuleId,
  opts?: { mode?: AnalyticsMode; flightPhase?: JourneyPhase },
): Promise<boolean> {
  if (!isAllowedModuleId(module)) return false;
  if (SESSION_ONCE_MODULES.has(module) && sessionOnceFired.has(module)) return false;
  const mode = opts?.mode && isAllowedMode(opts.mode) ? opts.mode : context.mode;
  const flightPhase = opts?.flightPhase && isAllowedJourneyPhase(opts.flightPhase)
    ? opts.flightPhase
    : context.phase;
  const ok = await emit('module_used', { module, mode, flight_phase: flightPhase });
  if (ok && SESSION_ONCE_MODULES.has(module)) sessionOnceFired.add(module);
  return ok;
}

export function resetAnalyticsForTests(nextSink?: AnalyticsSink): void {
  memory.clear();
  mockEvents.length = 0;
  consent = null;
  debugLogging = false;
  context = { mode: 'traveller', phase: 'pre_departure' };
  sessionOnceFired = new Set();
  lastSearchRaw = null;
  store = memoryStore;
  sink = nextSink ?? createMemorySink();
}

/** Lazy native Firebase; falls back to the mock sink when the module is absent. */
export async function tryCreateFirebaseSink(): Promise<AnalyticsSink | null> {
  try {
    const mod = require('@react-native-firebase/analytics') as {
      default?: () => {
        logEvent(name: string, params?: AnalyticsParams): Promise<void>;
        setAnalyticsCollectionEnabled(enabled: boolean): Promise<void>;
        setConsent(c: Record<string, boolean>): Promise<void>;
      };
    };
    const analytics = mod?.default?.();
    if (!analytics) return null;
    return {
      async logEvent(name, params) {
        await analytics.logEvent(name, params);
      },
      async setCollectionEnabled(enabled) {
        await analytics.setAnalyticsCollectionEnabled(enabled);
      },
      async setConsent(input) {
        await analytics.setConsent({
          analytics_storage: input.analytics_storage,
          ad_storage: input.ad_storage,
          ad_user_data: input.ad_user_data,
          ad_personalization: input.ad_personalization,
        });
      },
    };
  } catch {
    return null;
  }
}
