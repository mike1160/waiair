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
import { boardingPushCopy, boardingVisualPhase, type FlightLike } from '../boardingCountdown';
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

async function notify(title: string, body: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
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
  for (const t of list) {
    const live = await fetchLive(t.flightNumber || t.flight?.number);
    if (!live) continue;
    const num = slug(t.flightNumber || '');
    if (live.gate && live.gate !== t.lastGate) {
      if (await notifyAllowed('gate')) {
        await notify('Gate changed', `⚠️ Gate changed · ${num} · Now Gate ${live.gate}`);
      }
      t.previousGate = t.lastGate || t.previousGate || '';
      t.lastGate = live.gate;
      dirty = true;
    }
    if (live.status === 'boarding') {
      const like: FlightLike & { number?: string; origin?: string; destination?: string; gate?: string } = {
        ...(t.flight || {}),
        status: 'boarding',
        number: num,
        origin: t.flight?.origin,
        destination: t.flight?.destination,
        gate: live.gate || t.flight?.gate || t.lastGate || '',
      };
      const visual = boardingVisualPhase(like, Date.now(), t.type);
      if (visual === 'lastCall') {
        if (!t.notifiedLastCall && await notifyAllowed('boarding')) {
          const copy = boardingPushCopy(like, 'lastCall');
          await notify(copy.title, copy.body);
        }
        if (!t.notifiedLastCall || t.lastStatus !== 'boarding') {
          t.notifiedLastCall = true;
          t.notifiedGateClose = true;
          t.lastStatus = 'boarding';
          dirty = true;
        }
      } else if (visual === 'closing') {
        if (!t.notifiedGateClose && await notifyAllowed('boarding')) {
          const copy = boardingPushCopy(like, 'closing');
          await notify(copy.title, copy.body);
        }
        if (!t.notifiedGateClose || t.lastStatus !== 'boarding') {
          t.notifiedGateClose = true;
          t.lastStatus = 'boarding';
          dirty = true;
        }
      } else if (t.lastStatus !== 'boarding') {
        if (await notifyAllowed('boarding')) {
          const copy = boardingPushCopy(like, 'open');
          await notify(copy.title, copy.body);
        }
        t.lastStatus = 'boarding';
        dirty = true;
      }
    }
    if (live.delay >= (t.notifiedDelay || 0) + 10 && live.delay > 0) {
      if (await notifyAllowed('delay')) {
        await notify(`${num} delayed`, `${num} running ${live.delay} min late · ☕ You have time`);
      }
      t.notifiedDelay = live.delay;
      t.lastDelay = live.delay;
      dirty = true;
    }
    if (live.status === 'landed' && t.lastStatus !== 'landed') {
      if (await notifyAllowed('landed')) {
        const city = t.flight?.destCity || t.flight?.destination || '';
        await notify('Landed', city ? `Landed in ${city}` : `Landed · ${num}`);
      }
      try {
        if (await isPickupEnabled(t.key)) {
          await notifyPickupLanding({
            flightKey: t.key,
            flightNumber: num,
            destIata: t.flight?.destination || t.airportIata || '',
            terminal: t.flight?.arrTerminal || t.flight?.terminal,
          });
        }
      } catch { /* ignore */ }
      t.lastStatus = 'landed';
      dirty = true;
    }
    if (live.status && live.status !== t.lastStatus && live.status !== 'boarding' && live.status !== 'landed') {
      t.lastStatus = live.status;
      dirty = true;
    }
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
