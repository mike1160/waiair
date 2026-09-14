/**
 * Multi-leg flights: one flight number flying several legs (BR75 TPE → BKK → AMS). AeroDataBox returns each leg as its
 * own flight. With the user's departure airport set, the leg from that airport is the primary one; its arrival side is
 * the journey's final destination. Without a matching leg every leg is shown, labeled.
 */
import { usableAirportCode } from './airportCode.ts';
import { parseTimeMs, resolveArrivalIso, resolveDepartureIso, type FlightClockFields } from './flightTimes.ts';

/** The next leg leaves at most this long after the previous leg landed (same number, same journey). */
const MAX_CONNECT_MS = 24 * 60 * 60 * 1000;
/** Clock slack between legs (rounding, missing actuals). */
const CONNECT_SLACK_MS = 60 * 60 * 1000;

export type LegFields = FlightClockFields & {
  number?: string;
  destCity?: string;
  arrTerminal?: string;
  baggage?: string;
};

/** "BR 75" and "br75" are the same flight; '' when unknown. */
function numberKey(f: LegFields): string {
  return String(f.number || '').replace(/\s+/g, '').toUpperCase();
}

export type LegChoice<T> =
  /** One leg: nothing to choose. */
  | { kind: 'direct'; flight: T }
  /** The leg departing from the user's airport; `finalLeg` supplies the arrival at the final destination. */
  | { kind: 'fromOrigin'; leg: T; finalLeg: T; via: string[]; index: number; total: number }
  /** No leg departs from the user's airport (or none set): every leg, numbered. */
  | { kind: 'allLegs'; legs: { leg: T; index: number; total: number }[] };

function depMs(f: LegFields): number | null {
  return parseTimeMs(resolveDepartureIso(f));
}

function arrMs(f: LegFields): number | null {
  return parseTimeMs(resolveArrivalIso(f));
}

/** Same-number legs grouped into journeys: a leg continues a journey when it departs from where the last leg landed, within 24h. */
export function legJourneys<T extends LegFields>(legs: readonly T[]): T[][] {
  const sorted = [...legs].sort((a, b) => (depMs(a) ?? Infinity) - (depMs(b) ?? Infinity));
  const journeys: T[][] = [];
  for (const leg of sorted) {
    const origin = usableAirportCode(leg.origin);
    const dep = depMs(leg);
    const journey = [...journeys].reverse().find(j => {
      const last = j[j.length - 1];
      if (numberKey(last) !== numberKey(leg)) return false;
      if (!origin || usableAirportCode(last.destination) !== origin) return false;
      const landed = arrMs(last) ?? depMs(last);
      if (dep == null || landed == null) return false;
      return dep >= landed - CONNECT_SLACK_MS && dep - landed <= MAX_CONNECT_MS;
    });
    if (journey) journey.push(leg);
    else journeys.push([leg]);
  }
  return journeys;
}

/** For one journey: the leg from `originIata` as primary, or all legs labeled when none departs from there. */
export function chooseLeg<T extends LegFields>(journey: readonly T[], originIata?: string | null): LegChoice<T> {
  if (journey.length <= 1) return { kind: 'direct', flight: journey[0] };
  const want = usableAirportCode(originIata || '');
  const i = want ? journey.findIndex(l => usableAirportCode(l.origin) === want) : -1;
  if (i < 0) {
    return { kind: 'allLegs', legs: journey.map((leg, idx) => ({ leg, index: idx + 1, total: journey.length })) };
  }
  return {
    kind: 'fromOrigin',
    leg: journey[i],
    finalLeg: journey[journey.length - 1],
    via: journey.slice(i, -1).map(l => usableAirportCode(l.destination)).filter(Boolean),
    index: i + 1,
    total: journey.length,
  };
}

/** Search-row extras: `legOf` labels a leg when no leg departs from the user's airport; `via` lists stops after it. */
export type JourneyRowMeta = {
  legOf?: { index: number; total: number };
  via?: string[];
};

/**
 * Flight-number search rows from all live legs: single-leg flights unchanged; per journey the leg from `originIata`
 * (with the final arrival and `via`), or every leg labeled `legOf` when none departs from there.
 */
