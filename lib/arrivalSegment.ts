/**
 * "Or are you arriving here?" — the other half of the multi-leg question [W/3].
 *
 * A number like BR75 flies TPE → BKK → AMS, and the app merges that journey onto the traveller's own airport
 * (lib/flightLegs.ts chooseLeg, and lib/trackLegPick.ts on the add-by-number path). From Bangkok that gives
 * BKK → AMS, which is right for someone flying out. It is wrong for the other traveller on the same number:
 * the one whose trip *ends* in Bangkok, arriving from Taipei. Both people type BR75, both have BKK as their
 * airport, and nothing in the data separates them — so the app picks the departure reading and asks about the
 * other one instead of guessing twice.
 *
 * This is the mirror of lib/boardingSegment.ts, and deliberately a separate file: the two questions have
 * opposite preconditions and can never both apply. suggestBoardingLeg asks when the tracked origin is *not*
 * one of the traveller's airports; this asks only when it *is* their own airport, and only when a leg earlier
 * in the same journey actually lands there. So there is no ordering to get right between them.
 *
 * Saying yes re-bases the tracked flight onto the journey up to that landing: TPE → BKK, with the first leg's
 * departure and the arrival that touches down at home.
 *
 * The journey itself is found by lib/boardingSegment.ts journeyOfTracked, which matches on the departure
 * airport and time and never on the destination — so it works unchanged for a flight that has already been
 * merged, whose destination belongs to a later leg than its own.
 *
 * Pure, and unit-tested in lib/arrivalSegment.test.ts.
 */

import { usableAirportCode } from './airportCode.ts';
import { withFinalArrival, type JourneyRowMeta, type LegFields } from './flightLegs.ts';

export type ArrivalPrompt = {
  /** Where the tracked flight is flying to now (AMS). */
  trackedDestination: string;
  /** The traveller's own airport, which an earlier leg lands at (BKK). */
  arriveIata: string;
};

type TrackedLeg = { origin?: string; destination?: string; depMs: number | null };

/**
 * The arrival suggestion for a tracked flight, or null.
 *
 * Four things have to be true, and each one rules out a wrong question:
 *
 *   the journey has more than one leg            — nothing to re-base onto otherwise
 *   the tracked flight departs from home         — this is the merged reading, the one worth querying
 *   it is not also arriving home                 — a round trip needs no question
 *   an earlier leg lands at home                 — the alternative journey has to actually exist
 */
export function suggestArrivalLeg<T extends LegFields>(
  journey: readonly T[] | null,
  tracked: TrackedLeg,
  homeIata: string | null | undefined,
): ArrivalPrompt | null {
  if (!journey || journey.length < 2) return null;
  const home = usableAirportCode(homeIata || '');
  const origin = usableAirportCode(tracked.origin);
  const destination = usableAirportCode(tracked.destination);
  if (!home || !origin || !destination) return null;
  if (origin !== home || destination === home) return null;
  const from = journey.findIndex(l => usableAirportCode(l.origin) === origin);
  if (from <= 0) return null;
  // An earlier leg has to end where the traveller is, or there is no arriving journey to offer.
  const lands = journey.slice(0, from).some(l => usableAirportCode(l.destination) === home);
  return lands ? { trackedDestination: destination, arriveIata: home } : null;
}

/**
 * The tracked flight re-based onto the journey that *lands* at `arriveIata`: the journey's first departure and
 * that leg's arrival, with the stops in between. Null when no leg lands there.
 */
export function arrivalLegFlight<T extends LegFields>(
  journey: readonly T[] | null,
  arriveIata: string,
): (T & JourneyRowMeta) | null {
  if (!journey?.length) return null;
  const want = usableAirportCode(arriveIata);
  if (!want) return null;
  const to = journey.findIndex(l => usableAirportCode(l.destination) === want);
  if (to < 0) return null;
  const via = journey.slice(0, to).map(l => usableAirportCode(l.destination)).filter(Boolean);
  return { ...withFinalArrival(journey[0], journey[to]), via };
}
