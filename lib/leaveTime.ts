/** Airport-lead and passenger DATE-push timing. Pure — no Notifications, no homeNow. */

import { formatInTimeZone } from 'date-fns-tz';
import { timezoneForIata } from './airportTz.ts';
import { wallClockInZoneToUtcMs } from './localFlightTime.ts';

/** Minutes at the airport before departure, before subtracting travel. */
export const AIRPORT_LEAD_MIN = {
  international: { relaxed: 180, tight: 120 },
  domestic: { relaxed: 90, tight: 60 },
} as const;

/** Check-in counters open before departure. */
export const COUNTERS_OPEN_MIN = {
  international: 180,
  domestic: 120,
} as const;

export const BOARDING_PASS_LEAD_CUT_MIN = 30;
export const EVENING_GATE_BEFORE_DEP_MIN = 30;
export const LEAVE_PUSH_BEFORE_MIN = 10;
export const EVENING_PUSH_HOUR = 20;
export const DATE_PUSH_SHIFT_MIN = 10;
/** Unknown travel estimate → 45 min and the word “around”. */
export const UNKNOWN_TRAVEL_MIN = 45;

export type AirportTimingPref = 'relaxed' | 'tight';

export type LeaveAtOpts = {
  international: boolean;
  tight?: boolean;
  boardingPass?: boolean;
  /** Finite minutes = known estimate. Null/undefined = unknown (45 + around). */
  travelMin?: number | null;
};

export type LeaveAtResult = {
  leaveAt: number;
  travelMin: number;
  around: boolean;
  leadMin: number;
  targetMs: number;
};

export function airportLeadMin(opts: {
  international: boolean;
  tight?: boolean;
  boardingPass?: boolean;
}): number {
  const table = opts.international ? AIRPORT_LEAD_MIN.international : AIRPORT_LEAD_MIN.domestic;
  let lead: number = opts.tight ? table.tight : table.relaxed;
  if (opts.boardingPass) lead = Math.max(0, lead - BOARDING_PASS_LEAD_CUT_MIN);
  return lead;
}

export function countersOpenMin(international: boolean): number {
  return international ? COUNTERS_OPEN_MIN.international : COUNTERS_OPEN_MIN.domestic;
}

export function formatLeadLabel(leadMin: number): string {
  const h = Math.floor(leadMin / 60);
  const m = leadMin % 60;
  if (h > 0 && m > 0) return `${h} h ${m}`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

export function formatLeaveParts(
  depClock: string,
  leadMin: number,
  travelMin: number,
  leaveClock: string,
): string {
  return `${depClock} − ${formatLeadLabel(leadMin)} − ${travelMin} min travel = ${leaveClock}`;
}

/** leaveAt = (dep − lead) − travel. Unknown travel → 45 min. */
export function leaveAtUtcMs(depMs: number, opts: LeaveAtOpts): LeaveAtResult {
  const around = opts.travelMin == null || !Number.isFinite(opts.travelMin);
  const travel = around ? UNKNOWN_TRAVEL_MIN : Math.max(0, opts.travelMin as number);
  const lead = airportLeadMin(opts);
  const targetMs = depMs - lead * 60_000;
  return {
    leaveAt: targetMs - travel * 60_000,
    travelMin: travel,
    around,
    leadMin: lead,
    targetMs,
  };
}

export function leavePushFireUtcMs(leaveAtMs: number): number {
  return leaveAtMs - LEAVE_PUSH_BEFORE_MIN * 60_000;
}

export function shouldScheduleLeavePush(leaveAtMs: number, now: number): boolean {
  return leaveAtMs > now;
}

/** Evening-before 20:00 origin-TZ; null if we cannot name a zone day. */
export function eveningPushFireUtcMs(
  depMs: number,
  originIata?: string,
  originCountry?: string,
): number | null {
  if (!Number.isFinite(depMs)) return null;
  const tz = timezoneForIata(originIata, originCountry);
  const depYmd = formatInTimeZone(new Date(depMs), tz, 'yyyy-MM-dd');
  const [y, m, d] = depYmd.split('-').map(Number);
  if (!y || !m || !d) return null;
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return wallClockInZoneToUtcMs(
    prev.getUTCFullYear(),
    prev.getUTCMonth() + 1,
    prev.getUTCDate(),
    EVENING_PUSH_HOUR,
    0,
    0,
    tz,
  );
}

/** Tomorrow-or-later (origin-local offset) and 20:00 still in the future (no catch-up). */
export function shouldScheduleEveningPush(
  fireAt: number | null,
  now: number,
  dayOffset: number,
): boolean {
  return dayOffset >= 1 && fireAt != null && fireAt > now;
}

export function shouldRescheduleDatePushes(prevDepMs: number | null | undefined, nextDepMs: number): boolean {
  if (prevDepMs == null || !Number.isFinite(prevDepMs) || !Number.isFinite(nextDepMs)) return true;
  return Math.abs(nextDepMs - prevDepMs) >= DATE_PUSH_SHIFT_MIN * 60_000;
}

export function countersOpenUtcMs(depMs: number, international: boolean): number {
  return depMs - countersOpenMin(international) * 60_000;
}

export function eveningGateUtcMs(depMs: number): number {
  return depMs - EVENING_GATE_BEFORE_DEP_MIN * 60_000;
}

export function datePushIdsToCancel(ids?: { evening?: string; leave?: string } | null): string[] {
  if (!ids) return [];
  return [ids.evening, ids.leave].filter((x): x is string => !!x);
}
