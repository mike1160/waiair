/** Pure empty-home “alive” helpers: heading, dummy live line, sky decorations. */

export type HomeSkyImage = 'dawn' | 'day' | 'dusk' | 'night';

export const HOME_LIVE_SWITCH_HOUR = 18;
export const HOME_LIVE_MIN_COUNT = 3;
/** Crossing duration stays ~9 s. */
export const HOME_EMPTY_PLANE_MS = 9000;
/** Gap between empty-home cruise passes (~2.5 min). Tracked `once` does not use this. */
export const HOME_EMPTY_CRUISE_GAP_MS = 150_000;
export const HOME_EMPTY_STAR_COUNT = 36;
export const HOME_EMPTY_TWINKLE_COUNT = 3;
export const HOME_EMPTY_BRIGHT_COUNT = 5;

const SYNODIC_DAYS = 29.530588853;
/** NASA-style new moon: 2000-01-06 18:14 UTC. */
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

export type HomeEmptyHeadingKey = 'homeWhereToToday' | 'homeWhereToTonight';
export type HomeLiveWhenKey = 'homeLiveToday' | 'homeLiveTonight';

export type HomeStar = {
  x: number;
  y: number;
  /** Diameter in px (1–1.6). */
  size: number;
  twinkle: boolean;
  bright: boolean;
};

export type MoonPhase = {
  ageDays: number;
  illumination: number;
  waxing: boolean;
};

export const HOME_LIVE_DUMMY = {
  originIata: 'BKK',
  originCity: 'Bangkok',
  destIata: 'HND',
  destCity: 'Tokyo',
  count: 41,
  time: '22:35',
} as const;

export const HOME_LIVE_DUMMY_FLIGHT = {
  number: 'TG676',
  origin: 'BKK',
  destination: 'HND',
  originCity: 'Bangkok',
  destCity: 'Tokyo',
  scheduledTime: '22:35',
} as const;

function hourNorm(hourLocal: number): number {
  const h = Math.floor(Number(hourLocal));
  if (!Number.isFinite(h)) return 0;
  return ((h % 24) + 24) % 24;
}

export function homeEmptyHeadingKey(hourLocal: number): HomeEmptyHeadingKey {
  return hourNorm(hourLocal) >= HOME_LIVE_SWITCH_HOUR ? 'homeWhereToTonight' : 'homeWhereToToday';
}

export function homeLiveWhenKey(hourLocal: number): HomeLiveWhenKey {
  return hourNorm(hourLocal) >= HOME_LIVE_SWITCH_HOUR ? 'homeLiveTonight' : 'homeLiveToday';
}

export type HomeLiveLineKind = 'full' | 'next' | 'hide';

/** Count below 3 never prints a count; 0 or no next destination/time hides the line. */
export function homeLiveLineKind(count: number, dest: string, time: string): HomeLiveLineKind {
  const d = String(dest || '').trim();
  const tm = String(time || '').trim();
  if (!d || !tm) return 'hide';
  const n = Number(count);
  if (!Number.isFinite(n) || n < 1) return 'hide';
  if (n < HOME_LIVE_MIN_COUNT) return 'next';
  return 'full';
}

export function formatHomeLiveLine(input: {
  hour: number;
  count: number;
  city: string;
  dest: string;
  time: string;
  today: string;
  tonight: string;
  board: (when: string, city: string, n: number, dest: string, time: string) => string;
  nextOnly: (dest: string, time: string) => string;
}): string | null {
  const kind = homeLiveLineKind(input.count, input.dest, input.time);
  if (kind === 'hide') return null;
  const dest = String(input.dest).trim();
  const time = String(input.time).trim();
  if (kind === 'next') return input.nextOnly(dest, time);
  const when = hourNorm(input.hour) >= HOME_LIVE_SWITCH_HOUR ? input.tonight : input.today;
  return input.board(when, input.city, input.count, dest, time);
}

export function homeEmptyShowStars(image: HomeSkyImage): boolean {
  return image === 'night';
}

export function homeEmptyShowMoon(image: HomeSkyImage): boolean {
  return image === 'night';
}

export function homeEmptyShowGlow(image: HomeSkyImage): boolean {
  return image === 'night' || image === 'dusk';
}

export function homeEmptyShowCloud(image: HomeSkyImage): boolean {
  return image === 'day';
}

export function moonPhase(at: Date | number = Date.now()): MoonPhase {
  const ms = typeof at === 'number' ? at : at.getTime();
  const days = (ms - KNOWN_NEW_MOON_MS) / 86_400_000;
  const ageDays = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const illumination = (1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC_DAYS)) / 2;
  return {
    ageDays,
    illumination,
    waxing: ageDays < SYNODIC_DAYS / 2,
  };
}

/** Horizontal shift of the covering disk (overlapping-circles crescent).
 *  0 = new (fully covered); 2r = full (covering disk just off the face). */
export function moonShadowDx(illumination: number, waxing: boolean, radius: number): number {
  const t = Math.min(1, Math.max(0, Number(illumination)));
  const mag = t * 2 * radius;
  if (mag === 0) return 0;
  return waxing ? -mag : mag;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function homeEmptyStarSeed(ymd: string): number {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 1;
  return (Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3])) >>> 0;
}

export function homeEmptyStars(seed: number, count = HOME_EMPTY_STAR_COUNT): HomeStar[] {
  const n = Math.max(0, Math.floor(count));
  const rand = mulberry32(seed >>> 0);
  const twinkleAt = new Set<number>();
  while (twinkleAt.size < Math.min(HOME_EMPTY_TWINKLE_COUNT, n)) {
    twinkleAt.add(Math.floor(rand() * n));
  }
  const brightAt = new Set<number>();
  while (brightAt.size < Math.min(HOME_EMPTY_BRIGHT_COUNT, n)) {
    brightAt.add(Math.floor(rand() * n));
  }
  const out: HomeStar[] = [];
  for (let i = 0; i < n; i++) {
    const bright = brightAt.has(i);
    out.push({
      x: rand(),
      /** Skewed high in the band — few stars near the cream fade. */
      y: Math.pow(rand(), 1.65) * 0.38,
      size: bright ? 1.6 : 1 + rand() * 0.45,
      twinkle: twinkleAt.has(i),
      bright,
    });
  }
  return out;
}
