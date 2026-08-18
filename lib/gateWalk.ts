import { t } from './i18n';

const FALLBACK_ESTIMATE = 15;
export const CONNECTION_BUFFER_MIN = 10;

const ARRIVAL_EXITS: Record<string, string> = {
  AMS: 'Uitgang 3 — rechts na de douane',
  SIN: 'Exit 1 — Arrival Hall after customs',
  BKK: 'Exit B — after customs, follow Meeting Point',
  KUL: 'Public Arrivals — after customs, ground floor',
};

const AIRPORT_PHONE: Record<string, string> = {
  AMS: '+31207940800',
  SIN: '+6565956868',
  BKK: '+6621321888',
  KUL: '+60387778000',
};

const BAGGAGE_WALK: Record<string, number> = {
  AMS: 12,
  SIN: 14,
  BKK: 15,
  KUL: 12,
};

const AMS_PIER: Record<string, number> = {
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 8, M: 9, S: 7,
};

const SIN_TERMINAL: Record<string, number> = {
  A: 3, B: 3, C: 1, D: 1, E: 1, F: 2, G: 2,
};

const BKK_CONCOURSE: Record<string, number> = {
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6,
};

const KUL_PIER: Record<string, number> = {
  G: 0, H: 1, J: 2, K: 3, L: 4, M: 5, P: 6, Q: 7,
};

export type WalkEstimate = {
  minutes: number;
  estimate: boolean;
  /** Walk time including safety buffer — used for feasibility checks. */
  buffered?: number;
};

function code(iata?: string): string {
  return String(iata || '').trim().toUpperCase();
}

function normalizeTerminal(terminal?: string): string {
  const raw = String(terminal || '').trim();
  if (!raw || raw === '—' || /^(-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  const body = raw.replace(/^terminal\s+/i, '').replace(/\s+/g, '');
  if (!body) return '';
  if (/^t\d/i.test(body)) return body.toUpperCase();
  if (/^\d/.test(body)) return `T${body}`;
  return body.toUpperCase();
}

function parseGate(gate?: string): { pier: string; num: number } | null {
  const raw = String(gate || '').replace(/^gates?\s*:?\s*/i, '').trim().toUpperCase();
  if (!raw || /^(—|-|–|n\/?a|tba|tbd)$/i.test(raw)) return null;
  const m = raw.match(/^([A-Z]+)(\d+)?/);
  if (!m) return null;
  return { pier: m[1], num: m[2] ? Number(m[2]) : 0 };
}

function samePierWalk(a: { num: number }, b: { num: number }, base: number): number {
  return Math.max(base, Math.round(base + Math.min(8, Math.abs(a.num - b.num) * 0.2)));
}

function indexWalk(
  from: { pier: string; num: number },
  to: { pier: string; num: number },
  index: Record<string, number>,
  sameBase: number,
  step: number,
): number | null {
  const ia = index[from.pier[0]];
  const ib = index[to.pier[0]];
  if (ia == null || ib == null) return null;
  if (ia === ib) return samePierWalk(from, to, sameBase);
  return Math.round(sameBase + 4 + Math.abs(ia - ib) * step);
}

export function arrivalExitHint(iata?: string): string | null {
  return ARRIVAL_EXITS[code(iata)] || null;
}

export function airportPhone(iata?: string): string | null {
  return AIRPORT_PHONE[code(iata)] || null;
}

export function baggageWalkMinutes(iata?: string): number {
  return BAGGAGE_WALK[code(iata)] ?? 12;
}

export function gateWalkMinutes(iata?: string, fromGate?: string, toGate?: string): WalkEstimate {
  const hub = code(iata);
  const from = parseGate(fromGate);
  const to = parseGate(toGate);
  if (!from || !to) return { minutes: FALLBACK_ESTIMATE, estimate: true };

  if (hub === 'AMS') {
    const n = indexWalk(from, to, AMS_PIER, 6, 4);
    if (n != null) return { minutes: n, estimate: false };
  }
  if (hub === 'SIN') {
    if (from.pier.startsWith('T4') || to.pier.startsWith('T4') || from.pier === 'T' || to.pier === 'T') {
      const t4 = from.pier.includes('4') || to.pier.includes('4');
      if (t4) return { minutes: 28, estimate: false };
    }
    const n = indexWalk(from, to, SIN_TERMINAL, 8, 4);
    if (n != null) return { minutes: n, estimate: false };
  }
  if (hub === 'BKK') {
    const n = indexWalk(from, to, BKK_CONCOURSE, 7, 4);
    if (n != null) return { minutes: n, estimate: false };
  }
  if (hub === 'KUL') {
    const n = indexWalk(from, to, KUL_PIER, 8, 3);
    if (n != null) return { minutes: n, estimate: false };
  }

  return { minutes: FALLBACK_ESTIMATE, estimate: true };
}

/** Connection walk: terminal rules + 10 min safety buffer for feasibility. */
export function connectionWalkMinutes(
  iata?: string,
  fromGate?: string,
  toGate?: string,
  fromTerminal?: string,
  toTerminal?: string,
): WalkEstimate {
  const hub = code(iata);
  const fromT = normalizeTerminal(fromTerminal);
  const toT = normalizeTerminal(toTerminal);

  if (fromT && toT) {
    if (fromT === toT) {
      return { minutes: 8, estimate: false, buffered: 8 + CONNECTION_BUFFER_MIN };
    }
    if (hub === 'BKK' && (
      (fromT === 'T1' && toT === 'T2') || (fromT === 'T2' && toT === 'T1')
    )) {
      return { minutes: 25, estimate: false, buffered: 25 + CONNECTION_BUFFER_MIN };
    }
    return { minutes: 20, estimate: true, buffered: 20 + CONNECTION_BUFFER_MIN };
  }

  const base = gateWalkMinutes(iata, fromGate, toGate);
  return {
    minutes: base.minutes,
    estimate: base.estimate,
    buffered: base.minutes + CONNECTION_BUFFER_MIN,
  };
}

export function walkBuffered(walk: WalkEstimate): number {
  return walk.buffered ?? walk.minutes + CONNECTION_BUFFER_MIN;
}

export function walkLabel(walk: WalkEstimate): string {
  return walk.estimate ? t().walkMinEstimate(walk.minutes) : t().walkMin(walk.minutes);
}

export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type RaceBand = 'green' | 'orange' | 'red';

/** Status band from minutes until outgoing boards (or total connection window). */
export function raceBand(gapOrRemainMin: number, _walkMin?: number): RaceBand {
  if (gapOrRemainMin > 45) return 'green';
  if (gapOrRemainMin >= 20) return 'orange';
  return 'red';
}

export function connectionMissed(marginMin: number): boolean {
  return marginMin < 10;
}

export function raceStatusText(band: RaceBand): string {
  if (band === 'green') return t().gateRaceGotTime;
  if (band === 'orange') return t().gateRaceClose;
  return t().gateRaceRunNotify;
}

export const RACE_COLOR: Record<RaceBand, string> = {
  green: '#22C55E',
  orange: '#F59E0B',
  red: '#EF4444',
};
