/**
 * Colour and pulse of the clock time on the flight detail legs: the closer the departure, the louder the time.
 * Pure rules only — no React Native imports, so the buckets are unit-tested.
 */

export type ClockPhase = 'scheduled' | 'boarding' | 'departed' | 'landed' | 'cancelled';
export type ClockTone = 'default' | 'amber' | 'red' | 'green';
export type ClockPulse = 'none' | 'subtle' | 'strong';

export const CLOCK_AMBER = '#F5A623';
export const CLOCK_RED = '#E53935';
export const CLOCK_GREEN = '#2E7D32';

/** Amber from 3h out, red inside the last hour. */
export const AMBER_FROM_MIN = 180;
export const RED_FROM_MIN = 60;

export type ClockEmphasis = {
  tone: ClockTone;
  pulse: ClockPulse;
  /** Cancelled: the time is struck through as well. */
  strike: boolean;
};

/**
 * @param minutesUntil minutes until this leg's time; null when unknown (then the time stays default)
 * @param phase where the flight is; boarding and later are green and still
 * @param delayed a new time replaced the scheduled one: amber, however far away it is
 */
export function clockEmphasis(opts: {
  minutesUntil?: number | null;
  phase?: ClockPhase;
  delayed?: boolean;
}): ClockEmphasis {
  const phase = opts.phase || 'scheduled';
  if (phase === 'cancelled') return { tone: 'red', pulse: 'none', strike: true };
  if (phase === 'boarding' || phase === 'departed' || phase === 'landed') {
    return { tone: 'green', pulse: 'none', strike: false };
  }
  const mins = typeof opts.minutesUntil === 'number' && Number.isFinite(opts.minutesUntil)
    ? opts.minutesUntil
    : null;
  const near: ClockPulse = mins == null ? 'none' : mins < RED_FROM_MIN ? 'strong' : mins <= AMBER_FROM_MIN ? 'subtle' : 'none';
  if (opts.delayed) return { tone: 'amber', pulse: near === 'strong' ? 'strong' : 'subtle', strike: false };
  if (mins == null || mins > AMBER_FROM_MIN) return { tone: 'default', pulse: 'none', strike: false };
  if (mins < RED_FROM_MIN) return { tone: 'red', pulse: 'strong', strike: false };
  return { tone: 'amber', pulse: 'subtle', strike: false };
}

/** Tone → colour; 'default' keeps the screen's own text colour. */
export function clockColor(tone: ClockTone, defaultColor: string): string {
  if (tone === 'amber') return CLOCK_AMBER;
  if (tone === 'red') return CLOCK_RED;
  if (tone === 'green') return CLOCK_GREEN;
  return defaultColor;
}

/** Opacity range and duration of the countdown pulse. */
export function pulseTiming(pulse: ClockPulse): { from: number; duration: number } | null {
  if (pulse === 'strong') return { from: 0.45, duration: 700 };
  if (pulse === 'subtle') return { from: 0.7, duration: 1300 };
  return null;
}
