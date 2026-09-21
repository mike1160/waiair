import { Platform } from 'react-native';
import {
  formatDurationMs,
  getBoardingPhase,
  liveLockscreenLabel,
  liveStatusLabel,
} from './boardingCountdown';
import { compactTerminal } from './GateBadge';
import { t } from './lib/i18n';
import { formatAirportClock, resolveArrivalIso, resolveDepartureIso } from './lib/flightTimes';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';
import { getPrefs } from './lib/prefs';
import { airlineLogoMeta, cacheAirlineLogoUri } from './lib/liveActivityLogo';
import { leaveAtUtcMs } from './lib/leaveTime';
import { publicTransportFor } from './lib/getIntoTownData';
import FlightActivity, { type FlightActivityProps } from './widgets/FlightActivity';

const SHARE_BASE = 'https://waiair.app/flight';

type FlightForActivity = {
  number: string;
  origin: string;
  destination: string;
  destCity?: string;
  destCountry?: string;
  originCountry?: string;
  actualDeparture?: string;
  boardSide?: 'arrival' | 'departure' | 'both';
  progress?: number;
  status: string;
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  actualTime?: string;
  gate?: string;
  boardingGate?: string;
  terminal?: string;
  depTerminal?: string;
  arrTerminal?: string;
  delay?: number;
  airline?: string;
  airlineCode?: string;
  seat?: string;
  boardingPass?: { seat?: string };
  /** The trip's bookings, for the reasoning layer: only the hotel is read here. */
  tripExtras?: { hotel?: { name?: string; checkIn?: string } | null } | null;
};

/** Close enough to leaving that "leave at …" is the useful thing to say. */
const LEAVE_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * "Leave at 08:30" — only inside the six hours before departure, when it is advice rather than trivia.
 * The travel time is unknown here (no route lookup on this path), so leaveAtUtcMs falls back to its own
 * estimate and the label stays honest about the airport lead time.
 */
function leaveAtLabelFor(f: FlightForActivity, depMs: number | null, now: number, hour12: boolean): string | undefined {
  if (depMs == null || depMs <= now || depMs - now > LEAVE_WINDOW_MS) return undefined;
  const origin = String(f.originCountry || '').toUpperCase();
  const dest = String(f.destCountry || '').toUpperCase();
  const { leaveAt } = leaveAtUtcMs(depMs, { international: !!origin && !!dest && origin !== dest });
  if (!Number.isFinite(leaveAt) || leaveAt <= 0) return undefined;
  const clock = formatAirportClock(new Date(leaveAt).toISOString(), f.origin, hour12, f.originCountry);
  return clock ? t().leaveAt(clock) : undefined;
}

/**
 * How to get into town, once the flight is down. getIntoTownData knows the named options per airport but not
 * how long they take, so the label is the option's name without a duration rather than an invented one.
 */
function transportLabelFor(f: FlightForActivity, landed: boolean): string | undefined {
  if (!landed) return undefined;
  const first = publicTransportFor(f.destination)[0];
  return first?.name || undefined;
}

/** "Novotel · check-in 14:00", once there is somewhere to go. */
function hotelLabelFor(f: FlightForActivity, landed: boolean, hour12: boolean): string | undefined {
  if (!landed) return undefined;
  const hotel = f.tripExtras?.hotel;
  const name = String(hotel?.name || '').trim();
  if (!name) return undefined;
  const clock = formatAirportClock(String(hotel?.checkIn || ''), f.destination, hour12, f.destCountry);
  return clock ? `${name} · ${t().hotelCheckInShort} ${clock}` : name;
}

const activityByKey = new Map<string, ReturnType<typeof FlightActivity.start>>();

function flagFromCountry(cc?: string): string {
  const c = String(cc || '').toUpperCase();
  if (c.length !== 2) return '';
  return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
}

function departureEpochMs(f: FlightForActivity): number | null {
  const iso = String(f.revisedTime || f.scheduledTime || '').trim();
  if (!iso) return null;
  const ms = isoInAirportTzToUtcMs(iso, f.origin, f.originCountry);
  return ms != null && Number.isFinite(ms) && ms > 0 ? ms : null;
}

function gateDepartureLabel(f: FlightForActivity, now = Date.now()): string {
  const depMs = departureEpochMs(f);
  if (depMs != null && depMs > now) {
    return t().gateDepartureIn(formatDurationMs(depMs - now));
  }
  return liveLockscreenLabel(f, now);
}

