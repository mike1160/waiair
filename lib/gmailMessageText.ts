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

/** Gmail integration: most confirmations are HTML only — strip markup so dates and names sit next to their labels. */
export function htmlToText(raw: string): string {
  if (!/<[a-z!/][^>]*>/i.test(raw)) return raw;
  return raw
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ');
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
