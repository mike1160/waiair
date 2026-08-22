import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from './i18n';
import { buildNotificationData } from './notificationDeepLink';

export type HistoryFlight = {
  flightNumber: string;
  route: string;
  scheduledTime: string;
  actualTime: string;
  delay: number;
  gate: string;
  landedAt: string;
};

export type WakeAlarm = {
  flightKey: string;
  flightNumber: string;
  minutesBefore: 30 | 45 | 60;
  landAtIso: string;
  fireAtIso: string;
  notificationId?: string;
  source?: 'auto' | 'manual';
};

const WAKE_KEY = 'waiair.wakeAlarms.v1';
const WAKE_CLEARED_KEY = 'waiair.wakeAlarms.cleared.v1';
const LONG_HAUL_MS = 4 * 60 * 60 * 1000;
const ETA_SHIFT_MS = 15 * 60 * 1000;
const autoWakeToasted = new Set<string>();

function landAtMs(iso?: string): number | null {
  const ms = Date.parse(String(iso || ''));
  return Number.isFinite(ms) ? ms : null;
}
const HISTORY_PREFIX = 'history:';

function historyKey(dateIso: string, flightNumber: string): string {
  const day = (dateIso || new Date().toISOString()).slice(0, 10);
  const num = flightNumber.replace(/\s+/g, '').toUpperCase();
  return `${HISTORY_PREFIX}${day}:${num}`;
}

export async function saveLandedToHistory(entry: HistoryFlight): Promise<void> {
  const key = historyKey(entry.landedAt || entry.actualTime || entry.scheduledTime, entry.flightNumber);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export async function loadFlightHistory(): Promise<HistoryFlight[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const histKeys = keys.filter((k) => k.startsWith(HISTORY_PREFIX));
    if (!histKeys.length) return [];
    const pairs = await AsyncStorage.multiGet(histKeys);
    const items: HistoryFlight[] = [];
    for (const [, raw] of pairs) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as HistoryFlight;
        if (parsed?.flightNumber) items.push(parsed);
      } catch {
        /* skip */
      }
    }
    return items.sort((a, b) => {
      const ta = new Date(a.landedAt || a.actualTime || a.scheduledTime || 0).getTime();
      const tb = new Date(b.landedAt || b.actualTime || b.scheduledTime || 0).getTime();
      return tb - ta;
    });
  } catch {
    return [];
  }
}

/** Remove landed-flight history only — does not touch tracked flights. */
export async function clearFlightHistory(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const histKeys = keys.filter((k) => k.startsWith(HISTORY_PREFIX));
    if (histKeys.length) await AsyncStorage.multiRemove(histKeys);
  } catch {
    /* ignore */
  }
}

