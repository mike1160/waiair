/** Classify clipboard paste after parseImportText (no airport DB). */

export type ClipboardFlightCandidate = {
  flightNumber: string;
  dateIso?: string;
  origin?: string;
  destination?: string;
  id?: string;
  label?: string;
};

export type ClipboardImportHit<T extends ClipboardFlightCandidate = ClipboardFlightCandidate> =
  | { kind: 'none' }
  | { kind: 'one'; query: string }
  | { kind: 'many'; candidates: T[] };

/** Unique flight numbers: 0 → hint, 1 → search field, 2+ → import modal. */
export function clipboardImportHit<T extends ClipboardFlightCandidate>(
  candidates: T[],
  raw = '',
): ClipboardImportHit<T> {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    const n = String(c.flightNumber || '').trim().toUpperCase();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    unique.push(n);
  }
  if (unique.length === 0) return { kind: 'none' };
  if (unique.length === 1) {
    const trimmed = String(raw || '').trim();
    return { kind: 'one', query: trimmed || unique[0] };
  }
  return { kind: 'many', candidates };
}
