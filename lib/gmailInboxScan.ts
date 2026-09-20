/**
 * Gmail inbox scan for the opening screen: metadata only (sender, subject, date, message id).
 * No email body is read and nothing leaves the device — the results screen works from these fields alone.
 */

export type GmailItemKind = 'flight' | 'hotel' | 'carRental';

export type GmailInboxItem = {
  /** Gmail message id; also the dedupe key in gmail_imported_ids. */
  id: string;
  kind: GmailItemKind;
  sender: string;
  senderDomain: string;
  subject: string;
  dateMs: number;
};

export const SCAN_DAYS_DEFAULT = 90;
export const SCAN_DAYS_EXTENDED = 365;
export const SCAN_TIMEOUT_MS = 10_000;
export const SUBJECT_MAX = 40;

const FLIGHT_DOMAINS = [
  'thaiairways.com', 'airasia.com', 'lionairthai.com', 'bangkokairways.com', 'nokair.com',
  'klm.com', 'emirates.com', 'singaporeair.com', 'cathaypacific.com',
];
const HOTEL_DOMAINS = ['booking.com', 'agoda.com', 'agoda.co.th', 'hotels.com', 'airbnb.com', 'expedia.com', 'trip.com', 'ctrip.com'];
const CAR_DOMAINS = ['rentalcars.com', 'hertz.com', 'sixt.com', 'avis.com', 'budget.com', 'europcar.com'];

export const TRAVEL_DOMAINS = [...HOTEL_DOMAINS, ...FLIGHT_DOMAINS, ...CAR_DOMAINS];

/**
 * Subjects are compared folded: lower case, without accents and with the typographic apostrophe flattened,
 * so "Buchungsbestätigung", "BUCHUNGSBESTATIGUNG" and "réservation" all match the same keyword. Thai and the
 * other non-Latin scripts pass through unchanged. The keyword lists stay readable (written with accents) and
 * are folded once below; the Gmail query keeps the accented spelling, which is what the senders write.
 */