export function toFlightActivityProps(f: FlightForActivity, now = Date.now()): FlightActivityProps {
  const phase = getBoardingPhase(f, now);
  const destFlag = flagFromCountry(f.destCountry);
  const depMs = departureEpochMs(f);
  const boardEpochMs = depMs ?? now;
  const gate = String(f.gate || f.boardingGate || '').trim();
  const minutesUntil = depMs != null ? Math.max(0, Math.round((depMs - now) / 60000)) : 0;
  const seat = String(f.seat || f.boardingPass?.seat || '').replace(/^0+(?=[A-Z0-9])/i, '').trim();
  const hour12 = getPrefs().timeFormat === '12h';
  const depIso = f.departureTime || f.revisedTime || f.scheduledTime || resolveDepartureIso(f);
  const arrIso = f.arrivalTime || resolveArrivalIso(f) || '';
  const delay = typeof f.delay === 'number' ? f.delay : 0;
  const logoMeta = airlineLogoMeta(f);
  return {
    flightNumber: String(f.number || '').replace(/\s+/g, '').toUpperCase(),
    origin: f.origin || '—',
    destination: f.destination || '—',
    depClock: formatAirportClock(depIso, f.origin, hour12, f.originCountry),
    arrClock: formatAirportClock(arrIso, f.destination, hour12, f.destCountry),
    terminal: compactTerminal(f.depTerminal || f.terminal) || '',
    depStatus: liveStatusLabel(f, now),
    arrStatus: delay > 0 ? t().delayed : t().onTime,
    gateDepartureLabel: gateDepartureLabel(f, now),
    airlineIata: logoMeta.airlineIata,
    airlineLogoUri: '',
    airlineInitials: logoMeta.airlineInitials,
    airlineLogoColor: logoMeta.airlineLogoColor,
    status: liveStatusLabel(f, now),
    statusLabel: liveLockscreenLabel({ ...f, destFlag }, now),
    phase,
    boardEpochMs,
    gate,
    minutesUntil,
    seat,
    // Reasoning layer: undefined whenever it has nothing to say, so the widget shows no empty row.
    leaveAtLabel: leaveAtLabelFor(f, depMs, now, hour12),
    transportLabel: transportLabelFor(f, phase === 'landed'),
    hotelLabel: hotelLabelFor(f, phase === 'landed', hour12),
  };
}

async function buildActivityProps(f: FlightForActivity, now = Date.now()): Promise<FlightActivityProps> {
  const props = toFlightActivityProps(f, now);
  const airlineLogoUri = await cacheAirlineLogoUri(props.airlineIata);
  return { ...props, airlineLogoUri };
}

export async function startOrUpdateLiveActivity(key: string, f: FlightForActivity): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const props = await buildActivityProps(f);
  if (props.phase === 'landed' || props.phase === 'cancelled') {
    await endLiveActivity(key, props);
    return;
  }
  try {
    const existing = activityByKey.get(key);
    if (existing) {
      await existing.update(props);
      return;
    }
    const slug = String(f.number || '').replace(/\s+/g, '').toUpperCase();
    const url = `${SHARE_BASE}/${encodeURIComponent(slug)}`;
    const inst = FlightActivity.start(props, url);
    activityByKey.set(key, inst);
  } catch (e) {
    console.warn('[WaiAir] Live Activity start/update failed', e);
  }
}

export async function endLiveActivity(key: string, finalProps?: FlightActivityProps): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const inst = activityByKey.get(key);
  if (!inst) return;
  try {
    await inst.end('default', finalProps);
  } catch (e) {
    console.warn('[WaiAir] Live Activity end failed', e);
  } finally {
    activityByKey.delete(key);
  }
}

/** After cold start: clear orphans and start activities for active tracks */
export async function reconcileLiveActivities(
  entries: { key: string; flight: FlightForActivity }[],
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    for (const inst of FlightActivity.getInstances()) {
      try { await inst.end('immediate'); } catch { /* ignore */ }
    }
    activityByKey.clear();
    for (const e of entries) {
      const phase = getBoardingPhase(e.flight);
      if (phase === 'landed' || phase === 'cancelled') continue;
      await startOrUpdateLiveActivity(e.key, e.flight);
    }
  } catch (e) {
    console.warn('[WaiAir] Live Activity reconcile failed', e);
  }
}

export async function syncAllLiveActivities(
  entries: { key: string; flight: FlightForActivity }[],
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const activeKeys = new Set(entries.map(e => e.key));
  for (const key of [...activityByKey.keys()]) {
    if (!activeKeys.has(key)) await endLiveActivity(key);
  }
  for (const e of entries) {
    await startOrUpdateLiveActivity(e.key, e.flight);
  }
}
