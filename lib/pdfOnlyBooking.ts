/**
 * The booking that lives in the attachment [M/4].
 *
 * Thai Airways, and it is far from alone, sends a confirmation whose HTML says nothing useful: the flight
 * number, the date and the route are all inside a PDF e-ticket, and the schema.org block that would
 * otherwise rescue us is absent too. The mail is recognised as a flight booking, it appears in the inbox,
 * the traveller taps import — and nothing happens. No flight, no error, because "no candidates" was never
 * an error path.
 *
 * Reading the PDF is another question entirely (it needs either a new dependency on the phone or the mail's
 * own contents on a server, which is not something to decide in passing). What this does is refuse to fail
 * in silence: it recognises the shape of the problem and hands over what the mail *does* say, so the
 * traveller can finish the job in two taps instead of wondering why the app ignored them.
 *
 * What the mail does say, reliably:
 *   the airline   from the sender's domain — an e-ticket comes from the airline that issued it
 *   the reference from the "manage booking" link, which carries the PNR in plain sight
 *
 * Not the flight number. Never a guess at one: a made-up flight is worse than an absent one.
 *
 * Pure, and unit-tested in lib/pdfOnlyBooking.test.ts.
 */

/**
 * Airline domains to IATA codes. Only airlines that actually send e-tickets this way need to be here; an
 * unknown domain simply yields no code, and the sheet opens without one.
 */
const AIRLINE_DOMAINS: Record<string, string> = {
  'thaiairways.com': 'TG',
  'bangkokairways.com': 'PG',
  'nokair.com': 'DD',
  'lionairthai.com': 'SL',
  'singaporeair.com': 'SQ',
  'klm.com': 'KL',
  'airfrance.com': 'AF',
  'emirates.com': 'EK',
  'qatarairways.com': 'QR',
  'cathaypacific.com': 'CX',
  'malaysiaairlines.com': 'MH',
  'vietnamairlines.com': 'VN',
  'vietjetair.com': 'VJ',
  'garuda-indonesia.com': 'GA',
  'koreanair.com': 'KE',
  'flyasiana.com': 'OZ',
  'ana.co.jp': 'NH',
  'jal.com': 'JL',
  'lufthansa.com': 'LH',
  'britishairways.com': 'BA',
  'turkishairlines.com': 'TK',
  'etihad.com': 'EY',
  'flyscoot.com': 'TR',
  'eva-air.com': 'BR',
  'china-airlines.com': 'CI',
  'philippineairlines.com': 'PR',
  'airasia.com': 'AK',
};

/** The host of a `From:` header, lower case and without a trailing dot. */
export function senderHost(from: string): string {
  const m = String(from || '').match(/@([A-Za-z0-9.-]+)/);
  return (m ? m[1] : '').toLowerCase().replace(/\.$/, '');
}

/**
 * The airline that sent this, as an IATA code, or '' when the domain is not one we know. Subdomains count:
 * an e-ticket often comes from `eticket.thaiairways.com` rather than the bare domain.
 */
export function airlineCodeFromSender(from: string): string {
  const host = senderHost(from);
  if (!host) return '';
  for (const [domain, code] of Object.entries(AIRLINE_DOMAINS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return code;
  }
  return '';
}

/**
 * The booking reference out of a "manage booking" link. Airlines spell the parameter differently, so the
 * common names are all accepted; the value must look like a PNR (6 letters and digits) to be believed.
 */
export function bookingRefFromText(text: string): string {
  const src = String(text || '');
  const params = /[?&](?:booking_no|bookingno|bookingreference|booking_reference|pnr|recordlocator|record_locator|confirmationnumber|bookingcode)=([A-Za-z0-9]{5,8})\b/gi;
  for (const m of src.matchAll(params)) {
    const ref = String(m[1] || '').toUpperCase();
    // A PNR is six characters of letters and digits, and is never all digits — that would be a ticket number.
    if (/^[A-Z0-9]{6}$/.test(ref) && /[A-Z]/.test(ref)) return ref;
  }
  return '';
}

/** Does this mail carry a PDF? Filenames come straight from the Gmail payload's parts. */
export function hasPdfAttachment(filenames: string[] | undefined): boolean {
  return (filenames || []).some(n => /\.pdf$/i.test(String(n || '').trim()));
}

export interface PdfOnlyBooking {
  /** IATA code of the airline that sent it, or '' when the sender is not a known airline. */
  airlineCode: string;
  /** The PNR from the manage-booking link, or '' when the mail had none. */
  bookingRef: string;
  /** The PDF the flight is hiding in, for the message that names it. */
  filename: string;
}

/**
 * Is this the case at hand — a recognised flight booking, nothing parseable in it, and a PDF attached?
 *
 * All three have to hold. A mail with no PDF is a different failure and should not be blamed on one; a mail
 * that did yield a flight needs no help; and a mail the classifier never called a flight is somebody's
 * newsletter, which must not open an add-flight sheet.
 */
export function pdfOnlyBooking(input: {
  /** What the classifier made of the mail (lib/gmailInboxScan.ts). */
  kind?: string;
  /** How many flights the parser found. Anything above zero means there is nothing to rescue. */
  flightCount: number;
  attachments?: string[];
  from?: string;
  /** The mail body, for the manage-booking link. */
  text?: string;
}): PdfOnlyBooking | null {
  if (String(input.kind || '') !== 'flight') return null;
  if (input.flightCount > 0) return null;
  const pdf = (input.attachments || []).find(n => /\.pdf$/i.test(String(n || '').trim()));
  if (!pdf) return null;
  return {
    airlineCode: airlineCodeFromSender(input.from || ''),
    bookingRef: bookingRefFromText(input.text || ''),
    filename: String(pdf).trim(),
  };
}
