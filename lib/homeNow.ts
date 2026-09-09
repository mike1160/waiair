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
  type FlightClockFields,
} from './flightTimes.ts';
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
};

export type HomeNowResolved = {
  phase: HomeNowPhase;
  checkinTime: string;
  leaveTime: string;
  gate: string;
  walkMin: number;
  belt: string;
  landsIn: string;
};

export type HomeNowCopy = {
  homeNowCheckin: (time: string) => string;
  homeNowLeave: (time: string) => string;
  homeNowAtAirport: string;
  homeNowGate: (gate: string, mins: number) => string;
  homeNowBoarding: (gate: string) => string;
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

function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function liveStatus(f: HomeNowFlight, now: number): string {
  const st = String(f.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'canceled') return 'cancelled';
  if (st === 'landed') return 'landed';
  if (st === 'en-route' || st === 'enroute' || st === 'departed') {
    return st === 'departed' ? 'departed' : 'enRoute';
  }
  if (st === 'boarding') return 'boarding';
  const dep = depMsOf(f);
  if (dep != null && now > dep) return 'departed';
  return st || 'scheduled';
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

  const base: HomeNowResolved = {
    phase: 'checkin',
    checkinTime: checkinTime && checkinTime !== EMPTY_CLOCK ? checkinTime : '',
    leaveTime: leaveTime && leaveTime !== EMPTY_CLOCK ? leaveTime : '',
    gate,
    walkMin: DEFAULT_WALK_MIN,
    belt,
    landsIn,
  };

  if (live === 'cancelled') return { ...base, phase: 'done' };

  if (live === 'landed') {
    const elapsed = landedElapsedMs(f, now);
    if (elapsed != null && elapsed >= DONE_AFTER_MS) return { ...base, phase: 'done' };
    if (elapsed != null && elapsed >= HOTEL_AFTER_MS) return { ...base, phase: 'transport' };
    if (belt) return { ...base, phase: 'baggage' };
    return { ...base, phase: 'transport' };
  }

  if (live === 'enRoute' || live === 'departed') return { ...base, phase: 'in_flight' };

  if (live === 'boarding') return { ...base, phase: 'boarding' };

  if (gate) return { ...base, phase: 'gate' };

  if (leaveMs != null && now >= leaveMs) return { ...base, phase: 'at_airport' };

  if (checkinOpenMs != null && now >= checkinOpenMs) return { ...base, phase: 'leave' };

  return { ...base, phase: 'checkin' };
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
      return copy.homeNowGate(gate, resolved.walkMin);
    case 'boarding':
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

/** Search list: the departure clock wins over FIDS/clock-adjusted status.
 *  stampBoardRoute may stamp tonight's flights `en-route` (progress/actualTime);
 *  those must still show under Vandaag. */
export function isDepartedSearchResult(f: HomeNowFlight, now = Date.now()): boolean {
  const st = String(f.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'canceled') return false;
  const dep = depMsOf(f);
  if (dep != null) return dep < now;
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
  const includeDeparted = opts?.includeDeparted === true;
  for (const f of flights) {
    if (isDepartedSearchResult(f, now)) {
      if (includeDeparted) departed.push(f);
    } else {
      upcoming.push(f);
    }
  }
  return { upcoming, departed };
}

/** Flight-number search: today's (or selected day's) occurrence and the next one — never yesterday. */
export function pickFlightNumberHits<T extends HomeNowFlight>(
  flights: T[],
  now: number,
  opts: { dayOffset: number },
): T[] {
  const sorted = [...flights].sort((a, b) => (depMsOf(a) ?? Infinity) - (depMsOf(b) ?? Infinity));
  if (opts.dayOffset < 0) {
    return sorted.filter(f => (
      homeRelativeDayOffset(depMsOf(f), now, f.origin, f.originCountry) === opts.dayOffset
    ));
  }
  const upcoming = sorted.filter(f => {
    if (isDepartedSearchResult(f, now)) return false;
    const off = homeRelativeDayOffset(depMsOf(f), now, f.origin, f.originCountry);
    return off >= opts.dayOffset;
  });
  return upcoming.slice(0, 2);
}

export function homeFlightDurationMs(f: HomeNowFlight): number | null {
  const a = depMsOf(f);
  const b = arrMsOf(f);
  if (a == null || b == null || !(b > a)) return null;
  return b - a;
}
