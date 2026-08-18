/**
 * Background tracked-flight refresh.
 * Expo SDK 57: expo-background-fetch is deprecated — use expo-background-task (15 min min).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';

import { getFlightDetail } from '../services/DataManager';
import { isPickupEnabled, notifyPickupLanding } from './pickup';
import { boardingPushCopy, boardingVisualPhase, departureBoardingAlertsEnabled, type FlightLike } from '../boardingCountdown';
import { buildNotificationData } from './notificationDeepLink';
import { t } from './i18n';
import { syncHomeScreenWidget } from '../widgetSync';
const TRACK_STORAGE_KEY = 'waiair.tracked.v1';
const PREFS_KEY = 'waiair.prefs.v1';
export const TRACKED_BG_TASK = 'waiair-tracked-refresh';

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
) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, ...(data ? { data } : {}) },
      trigger: null,
    });
  } catch { /* ignore */ }
}

async function fetchLive(number: string): Promise<{ status: string; gate: string; delay: number } | null> {
  try {
    const bundle = await getFlightDetail(number);
    if (bundle.premium && bundle.data && !Array.isArray(bundle.data)) {
      const f = bundle.data;
      return {
        status: mapStatus(String(f.status || '')),
        gate: String(f.departureGate || f.arrivalGate || '').trim(),
        delay: 0,
      };
    }
    const raw = Array.isArray(bundle.data) ? bundle.data[0] : bundle.data;
    if (!raw) return null;
    const dep = raw.departure || {};
    const delay = Number(dep.delay || raw.delay || 0) || 0;
    return {
      status: mapStatus(raw.status || raw.flightStatus || raw.status || ''),
      gate: String(dep.gate || raw.gate || '').trim(),
      delay,
    };
  } catch {
    return null;
  }
}

async function notifyAllowed(kind: 'delay' | 'gate' | 'boarding' | 'landed'): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    const n = parsed?.notify || {};
    if (kind in n) return n[kind] !== false;
    return true;
  } catch {
    return true;
  }
}

export async function pollTrackedInBackground(): Promise<void> {
  const raw = await AsyncStorage.getItem(TRACK_STORAGE_KEY);
  if (!raw) return;
  const list = JSON.parse(raw);
  if (!Array.isArray(list) || !list.length) return;

  let dirty = false;
  for (const track of list) {
    const live = await fetchLive(track.flightNumber || track.flight?.number);
    if (!live) continue;
    const num = slug(track.flightNumber || '');
    const linkMeta = {
      flightKey: track.key as string,
      flightId: (track.flight?.id || track.key) as string,
    };
    if (live.gate && live.gate !== track.lastGate && track.type === 'departure') {
      if (await notifyAllowed('gate')) {
        await notify(
          t().gateChanged,
          t().gateChangedBody(num, live.gate),
          buildNotificationData({ flightNumber: num, kind: 'gate', ...linkMeta }),
        );
      }
      track.previousGate = track.lastGate || track.previousGate || '';
      track.lastGate = live.gate;
      dirty = true;
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
          await notify(copy.title, copy.body, boardingData);
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
          await notify(copy.title, copy.body, boardingData);
        }
        if (!track.notifiedGateClose || track.lastStatus !== 'boarding') {
          track.notifiedGateClose = true;
          track.lastStatus = 'boarding';
          dirty = true;
        }
      } else if (track.lastStatus !== 'boarding') {
        if (await notifyAllowed('boarding')) {
          const copy = boardingPushCopy(like, 'open');
          await notify(copy.title, copy.body, boardingData);
        }
        track.lastStatus = 'boarding';
        dirty = true;
      }
    }
    if (live.delay >= (track.notifiedDelay || 0) + 10 && live.delay > 0) {
      if (await notifyAllowed('delay')) {
        await notify(
          t().flightDelayed(num),
          t().flightDelayedBodyShort(num, live.delay),
          buildNotificationData({ flightNumber: num, kind: 'delay', ...linkMeta, type: 'eu261' }),
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
          buildNotificationData({ flightNumber: num, kind: 'landed', ...linkMeta }),
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
  }

  if (dirty) {
    await AsyncStorage.setItem(TRACK_STORAGE_KEY, JSON.stringify(list));
  }

  try {
    await syncHomeScreenWidget();
  } catch { /* widget extension may be unavailable */ }
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
