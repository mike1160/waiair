/**
 * Persist late-aircraft warning pushes once per flight per device.
 * Survives app restarts — not in-memory.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateString } from './localFlightTime.ts';

export const LATE_WARNING_PREFIX = 'lateWarning_';
export const LATE_WARNING_VALUE = 'sent';
export const LATE_WARNING_MAX_AGE_MS = 48 * 60 * 60 * 1000;

function slugFlight(flightNumber: string): string {
  return String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
}

export function lateWarningDateYmd(depIso?: string, now = new Date()): string {
  const m = String(depIso || '').match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1] || toLocalDateString(now);
}

/** `lateWarning_{flightNumber}_{date}` */
export function lateWarningStorageKey(flightNumber: string, dateYmd: string): string {
  const flight = slugFlight(flightNumber);
  const date = String(dateYmd || '').slice(0, 10);
  if (!flight || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return `${LATE_WARNING_PREFIX}${flight}_${date}`;
}

export function isExpiredLateWarningKey(key: string, nowMs: number): boolean {
  if (!String(key || '').startsWith(LATE_WARNING_PREFIX)) return false;
  const date = key.slice(key.lastIndexOf('_') + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const ms = Date.parse(`${date}T00:00:00`);
  if (!Number.isFinite(ms)) return false;
  return nowMs - ms > LATE_WARNING_MAX_AGE_MS;
}

export async function hasSentLateWarning(flightNumber: string, dateYmd: string): Promise<boolean> {
  const key = lateWarningStorageKey(flightNumber, dateYmd);
  if (!key) return false;
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === LATE_WARNING_VALUE;
  } catch {
    return false;
  }
}

export async function markLateWarningSent(flightNumber: string, dateYmd: string): Promise<void> {
  const key = lateWarningStorageKey(flightNumber, dateYmd);
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, LATE_WARNING_VALUE);
  } catch { /* ignore */ }
}

/** Drop lateWarning_* keys whose flight date is older than 48 hours. */
export async function pruneLateWarningKeys(nowMs = Date.now()): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter(k => isExpiredLateWarningKey(k, nowMs));
    if (stale.length) await AsyncStorage.multiRemove(stale);
  } catch { /* ignore */ }
}

let pruneQueued = false;
const inflight = new Set<string>();

/** Once-per-process prune; the flags themselves always live in AsyncStorage. */
export function scheduleLateWarningPrune(): void {
  if (pruneQueued) return;
  pruneQueued = true;
  void pruneLateWarningKeys();
}

/**
 * Persist the sent flag first, then the caller may push.
 * Returns false if this device already warned for this flight+date.
 */
export async function takeLateWarningSendSlot(flightNumber: string, dateYmd: string): Promise<boolean> {
  scheduleLateWarningPrune();
  const key = lateWarningStorageKey(flightNumber, dateYmd);
  if (!key) return false;
  if (inflight.has(key)) return false;
  inflight.add(key);
  try {
    if (await hasSentLateWarning(flightNumber, dateYmd)) return false;
    await markLateWarningSent(flightNumber, dateYmd);
    return true;
  } catch {
    return false;
  } finally {
    inflight.delete(key);
  }
}
