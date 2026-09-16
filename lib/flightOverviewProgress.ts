/** Compact in-list progress: (now - departed) / (eta - departed), cap 99% until landed. */

export type OverviewProgressTone = 'onTime' | 'delayed' | 'unknown' | 'landed';

export function shouldShowOverviewProgress(phase: string): boolean {
  const p = String(phase || '').replace(/[_\s-]/g, '').toLowerCase();
  return p === 'enroute' || p === 'departed' || p === 'inflight';
}

export function overviewBarPct(raw01: number, landed: boolean): number {
  if (landed) return 100;
  const n = Number(raw01);
  if (!Number.isFinite(n)) return 0;
  return Math.min(99, Math.max(0, Math.round(n * 100)));
}

export function overviewBarTone(input: {
  delay?: number;
  status?: string;
  landed?: boolean;
}): OverviewProgressTone {
  if (input.landed) return 'landed';
  const st = String(input.status || '').toLowerCase();
  if (st === 'unknown') return 'unknown';
  if (st === 'delayed' || (typeof input.delay === 'number' && input.delay > 0)) return 'delayed';
  return 'onTime';
}

export function remainingMinutesTo(arrMs: number | null | undefined, now = Date.now()): number | null {
  if (arrMs == null || !Number.isFinite(arrMs)) return null;
  const mins = Math.floor((arrMs - now) / 60000);
  if (mins <= 0) return null;
  return mins;
}

/** Clock fragment only — wrap with i18n "nog" / "left". */
export function formatRemainClock(mins: number, locale: string): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (locale === 'nl') {
    if (h <= 0) return `${m}m`;
    return m ? `${h}u ${m}m` : `${h}u`;
  }
  if (locale === 'th') {
    if (h <= 0) return `${m} น.`;
    return m ? `${h} ชม. ${m} น.` : `${h} ชม.`;
  }
  if (h <= 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
