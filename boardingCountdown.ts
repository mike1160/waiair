import { t } from './lib/i18n';

export type BoardingPhase = 'upcoming' | 'boarding' | 'departed' | 'landed' | 'cancelled' | 'other';

export type FlightLike = {
  status: string;
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  actualTime?: string;
};

/** Airlines typically close the gate this many minutes before departure */
export const GATE_CLOSE_BEFORE_DEP_MIN = 15;

/** Phase 2: gate closing soon — minutes until gate close */
export const GATE_CLOSING_SOON_MIN = 30;

/** Phase 3: last call — minutes until gate close */
export const LAST_CALL_GATE_MIN = 15;

/** iOS home screen widget timeline step (WidgetKit refresh cadence). */
export const WIDGET_TIMELINE_MS = 5 * 60 * 1000;

/** Best-effort boarding / departure target time */
export function boardingTargetIso(f: FlightLike): string {
  return f.departureTime || f.revisedTime || f.scheduledTime || '';
}

export function getBoardingPhase(f: FlightLike, now = Date.now()): BoardingPhase {
  if (f.status === 'cancelled') return 'cancelled';
  if (f.status === 'landed') return 'landed';
  if (f.status === 'boarding') return 'boarding';
  if (f.status === 'en-route') return 'departed';

  const iso = boardingTargetIso(f);
  if (!iso) return f.status === 'delayed' || f.status === 'scheduled' ? 'upcoming' : 'other';

  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 'upcoming';

  if (f.actualTime) {
    const actual = new Date(f.actualTime).getTime();
    if (!Number.isNaN(actual) && actual <= now) return 'departed';
  }

  // Past scheduled/revised departure without boarding status → departed
  if (target <= now) return 'departed';
  return 'upcoming';
}

export function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Live label: "Boards in 1h 23m" | "Boarding Now" | "Departed" | … */
export function boardingCountdownLabel(f: FlightLike, now = Date.now()): string {
  const phase = getBoardingPhase(f, now);
  if (phase === 'boarding') {
    const visual = boardingVisualPhase(f, now);
    if (visual === 'lastCall') return t().lastCall;
    if (visual === 'closing') return t().gateClosing;
    return t().boardingNow;
  }
  if (phase === 'departed') return t().departed;
  if (phase === 'landed') return t().landed;
  if (phase === 'cancelled') return t().cancelled;

  const iso = boardingTargetIso(f);
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return t().boardingNow;
  return t().boardsIn(formatDurationMs(diff));
}

export type LockscreenFlight = FlightLike & {
  destCity?: string;
  destFlag?: string;
  arrivalTime?: string;
};

/** iOS Live Activity / lockscreen copy. */
export function liveLockscreenLabel(f: LockscreenFlight, now = Date.now()): string {
  const phase = getBoardingPhase(f, now);
  if (phase === 'upcoming' || phase === 'boarding') {
    return boardingCountdownLabel(f, now) || t().boardingNow;
  }
  if (phase === 'departed') {
    const arr = f.arrivalTime || '';
    const diff = arr ? new Date(arr).getTime() - now : 0;
    if (Number.isFinite(diff) && diff > 0) return t().enRouteLandsIn(formatDurationMs(diff));
    return t().enRoute;
  }
  if (phase === 'landed') {
    const city = String(f.destCity || '').trim();
    const flag = String(f.destFlag || '').trim();
    if (city) return t().landedWelcomeTo(city, flag);
    return t().landed;
  }
  if (phase === 'cancelled') return t().cancelled;
  return boardingCountdownLabel(f, now);
}

/** Whole minutes until departure (can be negative). */
export function minutesUntilDeparture(f: FlightLike, now = Date.now()): number | null {
  const iso = boardingTargetIso(f);
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - now) / 60000);
}

/**
 * Minutes until gate close (departure minus 15 min).
 * Negative / zero means the gate should already be closed.
 */
export function minutesUntilGateClose(f: FlightLike, now = Date.now()): number | null {
  const iso = boardingTargetIso(f);
  if (!iso) return null;
  const dep = new Date(iso).getTime();
  if (Number.isNaN(dep)) return null;
  const closeAt = dep - GATE_CLOSE_BEFORE_DEP_MIN * 60 * 1000;
  return Math.floor((closeAt - now) / 60000);
}

/** True while the aircraft is still on the ground (not departed / landed / cancelled). */
export function isStillOnGround(f: FlightLike, now = Date.now()): boolean {
  const st = String(f.status);
  if (st === 'cancelled' || st === 'landed' || st === 'en-route') return false;
  if (f.actualTime) {
    const actual = new Date(f.actualTime).getTime();
    if (Number.isFinite(actual) && actual <= now) return false;
  }
  const dep = minutesUntilDeparture(f, now);
  if (dep !== null && dep < -5) return false;
  return true;
}

export type BoardRole = 'arrival' | 'departure';

/** Boarding / gate-close push alerts only when tracking a departure leg. */
export function departureBoardingAlertsEnabled(role?: BoardRole): boolean {
  return role !== 'arrival';
}

export const BOARDING_NOW_GREEN = '#00C853';
export const BOARDING_GATE_ORANGE = '#FF9500';
export const BOARDING_NOW_RED = '#FF3B30';
export const BOARDING_CLOSING_BG = 'rgba(255,149,0,0.05)';
export const BOARDING_LAST_CALL_BG = 'rgba(255,59,48,0.08)';

export type CardBoardingPhase = 'none' | 'open' | 'closing' | 'lastCall';

/**
 * 3-phase boarding chrome. Requires FIDS status === "boarding".
 * Arrivals only get phase 1 (green) — no gate-close countdown from origin dep.
 */
