/**
 * When a stay ends — the far edge of the window a booking is matched against (lib/matchScore.ts).
 *
 * The real answer is another tracked flight leaving the destination: that is the day you go home, and it is
 * used whenever it exists. Someone who only tracks the flight out has no such leg, and the trip then
 * collapsed to the single day of the arrival. A hotel checking in the evening after landing fell outside its
 * own trip, lost the points its kind is worth, and was never linked — auto-link simply never fired for
 * anyone with one flight on their list. That is what the fallbacks below fill in.
 *
 * Pure and free of React Native so it can be unit-tested: this used to live inside App.tsx, where the
 * fallbacks could not be covered.
 */

import { usableAirportCode } from './airportCode.ts';
import { addLocalDays, toLocalDateString } from './localFlightTime.ts';

/** How far a trip with no flight home reaches on its own: a fortnight, not a season. */
export const STAY_FALLBACK_DAYS = 14;
/** How long a stay is taken to be when a hotel says when it starts but not when it ends. */
export const STAY_FROM_CHECKIN_DAYS = 7;

/** The shape this needs from a tracked flight; App.tsx's TrackedFlight already has all of it. */
export interface StayFlight {
  key: string;
  scheduledTime?: string;
  flight?: {
    origin?: string;
    destination?: string;
    scheduledArrival?: string;
    arrivalTime?: string;
    scheduledDeparture?: string;
  } | null;
  tripExtras?: { hotel?: { checkIn?: string; checkOut?: string } } | null;
}

function day(value?: string | null): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || '').trim());
  return m ? m[1] : '';
}

/** `ymd` plus a number of days, over month and year ends. */
export function ymdPlusDays(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return '';
  // Midday, so no daylight-saving shift can move the result to the day before.
  const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return toLocalDateString(addLocalDays(at, days));
}

/**
 * The last day of the stay after landing, or undefined when the flight says too little to place it at all.
 *
 * In order: a tracked flight home, the trip's own hotel checkout, a week from that hotel's check-in, and
 * failing all of that a fortnight from the landing.
 *
 * The fallbacks deliberately read the trip's own bookings and never the waiting queue. A waiting booking
 * that set the window it is then measured against would let a hotel from any trip pull this trip's end date
 * out to meet it, and every queued booking would match every trip.
 */
export function stayEndYmd(t: StayFlight, all: StayFlight[]): string | undefined {
  const dest = usableAirportCode(t?.flight?.destination);
  const arrival = day(t?.flight?.scheduledArrival || t?.flight?.arrivalTime);
  if (!dest || !arrival) return undefined;

  let end = '';
  for (const other of all || []) {
    if (!other || other.key === t.key) continue;
    if (usableAirportCode(other.flight?.origin) !== dest) continue;
    const dep = day(other.flight?.scheduledDeparture || other.scheduledTime);
    if (!dep || dep < arrival) continue;
    if (!end || dep < end) end = dep;
  }
  if (end) return end;

  const hotel = t?.tripExtras?.hotel;
  const checkOut = day(hotel?.checkOut);
  if (checkOut && checkOut >= arrival) return checkOut;
  const checkIn = day(hotel?.checkIn);
  if (checkIn && checkIn >= arrival) return ymdPlusDays(checkIn, STAY_FROM_CHECKIN_DAYS) || undefined;
  return ymdPlusDays(arrival, STAY_FALLBACK_DAYS) || undefined;
}
