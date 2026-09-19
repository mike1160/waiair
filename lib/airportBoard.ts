/**
 * What the airport-mode board card shows: one status word and its colour, and the airline's short name.
 * Pure — no React Native imports — so the status order is unit-tested.
 */

export type BoardStatus = 'on_time' | 'delayed' | 'boarding' | 'departed' | 'landed' | 'cancelled';

export const BOARD_STATUS_COLOR: Record<BoardStatus, string> = {
  on_time: '#00FF41',
  delayed: '#FF3B30',
  boarding: '#FFC600',
  departed: '#00FF41',
  landed: '#888888',
  cancelled: '#FF3B30',
};

/** Boarding pulses; nothing else moves. */
export function boardStatusPulses(status: BoardStatus): boolean {
  return status === 'boarding';
}

/**
 * The one word on the board. Where the flight *is* wins over whether it is late: a delayed flight that has
 * landed says LANDED, one that is boarding says BOARDING. Late before departure is DELAYED.
 */
export function boardStatus(input: {
  status?: string | null;
  livePhase?: string | null;
  delayed?: boolean;
  depOffsetMin?: number | null;
}): BoardStatus {
  const s = String(input.status || '').toLowerCase();
  const p = String(input.livePhase || '').toLowerCase();
  if (s === 'cancelled' || s === 'canceled' || s === 'diverted') return 'cancelled';
  if (s === 'landed' || p === 'landed') return 'landed';
  if (s === 'en-route' || s === 'departed' || p === 'enroute' || p === 'departed') return 'departed';
  if (s === 'boarding' || p === 'boarding') return 'boarding';
  if (s === 'delayed' || input.delayed || (typeof input.depOffsetMin === 'number' && input.depOffsetMin > 0)) return 'delayed';
  return 'on_time';
}

/** "Thai Airways" → "THAI"; a short word a board has room for. */
export function airlineShort(name?: string | null): string {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  return first.replace(/[^\p{L}\p{N}-]/gu, '').toUpperCase().slice(0, 10);
}
