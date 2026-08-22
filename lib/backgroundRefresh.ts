/**
 * Background tracked-flight refresh.
 * Expo SDK 57: expo-background-fetch is deprecated — use expo-background-task (15 min min).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';

import { getCached, getFlightDetail } from '../services/DataManager';
import type { FAFlightDetail } from '../services/FlightAwareService';
import { isPickupEnabled, notifyPickupGate, notifyPickupLanding } from './pickup';
import { boardingPushCopy, boardingVisualPhase, departureBoardingAlertsEnabled, minutesUntilDeparture, type FlightLike } from '../boardingCountdown';
import { hasRealGate } from '../GateBadge';
import {
  isAlertSeverity,
  maybePrefetchTurbulence,
  turbulenceAlertCopy,
} from './turbulence';
import { buildNotificationData } from './notificationDeepLink';
import { hasSentNotification, markSentNotification, notificationDedupeKey } from './notificationDedupe';
import { delayMinutesFromTimes } from './eu261';
import { EMPTY_CLOCK, formatArrivesClockLabeled } from './flightTimes';
import { t } from './i18n';
const TRACK_STORAGE_KEY = 'waiair.tracked.v1';
const PREFS_KEY = 'waiair.prefs.v1';
export const TRACKED_BG_TASK = 'waiair-tracked-refresh';
const API_TIMEOUT_MS = 8000;

type LiveSnapshot = {
  status: string;
  gate: string;
  delay: number;
  arrivalTime: string;
};

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return run(ctrl.signal).finally(() => clearTimeout(timer));
}

function slug(n: string) {
  return String(n || '').replace(/\s+/g, '').toUpperCase();
}

function mapStatus(raw: string): string {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'arrived' || s === 'landed') return 'landed';
  if (s === 'canceled' || s === 'cancelled') return 'cancelled';
  if (s === 'departed' || s === 'en-route' || s === 'enroute' || s === 'airborne') return 'en-route';
  if (s === 'boarding' || s === 'departing' || s === 'gate closed' || s === 'last call') return 'boarding';
  if (s === 'delayed') return 'delayed';
  return 'scheduled';
}

async function notify(
  title: string,
  body: string,
  data?: Record<string, string>,
  dedupe?: { flight: string; kind: string; detail?: string | number },
  sound: boolean | string = true,
) {
  if (Platform.OS === 'web') return;
  const key = dedupe
    ? notificationDedupeKey(dedupe.flight, dedupe.kind, dedupe.detail)
    : '';
  if (key && await hasSentNotification(key)) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound, ...(data ? { data } : {}) },
      trigger: null,
    });
    if (key) await markSentNotification(key);
  } catch { /* ignore */ }
}

function premiumDelayMinutes(f: FAFlightDetail, type?: string): number {
  if (type === 'arrival') {
    return delayMinutesFromTimes(
      f.scheduledArrival,
      f.actualArrival,
      f.estimatedArrival,
    );
  }
  return delayMinutesFromTimes(
    f.scheduledDeparture,
    f.actualDeparture,
    f.estimatedDeparture,
    f.delay,
  );
}

function pickTime(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const nested = o.utc || o.local;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }
  return '';
}

function liveFromPremium(f: FAFlightDetail, type?: string): LiveSnapshot {
  const arrival = type === 'arrival';
  return {
    status: mapStatus(String(f.status || '')),
    gate: String(arrival ? (f.arrivalGate || '') : (f.departureGate || f.arrivalGate || '')).trim(),
    delay: premiumDelayMinutes(f, type),
    arrivalTime: pickTime(f.actualArrival, f.estimatedArrival, f.scheduledArrival),
  };
}

function liveFromRaw(raw: any, type?: string): LiveSnapshot | null {
  if (!raw) return null;
  const dep = raw.departure || {};
  const arr = raw.arrival || {};
  const mov = arr.movement || {};
  const arrival = type === 'arrival';
  const delay = arrival
    ? Number(arr.delay || raw.delay || 0) || 0
    : Number(dep.delay || raw.delay || 0) || 0;
  return {
    status: mapStatus(raw.status || raw.flightStatus || raw.status || ''),
    gate: String(
      arrival
        ? (arr.gate || arr.movement?.gate || '')
        : (dep.gate || raw.gate || ''),
    ).trim(),
    delay,
    arrivalTime: pickTime(
      arr.actualTime, arr.runwayTime, arr.revisedTime, arr.predictedTime, arr.scheduledTime,
      mov.actualTime, mov.runwayTime, mov.revisedTime, mov.predictedTime, mov.scheduledTime,
    ),
  };
}

function liveFromBundle(bundle: { data: any; premium?: boolean }, type?: string): LiveSnapshot | null {
  if (bundle.premium && bundle.data && !Array.isArray(bundle.data)) {
    return liveFromPremium(bundle.data as FAFlightDetail, type);
  }
  const raw = Array.isArray(bundle.data) ? bundle.data[0] : bundle.data;
  return liveFromRaw(raw, type);
}

