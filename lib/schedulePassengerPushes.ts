/** Schedule / cancel passenger evening + leave DATE local notifications. */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { airportRecByIata } from './airportsDb';
import { getLocalizedCity } from './cityLocalized';
import { taxiMinutes } from './destinationServices';
import { getLocale, t } from './i18n';
import {
  datePushIdsToCancel,
  shouldRescheduleDatePushes,
} from './leaveTime';
import { buildNotificationData } from './notificationDeepLink';
import { momentPriority, upcomingMoments, type TripMoment } from './tripMoments';
import {
  filterMomentsForFollower,
  filterMomentsForTraveler,
  followerText,
  getShareRecordForFlight,
  isExpired,
} from './familyShare';
import { estimateDriveToAirport, loadPickupHome } from './pickup';
import { getPrefs } from './prefs';
import {
  hasBoardingPassScan,
  passengerDepMs,
  planPassengerDatePushes,
  type DatePushCopy,
} from './scheduledFlightPushes';

export type DatePushIds = { evening?: string; leave?: string };

/** The scheduled ids of the trip moments, keyed by moment key, so a re-run can cancel what it replaces. */
export type TripMomentIds = Record<string, string>;

export type DatePushTracked = {
  key: string;
  flightNumber: string;
  type?: 'arrival' | 'departure';
  lastStatus?: string;
  boardingPass?: { seat?: string; sequence?: string; pnr?: string } | null;
  datePushIds?: DatePushIds;
  datePushDepMs?: number;
  flight: {
    origin?: string;
    originCity?: string;
    originCountry?: string;
    destination?: string;
    destCity?: string;
    destCountry?: string;
    scheduledTime?: string;
    departureTime?: string;
    revisedTime?: string;
    actualTime?: string;
    status?: string;
  };
};

async function cancelIds(ids: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  for (const id of ids) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ignore */ }
  }
}

async function scheduleAt(
  date: Date,
  title: string,
  body: string,
  data: Record<string, string>,
  opts?: { urgent?: boolean },
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (date.getTime() <= Date.now() + 15_000) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data,
        ...(Platform.OS === 'android'
          ? { channelId: opts?.urgent ? 'flights-urgent' : 'flights' }
          : {}),
        ...(opts?.urgent && Platform.OS === 'ios'
          ? { interruptionLevel: 'timeSensitive' as const }
          : {}),
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

function datePushCopy(): DatePushCopy {
  const copy = t();
  return {
    pushTomorrowTitle: copy.pushTomorrowTitle,
    pushTomorrowBody: copy.pushTomorrowBody,
    pushTomorrowBodyPass: copy.pushTomorrowBodyPass,
    pushLeaveTitle: copy.pushLeaveTitle,
    pushLeaveBody: copy.pushLeaveBody,
  };
}

function cityForIata(iata?: string, fallback?: string): string {
  const code = String(iata || '').toUpperCase();
  const rec = code ? airportRecByIata(code) : undefined;
  return getLocalizedCity(code, getLocale(), fallback || rec?.city || code);
}

export async function resolveTravelMinToOrigin(originIata?: string): Promise<number | null> {
  const code = String(originIata || '').toUpperCase();
  const rec = code ? airportRecByIata(code) : undefined;
  try {
    const home = await loadPickupHome();
    if (home && rec) {
      const est = estimateDriveToAirport(home, {
        iata: rec.iata,
        lat: rec.lat,
        lon: rec.lon,
        name: rec.name,
      });
      if (est.minutes != null && !est.tooFar) return est.minutes;
    }
  } catch { /* taxi fallback */ }
  return taxiMinutes(code);
}

export async function cancelPassengerDatePushes(entry: Pick<DatePushTracked, 'datePushIds'>): Promise<void> {
  await cancelIds(datePushIdsToCancel(entry.datePushIds));
}

function inactiveStatus(status?: string): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'cancelled' || s === 'landed' || s === 'en-route' || s === 'en route';
}

