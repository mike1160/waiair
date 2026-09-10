/** Detail-card hero clocks: navy ink, never green. Red only cancelled/diverted. */

import { isCancelledOrDivertedStatus } from './homeNow.ts';
import { PALETTE_TOKENS, type PaletteMode } from './themeTokens.ts';

export type DetailHeroKind = 'countdown' | 'departed' | 'landed' | 'cancelled';

const DEPARTED_PHASES = new Set(['departed', 'enRoute', 'en-route', 'landed']);

export function detailHeroColor(status: string, mode: PaletteMode, ink: string): string {
  if (isCancelledOrDivertedStatus(status)) return PALETTE_TOKENS[mode].statusRed;
  return ink;
}

export function detailOnTimeGreen(mode: PaletteMode): string {
  return PALETTE_TOKENS[mode].statusGreen;
}

export function detailGold(mode: PaletteMode): string {
  return PALETTE_TOKENS[mode].gold;
}

export function detailDepHeroKind(opts: {
  status: string;
  livePhase: string;
  hasLanded: boolean;
}): DetailHeroKind {
  if (isCancelledOrDivertedStatus(opts.status) || opts.livePhase === 'cancelled') return 'cancelled';
  if (opts.hasLanded || DEPARTED_PHASES.has(opts.livePhase)) return 'departed';
  return 'countdown';
}

export function detailArrHeroKind(opts: {
  status: string;
  livePhase: string;
  hasLanded: boolean;
}): DetailHeroKind {
  if (isCancelledOrDivertedStatus(opts.status) || opts.livePhase === 'cancelled') return 'cancelled';
  if (opts.hasLanded || opts.livePhase === 'landed') return 'landed';
  return 'countdown';
}

/** Small green “On time” once per station — never on the hero, never when delayed. */
export function showStationOnTime(opts: {
  delayed: boolean;
  cancelled: boolean;
  offsetMin?: number | null;
}): boolean {
  if (opts.cancelled || opts.delayed) return false;
  if (opts.offsetMin != null && opts.offsetMin > 0) return false;
  return true;
}

/** Gold rail only while boarding / gate closing / last call. */
export function phaseRailUsesGold(visual: string | null | undefined): boolean {
  const v = String(visual || '').toLowerCase();
  return v === 'open' || v === 'closing' || v === 'lastcall' || v === 'last-call' || v === 'last_call';
}
