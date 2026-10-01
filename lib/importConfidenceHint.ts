/**
 * Which found mails are worth ticking for the traveller, and which they should tick themselves [W/16b].
 *
 * The scan pre-selected everything it found, and it classified on the sender's domain alone — so
 * "Save up to 40% on Checked Baggage" from airasia.com was a flight, ticked, imported, tracked as a flight
 * number scraped out of the advertising copy, and it spent one of three free flights doing it. Eleven
 * newsletters came through as "Vluchten (11)".
 *
 * Nothing is hidden to fix that. Everything the scan finds stays on the screen and stays tickable. What
 * changes is the default and the order, and that rests on three questions:
 *
 *   Is the sender a travel brand at all?  A newsletter from Netflix is not, whatever its subject says.
 *   Does the subject name a confirmation?  Not the bare word "bevestiging" — the phrases a ticket actually
 *                                          uses: "ticket voor uw reis", "booking confirmed", "e-ticket".
 *   Does it look like marketing?          Gmail's Promotions label, a List-Unsubscribe header, or the
 *                                          vocabulary of a sale.
 *
 * Only a travel brand with a confirmation phrase is ticked in advance. That is deliberately narrow: a real
 * confirmation that misses the phrase is one tap away under "possibly travel-related", while a newsletter
 * that is ticked by default costs a free flight and puts a flight nobody is on in front of the traveller.
 *
 * Pure, and unit-tested in lib/importConfidenceHint.test.ts.
 */

/** Folded for comparison: lower case, accents flattened, typographic apostrophes normalised. */
function fold(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The phrases a booking confirmation actually uses, in the languages this app's travellers book in.
 *
 * Phrases, never bare words. "bevestiging" alone would make "Bevestiging: je Netflix-huishouden is
 * bijgewerkt" a confirmed booking, and that is exactly the mail that must not be ticked.
 */
export const CONFIRMATION_PHRASES = [
  // English
  'booking confirmed', 'booking confirmation', 'reservation confirmed', 'reservation confirmation',
  'your e-ticket', 'e-ticket', 'eticket', 'itinerary receipt', 'your ticket', 'tickets for your',
  'order confirmation', 'payment confirmation', 'your booking is confirmed', 'confirmed:',
  // Dutch
  'ticket voor uw reis', 'ticket voor je reis', 'uw boeking is bevestigd', 'je boeking is bevestigd',
  'boekingsbevestiging', 'bevestiging van uw boeking', 'bevestiging van je boeking',
  'dank u voor uw aankoop', 'bedankt voor je aankoop', 'uw ticket', 'je ticket', 'uw reservering',
  // German
  'buchungsbestatigung', 'bestatigung ihrer buchung', 'ihr ticket', 'ihre buchung ist bestatigt',
  // French
  'confirmation de reservation', 'votre billet', 'votre reservation est confirmee',
  // Spanish / Portuguese
  'confirmacion de reserva', 'reserva confirmada', 'seu bilhete',
  // Thai
  'ยืนยันการจอง', 'บัตรโดยสาร',
];

/** The vocabulary of a sale. Deliberately short: these only reorder, they never hide. */
export const PROMO_PHRASES = [
  'save up to', 'up to 40%', 'deals', 'deal dagen', 'offers', 'special offer', '% off', 'discount',
  'bespaar tot', 'korting', 'aanbieding', 'aanbiedingen', 'sale', 'newsletter', 'nieuwsbrief',
  'highlights', 'inspiration', 'inspiratie', 'last minute', 'promo', 'win ', 'gratis ',
];

export function hasConfirmationPhrase(subject: string): boolean {
  const s = fold(subject);
  return !!s && CONFIRMATION_PHRASES.some(p => s.includes(fold(p)));
}

export function hasPromoPhrase(subject: string): boolean {
  const s = fold(subject);
  return !!s && PROMO_PHRASES.some(p => s.includes(fold(p)));
}

export type ImportHint =
  /** A travel brand confirming a booking. Ticked in advance. */
  | 'strong'
  /** Travel-shaped but unproven. Shown, grouped apart, not ticked. */
  | 'weak'
  /** Marketing by Gmail's own reckoning or by its vocabulary. Shown last, not ticked. */
  | 'promo';

/**
 * How much this mail deserves to be trusted.
 *
 * `travelBrand` is the caller's answer to "is this sender a travel company" — the caller has
 * lib/gmailInboxScan.ts for that, and passing it in keeps this file free of those lists and of any cycle.
 *
 * A confirmation phrase from a travel brand beats the marketing signals: airlines do send tickets with a
 * List-Unsubscribe header, and losing a real ticket to that would be the worse mistake.
 */
export function importConfidenceHint(opts: {
  subject?: string;
  travelBrand?: boolean;
  promo?: { promotions?: boolean; unsubscribe?: boolean } | null;
}): ImportHint {
  const confirmed = hasConfirmationPhrase(opts.subject || '');
  if (opts.travelBrand && confirmed) return 'strong';
  const marketing = !!opts.promo?.promotions || !!opts.promo?.unsubscribe || hasPromoPhrase(opts.subject || '');
  if (marketing) return 'promo';
  return 'weak';
}