export async function loadWakeAlarms(): Promise<Record<string, WakeAlarm>> {
  try {
    const raw = await AsyncStorage.getItem(WAKE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveWakeAlarms(map: Record<string, WakeAlarm>): Promise<void> {
  await AsyncStorage.setItem(WAKE_KEY, JSON.stringify(map));
}

async function loadWakeCleared(): Promise<Record<string, true>> {
  try {
    const raw = await AsyncStorage.getItem(WAKE_CLEARED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveWakeCleared(map: Record<string, true>): Promise<void> {
  await AsyncStorage.setItem(WAKE_CLEARED_KEY, JSON.stringify(map));
}

export async function markWakeAlarmCleared(flightKey: string): Promise<void> {
  if (!flightKey) return;
  const map = await loadWakeCleared();
  map[flightKey] = true;
  await saveWakeCleared(map);
}

export async function clearWakeClearedFlag(flightKey: string): Promise<void> {
  if (!flightKey) return;
  const map = await loadWakeCleared();
  if (!map[flightKey]) return;
  delete map[flightKey];
  await saveWakeCleared(map);
}

export async function clearWakeAlarm(flightKey: string, opts?: { rememberClear?: boolean }): Promise<void> {
  const map = await loadWakeAlarms();
  const existing = map[flightKey];
  if (existing?.notificationId && Platform.OS !== 'web') {
    try {
      await Notifications.cancelScheduledNotificationAsync(existing.notificationId);
    } catch {
      /* ignore */
    }
  }
  delete map[flightKey];
  await saveWakeAlarms(map);
  if (opts?.rememberClear !== false) await markWakeAlarmCleared(flightKey);
}

export async function setWakeAlarm(opts: {
  flightKey: string;
  flightNumber: string;
  landAtIso: string;
  minutesBefore: 30 | 45 | 60;
  source?: 'auto' | 'manual';
}): Promise<WakeAlarm | null> {
  const landAt = new Date(opts.landAtIso);
  if (Number.isNaN(landAt.getTime())) return null;
  const fireAt = new Date(landAt.getTime() - opts.minutesBefore * 60_000);
  if (fireAt.getTime() <= Date.now()) return null;

  await clearWakeAlarm(opts.flightKey, { rememberClear: false });
  if (opts.source !== 'auto') await clearWakeClearedFlag(opts.flightKey);

  let notificationId: string | undefined;
  if (Platform.OS !== 'web') {
    try {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: t().wakeAlarmTitle(opts.flightNumber, opts.minutesBefore),
          body: t().wakeAlarmBody,
          sound: true,
          data: buildNotificationData({
            flightNumber: opts.flightNumber,
            kind: 'wake',
            flightKey: opts.flightKey,
            flightId: opts.flightKey,
            targetSection: 'arrival',
          }),
          ...(Platform.OS === 'android' ? { channelId: 'flights' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      });
    } catch {
      return null;
    }
  }

  const alarm: WakeAlarm = {
    flightKey: opts.flightKey,
    flightNumber: opts.flightNumber,
    minutesBefore: opts.minutesBefore,
    landAtIso: opts.landAtIso,
    fireAtIso: fireAt.toISOString(),
    notificationId,
    source: opts.source || 'manual',
  };
  const map = await loadWakeAlarms();
  map[opts.flightKey] = alarm;
  await saveWakeAlarms(map);
  return alarm;
}

export async function ensureLongHaulWakeAlarm(opts: {
  flightKey: string;
  flightNumber: string;
  landAtIso: string;
  durationMs?: number | null;
  isPro: boolean;
}): Promise<{ alarm: WakeAlarm | null; shouldToast: boolean }> {
  if (!opts.isPro || !opts.flightKey || !opts.landAtIso) {
    return { alarm: null, shouldToast: false };
  }
  if ((opts.durationMs ?? 0) <= LONG_HAUL_MS) {
    return { alarm: null, shouldToast: false };
  }
  const nextLand = landAtMs(opts.landAtIso);
  if (nextLand == null) return { alarm: null, shouldToast: false };

  const existing = (await loadWakeAlarms())[opts.flightKey] ?? null;
  if (existing) {
    const prevLand = landAtMs(existing.landAtIso);
    const shifted = prevLand != null && Math.abs(nextLand - prevLand) > ETA_SHIFT_MS;
    if (!shifted) return { alarm: existing, shouldToast: false };
    const next = await setWakeAlarm({
      flightKey: opts.flightKey,
      flightNumber: opts.flightNumber,
      landAtIso: opts.landAtIso,
      minutesBefore: existing.minutesBefore,
      source: existing.source || 'manual',
    });
    return { alarm: next, shouldToast: false };
  }

  const cleared = await loadWakeCleared();
  if (cleared[opts.flightKey]) return { alarm: null, shouldToast: false };

  const next = await setWakeAlarm({
    flightKey: opts.flightKey,
    flightNumber: opts.flightNumber,
    landAtIso: opts.landAtIso,
    minutesBefore: 45,
    source: 'auto',
  });
  const shouldToast = !!next && !autoWakeToasted.has(opts.flightKey);
  if (shouldToast) autoWakeToasted.add(opts.flightKey);
  return { alarm: next, shouldToast };
}
