/** Home state 2: journey phase → Now line + modules. Pure, testable. */

import { formatInTimeZone } from 'date-fns-tz';
import { timezoneForIata } from './airportTz.ts';
import { shouldShowAnalyticsConsent, type AnalyticsConsent } from './analytics.ts';
import {
  EMPTY_CLOCK,
  flightClockUtcMs,
  formatAirportClock,
  resolveArrivalIso,
  resolveDepartureIso,
  shouldStrikeScheduledClock,
  type FlightClockFields,
} from './flightTimes.ts';
import { airlineCodeFromIdent, identsMatch } from './flightIdent.ts';
import type { ModuleId } from './modules.ts';

export type HomeKind = 'pending' | 'empty' | 'tracked';

export type HomeNowPhase =
  | 'checkin'
  | 'leave'
  | 'at_airport'
  | 'gate'
  | 'boarding'
  | 'in_flight'
  | 'baggage'
  | 'transport'
  | 'done';

export type HomeNowFlight = FlightClockFields & {
  number?: string;
  airlineCode?: string;
  gate?: string;
  baggage?: string;
  landedAtMs?: number | null;
  /** Highest Now-phase already reached this travel day (FIDS must not regress it). */
  homeNowPhase?: HomeNowPhase | null;
  homeNowPhaseDay?: string | null;
};

export type HomeNowResolved = {
  phase: HomeNowPhase;
  checkinTime: string;
  leaveTime: string;
  gate: string;
  walkMin: number;
  belt: string;
  landsIn: string;
  lastCall?: boolean;
  goToGate?: boolean;
  phaseDay?: string;
};

export type HomeNowCopy = {
  homeNowCheckin: (time: string) => string;
  homeNowLeave: (time: string) => string;
  homeNowAtAirport: string;
  homeNowGate: (gate: string, mins: number) => string;
  homeNowGoToGate: (gate: string, mins: number) => string;
  homeNowBoarding: (gate: string) => string;
  homeNowLastCall: (gate: string) => string;
  homeNowLandsIn: (duration: string) => string;
  homeNowBelt: (belt: string) => string;
  homeNowTransport: string;
  homeGoodTrip: string;
  gateTbdShort: string;
};

/** Same leave window as MorningOfBriefingCard (departure − 45 min). */
export const LEAVE_BEFORE_MS = 45 * 60 * 1000;
/** Online check-in for known LCCs. */
export const CHECKIN_48H_HOURS = 48;
/** Online check-in when the airline is known. */
export const CHECKIN_24H_HOURS = 24;
/** Airport check-in when the airline is unknown. */
export const CHECKIN_AIRPORT_HOURS = 3;
const HOTEL_AFTER_MS = 5 * 60 * 1000;
const DONE_AFTER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WALK_MIN = 15;

export const HOME_NOW_PHASE_RANK: Record<HomeNowPhase, number> = {
  checkin: 1,
  leave: 2,
  at_airport: 3,
  gate: 4,
  boarding: 5,
  in_flight: 6,
  baggage: 7,
  transport: 8,
  done: 9,
};

const PHASES = Object.keys(HOME_NOW_PHASE_RANK) as HomeNowPhase[];

export function isHomeNowPhase(value: unknown): value is HomeNowPhase {
  return typeof value === 'string' && PHASES.includes(value as HomeNowPhase);
}

function liveIsOverride(live: string): boolean {
  return live === 'cancelled' || live === 'diverted';
}

/** Never move backwards within a travel day, unless cancelled or diverted. */
export function ratchetHomeNowPhase(opts: {
  prev: HomeNowPhase | null | undefined;
  prevDay?: string | null;
  next: HomeNowPhase;
  travelDay: string;
  live: string;
}): { phase: HomeNowPhase; flapped: boolean } {
  const { next, travelDay, live } = opts;
  if (liveIsOverride(live)) return { phase: next, flapped: false };
  const prev = isHomeNowPhase(opts.prev) ? opts.prev : null;
  const sameDay = !!prev && !!travelDay && String(opts.prevDay || '') === travelDay;
  if (!sameDay || !prev) return { phase: next, flapped: false };
  if (HOME_NOW_PHASE_RANK[next] >= HOME_NOW_PHASE_RANK[prev]) {
    return { phase: next, flapped: false };
  }
  return { phase: prev, flapped: true };
}

