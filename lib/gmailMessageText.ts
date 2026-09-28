/**
 * Gmail integration — turns a Gmail API message payload into plain text for the confirmation parsers.
 * Pure (no React Native imports) so it runs under `node --test`.
 */

export function decodeB64Url(raw: string): string {
  const pad = raw.replace(/-/g, '+').replace(/_/g, '/');
  try {
    if (typeof atob === 'function') {
      // Gmail integration: atob gives UTF-8 bytes as Latin-1; decode so "Geïmporteerd", Thai hotel names etc. survive.
      const bin = atob(pad);
      try {
        return decodeURIComponent(bin.replace(/[\s\S]/g, ch => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`));
      } catch {
        return bin;
      }
    }
  } catch { /* ignore */ }
  return raw;
}

/**
 * The named entities worth spelling out [V/1e]. Everything numeric is handled generically below, so this is
 * only the shorthand names.
 */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'",
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '·',
  lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', euro: '€', pound: '£', deg: '°',
};

/**
 * Entities out, real characters in [V/1e].
 *
 * Only a handful were decoded before, and a booking confirmation is full of the rest: an address came
 * through as "&lt;asoke@nhhotels.com&gt;" and a date as "3&nbsp;nights". Anything still encoded is a word
 * the classifier cannot see, so all of them are decoded — named and numeric alike.
 *
 * `&amp;` goes last on purpose: decoded first, "&amp;lt;" would turn into "<" instead of the literal "&lt;"
 * the sender actually wrote.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => codePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[String(name).toLowerCase()] ?? m)
    .replace(/&amp;/gi, '&');
}

function codePoint(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return '';
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

/**
 * The spaces and dashes that are not the ones you typed [V/1e].
 *
 * A confirmation laid out in HTML is full of non-breaking spaces and non-breaking hyphens: "check‑in" with
 * U+2011 is a different string from "check-in", and "2 nights" joined by U+00A0 does not match a pattern
 * written with an ordinary space. They all mean what their plain equivalents mean, so they are flattened
 * before anything tries to read the text.
 */
export function normaliseSpacing(text: string): string {
  return String(text || '')
    .replace(/[\u00a0\u1680\u2000-\u200a\u2007\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '');
}

/** Gmail integration: most confirmations are HTML only — strip markup so dates and names sit next to their labels. */
export function htmlToText(raw: string): string {
  if (!/<[a-z!/][^>]*>/i.test(raw)) return normaliseSpacing(decodeEntities(raw));
  return normaliseSpacing(decodeEntities(raw
    // Head, styles and scripts first: they are the bulk of a marketing-template confirmation and contain
    // nothing a traveller ever reads.
    .replace(/<(style|script|head|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')))
    /*
     * [V/1e] Tracking pixels and click-wrapped links are most of a marketing template's bulk and none of its
     * meaning: a single confirmation carried 18k characters, most of it URLs nobody reads. Dropped here, so
     * what survives is the text a traveller would actually see.
     */
    .replace(/https?:\/\/\S{40,}/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function collectBody(payload: unknown): string {
  const p = payload as { mimeType?: string; body?: { data?: string }; parts?: unknown[] } | null;
  if (!p) return '';
  const chunks: string[] = [];
  if (p.body?.data) chunks.push(htmlToText(decodeB64Url(p.body.data)));
  for (const part of p.parts || []) chunks.push(collectBody(part));
  return chunks.join('\n');
}

/**
 * The names of the files hanging off a mail [M/4]. `format=full` already carries them, so knowing that a
 * booking's flight is in a PDF costs nothing extra — only the file's *contents* would need another request.
 * Parts without a filename are the body itself and are skipped.
 */
export function collectAttachmentNames(payload: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    const p = node as { filename?: string; parts?: unknown[] } | null;
    if (!p) return;
    const name = String(p.filename || '').trim();
    if (name) out.push(name);
    for (const part of p.parts || []) walk(part);
  };
  walk(payload);
  return out;
}

/**
 * Gmail integration: airlines often print "EK 373" / "SQ 731"; the import parser wants "EK373".
 * Uppercase two-letter codes + 3–4 digits only (the parser's own flight-number shape).
 */
export function joinSplitFlightNumbers(text: string): string {
  return String(text || '').replace(/\b([A-Z]{2})[ \u00a0](\d{3,4})\b/g, '$1$2');
}

/**
 * Gmail integration: schema.org JSON-LD out of the HTML part. Airlines like Thai Airways, Qantas and LATAM
 * print the itinerary only in a PDF attachment, but still mark the mail up with <script type="application/ld+json">
 * — the same block Gmail itself reads. Anything unparseable is skipped rather than thrown.
 */
export function extractJsonLd(payload: unknown): unknown[] {
  const found: unknown[] = [];
  const walk = (node: unknown): void => {
    const p = node as { mimeType?: string; body?: { data?: string }; parts?: unknown[] } | null;
    if (!p) return;
    if (String(p.mimeType || '').toLowerCase() === 'text/html' && p.body?.data) {
      const html = decodeB64Url(p.body.data);
      const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
      for (let m = re.exec(html); m; m = re.exec(html)) {
        try {
          const parsed = JSON.parse(String(m[1]).trim());
          if (parsed != null) found.push(parsed);
        } catch { /* a broken block must not cost us the rest of the mail */ }
      }
    }
    for (const part of p.parts || []) walk(part);
  };
  walk(payload);
  return found;
}
