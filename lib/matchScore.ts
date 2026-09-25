/**
 * How sure we are that a booking found in Gmail belongs to a trip, and what to do about it.
 *
 * A hotel or a car used to be attached to the flight that landed nearest to it, within a fixed window of
 * three days, on the strength of the date alone (the matchExtrasFlightKey this replaced). That is why a hotel
 * in the wrong city could still land on a trip, and why anything the window missed sat in the queue with no
 * explanation. This module answers the same question with a number instead, so the app can act on how sure it
 * is: link it, offer it, or leave it alone.
 *
 * The score is out of 100 and made of three parts — when (40), where (40) and whether the kind of booking
 * makes sense for that trip at all (20). Everything here is pure and synchronous: it decides, it stores
 * nothing. The caller persists the result, which is what keeps the rule testable and reversible.
 *
 * Nothing scores without a date. A confirmation with no date says nothing about which trip it belongs to, and
 * guessing from the city alone is how a hotel ends up on last year's holiday.
 */

import { airportRecByIata, normKey, AIRPORTS, type AirportRec } from './airportsDb.ts';
import type { GmailItemKind } from './gmailInboxScan.ts';

/** From this score up, a booking is linked without asking. */
export const AUTO_LINK_MIN = 80;
/** From this score up (and below AUTO_LINK_MIN) the traveller is offered the link instead. */
export const SUGGEST_MIN = 50;

/**
 * Two places count as "the same region" within this distance. The airport table has no province or state
 * column, so the distance between the two places stands in for it: Don Mueang and Suvarnabhumi are one
 * region, Bangkok and Phuket are not.
 */
export const REGION_KM = 150;

/** The place agrees: same city, same metro area, or the very airport the flight lands at. */
export const LOC_EXACT = 40;
/** A different place in the same region — near enough to be the same stay. */
export const LOC_REGION = 20;
/** Same country, somewhere else entirely. */
export const LOC_COUNTRY = 15;
/**
 * The booking does not say where it is.
 *
 * Not knowing is not the same as being wrong, and it must not be scored as if it were: a booking
 * confirmation often carries nothing but a street and a hotel name (TripExtras has no city or country field
 * of its own), and scoring those at zero would send every one of them to the inbox — including the ones the
 * old date-only matcher attached without complaint. So an unknown place neither helps nor condemns: it
 * leaves the date and the kind of booking to decide.
 */
export const LOC_UNKNOWN = 20;

/** How a link came about, kept with the link so the traveller can see why it happened. */
export type LinkedBy = 'auto' | 'manual' | 'suggestion';

/** What to do with a score. */
export type LinkTier = 'auto' | 'suggest' | 'inbox';

/**
 * A booking found in the mailbox, reduced to the fields that decide where it belongs. `city`, `country` and
 * `airportIata` come from the parsed booking (lib/tripExtras.ts), not from the inbox scan — the scan reads
 * metadata only (GmailInboxItem) and knows no places.
 */
export interface GmailItem {
  id: string;
  kind: GmailItemKind;
  /** The day the booking is for (yyyy-MM-dd, or any ISO timestamp starting with it). */
  date?: string;
  city?: string;
  /** ISO country code or country name; both are accepted. */
  country?: string;
  airportIata?: string;
  linkedToTripKey?: string;
  linkedBy?: LinkedBy;
}

/**
 * A trip to match against: the arrival day, the last day, and where it goes.
 *
 * This is a view, in the same spirit as FlightForMatch in lib/gmailImport.ts, and for the same reason — the
 * app's own TrackedFlight type lives inside App.tsx and cannot be imported here (nor by the tests). The
 * caller maps its tracked flights onto these five fields.
 */
export interface Trip {
  key: string;
  /** Arrival day of the first leg (yyyy-MM-dd) — the day a hotel or a car normally starts. */
  startDate: string;
  /** Last day of the trip (yyyy-MM-dd); equal to startDate for a single-day trip. */
  endDate: string;
  destinationCity: string;
  destinationCountry: string;
  destinationIata: string;
}

