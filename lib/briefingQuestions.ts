/**
 * What the app offers to tell you, and when [T/1].
 *
 * Three chips under the hub, chosen by where the flight is. Not a menu of everything it could say — the
 * three things worth asking at that moment. Before you leave: the weather you are flying into, when to set
 * off, whether you need a visa. Once it is late: whether that is worth money, and what to do with the time.
 * In the air: how to get from the terminal to the hotel.
 *
 * Most of them the app answers itself, off data it already holds, with no request to anywhere. Those are
 * marked `deterministic` and are instant. The handful that genuinely need the outside world are marked `ai`
 * and cost a round trip — and nothing is fetched for any of them until the chip is actually tapped.
 *
 * The phases here are the app's own (lib/flightPhase.ts); nothing about them changes. A delay outranks the
 * phase, because a flight that is an hour late has made the question of what to do next more interesting
 * than whatever the clock says.
 *
 * Pure, and unit-tested in lib/briefingQuestions.test.ts.
 */

import type { FlightPhase } from './flightPhase.ts';

/** How an answer is found: on the device, or by asking the proxy. */
export type BriefingSource = 'deterministic' | 'ai';

/** The things the app can answer by itself. Each one has its own function in lib/briefingAnswers.ts. */
export type BriefingTopic =
  | 'weatherArrival'
  | 'howEarly'
  | 'entryRequirements'
  | 'onSchedule'
  | 'compensation'
  | 'weatherNow'
  | 'taxiCash'
  | 'traffic'
  | 'baggageRules'
  | 'delayThings'
  | 'alternatives'
  | 'toHotel'
  | 'toCentre'
  | 'publicTransport'
  | 'roads';

export interface BriefingChip {
  topic: BriefingTopic;
  /** The key in lib/i18n.ts holding the question as the traveller reads it. */
  labelKey: string;
  source: BriefingSource;
}

/** The groups of chips. A delay is its own group, whatever phase the flight is in. */
export type BriefingGroup = 'prep' | 'departure' | 'delay' | 'inflight' | 'arrived';

const CHIPS: Record<BriefingGroup, BriefingChip[]> = {
  prep: [
    { topic: 'weatherArrival', labelKey: 'briefingQWeatherArrival', source: 'deterministic' },
    { topic: 'howEarly', labelKey: 'briefingQHowEarly', source: 'deterministic' },
    { topic: 'entryRequirements', labelKey: 'briefingQEntry', source: 'deterministic' },
  ],
  departure: [
    { topic: 'onSchedule', labelKey: 'briefingQOnSchedule', source: 'deterministic' },
    { topic: 'traffic', labelKey: 'briefingQTraffic', source: 'ai' },
    { topic: 'baggageRules', labelKey: 'briefingQBaggage', source: 'ai' },
  ],
  delay: [
    { topic: 'compensation', labelKey: 'briefingQCompensation', source: 'deterministic' },
    { topic: 'delayThings', labelKey: 'briefingQDelayThings', source: 'ai' },
    { topic: 'alternatives', labelKey: 'briefingQAlternatives', source: 'ai' },
  ],
  inflight: [
    { topic: 'toHotel', labelKey: 'briefingQToHotel', source: 'ai' },
    { topic: 'weatherNow', labelKey: 'briefingQWeatherNow', source: 'deterministic' },
    /*
     * Asked out rather than answered here: there is no taxi-fare data in this repo, only journey times
     * (taxiMinutes). A made-up amount in a currency someone is about to hand over is worse than no amount.
     */
    { topic: 'taxiCash', labelKey: 'briefingQTaxiCash', source: 'ai' },
  ],
  arrived: [
    { topic: 'toCentre', labelKey: 'briefingQToCentre', source: 'ai' },
    { topic: 'publicTransport', labelKey: 'briefingQPublicTransport', source: 'ai' },
    { topic: 'roads', labelKey: 'briefingQRoads', source: 'ai' },
  ],
};

/** A flight is late enough for the delay questions to be the interesting ones. */
export const BRIEFING_DELAY_MIN = 15;

/**
 * Which group of chips belongs to this moment. The app's phases map onto the five groups; anything the
 * briefing has nothing useful to say about (PRACTICAL, FINAL — the app's own cards are doing the talking
 * there) gets the preparation questions, which are never wrong to offer.
 */
export function briefingGroupFor(phase: FlightPhase | null | undefined, delayMinutes = 0): BriefingGroup | null {
  if (!phase) return null;
  // A real delay wins: it is the thing the traveller is actually thinking about.
  if (Number(delayMinutes) > BRIEFING_DELAY_MIN && phase !== 'INFLIGHT'
    && phase !== 'ARRIVED' && phase !== 'COMPLETED') {
    return 'delay';
  }
  switch (phase) {
    case 'PREP':
    case 'EVE':
    case 'PRACTICAL':
    case 'FINAL':
      return 'prep';
    case 'DEPARTURE':
    case 'STOPOVER':
      return 'departure';
    case 'INFLIGHT':
      return 'inflight';
    case 'ARRIVED':
    case 'COMPLETED':
      return 'arrived';
    default:
      return null;
  }
}

/**
 * The chips to show, at most three. `weatherAlert` is the one condition that hides a question rather than
 * showing one: asking whether the roads are passable when nothing is wrong invents a worry.
 */
export function briefingChips(
  phase: FlightPhase | null | undefined,
  opts: { delayMinutes?: number; weatherAlert?: boolean } = {},
): BriefingChip[] {
  const group = briefingGroupFor(phase, opts.delayMinutes || 0);
  if (!group) return [];
  return CHIPS[group]
    .filter(c => c.topic !== 'roads' || !!opts.weatherAlert)
    .slice(0, 3);
}
