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
 * The first `From:` inside a forwarded body — the address the mail originally came from.
 *
 * Only the first is taken. A thread that has been forwarded twice holds several, and the earliest one in the
 * body is the outermost forward, which is the sender the traveller is actually asking about.
 */
export function originalSender(body: string): string {
  const m = /^[ \t>]*from\s*[:：]\s*(.+)$/im.exec(String(body || ''));
  return m ? m[1].trim().slice(0, 200) : '';
}

/** The `Subject:` inside a forwarded body, already stripped of any prefix of its own. */
export function originalSubject(body: string): string {
  const m = /^[ \t>]*subject\s*[:：]\s*(.+)$/im.exec(String(body || ''));
  return m ? stripForwardPrefix(m[1].trim().slice(0, 300)) : '';
}

export interface ForwardedHeaders {
  /** The original sender, or '' when the body carried none. */
  from: string;
  /** The original subject, or '' — falling back to the outer subject is the caller's choice. */
  subject: string;
}

/**
 * What a forwarded body says about where it came from. Both fields may be empty: plenty of forwards are
 * written by hand, or arrive as an attachment with no header block at all, and then there is nothing to
 * recover and nothing to pretend.
 */
export function forwardedHeaders(body: string): ForwardedHeaders {
  return { from: originalSender(body), subject: originalSubject(body) };
}