function logHomeNowFlap(
  f: HomeNowFlight,
  held: HomeNowPhase,
  computed: HomeNowPhase,
  live: string,
): void {
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  if (!dev) return;
  console.log('[homeNow] phase flap', {
    number: f.number,
    held,
    computed,
    live,
  });
}

const CHECKIN_48H = new Set([
  'FR', 'RK', 'U2', 'DS', 'W6', 'W4', 'W9', '5J', 'AK', 'D7', 'FD', 'QZ', 'Z2',
  'XT', 'TR', '3K', 'VJ', 'VZ', '6E', 'SG', 'G8', 'WN', 'NK', 'F9', 'G4', 'B6',
  'DY', 'TO', 'HV', 'PC', 'FZ', 'JQ', 'TT', 'MM', 'IT',
]);

export const HOME_HIDDEN_MODULES: readonly ModuleId[] = [
  'radar',
  'fids_board',
  'miles_compensation',
];

const PHASE_MODULES: Record<HomeNowPhase, readonly ModuleId[]> = {
  checkin: ['weather', 'morning_briefing', 'immigration', 'transport'],
  leave: ['weather', 'morning_briefing', 'immigration', 'transport'],
  at_airport: ['lounge', 'transport', 'connection_risk', 'inbound_tracking'],
  gate: ['lounge', 'transport', 'connection_risk', 'inbound_tracking'],
  boarding: ['lounge', 'transport', 'connection_risk', 'inbound_tracking'],
  in_flight: ['weather', 'turbulence', 'immigration'],
  baggage: ['transport', 'weather', 'immigration'],
  transport: ['transport', 'weather', 'immigration'],
  done: ['weather', 'transport'],
};

const HIDDEN = new Set<ModuleId>(['radar', 'fids_board', 'miles_compensation', 'journey_phase']);

function beltCode(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s || /^(—|-|–|n\/?a|tba|tbd|unknown|null|undefined)$/i.test(s)) return '';
  return s.replace(/^belt\s*/i, '').trim();
}

function hasGate(gate?: string): boolean {
  const g = String(gate || '').trim();
  return !!g && !/^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(g);
}

function gateCode(gate?: string): string {
  const raw = String(gate || '').trim();
  if (!hasGate(raw)) return '';
  const stripped = raw.replace(/^gates?\s*:?\s*/i, '').trim();
  return hasGate(stripped) ? stripped : '';
}

export function isHomeNowDepartedOrLater(phase: HomeNowPhase): boolean {
  return HOME_NOW_PHASE_RANK[phase] >= HOME_NOW_PHASE_RANK.in_flight;
}

export function isHomeNowLandedOrLater(phase: HomeNowPhase): boolean {
  return HOME_NOW_PHASE_RANK[phase] >= HOME_NOW_PHASE_RANK.baggage;
}

/** Detail overlay / home badge: Now phase wins over a stale FIDS "scheduled". */
export function homeNowOverlayStatus(
  phase: HomeNowPhase,
  liveStatus?: string,
): 'cancelled' | 'boarding' | 'en-route' | 'landed' | 'delayed' | 'scheduled' {
  const live = String(liveStatus || '').toLowerCase();
  if (live === 'cancelled' || live === 'canceled') return 'cancelled';
  if (isHomeNowLandedOrLater(phase)) return 'landed';
  if (phase === 'in_flight') return 'en-route';
  if (phase === 'boarding') return 'boarding';
  if (live === 'delayed') return 'delayed';
  return 'scheduled';
}

export type HomeNowCardChip = { kind: 'gate' | 'belt'; value: string } | null;

