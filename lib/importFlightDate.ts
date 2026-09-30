/**
 * Which day is this confirmation for? [W/11]
 *
 * Importing a months-old KLM confirmation tracked *today's* KL844 and presented it as the traveller's own
 * flight, mid-air. Two things were wrong, and the second is the one worth naming:
 *
 *   addTrackByNumber looked the flight up with no date at all, so the proxy answered with flights around
 *   today, and the date from the mail was only used to pick among those. Its no-exact-match branch takes
 *   whichever is nearest to that date — out of today's rotations, that is today's flight.
 *
 *   And there was no such thing as "I do not know the date". A candidate whose date failed to parse simply
 *   arrived with dateIso undefined, and undefined meant nearest-to-now, which means today. The absence of
 *   a fact was silently read as a fact.
 *
 * So a date now has three possible verdicts, and only one of them is trackable. A confirmation that cannot
 * be placed on a plausible day is skipped and *says so* — "already flown", "date unclear" — rather than
 * being quietly dropped (which is what the old `dateIso < today` filter did) or quietly guessed at.
 *
 * The tolerance exists because airlines move flights. A confirmation for the 4th whose flight now departs on
 * the 6th is still that traveller's flight; the same number a month later is not. Seven days is deliberately
 * generous — weather, strikes and operational changes shift real flights by days — while still being far
 * narrower than the monthly rotation it has to reject.
 *
 * Pure, and unit-tested in lib/importFlightDate.test.ts.
 */

/** How far a resolved flight may sit from the date the confirmation claimed. */
export const IMPORT_DATE_TOLERANCE_DAYS = 7;

/**
 * How far in the past a confirmation may be dated and still be worth tracking.
 *
 * Not zero: a flight that departed yesterday may still be in the air, or its bags still on the belt, and
 * the trip is not over the instant the clock passes midnight at the origin.
 *
 * The caller stacks with this on purpose: App.tsx passes yesterday as `todayIso`, so the window in the app
 * is about two days rather than one. Kept as it is — leniency here offers a trip that may be over, while the
 * other direction hides one that is not.
 */
export const IMPORT_PAST_GRACE_DAYS = 1;

export type ImportDateVerdict =
  /** A real date, recent enough to be somebody's upcoming or current trip. */
  | 'ok'
  /** A real date, long enough ago that this trip is over. */
  | 'flown'
  /** No date, or nothing that reads as one. Never treated as today. */
  | 'unclear';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A YYYY-MM-DD as a UTC day number, or null when it is not a date at all. */
export function dayNumber(iso: string | null | undefined): number | null {
  const m = String(iso || '').slice(0, 10).match(YMD);
  if (!m) return null;
  const [, y, mo, d] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  if (!Number.isFinite(ms)) return null;
  // Round-trip check, so 2026-02-31 is not silently read as 3 March.
  const back = new Date(ms);
  if (back.getUTCMonth() !== Number(mo) - 1 || back.getUTCDate() !== Number(d)) return null;
  return Math.round(ms / 86400000);
}

/** Whole days between two YYYY-MM-DD dates, or null when either is not a date. */
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  const x = dayNumber(a);
  const y = dayNumber(b);
  return x == null || y == null ? null : y - x;
}

/**
 * What to do with a confirmation dated `dateIso`, today being `todayIso`.
 *
 * `unclear` covers both a missing date and an unparseable one: the distinction does not change what the app
 * can do about it, which is nothing except say so.
 */
export function importDateVerdict(opts: {
  dateIso?: string | null;
  todayIso: string;
  graceDays?: number;
}): ImportDateVerdict {
  const grace = opts.graceDays ?? IMPORT_PAST_GRACE_DAYS;
  const diff = daysBetween(opts.todayIso, opts.dateIso);
  if (diff == null) return 'unclear';
  return diff < -grace ? 'flown' : 'ok';
}

/**
 * Is the flight the lookup resolved actually the one the confirmation was about?
 *
 * `flightIso` is whatever the flight data gives for its departure — a full timestamp or a bare date, so only
 * the first ten characters are read. An unreadable one is *not* treated as a match: this check exists to
 * refuse a flight that cannot be shown to be the right one.
 */
export function flightDateWithinTolerance(
  dateIso: string | null | undefined,
  flightIso: string | null | undefined,
  toleranceDays: number = IMPORT_DATE_TOLERANCE_DAYS,
): boolean {
  const diff = daysBetween(dateIso, flightIso);
  if (diff == null) return false;
  return Math.abs(diff) <= Math.max(0, toleranceDays);
}

/**
 * The verdict on a flight that was looked up for a dated confirmation: 'ok', or why it must not be tracked.
 *
 * A confirmation with no usable date never gets this far — it is `unclear` before any lookup happens — so
 * the only failure here is a lookup that answered with a different month's rotation of the same number.
 */
export function resolvedFlightVerdict(opts: {
  dateIso?: string | null;
  flightIso?: string | null;
  toleranceDays?: number;
}): 'ok' | 'unclear' {
  if (!opts.dateIso) return 'ok';
  return flightDateWithinTolerance(opts.dateIso, opts.flightIso, opts.toleranceDays) ? 'ok' : 'unclear';
}
