import { Platform } from 'react-native';
import {
  boardingTargetIso,
  getBoardingPhase,
  liveLockscreenLabel,
  liveStatusLabel,
} from './boardingCountdown';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';
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
};

const activityByKey = new Map<string, ReturnType<typeof FlightActivity.start>>();

function statusDisplay(f: FlightForActivity): string {
  return liveStatusLabel(f);
}

function flagFromCountry(cc?: string): string {
  const c = String(cc || '').toUpperCase();
  if (c.length !== 2) return '';
  return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
}

export function toFlightActivityProps(f: FlightForActivity, now = Date.now()): FlightActivityProps {
  const phase = getBoardingPhase(f, now);
  const iso = boardingTargetIso(f);
  const destFlag = flagFromCountry(f.destCountry);
  return {
    flightNumber: String(f.number || '').replace(/\s+/g, '').toUpperCase(),
    origin: f.origin || '—',
    destination: f.destination || '—',
    status: statusDisplay(f),
    statusLabel: liveLockscreenLabel({ ...f, destFlag }, now),
    phase,
      boardEpochMs: iso
      ? (isoInAirportTzToUtcMs(iso, f.origin, f.originCountry) ?? 0)
      : now,
  };
}

export async function startOrUpdateLiveActivity(key: string, f: FlightForActivity): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const props = toFlightActivityProps(f);
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
