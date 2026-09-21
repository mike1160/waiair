/**
 * Silent trip grouping: the tracked flights that belong to one journey, and the bookings that belong to it.
 *
 * Pure — no storage, no network, no React Native — so it runs under `node --test`. Nothing here decides what
 * the user sees; it only answers "which of these flights are one trip" for the screen that draws them.
 *
 * The flight type is structural on purpose. App.tsx's `TrackedFlight` is a local type inside a 13k-line file
 * that imports from lib/, so importing it here would be circular and would pull React Native into a module
 * that has to stay pure. A `TrackedFlight[]` satisfies `TripFlight[]` as it is.
 */

import { airportRecByIata } from './airportsDb.ts';
import { resolveArrivalIso, resolveDepartureIso, type FlightClockFields } from './flightTimes.ts';
import { extrasFieldCount } from './gmailImport.ts';
import { cleanTripExtras, type TripExtras } from './tripExtrasModel.ts';

/** How far apart two legs may sit and still be the same journey. */
export const TRIP_GAP_DAYS = 21;

const DAY_MS = 86_400_000;

export type TripFlightLeg = FlightClockFields & {
  origin?: string;
  destination?: string;
  originCity?: string;
  destCity?: string;
  originCountry?: string;
  destCountry?: string;
};

/** The shape this module needs from a tracked flight; App.tsx's TrackedFlight already has all of it. */
export type TripFlight = {
  key: string;
  scheduledTime?: string;
  tripExtras?: TripExtras;
  flight?: TripFlightLeg | null;
  /** Live fields the moment builder reads (lib/tripMoments.ts); all optional, all already on TrackedFlight. */
  flightNumber?: string;
  lastGate?: string;
  previousGate?: string;
  lastBaggage?: string;
  lastDelay?: number;
  lastStatus?: string;
};

export type TripGroup<T extends TripFlight = TripFlight> = {
  /** Stable key: first flight key + last flight key joined. */
  key: string;
  /** Display name: destination city of first flight. */
  name: string;
  /** ISO date of first departure. */
  startDate: string;
  /**
   * ISO date of the last departure — the day you leave, not the day you get home. A return leg that takes
   * off on the 21st and lands on the 22nd makes this a 14–21 trip: the header answers "how long am I there".
   */
  endDate: string;
  flights: T[];
  /** All extras merged across all flights in the group. */
  extras: TripExtras;
};

function iata(v?: string): string {
  return String(v || '').trim().toUpperCase();
}

function countryOf(code: string, given?: string): string {
  const explicit = String(given || '').trim();
  if (explicit) return explicit.toUpperCase();
  return String(airportRecByIata(code)?.country || '').trim().toUpperCase();
}

function msOf(iso?: string | null): number | null {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : null;
}