export async function syncPassengerDatePushes<T extends DatePushTracked>(
  entry: T,
  opts?: { force?: boolean; now?: number; travelMin?: number | null },
): Promise<T> {
  const now = opts?.now ?? Date.now();
  const live = entry.flight;
  const status = entry.lastStatus || live?.status;
  const skip = entry.type === 'arrival' || inactiveStatus(status) || !getPrefs().notify.delay;

  const clear = async (): Promise<T> => {
    const ids = datePushIdsToCancel(entry.datePushIds);
    if (ids.length) await cancelIds(ids);
    if (!entry.datePushIds && entry.datePushDepMs == null) return entry;
    return { ...entry, datePushIds: undefined, datePushDepMs: undefined };
  };

  if (skip || !live) return clear();

  const depMs = passengerDepMs(live);
  if (depMs == null) return clear();

  const originIata = live.origin;
  const originRec = originIata ? airportRecByIata(originIata) : undefined;
  const destIata = live.destination;
  const destRec = destIata ? airportRecByIata(destIata) : undefined;
  const originCountry = live.originCountry || originRec?.country;
  const destCountry = live.destCountry || destRec?.country;
  const travelMin = opts?.travelMin !== undefined ? opts.travelMin : await resolveTravelMinToOrigin(originIata);
  const hour12 = getPrefs().timeFormat === '12h';
  const tight = getPrefs().airportTiming === 'tight';
  const hasPass = hasBoardingPassScan(entry.boardingPass);

  const plan = planPassengerDatePushes(depMs, now, {
    flightNumber: entry.flightNumber,
    originIata,
    originCountry,
    destCountry,
    destCity: cityForIata(destIata, live.destCity),
    fromCity: cityForIata(originIata, live.originCity),
    travelMin,
    tight,
    hasBoardingPass: hasPass,
    hour12,
    copy: datePushCopy(),
  });

  const wantEvening = !!plan.evening;
  const wantLeave = !!plan.leave;
  const prevIds = entry.datePushIds || {};
  const reschedule = opts?.force || shouldRescheduleDatePushes(entry.datePushDepMs, depMs);
  const eveningStale = wantEvening !== !!prevIds.evening;
  const leaveStale = wantLeave !== !!prevIds.leave;

  if (!reschedule && !eveningStale && !leaveStale) {
    return entry;
  }

  await cancelIds(datePushIdsToCancel(prevIds));
  const nextIds: DatePushIds = {};
  const num = entry.flightNumber;
  const link = { flightKey: entry.key, flightId: entry.key };

  if (plan.evening) {
    const id = await scheduleAt(
      new Date(plan.evening.fireAt),
      plan.evening.title,
      plan.evening.body,
      buildNotificationData({ flightNumber: num, kind: 'evening', ...link }),
    );
    if (id) nextIds.evening = id;
  }
  if (plan.leave) {
    const id = await scheduleAt(
      new Date(plan.leave.fireAt),
      plan.leave.title,
      plan.leave.body,
      buildNotificationData({ flightNumber: num, kind: 'leave', ...link }),
    );
    if (id) nextIds.leave = id;
  }

  const datePushIds = (nextIds.evening || nextIds.leave) ? nextIds : undefined;
  return { ...entry, datePushIds, datePushDepMs: depMs };
}


/*
 * Trip moments (lib/tripMoments.ts). These sit alongside the evening/leave pushes above, which are unchanged:
 * those two are per flight, these are per trip and come from the bookings as well as the flights.
 *
 * Priority maps onto the two Android channels the app already creates in App.tsx: a connection you are about
 * to miss goes to 'flights-urgent' (and is time-sensitive on iOS), everything else to 'flights'.
 */
export async function cancelTripMoments(ids?: TripMomentIds | null): Promise<void> {
  await cancelIds(Object.values(ids || {}).filter(Boolean));
}

/**
 * Schedules the moments that still lie ahead and returns the ids, keyed by moment key. Anything previously
 * scheduled under `previous` is cancelled first, so re-running after a track/untrack never doubles up.
 * A moment whose trigger has passed is skipped rather than fired late.
 */
export async function scheduleTripMoments(
  moments: TripMoment[],
  opts?: { now?: number; previous?: TripMomentIds | null },
): Promise<TripMomentIds> {
  const now = opts?.now ?? Date.now();
  await cancelTripMoments(opts?.previous);
  const next: TripMomentIds = {};
  if (Platform.OS === 'web' || !getPrefs().notify.delay) return next;

  // The people following this flight get their own wording, sent through the proxy (Family Safety Mode).
  void fanOutToFollowers(moments || [], now);

  // Only what the traveller should see is scheduled on this device.
  for (const moment of upcomingMoments(filterMomentsForTraveler(moments || []), now)) {
    const priority = momentPriority(moment.kind);
    const id = await scheduleAt(
      new Date(moment.triggerMs),
      moment.title,
      moment.body,
      buildNotificationData({
        flightNumber: '',
        kind: moment.kind,
        flightKey: moment.flightKey,
        flightId: moment.flightKey,
        ...(moment.actionUrl ? { url: moment.actionUrl } : {}),
      }),
      { urgent: priority === 'max' },
    );
    if (id) next[moment.key] = id;
  }
  return next;
}


const PROXY_URL = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

/**
 * Hands the proxy the follower moments for every shared flight, with the time each is due.
 *
 * The device computes them because only the device has the flight legs and the bookings; the proxy holds
 * them and releases each one when its moment comes round, on the poll that already runs every five minutes
 * (proxy/familyPush.js releaseDue, driven by proxy/expoPush.js). Nothing is filtered by time here — that was
 * a workaround for having no clock on the other side, and the poller is now the authoritative one.
 *
 * Never throws and never blocks the traveller's own notifications: an unreachable proxy is a quiet no-op.
 */
async function fanOutToFollowers(moments: TripMoment[], now: number): Promise<void> {
  try {
    const wanted = filterMomentsForFollower(moments);
    if (!wanted.length) return;

    // One upload per shared flight, not per moment.
    const byFlight = new Map<string, TripMoment[]>();
    for (const m of wanted) {
      const list = byFlight.get(m.flightKey);
      if (list) list.push(m);
      else byFlight.set(m.flightKey, [m]);
    }

    for (const [flightKey, list] of byFlight) {
      const record = await getShareRecordForFlight(flightKey);
      if (!record || isExpired(record, now)) continue;
      const payload = list.map(m => {
        const { title, body } = followerText(m);
        return { key: m.key, kind: m.kind, triggerMs: m.triggerMs, title, body, urgent: m.urgent };
      });
      try {
        await fetch(`${PROXY_URL}/family-share/${encodeURIComponent(record.token)}/moments`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moments: payload }),
        });
      } catch { /* the next run uploads again */ }
    }
  } catch { /* the traveller's own schedule must not depend on this */ }
}
