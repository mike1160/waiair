import { airportRecByIata } from './airportsDb';

export type ImportCandidate = {
  id: string;
  flightNumber: string;
  dateIso?: string;
  origin?: string;
  destination?: string;
  label: string;
};

const FLIGHT_RE = /\b([A-Z]{2})\s?(\d{3,4})\b/gi;
const SKIP_PREFIX = new Set(['AM', 'PM']);
const MONTHS: Record<string, number> = {
  JAN: 0, JANUARY: 0,
  FEB: 1, FEBRUARY: 1,
  MAR: 2, MARCH: 2,
  APR: 3, APRIL: 3,
  MAY: 4,
  JUN: 5, JUNE: 5,
  JUL: 6, JULY: 6,
  AUG: 7, AUGUST: 7,
  SEP: 8, SEPT: 8, SEPTEMBER: 8,
  OCT: 9, OCTOBER: 9,
  NOV: 10, NOVEMBER: 10,
  DEC: 11, DECEMBER: 11,
};

type Hit<T> = { index: number; value: T };

function toIso(year: number, month: number, day: number): string | undefined {
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) return undefined;
  return d.toISOString().slice(0, 10);
}

function yearFromToken(raw: string): number {
  const n = Number(raw);
  if (raw.length === 2) return n >= 70 ? 1900 + n : 2000 + n;
  return n;
}

function nearest<T>(index: number, hits: Hit<T>[]): T | undefined {
  if (!hits.length) return undefined;
  let best = hits[0];
  let bestDist = Math.abs(hits[0].index - index);
  for (let i = 1; i < hits.length; i++) {
    const dist = Math.abs(hits[i].index - index);
    if (dist < bestDist) {
      best = hits[i];
      bestDist = dist;
    }
  }
  return best.value;
}

export function extractFlightNumbers(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const src = String(text || '');
  for (const m of src.matchAll(FLIGHT_RE)) {
    const prefix = String(m[1] || '').toUpperCase();
    const digits = String(m[2] || '');
    if (SKIP_PREFIX.has(prefix) && /^20\d{2}$/.test(digits)) continue;
    const number = `${prefix}${digits}`;
    if (seen.has(number)) continue;
    seen.add(number);
    out.push(number);
  }
  return out;
}

function findFlightHits(text: string): Hit<string>[] {
  const hits: Hit<string>[] = [];
  for (const m of String(text || '').matchAll(FLIGHT_RE)) {
    const prefix = String(m[1] || '').toUpperCase();
    const digits = String(m[2] || '');
    if (SKIP_PREFIX.has(prefix) && /^20\d{2}$/.test(digits)) continue;
    hits.push({ index: m.index ?? 0, value: `${prefix}${digits}` });
  }
  return hits;
}

function findRouteHits(text: string): Hit<{ origin: string; destination: string }>[] {
  const hits: Hit<{ origin: string; destination: string }>[] = [];
  const re = /\b([A-Z]{3})\s*(?:[-–—]|→|to)\s*([A-Z]{3})\b/gi;
  for (const m of String(text || '').matchAll(re)) {
    const origin = String(m[1] || '').toUpperCase();
    const destination = String(m[2] || '').toUpperCase();
    if (!airportRecByIata(origin) || !airportRecByIata(destination)) continue;
    if (origin === destination) continue;
    hits.push({ index: m.index ?? 0, value: { origin, destination } });
  }
  return hits;
}

function findDateHits(text: string): Hit<string>[] {
  const hits: Hit<string>[] = [];
  const src = String(text || '');

  for (const m of src.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const iso = toIso(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (iso) hits.push({ index: m.index ?? 0, value: iso });
  }

  const monthNames = Object.keys(MONTHS).join('|');
  const dmy = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\.?\\s+(20\\d{2}|\\d{2})\\b`, 'gi');
  for (const m of src.matchAll(dmy)) {
    const month = MONTHS[String(m[2] || '').toUpperCase()];
    if (month == null) continue;
    const iso = toIso(yearFromToken(m[3]), month, Number(m[1]));
    if (iso) hits.push({ index: m.index ?? 0, value: iso });
  }

  const mdy = new RegExp(`\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2}|\\d{2})\\b`, 'gi');
  for (const m of src.matchAll(mdy)) {
    const month = MONTHS[String(m[1] || '').toUpperCase()];
    if (month == null) continue;
    const iso = toIso(yearFromToken(m[3]), month, Number(m[2]));
    if (iso) hits.push({ index: m.index ?? 0, value: iso });
  }

  for (const m of src.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2}|\d{2})\b/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = yearFromToken(m[3]);
    const dmyIso = a > 12 ? toIso(year, b - 1, a) : toIso(year, b - 1, a);
    const mdyIso = b > 12 ? toIso(year, a - 1, b) : undefined;
    const iso = mdyIso || dmyIso;
    if (iso) hits.push({ index: m.index ?? 0, value: iso });
  }

  return hits;
}

function candidateLabel(c: Omit<ImportCandidate, 'id' | 'label'>): string {
  const bits = [c.flightNumber];
  if (c.origin && c.destination) bits.push(`${c.origin} → ${c.destination}`);
  if (c.dateIso) bits.push(c.dateIso);
  return bits.join(' · ');
}

export function parseImportText(text: string, fallbackDateIso?: string): ImportCandidate[] {
  const flights = findFlightHits(text);
  const routes = findRouteHits(text);
  const dates = findDateHits(text);
  const seen = new Set<string>();
  const out: ImportCandidate[] = [];

  for (const hit of flights) {
    const route = nearest(hit.index, routes);
    const dateIso = nearest(hit.index, dates) || fallbackDateIso;
    const key = `${hit.value}|${dateIso || ''}|${route?.origin || ''}|${route?.destination || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const draft = {
      flightNumber: hit.value,
      dateIso,
      origin: route?.origin,
      destination: route?.destination,
    };
    out.push({
      ...draft,
      id: key,
      label: candidateLabel(draft),
    });
  }
  return out;
}

export function parseCalendarEvent(input: {
  title?: string | null;
  notes?: string | null;
  location?: string | null;
  startDate?: Date | string | null;
}): ImportCandidate[] {
  const title = String(input.title || '');
  const notes = String(input.notes || '');
  const location = String(input.location || '');
  const blob = [title, notes, location].filter(Boolean).join('\n');
  const start = input.startDate instanceof Date
    ? input.startDate
    : input.startDate
      ? new Date(input.startDate)
      : null;
  const fallback = start && !Number.isNaN(start.getTime())
    ? start.toISOString().slice(0, 10)
    : undefined;
  const parsed = parseImportText(blob, fallback);
  return parsed.map((c, i) => ({
    ...c,
    id: `${c.id}|${title}|${i}`,
    label: title && !c.origin
      ? `${c.flightNumber}${c.dateIso ? ` · ${c.dateIso}` : ''} · ${title}`
      : c.label,
  }));
}