/** Gate until departure; belt from landing on when known. */
export function homeNowCardChip(
  phase: HomeNowPhase,
  gate?: string,
  baggage?: string,
): HomeNowCardChip {
  if (isHomeNowLandedOrLater(phase)) {
    const belt = beltCode(baggage);
    return belt ? { kind: 'belt', value: belt } : null;
  }
  if (isHomeNowDepartedOrLater(phase)) return null;
  const g = gateCode(gate);
  return g ? { kind: 'gate', value: g } : null;
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function liveStatus(f: HomeNowFlight, now: number): string {
  const st = String(f.status || '').toLowerCase().trim();
  const compact = st.replace(/[_\s-]/g, '');
  if (st === 'cancelled' || st === 'canceled' || compact === 'cancelled' || compact === 'canceled') {
    return 'cancelled';
  }
  if (compact === 'diverted' || compact === 'diversion' || compact === 'rerouted') {
    return 'diverted';
  }
  if (st === 'landed' || compact === 'arrived') return 'landed';
  if (st === 'en-route' || st === 'enroute' || compact === 'enroute') return 'enRoute';
  if (st === 'departed' || compact === 'departed') return 'departed';
  if (compact === 'lastcall') return 'last_call';
  if (st === 'boarding' || compact === 'boarding') return 'boarding';
  const dep = depMsOf(f);
  if (dep != null && now > dep) return 'departed';
  return st || 'scheduled';
}

/** Origin calendar day of this departure — ratchet key for one travel day. */
export function homeNowTravelDayYmd(f: HomeNowFlight, now: number): string {
  const dep = depMsOf(f);
  const tz = timezoneForIata(f.origin, f.originCountry) || 'UTC';
  const ms = dep != null && Number.isFinite(dep) ? dep : now;
  return formatInTimeZone(new Date(ms), tz, 'yyyy-MM-dd');
}

function computeHomeNowPhase(
  f: HomeNowFlight,
  now: number,
  live: string,
  gate: string,
  belt: string,
): HomeNowPhase {
  const depMs = depMsOf(f);
  const checkinOpenMs = depMs != null
    ? depMs - checkinHoursBeforeDeparture(f) * 60 * 60 * 1000
    : null;
  const leaveMs = depMs != null ? depMs - LEAVE_BEFORE_MS : null;

  if (live === 'cancelled') return 'done';
  if (live === 'diverted') return 'in_flight';

  if (live === 'landed') {
    const elapsed = landedElapsedMs(f, now);
    if (elapsed != null && elapsed >= DONE_AFTER_MS) return 'done';
    if (elapsed != null && elapsed >= HOTEL_AFTER_MS) return 'transport';
    if (belt) return 'baggage';
    return 'transport';
  }

  if (live === 'enRoute' || live === 'departed') return 'in_flight';
  if (live === 'boarding' || live === 'last_call') return 'boarding';
  if (gate) return 'gate';
  if (leaveMs != null && now >= leaveMs) return 'at_airport';
  if (checkinOpenMs != null && now >= checkinOpenMs) return 'leave';
  return 'checkin';
}

function airlineCodeOf(f: HomeNowFlight): string {
  const field = String(f.airlineCode || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (field.length >= 2) return field.slice(0, 2);
  const n = String(f.number || '').replace(/[\s-]/g, '').toUpperCase();
  const m = n.match(/^([A-Z]{2}|[A-Z]\d|\d[A-Z])\d/);
  return m ? m[1] : '';
}

/** Airline online T−48h / T−24h if known, else airport check-in T−3h. */
export function checkinHoursBeforeDeparture(f: HomeNowFlight): number {
  const code = airlineCodeOf(f);
  if (!code) return CHECKIN_AIRPORT_HOURS;
  if (CHECKIN_48H.has(code)) return CHECKIN_48H_HOURS;
  return CHECKIN_24H_HOURS;
}

function depMsOf(f: HomeNowFlight): number | null {
  const iso = resolveDepartureIso(f);
  return flightClockUtcMs(iso, f.origin, f.originCountry);
}

function arrMsOf(f: HomeNowFlight): number | null {
  const iso = resolveArrivalIso(f);
  return flightClockUtcMs(iso, f.destination, f.destCountry);
}

function clockAt(ms: number, iata?: string, country?: string, hour12 = false): string {
  return formatAirportClock(new Date(ms).toISOString(), iata, hour12, country);
}

function landedElapsedMs(f: HomeNowFlight, now: number): number | null {
  if (f.landedAtMs != null && Number.isFinite(f.landedAtMs)) return now - f.landedAtMs;
  const arr = arrMsOf(f);
  if (arr == null) return null;
  return now - arr;
}

export function isInternationalFlight(f: Pick<HomeNowFlight, 'originCountry' | 'destCountry'>): boolean {
  const o = String(f.originCountry || '').toUpperCase();
  const d = String(f.destCountry || '').toUpperCase();
  return !!o && !!d && o !== d;
}

export function resolveHomeKind(trackedReady: boolean, trackedCount: number): HomeKind {
  if (!trackedReady) return 'pending';
  return trackedCount > 0 ? 'tracked' : 'empty';
}

export function shouldShowTripConfirm(opts: {
  previousCount: number | null;
  nextCount: number;
}): boolean {
  if (opts.previousCount == null) return false;
  return opts.previousCount === 0 && opts.nextCount > 0;
}

export function shouldShowHomeConsent(
  consent: AnalyticsConsent | null,
  trackedCount: number,
  confirmVisible: boolean,
): boolean {
  return shouldShowAnalyticsConsent(consent, trackedCount) && !confirmVisible;
}

export function homeRelativeDayOffset(
  depMs: number | null,
  now: number,
  originIata?: string,
  originCountry?: string,
): number {
  if (depMs == null || !Number.isFinite(depMs)) return 0;
  const tz = timezoneForIata(originIata, originCountry) || 'UTC';
  const depYmd = formatInTimeZone(new Date(depMs), tz, 'yyyy-MM-dd');
  const nowYmd = formatInTimeZone(new Date(now), tz, 'yyyy-MM-dd');
  const [dy, dm, dd] = depYmd.split('-').map(Number);
  const [ny, nm, nd] = nowYmd.split('-').map(Number);
  return Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ny, nm - 1, nd)) / 86_400_000);
}

