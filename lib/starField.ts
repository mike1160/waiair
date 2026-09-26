/**
 * Deep Space's stars: where the dots sit on the background layer.
 *
 * The positions look random and are not. `Math.random()` at render time would move every star on every
 * re-render — a sky that twitches whenever a clock ticks — so the field comes from a small seeded generator:
 * the same seed always gives the same sky, and the sky is computed once.
 *
 * Positions are fractions of the screen (0–1), because this module knows nothing about how large the screen
 * is. The component multiplies them out.
 *
 * Pure: unit-tested in lib/starField.test.ts.
 */

export interface Star {
  /** 0–1 across the screen. */
  x: number;
  /** 0–1 down the screen. */
  y: number;
  /** Dot diameter in points. */
  size: number;
}

/** How many stars a sky has: enough to read as one, few enough to cost nothing to draw. */
export const STAR_COUNT = 60;
/** The opacity every star is drawn at. */
export const STAR_OPACITY = 0.5;

/**
 * mulberry32: a tiny deterministic generator. Good enough for scattering dots, and it fits in five lines
 * rather than pulling in a dependency for the sake of noise.
 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A field of stars, in reading order of nothing in particular. Sizes vary between 1 and 2.5 points: a sky of
 * identical dots reads as a pattern, and a pattern is the one thing a sky must not look like.
 */
export function starField(count: number = STAR_COUNT, seed: number = 20260926): Star[] {
  const rnd = seeded(seed);
  const n = Math.max(0, Math.floor(count));
  const out: Star[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      x: rnd(),
      y: rnd(),
      size: Math.round((1 + rnd() * 1.5) * 10) / 10,
    });
  }
  return out;
}

/** The one sky the app draws. Computed once at import: it can never differ between two renders. */
export const STARS: Star[] = starField();
