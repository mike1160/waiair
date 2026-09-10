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
import { estimateDriveToAirport, loadPickupHome } from './pickup';
import { getPrefs } from './prefs';
import {
  hasBoardingPassScan,
  passengerDepMs,
  planPassengerDatePushes,
  type DatePushCopy,
} from './scheduledFlightPushes';

export type DatePushIds = { evening?: string; leave?: string };

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