export function foldSubject(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c')
    .replace(/ß/g, 'ss')
    .replace(/[’‘`´]/g, "'");
}

/** Subject phrases that make a mail travel-related even from a sender we do not know. */
export const SUBJECT_KEYWORDS = [
  'booking confirmation', 'bevestiging', 'reservation confirmed', 'your itinerary', 'e-ticket',
  'your flight', 'hotel confirmation', 'check-in', 'your rental', 'pick-up confirmation', 'your booking',
  // Dutch: Trip.com NL and other Dutch senders never say any of the English ones.
  'boekingsbevestiging', 'je boeking', 'uw boeking', 'hotelbevestiging', 'huurauto',
  // German
  'buchungsbestätigung', 'ihre reservierung', 'reisebestätigung', 'ihre buchung',
  // French
  'confirmation de réservation', 'votre réservation', 'votre séjour',
  // Spanish
  'confirmación de reserva', 'tu reserva', 'su reserva', 'tu estancia',
  // Thai: "booking confirmed" and "your booking".
  'ยืนยันการจอง', 'การจองของคุณ',
];

/**
 * Keywords that also say which kind it is. Words that can only mean one product come first and win: a German
 * mail saying "Buchungsbestätigung für Ihren Flug" is a flight, even though the confirmation phrase alone
 * usually means a hotel. Short words that hide inside unrelated ones (French "vol") are left out on purpose —
 * these are matched as plain substrings, which is what makes German compounds ("Flugticket") work.
 */
const KIND_KEYWORDS: [string, GmailItemKind][] = [
  ['e-ticket', 'flight'],
  ['eticket', 'flight'],
  ['your flight', 'flight'],
  ['your itinerary', 'flight'],
  ['boarding pass', 'flight'],
  ['your rental', 'carRental'],
  ['pick-up confirmation', 'carRental'],
  // Dutch
  ['vlucht', 'flight'],
  ['instapkaart', 'flight'],
  ['reisschema', 'flight'],
  ['huurauto', 'carRental'],
  ['autohuur', 'carRental'],
  ['hotelbevestiging', 'hotel'],
  ['verblijf bevestigd', 'hotel'],
  ['boeking bij', 'hotel'],
  // German — "flug" also covers Abflug, Flugticket and Flughafen.
  ['flug', 'flight'],
  ['bordkarte', 'flight'],
  ['mietwagen', 'carRental'],
  ['autovermietung', 'carRental'],
  ['hotelbuchung', 'hotel'],
  ['unterkunft', 'hotel'],
  // French — "embarquement" also covers the Spanish "tarjeta de embarque".
  ['embarque', 'flight'],
  ['billet électronique', 'flight'],
  ['location de voiture', 'carRental'],
  ['votre séjour', 'hotel'],
  // Spanish
  ['vuelo', 'flight'],
  ['alquiler de coche', 'carRental'],
  ['alquiler de auto', 'carRental'],
  ['reserva de hotel', 'hotel'],
  ['estancia', 'hotel'],
  // Thai: flight, e-ticket, car rental, hotel booking.
  ['เที่ยวบิน', 'flight'],
  ['ตั๋วเครื่องบิน', 'flight'],
  ['เช่ารถ', 'carRental'],
  ['จองโรงแรม', 'hotel'],
];

/**
 * Confirmation phrases that are used for anything but most often mean a hotel. Only consulted when no keyword
 * above matched, so "online inchecken voor je vlucht" stays a flight instead of becoming a hotel check-in.
 */
const WEAK_KIND_KEYWORDS: [string, GmailItemKind][] = [
  ['hotel confirmation', 'hotel'],
  ['inchecken', 'hotel'],
  ['buchungsbestätigung', 'hotel'],
  ['ihre reservierung', 'hotel'],
  ['confirmation de réservation', 'hotel'],
  ['confirmación de reserva', 'hotel'],
];

const FOLDED_SUBJECT_KEYWORDS = SUBJECT_KEYWORDS.map(foldSubject);
const FOLDED_KIND_KEYWORDS: [string, GmailItemKind][] = [...KIND_KEYWORDS, ...WEAK_KIND_KEYWORDS]
  .map(([word, kind]) => [foldSubject(word), kind]);

/**
 * OTAs that sell flights, hotels and cars from one address and say which in the address itself —
 * Trip.com writes NL_HTL_NoReply@trip.com for a hotel and NL_FLT_NoReply@trip.com for a flight.
 */
const MULTI_PRODUCT_DOMAINS = ['trip.com', 'ctrip.com', 'expedia.com', 'booking.com'];

const SENDER_HINT: [RegExp, GmailItemKind][] = [
  [/\b(htl|hotel|hotels|stay)\b/, 'hotel'],
  [/\b(flt|flight|flights|air|ticket|eticket)\b/, 'flight'],
  [/\b(car|cars|rental|rentals)\b/, 'carRental'],
];

/** The product an OTA put in its own address, e.g. NL_HTL_NoReply@trip.com → hotel. '' when it says nothing. */
export function kindFromSenderAddress(from: string): GmailItemKind | '' {
  const local = String(from || '').match(/([A-Za-z0-9._%+-]+)@/)?.[1] || '';
  const words = ` ${local.toLowerCase().split(/[^a-z]+/).filter(Boolean).join(' ')} `;
  for (const [re, kind] of SENDER_HINT) if (re.test(words)) return kind;
  return '';
}

/** Gmail search: last `days` days, from a travel sender or with a travel subject. */
export function gmailQuery(days = SCAN_DAYS_DEFAULT): string {
  const from = TRAVEL_DOMAINS.join(' OR ');
  const subject = SUBJECT_KEYWORDS.map(k => `"${k}"`).join(' OR ');
  return `newer_than:${Math.max(1, Math.round(days))}d (from:(${from}) OR subject:(${subject}))`;
}

/** The domain of a `From:` header, e.g. `"Booking.com" <noreply@booking.com>` → `booking.com`. */
export function senderDomain(from: string): string {
  const m = String(from || '').match(/@([A-Za-z0-9.-]+)/);
  const host = (m ? m[1] : '').toLowerCase().replace(/\.$/, '');
  if (!host) return '';
  const known = TRAVEL_DOMAINS.find(d => host === d || host.endsWith(`.${d}`));
  return known || host;
}

/** The display name of a `From:` header, falling back to the domain. */
export function senderName(from: string): string {
  const raw = String(from || '').trim();
  const quoted = raw.match(/^"?([^"<]+?)"?\s*</);
  const name = (quoted ? quoted[1] : '').trim();
  return name || senderDomain(raw) || raw;
}

/** Travel mail? A known sender domain, or a subject keyword. */
export function matchesTravel(from: string, subject: string): boolean {
  const domain = senderDomain(from);
  if (domain && TRAVEL_DOMAINS.includes(domain)) return true;
  const s = foldSubject(subject);
  return FOLDED_SUBJECT_KEYWORDS.some(k => s.includes(k));
}

/** Flight, hotel or car rental: the sender decides, else a subject keyword; '' when neither says. */
export function classifyKind(from: string, subject: string): GmailItemKind | '' {
  const domain = senderDomain(from);
  // A sender that sells everything: its own address is a better clue than the domain.
  if (MULTI_PRODUCT_DOMAINS.includes(domain)) {
    const hint = kindFromSenderAddress(from);
    if (hint) return hint;
  }
  if (FLIGHT_DOMAINS.includes(domain)) return 'flight';
  if (HOTEL_DOMAINS.includes(domain)) return 'hotel';
  if (CAR_DOMAINS.includes(domain)) return 'carRental';
  const s = foldSubject(subject);
  for (const [word, kind] of FOLDED_KIND_KEYWORDS) if (s.includes(word)) return kind;
  return '';
}

type Header = { name?: string; value?: string };

/** One Gmail metadata response → a results-screen item; null when it is not travel or has no kind. */
export function itemFromMetadata(
  id: string,
  headers: Header[] | undefined,
  internalDate?: string | number | null,
): GmailInboxItem | null {
  const pick = (name: string) => {
    const hit = (headers || []).find(h => String(h?.name || '').toLowerCase() === name);
    return String(hit?.value || '').trim();
  };
  const from = pick('from');
  const subject = pick('subject');
  if (!id || !matchesTravel(from, subject)) return null;
  const kind = classifyKind(from, subject);
  if (!kind) return null;
  const headerDate = Date.parse(pick('date'));
  const stamp = Number(internalDate);
  const dateMs = Number.isFinite(stamp) && stamp > 0 ? stamp : (Number.isNaN(headerDate) ? 0 : headerDate);
  return { id, kind, sender: senderName(from), senderDomain: senderDomain(from), subject, dateMs };
}

/** Already-imported mails never show up again (on-device dedupe; no Gmail label, readonly scope). */
export function filterImported(items: GmailInboxItem[], importedIds: string[] | Set<string>): GmailInboxItem[] {
  const seen = importedIds instanceof Set ? importedIds : new Set(importedIds || []);
  return items.filter(i => !seen.has(i.id));
}

export function truncateSubject(subject: string, max = SUBJECT_MAX): string {
  const s = String(subject || '').trim();
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Newest first, grouped for the results screen. */
export function groupItems(items: GmailInboxItem[]): { kind: GmailItemKind; items: GmailInboxItem[] }[] {
  const order: GmailItemKind[] = ['flight', 'hotel', 'carRental'];
  return order
    .map(kind => ({ kind, items: items.filter(i => i.kind === kind).sort((a, b) => b.dateMs - a.dateMs) }))
    .filter(g => g.items.length > 0);
}
