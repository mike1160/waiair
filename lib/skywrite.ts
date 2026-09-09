/** Once-per-day Horizon skywriting. Pure rules + optional persist. */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const SKYWRITE_KEY = 'waiair.horizon.skywrite.v1';
export const SKYWRITE_DISSOLVE_MS = 4000;
/** Letter height as a fraction of the horizon band. */
export const SKYWRITE_LETTER_BAND = 0.075;
/** Word sits in the middle 70% of the width. */
export const SKYWRITE_WIDTH_SPAN = 0.7;
export const SKYWRITE_WIDTH_MARGIN = (1 - SKYWRITE_WIDTH_SPAN) / 2;

/** Thin stroke "WaiAir" in a 76×20 box — no fill, no logo mark. */
export const WAIAIR_PATH =
  'M2 18 L2 2 L8 14 L14 2 L14 18'
  + ' M20 18 L20 8 C20 4.2 23.5 3 26.5 5.4 C29.5 7.8 29.8 12.2 26.8 15.2 C24 18 20 17.6 20 13.5'
  + ' M34 18 L34 7.2 M34 3.4 L34 2'
  + ' M40 18 L46 2 L52 18 M42.4 12.2 L49.6 12.2'
  + ' M58 18 L58 7.2 M58 3.4 L58 2'
  + ' M64 18 L64 8 C64 4.2 67.8 3.2 71.2 5.8 L71.2 18 M71.2 10.4 L67.4 10.4';

export const WAIAIR_VIEWBOX = { w: 76, h: 20 };
/** Approximate stroke length for dash reveal. */
export const WAIAIR_PATH_LEN = 260;

let claimedYmd: string | null = null;
const resetListeners = new Set<() => void>();

export function localYmd(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function skywriteDue(storedYmd: string | null | undefined, todayYmd: string): boolean {
  return String(storedYmd || '') !== String(todayYmd || '');
}

export function peekSkywriteYmd(): string | null {
  return claimedYmd;
}

export function hydrateSkywriteFromStored(stored: string | null | undefined): void {
  const s = String(stored || '').trim().slice(0, 10);
  if (s) claimedYmd = s;
}

export function claimSkywrite(todayYmd: string): boolean {
  const today = String(todayYmd || '').slice(0, 10);
  if (!today) return false;
  if (claimedYmd === today) return false;
  claimedYmd = today;
  return true;
}

export function resetSkywriteMemory(): void {
  claimedYmd = null;
}

export function skywriteShouldRun(input: {
  due: boolean;
  reduced: boolean;
  foreground: boolean;
  expanded: boolean;
  crossingStartsNow: boolean;
  afterMount: boolean;
  width?: number;
}): boolean {
  if (!input.due || input.reduced || !input.foreground || !input.expanded) return false;
  if (!input.crossingStartsNow || !input.afterMount) return false;
  if (input.width != null && !(input.width > 40)) return false;
  return true;
}

export function skywriteLetterHeight(bandH: number): number {
  const h = Number(bandH);
  return (Number.isFinite(h) ? Math.max(0, h) : 0) * SKYWRITE_LETTER_BAND;
}

export function skywriteFrame(width: number, bandH: number, insetTop: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const w = Math.max(1, Number(width) || 0);
  const band = Math.max(1, Number(bandH) || 0);
  const inset = Math.max(0, Number(insetTop) || 0);
  const height = Math.max(4, skywriteLetterHeight(band));
  const boxW = Math.max(1, w * SKYWRITE_WIDTH_SPAN);
  const x = w * SKYWRITE_WIDTH_MARGIN;
  const minY = inset + 36;
  const preferred = inset + 8 + 56 - height / 2;
  const maxY = Math.max(minY, band - height - 12);
  const y = Math.min(maxY, Math.max(minY, preferred));
  return { x, y, width: boxW, height };
}

export function onSkywriteReset(fn: () => void): () => void {
  resetListeners.add(fn);
  return () => { resetListeners.delete(fn); };
}

export async function hydrateSkywrite(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SKYWRITE_KEY);
    hydrateSkywriteFromStored(raw);
  } catch {
    /* ignore */
  }
}

export async function persistSkywrite(todayYmd: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SKYWRITE_KEY, String(todayYmd || '').slice(0, 10));
  } catch {
    /* ignore */
  }
}

/** __DEV__ long-press on the greeting sky picker. Next crossing may write again. */
export async function resetSkywriteForDev(): Promise<void> {
  resetSkywriteMemory();
  try {
    await AsyncStorage.removeItem(SKYWRITE_KEY);
  } catch {
    /* ignore */
  }
  resetListeners.forEach(fn => fn());
}
