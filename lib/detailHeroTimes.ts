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

/**
 * What the departure station says, once and for all [B18].
 *
 * A departure that was late stays late. The old rule read only `delayed`, which is deliberately false from
 * the moment a flight is airborne — right for a countdown, wrong for a station label — and nothing else was
 * consulted, so a flight that pushed back forty minutes behind schedule landed still wearing a green
 * "On time" for its departure. The arrival is the status that freezes on landing; the departure is history
 * by then, and history does not improve.
 *
 * So the clock decides: scheduled against what actually happened. `offsetMin` is that difference in minutes,
 * positive when late, and it outlives the phase it was measured in.
 */
export function departureStationStatus(opts: {
  /** The live "running late" flag, which is only meaningful before departure. */
  delayed: boolean;
  cancelled: boolean;
  /** Actual departure minus scheduled, in minutes. Null when one of the two is unknown. */
  offsetMin?: number | null;
  /** Still counting down to departure, as opposed to already gone. */
  counting: boolean;
}): 'onTime' | 'delayed' | null {
  if (opts.cancelled) return null;
  const late = opts.offsetMin != null && opts.offsetMin > 0;
  if (showStationOnTime({ delayed: opts.delayed || late, cancelled: false, offsetMin: opts.offsetMin })) {
    return 'onTime';
  }
  // Late by the clock says so whatever the phase; the live flag only has standing before the wheels are up.
  if (late || (opts.delayed && opts.counting)) return 'delayed';
  return null;
}

/** Gold rail only while boarding / gate closing / last call. */
export function phaseRailUsesGold(visual: string | null | undefined): boolean {
  const v = String(visual || '').toLowerCase();
  return v === 'open' || v === 'closing' || v === 'lastcall' || v === 'last-call' || v === 'last_call';
}
