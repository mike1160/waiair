/** Shared Horizon geometry + plane rules. Empty and tracked home use one component. */

export const EXPANDED_BAND = 156;
export const COLLAPSED_BAND = 28;
/** Sky strip below the status inset on tracked home (~120 px of photo). */
export const TRACKED_SKY_BAND = 120;

export type HorizonBand = 'search' | 'tracked';
export type HorizonPlaneMode = 'cruise' | 'once' | 'off';
export type HorizonPlaneAction = 'cruise' | 'once' | 'hold' | 'hide';

export function horizonTrackedHeight(insetTop: number): number {
  const inset = Number(insetTop);
  return (Number.isFinite(inset) ? Math.max(0, inset) : 0) + TRACKED_SKY_BAND;
}

export function horizonSearchHeight(insetTop: number, collapsed: boolean): number {
  const inset = Number(insetTop);
  const top = Number.isFinite(inset) ? Math.max(0, inset) : 0;
  return top + (collapsed ? COLLAPSED_BAND : EXPANDED_BAND);
}

export function horizonBandHeight(
  insetTop: number,
  band: HorizonBand,
  collapsed: boolean,
): number {
  return band === 'tracked'
    ? horizonTrackedHeight(insetTop)
    : horizonSearchHeight(insetTop, collapsed);
}

/** Tracked home: one crossing on mount only while airborne. */
export function horizonPlaneModeForPhase(phase?: string | null): HorizonPlaneMode {
  return phase === 'in_flight' ? 'once' : 'off';
}

export function resolveHorizonPlaneMode(input: {
  plane?: HorizonPlaneMode;
  band: HorizonBand;
  collapsed: boolean;
}): HorizonPlaneMode {
  // Search/empty home never takes tracked in_flight-once (or plane="off").
  if (input.band !== 'tracked') {
    return input.collapsed ? 'off' : 'cruise';
  }
  return input.plane === 'once' ? 'once' : 'off';
}

/**
 * Empty home: loop while expanded and foregrounded; stop on reduce-motion / background.
 * Tracked: one crossing if armed at mount and not yet consumed; later still (hold), never repeat.
 */
export function horizonPlaneAction(input: {
  mode: HorizonPlaneMode;
  reduced: boolean;
  foreground: boolean;
  onceArmed: boolean;
  onceConsumed: boolean;
}): HorizonPlaneAction {
  if (input.mode === 'cruise') {
    if (input.reduced || !input.foreground) return 'hide';
    return 'cruise';
  }
  if (input.mode === 'once' && input.onceArmed) {
    if (input.onceConsumed) return input.reduced ? 'hide' : 'hold';
    if (input.reduced || !input.foreground) return 'hide';
    return 'once';
  }
  return 'hide';
}