export function homeRelativeDayLabel(
  offset: number,
  copy: { today: string; tomorrow: string; homeRelativeInDays: (n: number) => string },
): string {
  if (offset <= 0) return copy.today;
  if (offset === 1) return copy.tomorrow;
  return copy.homeRelativeInDays(offset);
}

export function resolveHomeNow(f: HomeNowFlight, now: number, hour12 = false): HomeNowResolved {
  const depMs = depMsOf(f);
  const arrMs = arrMsOf(f);
  const live = liveStatus(f, now);
  const gate = gateCode(f.gate);
  const belt = beltCode(f.baggage);
  const checkinOpenMs = depMs != null
    ? depMs - checkinHoursBeforeDeparture(f) * 60 * 60 * 1000
    : null;
  const leaveMs = depMs != null ? depMs - LEAVE_BEFORE_MS : null;
  const checkinTime = checkinOpenMs != null
    ? clockAt(checkinOpenMs, f.origin, f.originCountry, hour12)
    : '';
  const leaveTime = leaveMs != null
    ? clockAt(leaveMs, f.origin, f.originCountry, hour12)
    : '';
  const landsIn = arrMs != null && arrMs > now ? formatDurationMs(arrMs - now) : '';
  const walkMin = DEFAULT_WALK_MIN;
  const travelDay = homeNowTravelDayYmd(f, now);
  const computed = computeHomeNowPhase(f, now, live, gate, belt);
  const ratcheted = ratchetHomeNowPhase({
    prev: f.homeNowPhase,
    prevDay: f.homeNowPhaseDay,
    next: computed,
    travelDay,
    live,
  });
  if (ratcheted.flapped) logHomeNowFlap(f, ratcheted.phase, computed, live);

  const minsToBoard = depMs != null ? (depMs - now) / 60000 : null;
  const goToGate = ratcheted.phase === 'gate'
    && minsToBoard != null
    && minsToBoard >= 0
    && walkMin > minsToBoard;
  const lastCall = ratcheted.phase === 'boarding' && live === 'last_call';

  return {
    phase: ratcheted.phase,
    checkinTime: checkinTime && checkinTime !== EMPTY_CLOCK ? checkinTime : '',
    leaveTime: leaveTime && leaveTime !== EMPTY_CLOCK ? leaveTime : '',
    gate,
    walkMin,
    belt,
    landsIn,
    lastCall,
    goToGate,
    phaseDay: travelDay,
  };
}

