/**
 * The five modes behind the home screen's MODE button, on top of the existing theme system.
 * Day and Night are the user's own light and dark themes; Airport, Kids and Blackout are themes of their own.
 * Pure — no React Native imports — so the mapping, the kids phase ladder and the flip steps are unit-tested.
 */

export type AppMode = 'day' | 'night' | 'airport' | 'kids' | 'blackout';

export const APP_MODES: AppMode[] = ['day', 'night', 'airport', 'kids', 'blackout'];

export const MODE_EMOJI: Record<AppMode, string> = {
  day: '☀️',
  night: '🌙',
  airport: '✈️',
  kids: '👶',
  blackout: '⬛',
};

/** Themes that are a mode of their own, not a light or dark theme the user picked. */
export const MODE_THEMES = ['airport', 'kids', 'blackout'] as const;
export type ModeThemeId = typeof MODE_THEMES[number];

export function isModeTheme(themeId: string | null | undefined): themeId is ModeThemeId {
  return themeId === 'airport' || themeId === 'kids' || themeId === 'blackout';
}

/** The mode a theme belongs to, for the MODE button's emoji and the checked row in the sheet. */
export function modeForTheme(themeId: string | null | undefined, isDark: boolean): AppMode {
  if (themeId === 'airport') return 'airport';
  if (themeId === 'kids') return 'kids';
  if (themeId === 'blackout') return 'blackout';
  return isDark ? 'night' : 'day';
}

/**
 * The theme a mode switches to. Day and Night go back to the user's own last light or dark theme — someone on
 * Gold or Spotter keeps it — and fall back to Day and Classic when there is none yet.
 */
export function themeForMode(
  mode: AppMode,
  last: { light?: string | null; dark?: string | null } = {},
): string {
  if (mode === 'airport') return 'airport';
  if (mode === 'kids') return 'kids';
  if (mode === 'blackout') return 'blackout';
  const remembered = mode === 'day' ? last.light : last.dark;
  if (remembered && !isModeTheme(remembered)) return remembered;
  return mode === 'day' ? 'day' : 'classic';
}

// ---------- Kids mode: the phase card ladder ----------

export type KidsPhaseKey =
  | 'kids_phase_tomorrow'
  | 'kids_phase_pack'
  | 'kids_phase_almost'
  | 'kids_phase_to_airport'
  | 'kids_phase_soon'
  | 'kids_phase_boarding'
  | 'kids_phase_inflight'
  | 'kids_phase_landed';

export type KidsFlightPhase = 'scheduled' | 'boarding' | 'inflight' | 'landed' | 'cancelled';

/**
 * The kid-friendly line for where the trip is. Flight phase wins over the clock (boarding, flying, landed);
 * before that the minutes to departure pick the step. Null for a cancelled flight or an unknown time.
 */
export function kidsPhaseKey(input: {
  phase: KidsFlightPhase;
  minutesToDeparture: number | null | undefined;
}): KidsPhaseKey | null {
  if (input.phase === 'cancelled') return null;
  if (input.phase === 'landed') return 'kids_phase_landed';
  if (input.phase === 'inflight') return 'kids_phase_inflight';
  if (input.phase === 'boarding') return 'kids_phase_boarding';
  const m = input.minutesToDeparture;
  if (typeof m !== 'number' || !Number.isFinite(m)) return null;
  if (m > 24 * 60) return 'kids_phase_tomorrow';
  if (m > 12 * 60) return 'kids_phase_pack';
  if (m > 3 * 60) return 'kids_phase_almost';
  if (m > 60) return 'kids_phase_to_airport';
  return 'kids_phase_soon';
}

// ---------- Airport mode: the split-flap flip ----------

export const FLIP_STAGGER_MS = 40;
export const FLIP_HALF_MS = 80;

/**
 * Which characters of a split-flap value turn over when it changes from `prev` to `next`.
 * Both are padded to the same width with spaces, so a shorter value still clears the old characters.
 */
export function flipCells(prev: string, next: string): Array<{ from: string; to: string; flips: boolean }> {
  const a = String(prev ?? '');
  const b = String(next ?? '');
  const width = Math.max(a.length, b.length);
  const cells: Array<{ from: string; to: string; flips: boolean }> = [];
  for (let i = 0; i < width; i += 1) {
    const from = a[i] ?? ' ';
    const to = b[i] ?? ' ';
    cells.push({ from, to, flips: from !== to });
  }
  return cells;
}

/** How long a whole value takes to settle: the last flipping cell's delay plus its two halves. */
export function flipDurationMs(prev: string, next: string): number {
  const cells = flipCells(prev, next);
  let last = -1;
  cells.forEach((c, i) => { if (c.flips) last = i; });
  return last < 0 ? 0 : last * FLIP_STAGGER_MS + 2 * FLIP_HALF_MS;
}
