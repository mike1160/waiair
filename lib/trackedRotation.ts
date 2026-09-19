/**
 * Which rotation of a flight number a tracked flight is. A number like TG208 flies every day, and a refresh can
 * return yesterday's leg; without an anchor the nearest-time match took it and the tracked flight jumped a day.
 * The anchor is the scheduled departure at the moment tracking started, kept for good; a live row whose own
 * scheduled departure is more than 12 hours from it is another day's flight and is ignored.
 */
import { flightClockUtcMs, type FlightClockFields } from './flightTimes.ts';

/** Same flight number, another day: at least ~24 h apart, so 12 h leaves room for any schedule change. */
export const ROTATION_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * The scheduled departure of this rotation (epoch ms), or null when the row has none. The schedule, not the
 * estimate, so a long delay stays the same rotation. `scheduledTime` counts only on departure-board rows: the
 * flight-number rows switch it to the arrival once landed, and arrival boards always hold the arrival there.
 */
export function scheduledDepartureMs(f: FlightClockFields): number | null {
  const onDepartureBoard = f.boardSide === 'departure' || !f.boardSide;
  const iso = f.scheduledDeparture || (onDepartureBoard ? f.scheduledTime : '') || f.departureTime || '';
  if (!iso) return null;
  const ms = flightClockUtcMs(iso, f.origin, f.originCountry);
  return ms != null && Number.isFinite(ms) ? ms : null;
}

/** Whether a live row can be the tracked rotation. No anchor, or no departure on the row: as before, yes. */
export function isTrackedRotation(candidate: FlightClockFields, trackedDepMs?: number | null): boolean {
  if (trackedDepMs == null || !Number.isFinite(trackedDepMs)) return true;
  const ms = scheduledDepartureMs(candidate);
  if (ms == null) return true;
  return Math.abs(ms - trackedDepMs) <= ROTATION_WINDOW_MS;
}

type Tracked = { flightNumber: string; scheduledTime: string; trackedDepMs?: number };
type Row = FlightClockFields & { number: string; scheduledTime: string };

/**
 * The live row for a tracked flight: same number and the tracked rotation, then the exact scheduled time, else
 * the nearest. Undefined when none qualifies — the caller then keeps the previous data.
 */
export function matchTrackedRotation<F extends Row>(
  tracked: Tracked,
  hits: F[],
  slug: (n: string) => string,
): F | undefined {
  const same = hits.filter(h => slug(h.number) === slug(tracked.flightNumber) && isTrackedRotation(h, tracked.trackedDepMs));
  if (!same.length) return undefined;
  const exact = same.find(h => h.scheduledTime === tracked.scheduledTime);
  if (exact) return exact;
  const t = new Date(tracked.scheduledTime).getTime() || 0;
  return [...same].sort((a, b) =>
    Math.abs(new Date(a.scheduledTime).getTime() - t) - Math.abs(new Date(b.scheduledTime).getTime() - t),
  )[0];
}
