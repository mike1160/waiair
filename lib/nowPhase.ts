/**
 * The "Now" card message, purely from the time left until departure and where the flight is.
 * No React Native imports: the ladder and its boundaries are unit-tested.
 *
 * Before departure the clock always wins. A stale landed / boarding / departed flag
 * (same flight number on an earlier day) must not say the passenger has landed.
 */

export type NowPhaseId =
  | 'tomorrow'
  | 'checkin'
  | 'prepare'
  | 'head'
  | 'airport'
  | 'boarding'
  | 'inflight'
  | 'landed'
  | 'unknown';

/** Online check-in opens 24h before departure. */
export const CHECKIN_OPENS_MIN = 24 * 60;

function minutesOf(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Whole days on the >24h card. 1 means "tomorrow" (until 48h out);
 * 2+ is "in N days". Null once check-in territory starts (≤24h).
 */
export function daysUntilDeparture(minutesToDeparture?: number | null): number | null {
  const m = minutesOf(minutesToDeparture);
  if (m == null || m <= CHECKIN_OPENS_MIN) return null;
  if (m < 48 * 60) return 1;
  return Math.max(2, Math.round(m / (24 * 60)));
}

export function nowPhaseId(opts: {
  /** Minutes until departure; null when the flight has no usable time (then the card falls back). */
  minutesToDeparture?: number | null;
  boarding?: boolean;
  departed?: boolean;
  landed?: boolean;
}): NowPhaseId {
  const m = minutesOf(opts.minutesToDeparture);
  // Still before the scheduled departure: the clock is the phase.
  // Landed, inflight and boarding are not shown until that time has passed.
  if (m == null || m <= 0) {
    if (opts.landed) return 'landed';
    if (opts.departed) return 'inflight';
    if (opts.boarding) return 'boarding';
  }
  if (m == null) return 'unknown';
  if (m > 24 * 60) return 'tomorrow';
  if (m > 12 * 60) return 'checkin';
  if (m > 3 * 60) return 'prepare';
  if (m > 60) return 'head';
  return 'airport';
}

/** Whole hours until check-in opens; 0 once it is open. */
export function hoursUntilCheckin(minutesToDeparture?: number | null): number {
  const m = typeof minutesToDeparture === 'number' && Number.isFinite(minutesToDeparture) ? minutesToDeparture : null;
  if (m == null) return 0;
  return Math.max(0, Math.ceil((m - CHECKIN_OPENS_MIN) / 60));
}

export type NowPhaseCopy = {
  nowTomorrow: string;
  /** Title when departure is two or more days away ("in 6 days"). */
  nowInDays: (days: number) => string;
  nowTomorrowSub: (hours: number) => string;
  nowCheckinOpen: string;
  nowCheckinOpenSub: string;
  nowPrepare: string;
  nowPrepareSub: string;
  nowHeadToAirport: string;
  nowHeadToAirportSub: string;
  nowAtAirportNow: string;
  nowAtAirportNowSub: string;
  nowBoardingSoon: string;
  nowBoardingSoonSub: string;
  nowOnYourWay: string;
  nowOnYourWaySub: (duration: string) => string;
  nowWelcomeTo: (city: string) => string;
  nowBaggageTerminal: (terminal: string) => string;
  nowBaggageClaim: string;
  nowCheckDetails: string;
};

export type NowPhaseFacts = {
  /** Minutes until departure, for the "check-in opens in X hours" line. */
  minutesToDeparture?: number | null;
  /** Remaining flight time, already formatted ("2h 15m"). */
  landsIn?: string;
  /** Arrival city for the landed title. */
  city?: string;
  /** Arrival terminal from the flight data, when known. */
  terminal?: string;
};

/** Title and subtitle for a phase; an empty subtitle means the card shows the title alone. */
export function nowPhaseLines(id: NowPhaseId, copy: NowPhaseCopy, facts: NowPhaseFacts = {}): { title: string; sub: string } {
  const city = String(facts.city || '').trim();
  const terminal = String(facts.terminal || '').trim();
  const landsIn = String(facts.landsIn || '').trim();
  switch (id) {
    case 'tomorrow': {
      const days = daysUntilDeparture(facts.minutesToDeparture);
      const title = days != null && days >= 2 ? copy.nowInDays(days) : copy.nowTomorrow;
      return { title, sub: copy.nowTomorrowSub(hoursUntilCheckin(facts.minutesToDeparture)) };
    }
    case 'checkin':
      return { title: copy.nowCheckinOpen, sub: copy.nowCheckinOpenSub };
    case 'prepare':
      return { title: copy.nowPrepare, sub: copy.nowPrepareSub };
    case 'head':
      return { title: copy.nowHeadToAirport, sub: copy.nowHeadToAirportSub };
    case 'airport':
      return { title: copy.nowAtAirportNow, sub: copy.nowAtAirportNowSub };
    case 'boarding':
      return { title: copy.nowBoardingSoon, sub: copy.nowBoardingSoonSub };
    case 'inflight':
      return { title: copy.nowOnYourWay, sub: landsIn ? copy.nowOnYourWaySub(landsIn) : '' };
    case 'landed':
      return {
        title: city ? copy.nowWelcomeTo(city) : copy.nowBaggageClaim,
        sub: terminal ? copy.nowBaggageTerminal(terminal) : (city ? copy.nowBaggageClaim : ''),
      };
    default:
      return { title: copy.nowCheckDetails, sub: '' };
  }
}