function cachedLiveFromTrack(track: any): LiveSnapshot | null {
  const status = String(track?.lastStatus || track?.flight?.status || '').trim();
  const gate = String(track?.lastGate || track?.flight?.gate || '').trim();
  const delay = Number(track?.lastDelay || track?.notifiedDelay || 0) || 0;
  const arrivalTime = pickTime(
    track?.flight?.arrivalTime,
    track?.flight?.estimatedArrival,
    track?.flight?.scheduledArrival,
  );
  if (!status && !gate && !delay && !arrivalTime) return null;
  return {
    status: mapStatus(status),
    gate,
    delay,
    arrivalTime,
  };
}

async function liveFromFlightCache(number: string, type?: string): Promise<LiveSnapshot | null> {
  try {
    const cached = await getCached(`flight_${slug(number)}`);
    if (cached?.fa) return liveFromPremium(cached.fa as FAFlightDetail, type);
    if (Array.isArray(cached?.adb)) return liveFromRaw(cached.adb[0], type);
    if (Array.isArray(cached)) return liveFromRaw(cached[0], type);
  } catch { /* ignore */ }
  return null;
}

async function fetchLive(
  number: string,
  type: string | undefined,
  timeoutMs: number,
  track: any,
): Promise<LiveSnapshot | null> {
  try {
    const bundle = await withTimeout(
      (signal) => getFlightDetail(number, signal),
      timeoutMs,
    );
    return liveFromBundle(bundle, type) || cachedLiveFromTrack(track);
  } catch {
    return (await liveFromFlightCache(number, type)) || cachedLiveFromTrack(track);
  }
}

async function notifyAllowed(kind: 'delay' | 'gate' | 'boarding' | 'landed' | 'turbulence'): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    const n = parsed?.notify || {};
    if (kind === 'turbulence') {
      return n.boarding !== false || n.gate !== false || n.delay !== false;
    }
    if (kind in n) return n[kind] !== false;
    return true;
  } catch {
    return true;
  }
}

export async function pollTrackedInBackground(): Promise<void> {
  try {
    await runTrackedBackgroundRefresh();
  } catch (e) {
    console.warn('[backgroundRefresh]', e);
  }
}