export function formatHomeNowLine(resolved: HomeNowResolved, copy: HomeNowCopy): string {
  const gate = resolved.gate || copy.gateTbdShort;
  switch (resolved.phase) {
    case 'checkin':
      return resolved.checkinTime ? copy.homeNowCheckin(resolved.checkinTime) : copy.homeGoodTrip;
    case 'leave':
      return resolved.leaveTime ? copy.homeNowLeave(resolved.leaveTime) : copy.homeGoodTrip;
    case 'at_airport':
      return copy.homeNowAtAirport;
    case 'gate':
      if (resolved.goToGate) return copy.homeNowGoToGate(gate, resolved.walkMin);
      return copy.homeNowGate(gate, resolved.walkMin);
    case 'boarding':
      if (resolved.lastCall) return copy.homeNowLastCall(gate);
      return copy.homeNowBoarding(gate);
    case 'in_flight':
      return resolved.landsIn ? copy.homeNowLandsIn(resolved.landsIn) : copy.homeGoodTrip;
    case 'baggage':
      return resolved.belt ? copy.homeNowBelt(resolved.belt) : copy.homeNowTransport;
    case 'transport':
      return copy.homeNowTransport;
    case 'done':
      return copy.homeGoodTrip;
    default:
      return copy.homeGoodTrip;
  }
}

export function homeModulesForPhase(
  phase: HomeNowPhase,
  opts?: { international?: boolean },
): ModuleId[] {
  const international = opts?.international !== false;
  let ids = PHASE_MODULES[phase].filter(id => !HIDDEN.has(id));
  if (!international) ids = ids.filter(id => id !== 'immigration');
  return ids.slice(0, 4);
}

/** Home module row → DetailCard section id. */
export function homeModuleCardSection(id: ModuleId): string | null {
  switch (id) {
    case 'weather': return 'atDestination';
    case 'transport': return 'atDestination';
    case 'lounge': return 'beforeDeparture';
    case 'inbound_tracking': return 'extras';
    case 'connection_risk': return 'urgent';
    case 'immigration': return 'atDestination';
    case 'turbulence': return 'beforeDeparture';
    case 'morning_briefing': return 'beforeDeparture';
    case 'radar': return 'extras';
    default: return null;
  }
}

export function sortTrackedFlightsForHome<T extends HomeNowFlight>(flights: T[], now: number): T[] {
  return [...flights].sort((a, b) => {
    const aDone = resolveHomeNow(a, now).phase === 'done';
    const bDone = resolveHomeNow(b, now).phase === 'done';
    if (aDone !== bDone) return aDone ? 1 : -1;
    const aDep = depMsOf(a) ?? Number.POSITIVE_INFINITY;
    const bDep = depMsOf(b) ?? Number.POSITIVE_INFINITY;
    return aDep - bDep;
  });
}

function nonEmptyIso(iso?: string | null): string {
  return String(iso || '').trim();
}

export type SearchDepKind = 'actual' | 'estimated' | 'scheduled';

/** Route-search split clock: actual, else estimated, else scheduled.
 *  Ignores FIDS `actualTime` stamps that mark tonight's flights as already gone. */
export function searchDepartureClock(f: HomeNowFlight): { iso: string; kind: SearchDepKind } | null {
  const actual = nonEmptyIso(f.actualDeparture);
  if (actual) return { iso: actual, kind: 'actual' };
  const estimated = nonEmptyIso(f.estimatedDeparture);
  if (estimated) return { iso: estimated, kind: 'estimated' };
  const scheduled = scheduledDepIso(f);
  if (scheduled) return { iso: scheduled, kind: 'scheduled' };
  return null;
}

export function scheduledDepIso(f: HomeNowFlight): string {
  return nonEmptyIso(f.scheduledDeparture) || nonEmptyIso(f.scheduledTime);
}

export function scheduledArrIso(f: HomeNowFlight): string {
  return nonEmptyIso(f.scheduledArrival)
    || (f.boardSide === 'arrival' ? nonEmptyIso(f.scheduledTime) : '');
}

