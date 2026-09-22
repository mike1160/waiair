/**
 * The travel assistant on the home screen (components/FlightAssistantHub.tsx) shows different things as the
 * trip comes closer. This decides which phase the next flight is in, plus the small lookups each phase uses.
 *
 * Pure: no React Native, no network, no storage — everything is unit-tested in lib/flightPhase.test.ts.
 *
 * Departed and landed come from resolveHomeNow(), the same source the flight card on the home screen uses, so
 * the hub can never say "you are flying" while the card above it says "boarding". After a boarding leg is
 * confirmed (lib/boardingSegment.ts) the tracked flight is re-based onto that leg, so its own departure time
 * already is the boarding time — there is no separate boarding field to read.
 */
import {
  checkinHoursBeforeDeparture,
  isHomeNowDepartedOrLater,
  isHomeNowLandedOrLater,
  resolveHomeNow,
  type HomeNowFlight,
} from './homeNow.ts';
import { flightClockUtcMs, resolveArrivalIso, resolveDepartureIso } from './flightTimes.ts';

export type FlightPhase =
  | 'PREP'
  | 'PRACTICAL'
  | 'FINAL'
  | 'EVE'
  | 'DEPARTURE'
  | 'STOPOVER'
  | 'INFLIGHT'
  | 'ARRIVED'
  | 'COMPLETED';

const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
/** Landed less than this long ago: still arriving (welcome, belt, transport). After that the trip is done. */
export const ARRIVED_WINDOW_MS = 4 * HOUR_MS;
/** The next leg leaves within this long of landing: a connection, not the start of a new trip. */
export const STOPOVER_MAX_MS = 24 * HOUR_MS;

/** The leg flown before this one, for the stopover: where it landed and when. */
export type PreviousLeg = {
  destination?: string;
  landed: boolean;
  arrMs: number | null;
};

export function departureMs(f: HomeNowFlight): number | null {
  return flightClockUtcMs(resolveDepartureIso(f), f.origin, f.originCountry);
}

export function arrivalMs(f: HomeNowFlight): number | null {
  return flightClockUtcMs(resolveArrivalIso(f), f.destination, f.destCountry);
}

/**
 * The hub only speaks for a flight whose departure it knows. A flight tracked from an arrivals board carries the
 * arrival alone (someone you are picking up); without a departure every phase would be a guess, so the home
 * screen keeps its old card for it.
 */
export function hasKnownDeparture(f: HomeNowFlight): boolean {
  return departureMs(f) != null;
}

function sameAirport(a?: string, b?: string): boolean {
  const x = String(a || '').trim().toUpperCase();
  return !!x && x === String(b || '').trim().toUpperCase();
}

/**
 * Which phase the flight is in at `now`.
 *
 * Landed and departed follow resolveHomeNow(). Before departure the time left decides: more than 14 days PREP,
 * 7–14 PRACTICAL, 3–7 FINAL, 1–3 EVE, the last 24 hours DEPARTURE (also when it is late and still on the
 * ground). STOPOVER wins when the leg before it, in the same trip, has landed at this flight's origin and this
 * one leaves within a day.
 */
export function getFlightPhase(flight: HomeNowFlight, now: number, previousLeg?: PreviousLeg | null): FlightPhase {
  const home = resolveHomeNow(flight, now).phase;
  if (isHomeNowLandedOrLater(home)) {
    const landedAt = flight.landedAtMs != null && Number.isFinite(flight.landedAtMs) ? flight.landedAtMs : arrivalMs(flight);
    return landedAt != null && now - landedAt > ARRIVED_WINDOW_MS ? 'COMPLETED' : 'ARRIVED';
  }
  if (isHomeNowDepartedOrLater(home)) return 'INFLIGHT';

  const dep = departureMs(flight);
  if (
    previousLeg?.landed
    && previousLeg.arrMs != null
    && sameAirport(previousLeg.destination, flight.origin)
    && dep != null
    && dep > now
    && dep - previousLeg.arrMs <= STOPOVER_MAX_MS
  ) {
    return 'STOPOVER';
  }
  // No departure time at all: nothing to count down to, so the calmest phase.
  if (dep == null) return 'PREP';
  const left = dep - now;
  if (left <= DAY_MS) return 'DEPARTURE';
  if (left <= 3 * DAY_MS) return 'EVE';
  if (left <= 7 * DAY_MS) return 'FINAL';
  if (left <= 14 * DAY_MS) return 'PRACTICAL';
  return 'PREP';
}

