import { knownTemperature } from './temperatureValue.ts';
/**
 * The answers the app already knows [T/1].
 *
 * Most briefing questions never leave the phone. Whether the flight is on time, what the weather is where it
 * lands, when to set off, whether a delay is worth money — the app is holding all of that already, and
 * asking anyone else would be slower, cost money, and risk a worse answer than the one in memory.
 *
 * So these come back instantly and are always the same for the same facts. Every one of them takes plain
 * values and returns a string, which is why they can be tested without a device: no storage, no network, no
 * React. What is *not* here is anything the app would have to guess at — there is no taxi-fare table in this
 * repo, so there is no taxi-fare answer.
 *
 * Unit-tested in lib/briefingAnswers.test.ts.
 */

/** The strings these answers are built from, passed in so this module needs no i18n import. */
export interface BriefingAnswerCopy {
  briefingWeatherAt: (city: string, temp: string, condition: string) => string;
  briefingEarlyAirport: (clock: string, hours: string) => string;
  briefingFlightOnTime: string;
  briefingFlightDelayed: (min: number) => string;
  briefingEu261Yes: (amount: string) => string;
  briefingEu261No: string;
}

/** Before an international flight. Long enough for a queue that is having a bad morning. */
export const CHECKIN_HOURS_INTERNATIONAL = 3;
/** Before a domestic one, where there is no passport queue to sit in. */
export const CHECKIN_HOURS_DOMESTIC = 2;
/** The hours when the road and the terminal are both against you. */
export const PEAK_EXTRA_MIN = 30;

/** Is this hour one of the bad ones? Mornings 07:00–09:00, evenings 16:00–19:00. */
export function isPeakHour(hour: number): boolean {
  const h = Math.floor(Number(hour));
  if (!Number.isFinite(h)) return false;
  return (h >= 7 && h < 9) || (h >= 16 && h < 19);
}

/** Same country at both ends, so no passport control and one hour less standing about. */
export function isDomestic(originCountry?: string, destCountry?: string): boolean {
  const a = String(originCountry || '').trim().toUpperCase();
  const b = String(destCountry || '').trim().toUpperCase();
  return !!a && a === b;
}

/**
 * How long before departure to be at the airport, in minutes. Three hours international, two domestic, and
 * half an hour more when the departure falls in rush hour — the road there is part of the journey.
 */
export function leaveLeadMinutes(opts: {
  originCountry?: string;
  destCountry?: string;
  departureHour?: number | null;
}): number {
  const base = (isDomestic(opts.originCountry, opts.destCountry)
    ? CHECKIN_HOURS_DOMESTIC
    : CHECKIN_HOURS_INTERNATIONAL) * 60;
  const hour = Number(opts.departureHour);
  return Number.isFinite(hour) && isPeakHour(hour) ? base + PEAK_EXTRA_MIN : base;
}

/** "2h 30m" / "3h", for the lead time above. */
export function formatLead(minutes: number): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * When to be at the airport, as a sentence. `clock` is the time to be there, already formatted in the
 * departure airport's own clock by the caller — this module knows nothing about timezones.
 */
export function answerHowEarly(
  copy: BriefingAnswerCopy,
  opts: { clock: string; leadMinutes: number },
): string | null {
  const clock = String(opts.clock || '').trim();
  if (!clock) return null;
  return copy.briefingEarlyAirport(clock, formatLead(opts.leadMinutes));
}

/** The weather where the flight lands, in one sentence. Null when there is nothing to report. */
export function answerWeather(
  copy: BriefingAnswerCopy,
  opts: { city?: string; temp?: number | null; condition?: string },
): string | null {
  const city = String(opts.city || '').trim();
  const condition = String(opts.condition || '').trim();
  // [W/12] Same trap as lib/briefingClient.ts: Number(null) is 0, so a missing reading was printed as 0°.
  const temp = knownTemperature(opts.temp);
  if (!city || (temp === null && !condition)) return null;
  return copy.briefingWeatherAt(city, temp === null ? '' : `${Math.round(temp)}°`, condition);
}

/** On time, or how late. One sentence, and never a guess about why. */
export function answerOnSchedule(
  copy: BriefingAnswerCopy,
  opts: { delayMinutes?: number | null },
): string {
  const delay = Math.round(Number(opts.delayMinutes) || 0);
  return delay > 0 ? copy.briefingFlightDelayed(delay) : copy.briefingFlightOnTime;
}

/**
 * Whether this delay is worth money, and how much. The rules themselves live in lib/eu261.ts and are not
 * repeated here — the caller passes what that worked out, and this only says it out loud.
 */
export function answerCompensation(
  copy: BriefingAnswerCopy,
  claim: { eligible?: boolean; amount?: number | null } | null | undefined,
): string {
  const amount = Number(claim?.amount);
  if (!claim?.eligible || !Number.isFinite(amount) || amount <= 0) return copy.briefingEu261No;
  return copy.briefingEu261Yes(`€${Math.round(amount)}`);
}