/** Card live clock: actual, else estimated, else scheduled. Not resolveDepartureIso. */
export function homeCardLiveDepIso(f: HomeNowFlight): string {
  return nonEmptyIso(f.actualDeparture) || nonEmptyIso(f.estimatedDeparture) || scheduledDepIso(f);
}

export function homeCardLiveArrIso(f: HomeNowFlight): string {
  return nonEmptyIso(f.actualArrival) || nonEmptyIso(f.estimatedArrival) || scheduledArrIso(f);
}

export type HomeCardClockPart = {
  scheduled: string;
  live: string;
  strike: boolean;
};

export type HomeCardTimes = {
  dep: HomeCardClockPart | null;
  arr: HomeCardClockPart | null;
};

function formatCardClock(
  iso: string,
  iata: string,
  hour12: boolean,
  country?: string,
): string {
  if (!iso) return '';
  const c = formatAirportClock(iso, iata, hour12, country);
  return !c || c === EMPTY_CLOCK ? '' : c;
}

function homeCardClockPart(
  scheduledIso: string,
  liveIso: string,
  iata: string,
  country: string | undefined,
  hour12: boolean,
): HomeCardClockPart | null {
  const live = formatCardClock(liveIso, iata, hour12, country);
  if (!live) return null;
  const scheduled = formatCardClock(scheduledIso, iata, hour12, country);
  return {
    scheduled,
    live,
    strike: shouldStrikeScheduledClock(scheduled, live),
  };
}

/** Tracked-home card: strike scheduled when actual/estimated clock differs. */
export function homeCardTimes(f: HomeNowFlight, hour12 = false): HomeCardTimes {
  return {
    dep: homeCardClockPart(
      scheduledDepIso(f),
      homeCardLiveDepIso(f),
      f.origin || '',
      f.originCountry,
      hour12,
    ),
    arr: homeCardClockPart(
      scheduledArrIso(f),
      homeCardLiveArrIso(f),
      f.destination || '',
      f.destCountry,
      hour12,
    ),
  };
}

function searchDepMs(f: HomeNowFlight, iso: string): number | null {
  return flightClockUtcMs(iso, f.origin, f.originCountry);
}

export type HomeSearchDelayClocks = {
  scheduledIso: string;
  estimatedIso: string;
};

/** Estimated later than scheduled — strikethrough + Delayed · {estimated}. */
export function homeSearchDelayClocks(f: HomeNowFlight): HomeSearchDelayClocks | null {
  const scheduledIso = scheduledDepIso(f);
  const estimatedIso = nonEmptyIso(f.estimatedDeparture);
  if (!scheduledIso || !estimatedIso) return null;
  const schedMs = searchDepMs(f, scheduledIso);
  const estMs = searchDepMs(f, estimatedIso);
  if (schedMs == null || estMs == null) return null;
  if (estMs - schedMs < 60 * 1000) return null;
  return { scheduledIso, estimatedIso };
}

export type HomeSearchRowStatus =
  | { kind: 'cancelled' }
  | { kind: 'boarding' }
  | { kind: 'gateClosed' }
  | { kind: 'delayed'; estimatedIso: string }
  | { kind: 'enRoute' }
  | { kind: 'landed' }
  | { kind: 'departed'; iso: string; assumedScheduled: boolean }
  | { kind: 'none' };

function proxyStatus(f: HomeNowFlight): string {
  return String(f.status || '').toLowerCase().replace(/_/g, '-');
}

/** Labels for today's list: proxy status when it is the day's state, else split-clock. */
export function homeSearchRowStatus(
  f: HomeNowFlight,
  now = Date.now(),
  departed = false,
): HomeSearchRowStatus {
  const st = proxyStatus(f);
  if (st === 'cancelled' || st === 'canceled') return { kind: 'cancelled' };

  if (!departed) {
    if (st === 'gateclosed' || st === 'gate-closed' || st === 'gate closed') return { kind: 'gateClosed' };
    if (st === 'boarding' || st === 'lastcall' || st === 'last-call') return { kind: 'boarding' };
    const delay = homeSearchDelayClocks(f);
    if (delay) return { kind: 'delayed', estimatedIso: delay.estimatedIso };
    if (st === 'delayed') return { kind: 'delayed', estimatedIso: nonEmptyIso(f.estimatedDeparture) };
    return { kind: 'none' };
  }

  if (st === 'landed' || st === 'arrived') return { kind: 'landed' };
  if (st === 'en-route' || st === 'enroute') return { kind: 'enRoute' };

  const clock = searchDepartureClock(f);
  const iso = clock?.iso || '';
  if (st === 'departed' && iso) {
    return { kind: 'departed', iso, assumedScheduled: clock?.kind === 'scheduled' };
  }
  if (!iso) return { kind: 'departed', iso: '', assumedScheduled: true };
  return {
    kind: 'departed',
    iso,
    assumedScheduled: clock?.kind === 'scheduled',
  };
}

