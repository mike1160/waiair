/**
 * "Where do you board?" for multi-leg numbers (BR75 TPE → BKK → AMS). A tracked flight whose departure airport is
 * none of the user's trip airports, while a later leg of the same journey departs from one of them, most likely
 * means the traveller boards there: BR75 from Taipei, but the user flies Bangkok → Amsterdam. The card asks; only a
 * confirmation re-bases the tracked flight onto that leg (lib/flightLegs.ts withFinalArrival).
 */
import { usableAirportCode } from './airportCode.ts';
import { chooseLeg, legDepartureMs, legJourneys, withFinalArrival, type JourneyRowMeta, type LegFields } from './flightLegs.ts';

/** The journey leg must depart within this of the tracked departure (same day's service). */
const SAME_SERVICE_MS = 12 * 60 * 60 * 1000;

export type BoardingPrompt = {
  /** Where the tracked flight departs now (the route origin, TPE). */
  routeOrigin: string;
  /** The suggested boarding airport (BKK). */
  boardIata: string;
};

type TrackedLeg = { origin?: string; destination?: string; depMs: number | null };

/** The journey (same-number legs, in flying order) the tracked leg belongs to; null when it is not in `legs`. */
export function journeyOfTracked<T extends LegFields>(legs: readonly T[], tracked: TrackedLeg): T[] | null {
  const origin = usableAirportCode(tracked.origin);
  if (!origin) return null;
  for (const journey of legJourneys(legs)) {
    const hit = journey.find(l => {
      if (usableAirportCode(l.origin) !== origin) return false;
      const dep = legDepartureMs(l);
      return tracked.depMs == null || dep == null || Math.abs(dep - tracked.depMs) <= SAME_SERVICE_MS;
    });
    if (hit) return journey;
  }
  return null;
}

/**
 * The boarding suggestion for a tracked flight, or null. Only a later leg that the tracked flight actually flies
 * through counts (its origin is a stop before the tracked destination), so someone flying TPE → BKK home is never
 * asked whether they board in Bangkok.
 */
export function suggestBoardingLeg<T extends LegFields>(
  journey: readonly T[] | null,
  tracked: TrackedLeg,
  tripAirports: readonly string[],
): BoardingPrompt | null {
  if (!journey || journey.length < 2) return null;
  const origin = usableAirportCode(tracked.origin);
  const destination = usableAirportCode(tracked.destination);
  const trip = new Set(tripAirports.map(a => usableAirportCode(a)).filter(Boolean));
  if (!origin || !destination || trip.has(origin)) return null;
  const from = journey.findIndex(l => usableAirportCode(l.origin) === origin);
  const to = journey.findIndex((l, i) => i >= from && usableAirportCode(l.destination) === destination);
  if (from < 0 || to < 0) return null;
  for (let i = from + 1; i <= to; i++) {
    const board = usableAirportCode(journey[i].origin);
    if (board && trip.has(board)) return { routeOrigin: origin, boardIata: board };
  }
  return null;
}

/**
 * The tracked flight re-based onto the leg from `boardIata`: that leg's departure side, the journey's final arrival
 * and the stops after it. Null when no leg departs from there.
 */
export function boardingLegFlight<T extends LegFields>(
  journey: readonly T[] | null,
  boardIata: string,
): (T & JourneyRowMeta) | null {
  if (!journey?.length) return null;
  const choice = chooseLeg(journey, boardIata);
  if (choice.kind !== 'fromOrigin') return null;
  return { ...withFinalArrival(choice.leg, choice.finalLeg), via: choice.via };
}