export function journeyRows<T extends LegFields>(legs: readonly T[], originIata?: string | null): Array<T & JourneyRowMeta> {
  const rows: Array<T & JourneyRowMeta> = [];
  for (const journey of legJourneys(legs)) {
    const choice = chooseLeg(journey, originIata);
    if (choice.kind === 'direct') {
      rows.push(choice.flight);
    } else if (choice.kind === 'fromOrigin') {
      rows.push({ ...withFinalArrival(choice.leg, choice.finalLeg), via: choice.via });
    } else {
      for (const l of choice.legs) rows.push({ ...l.leg, legOf: { index: l.index, total: l.total } });
    }
  }
  return rows;
}

/** A tracked journey's leg must depart within this of the tracked departure (same day's service, not tomorrow's). */
const TRACKED_DAY_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Journey status: the user's leg until it has landed, then the final leg (transit, onward flight). A cancelled leg
 * cancels the journey.
 */
export function journeyStatus(leg: LegFields, finalLeg: LegFields): string | undefined {
  if (leg === finalLeg) return leg.status;
  if (leg.status === 'cancelled' || finalLeg.status === 'cancelled') return 'cancelled';
  return leg.status === 'landed' ? finalLeg.status : leg.status;
}

/** Departure time of a tracked flight (for trackedJourneyFlight). */
export function legDepartureMs(f: LegFields): number | null {
  return depMs(f);
}

export type TrackedJourney = { origin?: string; destination?: string; depMs: number | null };

/**
 * The legs of a tracked journey (tracked flight with `via`) in `liveLegs`: the leg from the tracked origin departing
 * nearest to the tracked departure (within 12h), and its journey's final leg. Only a complete journey counts — the
 * final leg must end at the tracked destination — so a board or response holding just one leg never replaces the final
 * arrival. Returns the live objects themselves; null when no such journey is present.
 */
export function trackedJourneyLegs<T extends LegFields>(
  liveLegs: readonly T[],
  tracked: TrackedJourney,
): { leg: T; finalLeg: T; via: string[] } | null {
  const origin = usableAirportCode(tracked.origin);
  const destination = usableAirportCode(tracked.destination);
  if (!origin || !destination) return null;
  let best: { leg: T; finalLeg: T; via: string[]; gap: number } | null = null;
  for (const journey of legJourneys(liveLegs)) {
    const choice = chooseLeg(journey, origin);
    const leg = choice.kind === 'direct' ? choice.flight : choice.kind === 'fromOrigin' ? choice.leg : null;
    if (!leg || usableAirportCode(leg.origin) !== origin) continue;
    const finalLeg = choice.kind === 'fromOrigin' ? choice.finalLeg : leg;
    if (usableAirportCode(finalLeg.destination) !== destination) continue;
    const dep = depMs(leg);
    const gap = tracked.depMs == null || dep == null ? 0 : Math.abs(dep - tracked.depMs);
    if (tracked.depMs != null && gap > TRACKED_DAY_WINDOW_MS) continue;
    // A lone flight that is already a merged journey keeps its own stops.
    const via = choice.kind === 'fromOrigin' ? choice.via : ((leg as T & JourneyRowMeta).via ?? []);
    if (!best || gap < best.gap) best = { leg, finalLeg, via, gap };
  }
  return best ? { leg: best.leg, finalLeg: best.finalLeg, via: best.via } : null;
}

/** Live refresh of a tracked journey: its leg with the final arrival, the journey status and `via`; null without a complete journey. */
export function trackedJourneyFlight<T extends LegFields>(
  liveLegs: readonly T[],
  tracked: TrackedJourney,
): (T & JourneyRowMeta) | null {
  const legs = trackedJourneyLegs(liveLegs, tracked);
  if (!legs) return null;
  if (legs.leg === legs.finalLeg) return { ...legs.leg, via: legs.via };
  return {
    ...withFinalArrival(legs.leg, legs.finalLeg),
    status: journeyStatus(legs.leg, legs.finalLeg),
    via: legs.via,
  };
}

/** Display flight: departure side from `leg`, destination and arrival times from the journey's `finalLeg`. */
export function withFinalArrival<T extends LegFields>(leg: T, finalLeg: T): T {
  if (leg === finalLeg) return leg;
  return {
    ...leg,
    destination: finalLeg.destination,
    destCity: finalLeg.destCity,
    destCountry: finalLeg.destCountry,
    scheduledArrival: finalLeg.scheduledArrival,
    estimatedArrival: finalLeg.estimatedArrival,
    actualArrival: finalLeg.actualArrival,
    arrivalTime: finalLeg.arrivalTime,
    arrTerminal: finalLeg.arrTerminal,
    baggage: finalLeg.baggage,
  };
}
