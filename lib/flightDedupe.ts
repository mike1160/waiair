/** Collapse duplicate FIDS rows (same marketing number, or codeshare of one departure). */

import { identsMatch, slugFlightIdent } from './flightIdent.ts';

export type DedupeFlight = {
  number: string;
  origin?: string;
  destination?: string;
  scheduledTime?: string;
  scheduledDeparture?: string;
  departureTime?: string;
  operatingNumber?: string;
  codeshareStatus?: string;
  isCodeshare?: boolean;
  alsoCodeshare?: string;
};

function schedBits(f: DedupeFlight): { day: string; hm: string } {
  const iso = String(f.scheduledDeparture || f.departureTime || f.scheduledTime || '');
  const day = iso.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
  const hm = iso.match(/T(\d{2}:\d{2})/)?.[1] || iso.match(/[ T](\d{2}:\d{2})/)?.[1] || '';
  return { day, hm };
}

function identKey(f: DedupeFlight): string {
  const { day, hm } = schedBits(f);
  return `${slugFlightIdent(f.number)}|${day}|${hm}`;
}

function slotKey(f: DedupeFlight): string {
  const { day, hm } = schedBits(f);
  return `${String(f.origin || '').toUpperCase()}|${String(f.destination || '').toUpperCase()}|${day}|${hm}`;
}

export function isOperatingCarrier(f: DedupeFlight): boolean {
  const s = String(f.codeshareStatus || '').toLowerCase();
  if (s === 'iscodeshared' || s === 'codeshare' || s === 'iscodeshare') return false;
  if (f.isCodeshare) return false;
  if (s === 'isoperator' || s === 'operator') return true;
  return true;
}

function preferOperating<T extends DedupeFlight>(a: T, b: T): T {
  const aOp = isOperatingCarrier(a);
  const bOp = isOperatingCarrier(b);
  if (aOp !== bOp) return aOp ? a : b;
  return a;
}

function codeshareNums<T extends DedupeFlight>(kept: T, rest: T[]): string {
  const seen = new Set([slugFlightIdent(kept.number)]);
  const out: string[] = [];
  const push = (raw?: string) => {
    const slug = slugFlightIdent(raw);
    if (!slug || seen.has(slug) || identsMatch(slug, kept.number)) return;
    seen.add(slug);
    out.push(slug);
  };
  push(kept.operatingNumber);
  for (const f of rest) {
    push(f.number);
    push(f.operatingNumber);
  }
  return out.join(' · ');
}

export function dedupeRouteFlights<T extends DedupeFlight>(flights: T[]): T[] {
  const byIdent = new Map<string, T>();
  for (const f of flights) {
    const k = identKey(f);
    const prev = byIdent.get(k);
    byIdent.set(k, prev ? preferOperating(prev, f) : f);
  }
  const unique = [...byIdent.values()];

  const bySlot = new Map<string, T[]>();
  for (const f of unique) {
    const k = slotKey(f);
    const g = bySlot.get(k);
    if (g) g.push(f);
    else bySlot.set(k, [f]);
  }

  const out: T[] = [];
  for (const group of bySlot.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const linked = group.some(f => !isOperatingCarrier(f))
      || group.some(f => group.some(o => o !== f && (
        identsMatch(f.operatingNumber, o.number) || identsMatch(o.operatingNumber, f.number)
      )));
    if (!linked) {
      out.push(...group);
      continue;
    }
    const op = group.find(isOperatingCarrier) || group[0];
    const rest = group.filter(f => f !== op);
    const also = codeshareNums(op, rest);
    out.push(also ? { ...op, alsoCodeshare: also } : op);
  }
  return out;
}
