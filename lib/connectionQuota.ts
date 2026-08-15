import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'waiair.connQuota.v1';
export const FREE_CONN_PER_DAY = 2;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function connectionChecksUsed(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed?.day !== todayKey()) return 0;
    return Number(parsed.count) || 0;
  } catch {
    return 0;
  }
}

export async function canCheckConnection(isPro: boolean): Promise<{ ok: boolean; used: number; limit: number }> {
  if (isPro) return { ok: true, used: 0, limit: Infinity };
  const used = await connectionChecksUsed();
  return { ok: used < FREE_CONN_PER_DAY, used, limit: FREE_CONN_PER_DAY };
}

export async function recordConnectionCheck(isPro: boolean): Promise<void> {
  if (isPro) return;
  const used = await connectionChecksUsed();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ day: todayKey(), count: used + 1 }));
  } catch { /* ignore */ }
}

const LAST_RESULT_KEY = 'waiair.lastConnResult.v1';

export async function saveLastConnectionResult(result: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
  } catch { /* ignore */ }
}

export async function loadLastConnectionResult<T = unknown>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
