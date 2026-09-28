/**
 * Which leg of a flight number is the one being tracked [W/2].
 *
 * A number like BR75 flies TPE → BKK → AMS, and AeroDataBox answers with each leg as its own flight. The home
 * search has always known what to do with that: lib/flightLegs.ts journeyRows merges the journey onto the
 * traveller's own airport, so searching BR75 from Bangkok offers one row, BKK → AMS, arriving in Amsterdam.
 *
 * Adding the same flight *by number* — the quick lookup, a deep link, a scanned boarding pass, a Gmail import —
 * skipped all of that. It sorted the raw legs by how close their departure was to now and took the nearest one,
 * treating the two halves of one journey as two competing rotations of the same number. Add BR75 in the morning
 * and the card showed TPE → BKK: a flight from Taipei that the traveller was not on, with the wrong departure,
 * the wrong destination and a countdown to somebody else's take-off.
 *
 * So the merge happens first and the nearest-in-time pick runs over the merged rows. The two add paths now agree
 * with each other, because they run the same function over the same legs.
 *
 * The time comparison is deliberately unchanged: raw `scheduledTime`, the same field and the same arithmetic as
 * before, so nothing about picking between genuine rotations of a single-leg number moves.
 *
 * Pure, and unit-tested in lib/trackLegPick.test.ts.
 */

import { journeyRows, type JourneyRowMeta, type LegFields } from './flightLegs.ts';

export type TrackLegCandidate = LegFields & { scheduledTime?: string };

function scheduledMs(f: TrackLegCandidate): number {
  return new Date(f.scheduledTime || 0).getTime();
}

/** The legs to choose from: journeys merged onto `originIata`, or every leg when none departs from there. */
export function trackLegRows<T extends TrackLegCandidate>(
  hits: readonly T[],
  originIata?: string | null,
): Array<T & JourneyRowMeta> {
  return journeyRows(hits, originIata || '');
}

/**
 * The leg to track.
 *
 * `originIata` is where the traveller boards, as well as the app knows it: a scanned boarding pass says so
 * outright, and otherwise it is their own airport — which the app always has, since it falls back to Bangkok.
 * Nothing is invented from it; a journey that does not touch that airport is left as its separate legs, exactly
 * as the search leaves it.
 *
 * `dateIso` (YYYY-MM-DD) prefers that day's departure, then the nearest to it. Without one the nearest to `nowMs`
 * wins, which is what an unqualified "track BR75" means.
 */
export function pickTrackLeg<T extends TrackLegCandidate>(
  hits: readonly T[],
  opts: { originIata?: string | null; dateIso?: string; nowMs?: number } = {},
): (T & JourneyRowMeta) | undefined {
  const rows = trackLegRows(hits, opts.originIata);
  if (!rows.length) return undefined;
  const nearest = (target: number) => [...rows].sort(
    (a, b) => Math.abs(scheduledMs(a) - target) - Math.abs(scheduledMs(b) - target),
  )[0];
  if (opts.dateIso) {
    const exact = rows.find(r => String(r.scheduledTime || '').startsWith(opts.dateIso as string));
    if (exact) return exact;
    return nearest(new Date(`${opts.dateIso}T12:00:00Z`).getTime());
  }
  return nearest(opts.nowMs ?? Date.now());
}