/** When online check-in opens: T−48h or T−24h for airlines we know, the airport desk at T−3h otherwise. */
export function checkinOpensMs(f: HomeNowFlight): number | null {
  const dep = departureMs(f);
  return dep == null ? null : dep - checkinHoursBeforeDeparture(f) * HOUR_MS;
}

/**
 * Online check-in pages, keyed by IATA airline code. Only pages that were opened and confirmed as the airline's
 * check-in page are listed (2026-09-22): a guessed URL sends people to a 404 at the worst moment. Anyone not in
 * here gets a plain "check in with {airline}" line and no link.
 */
const CHECKIN_URLS: Record<string, string> = {
  BR: 'https://booking.evaair.com/flyeva/eva/b2c/manage-your-trip/online-checked-in-login.aspx?lang=en-global',
  CX: 'https://www.cathaypacific.com/cx/en_GB/manage-booking/check-in.html',
  EK: 'https://www.emirates.com/english/manage-booking/online-check-in/',
  FD: 'https://www.airasia.com/check-in/en/gb',
  KL: 'https://www.klm.com/check-in',
  LH: 'https://www.lufthansa.com/xx/en/online-check-in',
  SQ: 'https://www.singaporeair.com/en_UK/sg/travel-info/check-in/',
};

export function checkinUrlFor(airlineCode?: string | null): string | null {
  return CHECKIN_URLS[String(airlineCode || '').trim().toUpperCase()] || null;
}

export type PackingTip = 'sunscreen' | 'coat';

/**
 * One thing worth packing, from where the destination lies and the month you arrive. Between the tropics it is
 * always sun; far from the equator in its own winter it is a coat — the southern winter runs May to September.
 * Anything in between has no clear tip, so none is shown.
 */
export function packingTip(lat: number | null | undefined, month: number): PackingTip | null {
  if (lat == null || !Number.isFinite(lat) || month < 0 || month > 11) return null;
  if (Math.abs(lat) <= 23.5) return 'sunscreen';
  const northernWinter = month >= 10 || month <= 2;
  const southernWinter = month >= 4 && month <= 8;
  if (lat >= 35 && northernWinter) return 'coat';
  if (lat <= -35 && southernWinter) return 'coat';
  return null;
}

/** A hotel from the mail that waits for a trip, as the Settings list keeps it (lib/gmailSyncStatus.ts). */
export type HotelCandidate = { messageId: string; kind: string; title: string; startYmd: string };

/** Days between two yyyy-MM-dd dates, or null when either is not a date. */
function ymdDistance(a: string, b: string): number | null {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.round(Math.abs(ta - tb) / DAY_MS);
}

/** The window the hotel suggestion allows around the arrival day. */
export const HOTEL_SUGGEST_DAYS = 2;

/**
 * The one hotel to offer for this flight: a waiting booking whose check-in lies within two days of the arrival
 * day, the closest first. A waiting booking only carries a name and a date, not a city, so the date is what
 * ties it to this trip — the same way the mail import itself matches a booking to a flight.
 */
export function hotelSuggestionFor(
  waiting: readonly HotelCandidate[],
  arrivalYmd: string | null | undefined,
): HotelCandidate | null {
  if (!arrivalYmd) return null;
  let best: { item: HotelCandidate; days: number } | null = null;
  for (const item of waiting || []) {
    if (item?.kind !== 'hotel' || !item.title || !item.startYmd) continue;
    const days = ymdDistance(item.startYmd, arrivalYmd);
    if (days == null || days > HOTEL_SUGGEST_DAYS) continue;
    if (!best || days < best.days) best = { item, days };
  }
  return best ? best.item : null;
}

/** The AsyncStorage key that remembers "No, ignore" for this flight's hotel suggestion. */
export function hotelDismissKey(flightId: string): string {
  return `hub:hotel:dismissed:${flightId}`;
}

/**
 * The exchange rate as one readable line, always with a number above one: "1 EUR = 38.46 THB" rather than
 * "1 THB = 0.03 EUR". `rate` is how many `to` one `from` buys; below one the line is turned around.
 */
export function formatFxLine(fx: { from: string; to: string; rate: number }): string | null {
  if (!fx || !Number.isFinite(fx.rate) || fx.rate <= 0 || !fx.from || !fx.to) return null;
  return fx.rate >= 1
    ? `1 ${fx.from} = ${fx.rate.toFixed(2)} ${fx.to}`
    : `1 ${fx.to} = ${(1 / fx.rate).toFixed(2)} ${fx.from}`;
}

/** "3h 25m" / "45m" for the time left on a stopover. */
export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
