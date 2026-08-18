import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'waiair.fx.history.v1.';
const MAX_DAYS = 30;
const MIN_SAMPLES = 3;

type FxSample = { date: string; rate: number };

function historyKey(destCode: string): string {
  return `${KEY_PREFIX}${destCode}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordFxRate(destCode: string, usdToDest: number | null | undefined): Promise<void> {
  const code = String(destCode || '').trim().toUpperCase();
  const rate = Number(usdToDest);
  if (!code || !Number.isFinite(rate) || rate <= 0) return;

  const key = historyKey(code);
  const day = todayKey();
  let samples: FxSample[] = [];
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) samples = parsed.filter(s => s?.date && Number.isFinite(s.rate));
    }
  } catch { /* reset */ }

  const idx = samples.findIndex(s => s.date === day);
  if (idx >= 0) samples[idx] = { date: day, rate };
  else samples.push({ date: day, rate });

  samples.sort((a, b) => a.date.localeCompare(b.date));
  if (samples.length > MAX_DAYS) samples = samples.slice(-MAX_DAYS);

  await AsyncStorage.setItem(key, JSON.stringify(samples)).catch(() => {});
}

export async function getFxAverage(destCode: string): Promise<number | null> {
  const code = String(destCode || '').trim().toUpperCase();
  if (!code) return null;
  try {
    const raw = await AsyncStorage.getItem(historyKey(code));
    if (!raw) return null;
    const samples: FxSample[] = JSON.parse(raw);
    if (!Array.isArray(samples) || samples.length < MIN_SAMPLES) return null;
    const rates = samples.map(s => s.rate).filter(r => Number.isFinite(r) && r > 0);
    if (rates.length < MIN_SAMPLES) return null;
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  } catch {
    return null;
  }
}

export function isFavorableFxRate(current: number, average: number, thresholdPct = 1.5): boolean {
  if (!Number.isFinite(current) || !Number.isFinite(average) || average <= 0) return false;
  return ((current - average) / average) * 100 >= thresholdPct;
}

export function fxPctAboveAverage(current: number, average: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(average) || average <= 0) return 0;
  return Math.round(((current - average) / average) * 1000) / 10;
}
