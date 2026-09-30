/**
 * Whose booking is this? [W/9]
 *
 * A forwarded hotel confirmation was listed under "Mike Kleinjans" — the person who forwarded it, not the
 * hotel that sent it. The cause was two item builders that disagreed:
 *
 *   lib/gmailInboxScan.ts itemFromMetadata runs on `format=metadata` headers, so its From is the *outer*
 *   one: the forwarder. It named the card after them.
 *
 *   lib/gmailInboxStore.ts rescueForwarded fetches the full message, recovers the original sender from the
 *   quoted header block (lib/forwardedMail.ts) and already used that instead.
 *
 * And rescueForwarded only runs when header classification *fails*. The Solaria booking names its kind in
 * its own subject, so it succeeded on headers, went the metadata route, and got the forwarder's name. Thai
 * Airways failed on headers, fell into the rescue path, and got thaiairways.com. The mails that worked best
 * were exactly the ones showing the wrong name.
 *
 * So the name is decided in one place, by one rule, and the forwarder is never the answer:
 *
 *   the recovered original sender, when there is one and it is not itself a personal mailbox
 *   else the subject, when the mail was forwarded — it is what actually names the hotel
 *   else the sender, for the ordinary case of a mail that came straight from the company
 *
 * No localized label lists: whether a mail was forwarded comes from lib/forwardedMail.ts, which reads
 * structure rather than words, and the only list here is of consumer mail providers — a fact about
 * addresses, not about language.
 *
 * Pure, and unit-tested in lib/importDisplayName.test.ts.
 */

import { isForwardedSubject, stripForwardPrefix } from './forwardedMail.ts';

/**
 * Mailboxes that belong to a person rather than a company. A forward chain that went person → person
 * recovers one of these as its "original sender", and it is no better an answer than the forwarder.
 */
const PERSONAL_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'gmx.com',
  'gmx.net', 'web.de', 'proton.me', 'protonmail.com', 'zoho.com', 'mail.com', 'yandex.ru', 'qq.com',
  '163.com', '126.com', 'naver.com', 'daum.net', 'hanmail.net',
]);

/** The domain of an address, lowercased. '' when there is no address in it. */
export function addressDomain(raw: string | null | undefined): string {
  const m = String(raw || '').match(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  return m ? m[1].toLowerCase() : '';
}

/** Is this address somebody's personal mailbox rather than a company's? */
export function isPersonalMailbox(raw: string | null | undefined): boolean {
  const domain = addressDomain(raw);
  return !!domain && PERSONAL_MAIL_DOMAINS.has(domain);
}

/** The display part of a From header: `"Solaria" <x@y>` → `Solaria`. '' when it carries none. */
function quotedName(raw: string): string {
  const m = String(raw || '').trim().match(/^"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : '';
}

/** A company name from an address: the display name, else the domain without its suffix. */
function companyName(raw: string): string {
  const named = quotedName(raw);
  if (named) return named;
  const domain = addressDomain(raw);
  if (!domain) return String(raw || '').trim();
  return domain;
}

/** How much subject to use as a title before it stops being one. */
const SUBJECT_NAME_MAX = 60;

/**
 * A name out of a subject line.
 *
 * Structural only: a leading bracketed or parenthesised tag goes, a trailing booking reference goes, and
 * what is left is the subject itself. No attempt is made to find the brand inside it — "Uw boeking bij
 * Solaria Nishitetsu Hotel" is a long title but it is a true one, and guessing which words are the hotel's
 * name is how this sort of code starts inventing things.
 */
export function nameFromSubject(subject: string): string {
  let s = stripForwardPrefix(String(subject || ''));
  // A leading tag: "[Boekingsbevestiging] Uw boeking bij …" or "(Confirmation) …".
  s = s.replace(/^\s*[[(][^\])]{0,40}[\])]\s*/, '');
  // A trailing reference: "… Confirmation #100853623424", "… - 4821".
  s = s.replace(/\s*[-–—·|]?\s*#?\s*\d{4,}\s*$/, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > SUBJECT_NAME_MAX ? `${s.slice(0, SUBJECT_NAME_MAX - 1).trimEnd()}…` : s;
}

/**
 * What to call an imported booking on the card.
 *
 * `recoveredFrom` is the original sender when the body was read (rescueForwarded has it; itemFromMetadata
 * never does). Everything is optional, and the last resort is the outer sender — which is correct for the
 * overwhelming majority of mails, the ones nobody forwarded.
 */
export function importDisplayName(opts: {
  outerFrom?: string;
  subject?: string;
  recoveredFrom?: string;
}): string {
  const outerFrom = String(opts.outerFrom || '');
  const subject = String(opts.subject || '');
  const recovered = String(opts.recoveredFrom || '');

  // A company we can name outright: the airline or hotel the mail originally came from.
  if (recovered && !isPersonalMailbox(recovered)) {
    const name = companyName(recovered);
    if (name) return name;
  }

  /*
   * Forwarded, and nothing better recovered. The forwarder's own name is the one thing this must never be,
   * so the subject answers instead — it is what names the hotel in practice.
   */
  if (isForwardedSubject(subject)) {
    const fromSubject = nameFromSubject(subject);
    if (fromSubject) return fromSubject;
  }

  return companyName(outerFrom);
}