export function boardingVisualPhase(f: FlightLike, now = Date.now(), role?: BoardRole): CardBoardingPhase {
  if (String(f.status) !== 'boarding') return 'none';
  if (role === 'arrival') return 'open';
  if (!isStillOnGround(f, now)) return 'none';
  const mins = minutesUntilGateClose(f, now);
  if (mins !== null && mins <= LAST_CALL_GATE_MIN) return 'lastCall';
  if (mins !== null && mins <= GATE_CLOSING_SOON_MIN) return 'closing';
  return 'open';
}

/**
 * Show Boarding Now on a card when FIDS reports boarding.
 * Time inference is departure-only so arrivals do not light up from origin dep time.
 */
export function isBoardingNowDisplay(f: FlightLike, now = Date.now(), role?: BoardRole): boolean {
  return boardingVisualPhase(f, now, role) !== 'none';
}

/** Show gate-close UI when boarding and gate closes in ≤30 min. */
export function shouldShowGateClose(f: FlightLike, now = Date.now()): boolean {
  return isBoardingNowUrgent(f, now);
}

/** Boarding + gate closes in 30 minutes or less, still on the ground. */
export function isBoardingNowUrgent(f: FlightLike, now = Date.now(), role?: BoardRole): boolean {
  const phase = boardingVisualPhase(f, now, role);
  return phase === 'closing' || phase === 'lastCall';
}

export type FlightCardBoarding = {
  boarding: boolean;
  phase: CardBoardingPhase;
  urgent: boolean;
  label: string;
  color: string;
  backgroundColor: string;
  pulseTo: number;
  pulseMs: number;
};

const PHASE_NONE: FlightCardBoarding = {
  boarding: false,
  phase: 'none',
  urgent: false,
  label: '',
  color: '',
  backgroundColor: 'transparent',
  pulseTo: 1,
  pulseMs: 0,
};

/** List-card boarding chrome: green / orange / last-call red. */
export function flightCardBoarding(f: FlightLike, now = Date.now(), role?: BoardRole): FlightCardBoarding {
  const phase = boardingVisualPhase(f, now, role);
  if (phase === 'lastCall') {
    return {
      boarding: true,
      phase,
      urgent: true,
      label: t().lastCall,
      color: BOARDING_NOW_RED,
      backgroundColor: BOARDING_LAST_CALL_BG,
      pulseTo: 0.2,
      pulseMs: 500,
    };
  }
  if (phase === 'closing') {
    return {
      boarding: true,
      phase,
      urgent: true,
      label: t().gateClosing,
      color: BOARDING_GATE_ORANGE,
      backgroundColor: BOARDING_CLOSING_BG,
      pulseTo: 0.3,
      pulseMs: 900,
    };
  }
  if (phase === 'open') {
    return {
      boarding: true,
      phase,
      urgent: false,
      label: t().boardingNow,
      color: BOARDING_NOW_GREEN,
      backgroundColor: 'transparent',
      pulseTo: 0.5,
      pulseMs: 1200,
    };
  }
  return PHASE_NONE;
}

export function boardingNowUrgentLabel(f: FlightLike, now = Date.now()): string {
  const card = flightCardBoarding(f, now);
  if (card.phase === 'lastCall') {
    const mins = minutesUntilGateClose(f, now);
    if (mins === null) return t().lastCall;
    if (mins <= 0) return t().lastCallGateClosed;
    return t().lastCallGateCloses(mins);
  }
  if (card.phase === 'closing') {
    const mins = minutesUntilGateClose(f, now);
    if (mins === null) return t().gateClosing;
    if (mins <= 0) return t().gateClosing;
    return t().gateClosingRemaining(mins);
  }
  return card.label || t().boardingNow;
}

export function boardingNowUrgentColor(f: FlightLike, now = Date.now()): string {
  return flightCardBoarding(f, now).color || BOARDING_GATE_ORANGE;
}

/** Last Call — boarding and ≤15 min until gate close. */
export function isLastCall(f: FlightLike, now = Date.now(), role?: BoardRole): boolean {
  return boardingVisualPhase(f, now, role) === 'lastCall';
}

export type BoardingNotifyPhase = 'open' | 'closing' | 'lastCall';

export type BoardingNotifyFlight = FlightLike & {
  number?: string;
  origin?: string;
  destination?: string;
  gate?: string;
};

/** Push title/body for each boarding phase. */
export function boardingPushCopy(
  f: BoardingNotifyFlight,
  phase: BoardingNotifyPhase,
  now = Date.now(),
): { title: string; body: string } {
  const num = String(f.number || '').replace(/\s+/g, '').toUpperCase();
  const origin = String(f.origin || '').trim().toUpperCase();
  const dest = String(f.destination || '').trim().toUpperCase();
  const route = origin && dest ? `${origin}→${dest}` : '';
  const gate = String(f.gate || '').trim();
  const gateBit = gate ? t().gate(gate) : '';
  const closeMins = minutesUntilGateClose(f, now);
  const closeShown = closeMins == null ? null : Math.max(0, closeMins);

  if (phase === 'open') {
    return {
      title: t().boardingNowPush,
      body: [num, route, gateBit].filter(Boolean).join(' · '),
    };
  }
  if (phase === 'closing') {
    return {
      title: t().gateClosingSoonPush,
      body: [
        num,
        closeShown == null ? t().gateClosingSoon : t().minToClose(closeShown),
        gateBit,
      ].filter(Boolean).join(' · '),
    };
  }
  return {
    title: t().lastCallPush,
    body: [
      num,
      closeShown == null || closeShown <= 0
        ? t().gateClosingNow
        : t().gateClosesInMin(closeShown),
      t().run,
    ].filter(Boolean).join(' · '),
  };
}