/** Search list: actual / estimated / scheduled. No grace window past scheduled. */
export function isDepartedSearchResult(f: HomeNowFlight, now = Date.now()): boolean {
  const st = proxyStatus(f);
  if (st === 'cancelled' || st === 'canceled') return true;
  const clock = searchDepartureClock(f);
  if (clock) {
    const ms = searchDepMs(f, clock.iso);
    if (ms != null) return ms < now;
  }
  const live = liveStatus(f, now);
  return live === 'departed' || live === 'enRoute' || live === 'landed';
}

export function partitionHomeSearchResults<T extends HomeNowFlight>(
  flights: T[],
  now = Date.now(),
  opts?: { includeDeparted?: boolean },
): { upcoming: T[]; departed: T[] } {
  const upcoming: T[] = [];
  const departed: T[] = [];
  const includeDeparted = opts?.includeDeparted !== false;
  for (const f of flights) {
    const st = proxyStatus(f);
    const cancelled = st === 'cancelled' || st === 'canceled';
    if (cancelled || isDepartedSearchResult(f, now)) {
      if (cancelled || includeDeparted) departed.push(f);
    } else {
      upcoming.push(f);
    }
  }
  return { upcoming, departed };
}

/** Merge two-hub FIDS lists into one time-sorted list (actual/estimated/scheduled). */
export function mergeHubSearchFlights<T extends HomeNowFlight>(flights: T[]): T[] {
  return [...flights].sort((a, b) => {
    const aIso = searchDepartureClock(a)?.iso;
    const bIso = searchDepartureClock(b)?.iso;
    const am = aIso ? (searchDepMs(a, aIso) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    const bm = bIso ? (searchDepMs(b, bIso) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    return am - bm;
  });
}

export function matchingFlightNumber<T extends { number?: string; operatingNumber?: string }>(
  flights: T[],
  number: string,
): T[] {
  return flights.filter(f => identsMatch(f.number, number) || identsMatch(f.operatingNumber, number));
}

export function matchingAirlineFlights<T extends HomeNowFlight & { number?: string; airlineCode?: string }>(
  flights: T[],
  airline: string,
): T[] {
  const code = String(airline || '').replace(/\s+/g, '').toUpperCase();
  if (!code) return [];
  return flights.filter(f => {
    const row = String(f.airlineCode || '').replace(/\s+/g, '').toUpperCase();
    if (row === code) return true;
    return airlineCodeFromIdent(f.number) === code;
  });
}

function originMatches(f: HomeNowFlight, originIata?: string): boolean {
  const want = String(originIata || '').trim().toUpperCase();
  if (!want) return true;
  return String(f.origin || '').trim().toUpperCase() === want;
}

/** Selected calendar day at origin, optionally only from `originIata`. Yesterday allowed. */
export function pickFlightNumberHits<T extends HomeNowFlight>(
  flights: T[],
  now: number,
  opts: { dayOffset: number; originIata?: string },
): T[] {
  const onDay = [...flights]
    .filter(f => homeRelativeDayOffset(depMsOf(f), now, f.origin, f.originCountry) === opts.dayOffset)
    .sort((a, b) => (depMsOf(a) ?? Infinity) - (depMsOf(b) ?? Infinity));
  if (!opts.originIata) return onDay;
  return onDay.filter(f => originMatches(f, opts.originIata));
}

export function homeFlightDurationMs(f: HomeNowFlight): number | null {
  const a = depMsOf(f);
  const b = arrMsOf(f);
  if (a == null || b == null || !(b > a)) return null;
  return b - a;
}
