/** Passenger evening + leave DATE push copy and plan. Pure — no Notifications. */

import { formatAirportClock, resolveDepartureIso, flightClockUtcMs, type FlightClockFields } from './flightTimes.ts';
import { homeRelativeDayOffset, isInternationalFlight } from './homeNow.ts';
import {
  countersOpenUtcMs,
  eveningGateUtcMs,
  eveningPushFireUtcMs,
  leaveAtUtcMs,
  leavePushFireUtcMs,
  shouldScheduleEveningPush,
  shouldScheduleLeavePush,
} from './leaveTime.ts';

export type DatePushCopy = {
  pushTomorrowTitle: (num: string, city: string) => string;
  pushTomorrowBody: (dep: string, from: string, checkin: string, gateTime: string) => string;
  pushTomorrowBodyPass: (dep: string, from: string, gateTime: string) => string;
  pushLeaveTitle: (num: string, city: string, leave: string) => string;
  pushLeaveBody: (dep: string, from: string, travel: number) => string;
};

export type PassengerDatePushInput = {
  flightNumber: string;
  originIata?: string;
  originCountry?: string;
  destCountry?: string;
  destCity: string;
  fromCity: string;
  travelMin?: number | null;
  tight?: boolean;
  hasBoardingPass?: boolean;
  hour12?: boolean;
  copy: DatePushCopy;
};

export type ScheduledDatePush = {
  fireAt: number;
  title: string;
  body: string;
};

export type PassengerDatePushPlan = {
  evening: ScheduledDatePush | null;
  leave: (ScheduledDatePush & { leaveAt: number }) | null;
};

export function hasBoardingPassScan(pass?: { seat?: string; sequence?: string; pnr?: string } | null): boolean {
  return !!(pass && (pass.seat || pass.sequence || pass.pnr));
}

export function passengerDepMs(f: FlightClockFields): number | null {
  const iso = resolveDepartureIso(f);
  const ms = flightClockUtcMs(iso, f.origin, f.originCountry);
  return ms != null && Number.isFinite(ms) ? ms : null;
}

function clockAt(ms: number, iata?: string, country?: string, hour12 = false): string {
  return formatAirportClock(new Date(ms).toISOString(), iata, hour12, country);
}

export function planPassengerDatePushes(
  depMs: number,
  now: number,
  input: PassengerDatePushInput,
): PassengerDatePushPlan {
  const international = isInternationalFlight({
    originCountry: input.originCountry,
    destCountry: input.destCountry,
  });
  const hour12 = !!input.hour12;
  const origin = input.originIata;
  const num = input.flightNumber;
  const depClock = clockAt(depMs, origin, input.originCountry, hour12);
  const dayOffset = homeRelativeDayOffset(depMs, now, origin, input.originCountry);

  let evening: ScheduledDatePush | null = null;
  const eveningAt = eveningPushFireUtcMs(depMs, origin, input.originCountry);
  if (shouldScheduleEveningPush(eveningAt, now, dayOffset) && eveningAt != null) {
    const gateTime = clockAt(eveningGateUtcMs(depMs), origin, input.originCountry, hour12);
    const title = input.copy.pushTomorrowTitle(num, input.destCity);
    const body = input.hasBoardingPass
      ? input.copy.pushTomorrowBodyPass(depClock, input.fromCity, gateTime)
      : input.copy.pushTomorrowBody(
        depClock,
        input.fromCity,
        clockAt(countersOpenUtcMs(depMs, international), origin, input.originCountry, hour12),
        gateTime,
      );
    evening = { fireAt: eveningAt, title, body };
  }

  let leave: (ScheduledDatePush & { leaveAt: number }) | null = null;
  const leaveRes = leaveAtUtcMs(depMs, {
    international,
    tight: !!input.tight,
    boardingPass: !!input.hasBoardingPass,
    travelMin: input.travelMin,
  });
  if (shouldScheduleLeavePush(leaveRes.leaveAt, now)) {
    const fireAt = leavePushFireUtcMs(leaveRes.leaveAt);
    if (fireAt > now) {
      const leaveClock = clockAt(leaveRes.leaveAt, origin, input.originCountry, hour12);
      leave = {
        fireAt,
        leaveAt: leaveRes.leaveAt,
        title: input.copy.pushLeaveTitle(num, input.destCity, leaveClock),
        body: input.copy.pushLeaveBody(depClock, input.fromCity, leaveRes.travelMin),
      };
    }
  }

  return { evening, leave };
}

/** True if a DATE would fire immediately (catch-up / add-time). Plan must never do this. */
export function hasImmediatePassengerPush(plan: PassengerDatePushPlan, now: number): boolean {
  if (plan.evening && plan.evening.fireAt <= now) return true;
  if (plan.leave && plan.leave.fireAt <= now) return true;
  return false;
}
