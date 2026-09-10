/** Phase → status-pill tone. One table for home card, search list, detail header. */

import { PALETTE_TOKENS } from './themeTokens.ts';

export type StatusPillTone =
  | 'active'
  | 'scheduled'
  | 'landed'
  | 'delayed'
  | 'cancelled';

/** @deprecated Use StatusPillTone. */
export type StatusBadgeTone = StatusPillTone;

const P = PALETTE_TOKENS.light;

/** Gold — boarding, last call, departed, in flight (same as “Boarding now”). */
const GOLD_PILL = { bg: '#2A2000', fg: P.gold } as const;
/** Scheduled — muted. */
const MUTED_PILL = { bg: P.bg, fg: P.textMuted } as const;
/** Landed / done — navy on cream. */
const LANDED_PILL = { bg: P.bg, fg: P.navy } as const;
/** Cancelled / diverted. */
const CANCELLED_PILL = { bg: 'rgba(220, 38, 38, 0.14)', fg: P.statusRed } as const;

export const STATUS_PILL_TONES: Record<StatusPillTone, { bg: string; fg: string }> = {
  active: GOLD_PILL,
  delayed: GOLD_PILL,
  scheduled: MUTED_PILL,
  landed: LANDED_PILL,
  cancelled: CANCELLED_PILL,
};

const ALIAS_TONE: Record<string, StatusPillTone> = {
  boarding: 'active',
  enroute: 'active',
  'en-route': 'active',
  gateclosed: 'active',
  'gate-closed': 'active',
  ontime: 'scheduled',
};

export function resolveStatusPillTone(tone?: string | null): StatusPillTone {
  const raw = String(tone || '').toLowerCase().replace(/[_\s]+/g, '-');
  if (raw && raw in STATUS_PILL_TONES) return raw as StatusPillTone;
  if (raw && raw in ALIAS_TONE) return ALIAS_TONE[raw];
  return 'scheduled';
}

export function statusPillToneFromPhase(
  phase?: string | null,
  opts?: { boarding?: boolean; delayed?: boolean; cancelled?: boolean },
): StatusPillTone {
  const raw = String(phase || '').toLowerCase().replace(/[_\s]+/g, '-');
  if (opts?.cancelled || raw === 'cancelled' || raw === 'canceled' || raw === 'diverted') {
    return 'cancelled';
  }
  if (raw === 'landed' || raw === 'arrived' || raw === 'baggage' || raw === 'transport' || raw === 'done') {
    return 'landed';
  }
  if (
    opts?.boarding
    || raw === 'boarding'
    || raw === 'last-call'
    || raw === 'lastcall'
    || raw === 'enroute'
    || raw === 'en-route'
    || raw === 'in-flight'
    || raw === 'departed'
    || raw === 'gateclosed'
    || raw === 'gate-closed'
  ) {
    return 'active';
  }
  if (opts?.delayed || raw === 'delayed') return 'delayed';
  return 'scheduled';
}

/** @deprecated Use statusPillToneFromPhase. */
export const statusBadgeToneFromPhase = statusPillToneFromPhase;
