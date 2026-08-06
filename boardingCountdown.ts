/** Shared boarding / departure countdown helpers for detail, My Flights, Live Activities */

export type BoardingPhase = 'upcoming' | 'boarding' | 'departed' | 'landed' | 'cancelled' | 'other';

export type FlightLike = {
  status: string;
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  actualTime?: string;
};

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
  if (phase === 'boarding') return 'Boarding Now';
  if (phase === 'departed') return 'Departed';
  if (phase === 'landed') return 'Landed';
  if (phase === 'cancelled') return 'Cancelled';

  const iso = boardingTargetIso(f);
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return 'Boarding Now';
  return `Boards in ${formatDurationMs(diff)}`;
}
