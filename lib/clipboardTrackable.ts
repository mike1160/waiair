/** Clipboard paste → first flight number or labeled PNR (no airport DB). */

const FLIGHT_RE = /\b[A-Z]{2}\d{3,4}\b/gi;
const SKIP_PREFIX = new Set(['AM', 'PM']);
const CLIPBOARD_PNR_RE =
  /(?:\bPNR\b|booking\s*ref(?:erence)?|record\s*locator)\s*[:#]?\s*([A-Z0-9]{5,7})\b/i;

/** First flight number or labeled PNR/booking ref from a clipboard paste. */
export function clipboardTrackableIdent(text: string): string | null {
  const src = String(text || '').trim();
  if (!src) return null;
  for (const m of src.matchAll(FLIGHT_RE)) {
    const number = String(m[0] || '').toUpperCase();
    const prefix = number.slice(0, 2);
    const digits = number.slice(2);
    if (SKIP_PREFIX.has(prefix) && /^20\d{2}$/.test(digits)) continue;
    return number;
  }
  const pnr = src.match(CLIPBOARD_PNR_RE);
  if (pnr?.[1]) return pnr[1].toUpperCase();
  return null;
}
