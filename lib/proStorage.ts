import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
};

const WAKE_KEY = 'waiair.wakeAlarms.v1';
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

export async function clearWakeAlarm(flightKey: string): Promise<void> {
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
}

export async function setWakeAlarm(opts: {
  flightKey: string;
  flightNumber: string;
  landAtIso: string;
  minutesBefore: 30 | 45 | 60;
}): Promise<WakeAlarm | null> {
  const landAt = new Date(opts.landAtIso);
  if (Number.isNaN(landAt.getTime())) return null;
  const fireAt = new Date(landAt.getTime() - opts.minutesBefore * 60_000);
  if (fireAt.getTime() <= Date.now()) return null;

  await clearWakeAlarm(opts.flightKey);

  let notificationId: string | undefined;
  if (Platform.OS !== 'web') {
    try {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `✈️ ${opts.flightNumber} lands in ${opts.minutesBefore} minutes`,
          body: 'Time to freshen up',
          sound: true,
          data: { kind: 'wake', flightNumber: opts.flightNumber },
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
  };
  const map = await loadWakeAlarms();
  map[opts.flightKey] = alarm;
  await saveWakeAlarms(map);
  return alarm;
}