function ymd(iso: string | null, ms: number | null): string {
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  if (ms == null) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

type Leg<T extends TripFlight> = {
  f: T;
  depIso: string | null;
  arrIso: string | null;
  depMs: number | null;
  arrMs: number | null;
  origin: string;
  destination: string;
  originCountry: string;
  destCountry: string;
};

function toLeg<T extends TripFlight>(f: T): Leg<T> {
  const live = f.flight || {};
  const depIso = resolveDepartureIso(live) || f.scheduledTime || null;
  const arrIso = resolveArrivalIso(live) || null;
  const origin = iata(live.origin);
  const destination = iata(live.destination);
  return {
    f,
    depIso,
    arrIso,
    depMs: msOf(depIso),
    arrMs: msOf(arrIso),
    origin,
    destination,
    originCountry: countryOf(origin, live.originCountry),
    destCountry: countryOf(destination, live.destCountry),
  };
}

/**
 * Are these two legs the same journey? The earlier one's arrival and the later one's departure have to sit
 * within TRIP_GAP_DAYS of each other, and the legs have to actually meet: the same airport, or at least the
 * same country — you land in Bangkok and fly on from Don Mueang, which is a different airport and one trip.
 */
function connected<T extends TripFlight>(earlier: Leg<T>, later: Leg<T>): boolean {
  const from = earlier.arrMs ?? earlier.depMs;
  const to = later.depMs ?? later.arrMs;
  if (from == null || to == null) return false;
  if (Math.abs(to - from) > TRIP_GAP_DAYS * DAY_MS) return false;
  const sameAirport = !!earlier.destination && earlier.destination === later.origin;
  const sameCountry = !!earlier.destCountry && earlier.destCountry === later.originCountry;
  return sameAirport || sameCountry;
}

/** Pick the fullest of several bookings of one kind — the mail that said the most wins. */
function richest<K extends 'carRental' | 'transfer' | 'excursion' | 'restaurant'>(
  slot: K,
  all: TripExtras[],
): TripExtras[K] | undefined {
  let best: TripExtras[K] | undefined;
  let bestCount = -1;
  for (const e of all) {
    const value = e[slot];
    if (!value) continue;
    const count = extrasFieldCount({ [slot]: value } as Partial<TripExtras>);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Every booking on the trip, as one set of extras. The hotel is the one you check into last — on a multi-leg
 * trip that is the stay the later legs are about. The other kinds keep whichever mail said the most.
 */
export function extrasForGroup<T extends TripFlight>(group: TripGroup<T>): TripExtras {
  const all = (group?.flights || []).map(f => f.tripExtras).filter((e): e is TripExtras => !!e);
  if (!all.length) return {};

  let hotel: TripExtras['hotel'];
  let hotelAt = -Infinity;
  for (const e of all) {
    if (!e.hotel) continue;
    const at = msOf(e.hotel.checkIn) ?? -Infinity;
    if (!hotel || at > hotelAt) {
      hotel = e.hotel;
      hotelAt = at;
    }
  }

  const merged = cleanTripExtras({
    hotel,
    carRental: richest('carRental', all),
    transfer: richest('transfer', all),
    excursion: richest('excursion', all),
    restaurant: richest('restaurant', all),
  }) || {};
  // cleanTripExtras always returns all five slots, the unused ones undefined. Harmless to read through, but
  // it makes `'restaurant' in group.extras` lie, so the group only carries the bookings it really has.
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => !!v)) as TripExtras;
}

/**
 * The tracked flights, split into journeys. A flight that meets no other is a group of its own, which the
 * screen draws exactly as it always did. Groups come back oldest first, and the legs inside each group in
 * the order you fly them.
 */
export function groupTrips<T extends TripFlight>(flights: T[]): TripGroup<T>[] {
  const legs = (flights || [])
    .filter(f => f && f.key)
    .map(toLeg)
    // Unknown departures go last, so a flight with no clock never anchors a group.
    .sort((a, b) => (a.depMs ?? Number.MAX_SAFE_INTEGER) - (b.depMs ?? Number.MAX_SAFE_INTEGER));

  // Union-find, so the order the pairs are examined in cannot change the grouping.
  const parent = legs.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let at = i;
    while (parent[at] !== root) {
      const next = parent[at];
      parent[at] = root;
      at = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      if (connected(legs[i], legs[j])) union(i, j);
    }
  }

  const buckets = new Map<number, Leg<T>[]>();
  for (let i = 0; i < legs.length; i++) {
    const root = find(i);
    const bucket = buckets.get(root);
    if (bucket) bucket.push(legs[i]);
    else buckets.set(root, [legs[i]]);
  }

  const groups: TripGroup<T>[] = [];
  for (const bucket of buckets.values()) {
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const name = String(first.f.flight?.destCity || '').trim()
      || airportRecByIata(first.destination)?.city
      || first.destination;
    const group: TripGroup<T> = {
      key: `${first.f.key}|${last.f.key}`,
      name,
      startDate: ymd(first.depIso, first.depMs),
      endDate: ymd(last.depIso ?? last.arrIso, last.depMs ?? last.arrMs),
      flights: bucket.map(l => l.f),
      extras: {},
    };
    group.extras = extrasForGroup(group);
    groups.push(group);
  }

  return groups.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
