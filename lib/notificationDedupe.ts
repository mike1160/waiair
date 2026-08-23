import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'waiair.notify.sent.v1:';

function slug(flightNumber: string): string {
  return String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Same format in foreground and background: `{flight}-{kind}-{date}`. */
export function notificationDedupeKey(
  flightNumber: string,
  kind: string,
  detail?: string | number,
): string {
  const flight = slug(flightNumber);
  const date = todayKey();
  const extra = detail == null ? '' : String(detail).trim();
  if (kind === 'gate' && extra) return `${flight}-gate-${extra}-${date}`;
  if (kind === 'delay' && extra !== '') return `${flight}-delay-${extra}-${date}`;
  return `${flight}-${kind}-${date}`;
}

function storageKey(dedupeKey: string): string {
  return STORAGE_PREFIX + dedupeKey;
}

export async function hasSentNotification(dedupeKey: string): Promise<boolean> {
  if (!dedupeKey) return false;
  try {
    const raw = await AsyncStorage.getItem(storageKey(dedupeKey));
    return raw != null;
  } catch {
    return false;
  }
}

export async function markSentNotification(dedupeKey: string): Promise<void> {
  if (!dedupeKey) return;
  try {
    await AsyncStorage.setItem(storageKey(dedupeKey), '1');
  } catch { /* ignore */ }
}

/** Allow timeline/gate alerts to fire again after re-tracking the same flight. */
export async function clearNotificationDedupeForFlight(flightNumber: string): Promise<void> {
  const flight = slug(flightNumber);
  if (!flight) return;
  try {
    const prefix = STORAGE_PREFIX + flight + '-';
    const all = await AsyncStorage.getAllKeys();
    const toRemove = all.filter(k => k.startsWith(prefix));
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch { /* ignore */ }
}
