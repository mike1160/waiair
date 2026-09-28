/**
 * The booking somebody forwarded [V/1].
 *
 * A confirmation that arrives straight from the airline is easy: the sender is thaiairways.com, and that one
 * fact tells the scan it is a flight. Forward that same mail and both of those facts are gone — the sender is
 * now the traveller's own address and the subject has grown a "Fwd:". Detection ran on headers alone, so a
 * forwarded hotel booking was dropped: its subject said "booking confirmation", which is travel-shaped but
 * belongs to no particular kind, and the domain that used to answer that question had been replaced.
 *
 * The fix does not need a body parser. A forwarded mail *carries its own original headers* in the body —
 * every mail client writes them, in the same shape:
 *
 *     ---------- Forwarded message ---------
 *     From: Thai Airways <eticket@thaiairways.com>
 *     Date: Fri, 26 Sep 2026 at 09:14
 *     Subject: Your e-ticket / Itinerary Receipt
 *     To: <someone@example.com>
 *
 * So the original sender and subject are recovered from there and handed to the classifier that already
 * exists. Nothing about how a mail is judged changes; it is simply asked about the real sender instead of
 * the person who passed it on. That is why this is a small file and not a second classifier.
 *
 * Pure, and unit-tested in lib/forwardedMail.test.ts.
 */

/**
 * The prefixes mail clients put in front of a forwarded or replied subject, in the languages this app's
 * travellers use. Matched repeatedly, because a mail that has been round the houses carries several.
 */
const PREFIX_RE = /^\s*(?:fwd?|fw|doorgestuurd|door|re|antw|aw|wg|tr|rv|enc|vs|回复|转发|ตอบกลับ|ส่งต่อ)\s*[:：]\s*/i;

/** A subject without its forwarding prefixes: "Fwd: Re: Your e-ticket" → "Your e-ticket". */
export function stripForwardPrefix(subject: string): string {
  let s = String(subject || '');
  // Several passes: "Fwd: Fwd: Re:" is one subject, not three.
  for (let i = 0; i < 6; i += 1) {
    const next = s.replace(PREFIX_RE, '');
    if (next === s) break;
    s = next;
  }
  return s.trim();
}

/** Was this subject forwarded or replied at all? */
export function isForwardedSubject(subject: string): boolean {
  return stripForwardPrefix(subject) !== String(subject || '').trim();
}

/**
 * Finding the forwarded block without reading a word of it [V/1d].
 *
 * The header block a forward carries is written in the *forwarder's* interface language: a Dutch Gmail says
 * "Van:", a German one "Von:", a Japanese one "差出人:". Matching those labels means keeping a translation
 * table for every mail client in every language and being wrong about the one you did not think of — which
 * is exactly how a forwarded Thai Airways ticket went unrescued while its domain sat in plain sight two
 * lines into the body.
 *
 * So nothing here reads a label. Two structural facts do the work instead:
 *
 *   a run of dashes on its own line is where every client starts the quoted block
 *   an email address is the same characters in every language
 *
 * The sender is the first address after that separator. In a forward block the sender's line always precedes
 * the recipient's, so the first address is the one that sent the mail.
 */

/** Five dashes or more on their own line: the separator every client writes, whatever it says around it. */
const SEPARATOR_RE = /^[ \t>]*[-—–_]{5,}.*$/m;
/** An address. Language-independent, which is the entire point. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
/** How far past the separator the header block still plausibly reaches. */
const HEADER_REGION_CHARS = 1500;

/** Where the quoted original begins, or 0 when this forward has no separator at all. */
export function forwardedBlockStart(body: string): number {
  const m = SEPARATOR_RE.exec(String(body || ''));
  return m ? (m.index ?? 0) + m[0].length : 0;
}

/**
 * The address the mail originally came from: the first one after the separator.
 *
 * Without a separator the whole head of the body is searched, which covers a hand-written forward that
 * simply pastes the confirmation underneath a sentence.
 */
export function originalSender(body: string): string {
  const src = String(body || '');
  const from = forwardedBlockStart(src);
  const region = src.slice(from, from + HEADER_REGION_CHARS);
  const addr = EMAIL_RE.exec(region);
  return addr ? addr[0] : '';
}

export interface ForwardedHeaders {
  /** The original sender, or '' when the body carried no address. */
  from: string;
}

/**
 * What a forwarded body says about where it came from. Both fields may be empty: plenty of forwards are
 * written by hand, or arrive as an attachment with no header block at all, and then there is nothing to
 * recover and nothing to pretend.
 */
export function forwardedHeaders(body: string): ForwardedHeaders {
  return { from: originalSender(body) };
}
