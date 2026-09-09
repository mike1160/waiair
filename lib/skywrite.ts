/** Once-per-day Horizon skywriting. Pure rules + optional persist. */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const SKYWRITE_KEY = 'waiair.horizon.skywrite.v1';
export const SKYWRITE_DISSOLVE_MS = 4000;
/** Letter height as a fraction of the horizon band. */
export const SKYWRITE_LETTER_BAND = 0.08;
/** Word sits in the middle 70% of the width. */
export const SKYWRITE_WIDTH_SPAN = 0.7;
export const SKYWRITE_WIDTH_MARGIN = (1 - SKYWRITE_WIDTH_SPAN) / 2;
/** Matches Horizon plane top inside the deco layer. */
export const SKYWRITE_PLANE_TOP = 56;
export const SKYWRITE_CLIMB = Math.tan((6 * Math.PI) / 180);
export const SKYWRITE_TRAIL_W = 52;
export const SKYWRITE_TRAIL_STROKE = 1.5;
/** Baseline as a fraction of the viewBox height (Y-down screen coords). */
export const SKYWRITE_BASELINE_FRAC = 16.5 / 20;

/**
 * Single-stroke handwritten WaiAir in screen coordinates (Y down, origin top-left).
 * W starts on the baseline and goes up — a Y-flip would render M.
 */
export const WAIAIR_PATH =
  'M1.8 16.5 L6.2 2.4 L10.8 16.2 L15.4 2.4 L19.8 16.5'
  + ' M28 9.2 C27.6 5.6 23.6 5 21.6 7.8 C19.8 10.4 21.4 16.3 25.6 16.4 C28.6 16.5 30 13.5 30 10 L30 16.5'
  + ' M35.6 16.5 L35.6 8 M35.6 4.2 L35.6 2.8'
  + ' M41 16.5 L47.4 2.2 L53.8 16.5 M43.6 10.6 L51.2 10.6'
  + ' M59.4 16.5 L59.4 8 M59.4 4.2 L59.4 2.8'
  + ' M65.2 16.5 L65.2 7.6 C65.2 4.6 70.4 4.4 73.2 7.6';

export const WAIAIR_VIEWBOX = { w: 76, h: 20 };
/** Approximate stroke length for dash reveal. */
export const WAIAIR_PATH_LEN = 240;

export function skywriteStrokeWidth(letterHeight: number): number {
  const h = Number(letterHeight);
  if (!Number.isFinite(h) || h <= 0) return SKYWRITE_TRAIL_STROKE;
  return SKYWRITE_TRAIL_STROKE * (WAIAIR_VIEWBOX.h / h);
}

/** 0 = nothing written; 1 = complete. Pen is the tail (contrail start), never the nose. */
export function skywriteRevealT(
  planeX: number,
  writeLeft: number,
  writeRight: number,
  trailW = SKYWRITE_TRAIL_W,
): number {
  'worklet';
  const pen = Number(planeX) + trailW;
  const a = Number(writeLeft);
  const b = Number(writeRight);
  if (!(b > a)) return 0;
  if (!(pen > a)) return 0;
  if (pen >= b) return 1;
  return (pen - a) / (b - a);
}

export function skywriteSvgSnapshot(): string {
  const { w, h } = WAIAIR_VIEWBOX;
  const pad = 6;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h + pad * 2}" width="${w * 12}" height="${(h + pad * 2) * 12}">`,
    `<rect width="${w}" height="${h + pad * 2}" fill="#7EB6D9"/>`,
    `<g transform="translate(0 ${pad})">`,
    `<path d="${WAIAIR_PATH}" fill="none" stroke="#0D1B2E" stroke-width="${SKYWRITE_TRAIL_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<line x1="0" y1="${h * SKYWRITE_BASELINE_FRAC}" x2="${w}" y2="${h * SKYWRITE_BASELINE_FRAC}" stroke="#C9A84C" stroke-width="0.2" stroke-dasharray="1 1"/>`,
    `</g>`,
    `</svg>`,
    '',
  ].join('\n');
}

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
  const decoTop = inset + 8;
  const planeTop = decoTop + SKYWRITE_PLANE_TOP;
  const baselineAtLeft = planeTop - x * SKYWRITE_CLIMB;
  const y = baselineAtLeft - height * SKYWRITE_BASELINE_FRAC;
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