/** The three parts of a score, kept separate so a surprising total can be read back. */
export interface ScoreParts {
  date: number;
  location: number;
  type: number;
  total: number;
}

/** Everything worth keeping about a link, so it can be explained and undone. */
export interface LinkRecord {
  linkedToTripKey: string;
  linkedBy: LinkedBy;
  linkedAt: number;
  matchScoreAtLink: number;
}

/** One item's outcome: the trip it fits best, how well, and what that means. */
export interface LinkPlan {
  item: GmailItem;
  /** The best trip, or null when nothing scored at all. */
  tripKey: string | null;
  score: number;
  tier: LinkTier;
  /** Present for 'auto' and 'suggest': what the caller should store with the item. */
  record?: LinkRecord;
}

export interface AutoLinkResult {
  autoLinked: number;
  suggested: number;
  inbox: number;
  /** The per-item decisions — the caller needs these to actually link or queue anything. */
  plans: LinkPlan[];
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** A day as yyyy-MM-dd, or '' when the value is not a date. Timestamps are cut down to their day. */
function ymd(value?: string): string {
  const m = YMD_RE.exec(String(value || '').trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/**
 * Whole days from `a` to `b`, or null when either is not a date. Deliberately not dateOffsetDays from
 * lib/smartQuery.ts: that one answers 0 for unparsable input, and here "no date" must never read as "today".
 */
function dayDiff(a: string, b: string): number | null {
  const x = YMD_RE.exec(a);
  const y = YMD_RE.exec(b);
  if (!x || !y) return null;
  const ms = Date.UTC(Number(x[1]), Number(x[2]) - 1, Number(x[3]))
    - Date.UTC(Number(y[1]), Number(y[2]) - 1, Number(y[3]));
  return Math.round(ms / 86_400_000);
}

/**
 * Straight-line kilometres between two points. Lives here rather than in lib/eu261.ts, whose own copy
 * reaches react-native through its imports and so cannot be used by a unit-tested module.
 */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Is the day inside the trip, inclusive of both ends? */
function withinTrip(day: string, trip: Trip): boolean {
  const start = ymd(trip.startDate);
  const end = ymd(trip.endDate) || start;
  if (!day || !start) return false;
  return day >= start && day <= (end < start ? start : end);
}

/**
 * When (max 40). Measured against the arrival day, which is the day a booking normally starts — the same
 * anchor the old date-only matcher used.
 *
 * A day further out than two still counts for something as long as it falls inside the trip: a restaurant on
 * day six of a holiday is not suspicious, it is just later. Outside the trip, nothing.
 */
export function scoreDate(item: GmailItem, trip: Trip): number {
  const day = ymd(item.date);
  const diff = dayDiff(day, ymd(trip.startDate));
  if (day === '' || diff == null) return 0;
  const off = Math.abs(diff);
  if (off === 0) return 40;
  if (off === 1) return 25;
  if (off === 2) return 15;
  return withinTrip(day, trip) ? 10 : 0;
}

const cityCache = new Map<string, AirportRec | null>();

/** The airport a place name points at, so "Bangkok" and "Suvarnabhumi" can be compared by position. */
function airportForCity(city: string, country?: string): AirportRec | null {
  const key = `${normKey(city)}\u0000${normKey(country || '')}`;
  const hit = cityCache.get(key);
  if (hit !== undefined) return hit;
  const want = normKey(city);
  let found: AirportRec | null = null;
  if (want) {
    const cc = normKey(country || '');
    for (const rec of AIRPORTS) {
      if (cc && normKey(rec.country) !== cc && normKey(rec.countryName) !== cc) continue;
      if (namesTouch(want, rec)) { found = rec; break; }
    }
  }
  cityCache.set(key, found);
  return found;
}

/** Does this place name mean this airport — its city, its own name, or one of its aliases? */
function namesTouch(wantKey: string, rec: AirportRec): boolean {
  if (!wantKey) return false;
  const candidates = [rec.city, rec.name, rec.iata, ...(rec.aliases || [])];
  for (const c of candidates) {
    const k = normKey(c);
    if (!k) continue;
    if (k === wantKey) return true;
    // "Bangkok Metropolitan" is Bangkok; "BKK" inside a longer word is not, hence the length floor.
    if (k.length >= 4 && wantKey.length >= 4 && (k.includes(wantKey) || wantKey.includes(k))) return true;
  }
  return false;
}

function sameCountry(item: GmailItem, trip: Trip, dest?: AirportRec | null): boolean {
  const a = normKey(item.country || '');
  if (!a) return false;
  const candidates = [trip.destinationCountry, dest?.country, dest?.countryName]
    .map(v => normKey(v || ''))
    .filter(Boolean);
  return candidates.includes(a);
}

/**
 * Where (max 40). The destination airport does the talking: its city, its name and its aliases all count as
 * the same place, accents and capitals ignored (normKey). An airport code on the booking is compared
 * directly, which is what makes a car picked up in the arrivals hall an exact match.
 */
export function scoreLocation(item: GmailItem, trip: Trip): number {
  const dest = airportRecByIata(trip.destinationIata) || null;

  // The trip itself may not say where it goes (a flight tracked by number alone). Not knowing cuts both
  // ways: judging the booking against a blank destination would score every one of them zero.
  if (!String(trip.destinationIata || '').trim()
    && !String(trip.destinationCity || '').trim()
    && !String(trip.destinationCountry || '').trim()) {
    return LOC_UNKNOWN;
  }

  const iata = String(item.airportIata || '').toUpperCase();
  if (iata && iata === String(trip.destinationIata || '').toUpperCase()) return LOC_EXACT;

  const city = String(item.city || '').trim();
  if (city) {
    const wantKey = normKey(city);
    if (wantKey && normKey(trip.destinationCity) === wantKey) return LOC_EXACT;
    if (dest && namesTouch(wantKey, dest)) return LOC_EXACT;
  }

  // Not the same place. An airport code or a city we can put on the map may still be next door.
  const here = iata ? airportRecByIata(iata) : (city ? airportForCity(city, item.country) : null);
  if (here && dest) {
    const sameCc = normKey(here.country) === normKey(dest.country);
    if (sameCc) {
      const km = distanceKm(here.lat, here.lon, dest.lat, dest.lon);
      return km <= REGION_KM ? LOC_REGION : LOC_COUNTRY;
    }
  }

  if (sameCountry(item, trip, dest)) return LOC_COUNTRY;
  // Nothing at all to go on — see LOC_UNKNOWN. A place we could read but could not place also lands here.
  if (!iata && !city && !String(item.country || '').trim()) return LOC_UNKNOWN;
  return 0;
}

/**
 * Whether the kind of booking fits the trip at all (max 20).
 *
 * These points need the place to agree first: a hotel check-in after landing is only evidence when the hotel
 * is where the flight went. Without that condition a hotel on the right day in the wrong country would score
 * 60 and be offered as a suggestion, which is exactly the kind of wrong link this module exists to prevent.
 *
 * 'transport' covers trains, buses and ferries together, the way the scanner classifies them
 * (lib/gmailInboxScan.ts). Events and courses have no kind of their own yet, so they are not listed here.
 */
export function scoreType(item: GmailItem, trip: Trip, locationScore: number): number {
  if (locationScore <= 0) return 0;
  const day = ymd(item.date);
  if (!day) return 0;
  // "After the flight lands" means inside the trip, not merely later: a hotel in the right city a month
  // after the return flight is not this trip's hotel, and reading it as one is how a booking gets attached
  // to a holiday that is already over.
  if (!withinTrip(day, trip)) return 0;

  switch (item.kind) {
    case 'hotel':
      return 20;
    case 'carRental':
      // Picked up at the airport you land at: the strongest signal a car booking can give.
      return String(item.airportIata || '').toUpperCase() === String(trip.destinationIata || '').toUpperCase()
        ? 20
        : 15;
    case 'restaurant':
    case 'excursion':
      return 15;
    case 'transport':
      return 15;
    default:
      // Flights match on their own number, and the flight extras (bags, seats, meals) belong to a ticket
      // rather than to a place, so neither earns points here.
      return 0;
  }
}

/** The three parts and their total, for a caller that wants to show its reasoning. */
export function scoreBreakdown(item: GmailItem, trip: Trip): ScoreParts {
  if (!ymd(item.date)) return { date: 0, location: 0, type: 0, total: 0 };
  const date = scoreDate(item, trip);
  const location = scoreLocation(item, trip);
  const type = scoreType(item, trip, location);
  return { date, location, type, total: Math.max(0, Math.min(100, date + location + type)) };
}

/** How sure we are that this booking belongs to this trip, out of 100. */
export function matchScore(item: GmailItem, trip: Trip): number {
  return scoreBreakdown(item, trip).total;
}

export function linkDecision(score: number): LinkTier {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'inbox';
  if (n >= AUTO_LINK_MIN) return 'auto';
  if (n >= SUGGEST_MIN) return 'suggest';
  return 'inbox';
}

/** The trip this booking fits best, with its score. Ties go to the trip that starts first. */
export function bestTrip(item: GmailItem, trips: Trip[]): { trip: Trip | null; score: number } {
  let best: { trip: Trip | null; score: number } = { trip: null, score: 0 };
  for (const trip of trips || []) {
    if (!trip?.key) continue;
    const score = matchScore(item, trip);
    if (score > best.score
      || (score === best.score && score > 0 && best.trip && ymd(trip.startDate) < ymd(best.trip.startDate))) {
      best = { trip, score };
    }
  }
  return best;
}

/** The items still waiting for a trip — what a re-match after adding a flight should look at. */
export function unlinkedItems(items: GmailItem[]): GmailItem[] {
  return (items || []).filter(i => i && !i.linkedToTripKey);
}

/**
 * What to do with each booking, and the totals. Pure: it works out the links, the caller writes them.
 *
 * Run it after a Gmail scan, after a flight is tracked by hand and after a new trip appears. The second one
 * is the point: a confirmation that arrived before its flight was tracked keeps sitting in the inbox, and
 * re-running this over the unlinked items is what finally attaches it.
 */
export function planLinks(items: GmailItem[], trips: Trip[], opts?: { now?: number }): AutoLinkResult {
  const now = opts?.now ?? Date.now();
  const result: AutoLinkResult = { autoLinked: 0, suggested: 0, inbox: 0, plans: [] };

  for (const item of items || []) {
    if (!item?.id) continue;
    const { trip, score } = bestTrip(item, trips);
    const tier = trip ? linkDecision(score) : 'inbox';
    const plan: LinkPlan = { item, tripKey: tier === 'inbox' ? null : (trip?.key ?? null), score, tier };
    if (trip && tier !== 'inbox') {
      plan.record = {
        linkedToTripKey: trip.key,
        linkedBy: tier === 'auto' ? 'auto' : 'suggestion',
        linkedAt: now,
        matchScoreAtLink: score,
      };
    }
    if (tier === 'auto') result.autoLinked += 1;
    else if (tier === 'suggest') result.suggested += 1;
    else result.inbox += 1;
    result.plans.push(plan);
  }

  return result;
}

/** planLinks, awaited — the shape the callers in the app use. */
export async function autoLinkItems(
  items: GmailItem[],
  trips: Trip[],
  opts?: { now?: number },
): Promise<AutoLinkResult> {
  return planLinks(items, trips, opts);
}