async function runTrackedBackgroundRefresh(): Promise<void> {
  const raw = await AsyncStorage.getItem(TRACK_STORAGE_KEY);
  if (!raw) return;
  const list = JSON.parse(raw);
  if (!Array.isArray(list) || !list.length) return;

  const started = Date.now();
  let dirty = false;
  for (const track of list) {
    const remaining = API_TIMEOUT_MS - (Date.now() - started);
    const live = remaining <= 0
      ? ((await liveFromFlightCache(track.flightNumber || track.flight?.number, track.type))
        || cachedLiveFromTrack(track))
      : await fetchLive(
        track.flightNumber || track.flight?.number,
        track.type,
        remaining,
        track,
      );
    if (!live) continue;
    const num = slug(track.flightNumber || '');
    const linkMeta = {
      flightKey: track.key as string,
      flightId: (track.flight?.id || track.key) as string,
    };
    const isArrival = track.type === 'arrival';
    if (live.gate && live.gate !== track.lastGate) {
      if (isArrival) {
        try {
          if (await isPickupEnabled(track.key)) {
            await notifyPickupGate(track.key, num, live.gate, { arrivalsBoard: true });
          }
        } catch { /* ignore */ }
        track.previousGate = track.lastGate || track.previousGate || '';
        track.lastGate = live.gate;
        dirty = true;
      } else if (track.type === 'departure') {
        if (await notifyAllowed('gate')) {
          const firstGate = !hasRealGate(track.lastGate);
          await notify(
            firstGate ? t().gateAssigned : t().gateChanged,
            firstGate ? t().gateAssignedBody(num, live.gate) : t().gateChangedBody(num, live.gate),
            buildNotificationData({ flightNumber: num, kind: 'gate', ...linkMeta }),
            { flight: num, kind: 'gate', detail: live.gate },
          );
        }
        track.previousGate = track.lastGate || track.previousGate || '';
        track.lastGate = live.gate;
        dirty = true;
      }
    }
    if (live.status === 'boarding' && departureBoardingAlertsEnabled(track.type)) {
      const like: FlightLike & { number?: string; origin?: string; destination?: string; gate?: string } = {
        ...(track.flight || {}),
        status: 'boarding',
        number: num,
        origin: track.flight?.origin,
        destination: track.flight?.destination,
        gate: live.gate || track.flight?.gate || track.lastGate || '',
      };
      const visual = boardingVisualPhase(like, Date.now(), track.type);
      const boardingData = buildNotificationData({ flightNumber: num, kind: 'boarding', ...linkMeta });
      if (visual === 'lastCall') {
        if (!track.notifiedLastCall && await notifyAllowed('boarding')) {
          const copy = boardingPushCopy(like, 'lastCall');
          await notify(copy.title, copy.body, boardingData, { flight: num, kind: 'lastCall' });
        }
        if (!track.notifiedLastCall || track.lastStatus !== 'boarding') {
          track.notifiedLastCall = true;
          track.notifiedGateClose = true;
          track.lastStatus = 'boarding';
          dirty = true;
        }
      } else if (visual === 'closing') {
        if (!track.notifiedGateClose && await notifyAllowed('boarding')) {
          const copy = boardingPushCopy(like, 'closing');
          await notify(copy.title, copy.body, boardingData, { flight: num, kind: 'gateClose' });
        }
        if (!track.notifiedGateClose || track.lastStatus !== 'boarding') {
          track.notifiedGateClose = true;
          track.lastStatus = 'boarding';
          dirty = true;
        }
      } else if (track.lastStatus !== 'boarding') {
        if (await notifyAllowed('boarding')) {
          const copy = boardingPushCopy(like, 'open');
          await notify(copy.title, copy.body, boardingData, { flight: num, kind: 'boarding' });
        }
        track.lastStatus = 'boarding';
        dirty = true;
      }
    }
    if (live.delay >= (track.notifiedDelay || 0) + 10 && live.delay > 0) {
      if (await notifyAllowed('delay')) {
        const copy = t();
        let body = copy.flightDelayedBodyShort(num, live.delay);
        if (isArrival) {
          const iso = live.arrivalTime
            || track.flight?.arrivalTime
            || track.flight?.estimatedArrival
            || track.flight?.scheduledArrival
            || '';
          const clock = iso
            ? formatArrivesClockLabeled(iso, track.flight?.destination, false, track.flight?.destCountry)
            : '';
          if (clock && clock !== EMPTY_CLOCK) {
            body = copy.flightDelayedArrivalBody(num, live.delay, clock);
          }
        }
        await notify(
          copy.flightDelayed(num),
          body,
          buildNotificationData({ flightNumber: num, kind: 'delay', ...linkMeta, type: 'eu261' }),
          { flight: num, kind: 'delay', detail: live.delay },
        );
      }
      track.notifiedDelay = live.delay;
      track.lastDelay = live.delay;
      dirty = true;
    }
    if (live.status === 'landed' && track.lastStatus !== 'landed') {
      if (await notifyAllowed('landed')) {
        const city = track.flight?.destCity || track.flight?.destination || '';
        await notify(
          t().landed,
          city ? t().landedIn(city, '') : t().landedDotNum(num),
          buildNotificationData({
            flightNumber: num,
            kind: 'landed',
            ...linkMeta,
            focusSection: 'globe',
          }),
          { flight: num, kind: 'landed' },
          'airport_chime.caf',
        );
      }
      try {
        if (await isPickupEnabled(track.key)) {
          await notifyPickupLanding({
            flightKey: track.key,
            flightNumber: num,
            destIata: track.flight?.destination || track.airportIata || '',
            terminal: track.flight?.arrTerminal || track.flight?.terminal,
          });
        }
      } catch { /* ignore */ }
      track.lastStatus = 'landed';
      dirty = true;
    }
    if (live.status && live.status !== track.lastStatus && live.status !== 'boarding' && live.status !== 'landed') {
      track.lastStatus = live.status;
      dirty = true;
    }

    const flight = {
      ...(track.flight || {}),
      status: live.status || track.lastStatus,
      gate: live.gate || track.lastGate || track.flight?.gate,
      origin: track.flight?.origin,
      destination: track.flight?.destination,
      number: num,
      scheduledTime: track.flight?.scheduledTime || track.scheduledTime,
    };
    try {
      const forecast = await maybePrefetchTurbulence(flight, {
        trackKey: String(track.key || track.flight?.id || ''),
        minutesUntilDeparture: minutesUntilDeparture(flight as FlightLike),
        hasGate: hasRealGate(flight.gate),
      });
      if (forecast && isAlertSeverity(forecast.peak) && await notifyAllowed('turbulence')) {
        const alert = turbulenceAlertCopy(forecast, num);
        await notify(
          alert.title,
          alert.body,
          buildNotificationData({ flightNumber: num, kind: 'turbulence', ...linkMeta }),
          { flight: num, kind: 'turbulence' },
        );
      }
    } catch { /* prefetch is best-effort */ }
  }

  if (dirty) {
    await AsyncStorage.setItem(TRACK_STORAGE_KEY, JSON.stringify(list));
  }

}

export async function registerTrackedBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
    const registered = await TaskManager.isTaskRegisteredAsync(TRACKED_BG_TASK);
    if (!registered) {
      await BackgroundTask.registerTaskAsync(TRACKED_BG_TASK, { minimumInterval: 15 });
    }
  } catch {
    /* Expo Go / missing native module */
  }
}

/** Must run at import time (global scope) so iOS can wake the JS task. */
export function defineTrackedBackgroundTask(): void {
  if (Platform.OS === 'web') return;
  try {
    TaskManager.defineTask(TRACKED_BG_TASK, async () => {
      try {
        await pollTrackedInBackground();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch {
    /* native module not present */
  }
}
