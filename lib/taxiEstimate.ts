/**
 * What a taxi from the airport into town costs [U/1].
 *
 * A range, in the local currency, for the airports this app's travellers actually land at. Ranges rather
 * than a figure, because a taxi fare is a range: traffic, tolls, time of day and how the meter is read all
 * move it, and a single number would be wrong more often than it was right.
 *
 * An airport that is not in this table has no answer here and says so by returning null — the question then
 * goes out to be answered generally, rather than being met with a made-up number in a currency somebody is
 * about to hand over in cash. That is the whole reason this file is a short list and not a clever formula.
 *
 * Pure, and unit-tested in lib/taxiEstimate.test.ts.
 */

export interface TaxiRange {
  /** Cheap end of a normal metered fare into the city centre. */
  low: number;
  high: number;
  /** ISO 4217, for the app to show alongside the numbers. */
  currency: string;
}

/**
 * Airport → typical metered fare into the centre. Kept deliberately small: every entry here is a claim
 * about the real world that somebody could be out of pocket over.
 */
const FARES: Record<string, TaxiRange> = {
  BKK: { low: 300, high: 500, currency: 'THB' },
  HKT: { low: 600, high: 800, currency: 'THB' },
  CNX: { low: 150, high: 250, currency: 'THB' },
  AMS: { low: 40, high: 60, currency: 'EUR' },
  SIN: { low: 20, high: 35, currency: 'SGD' },
  KUL: { low: 70, high: 120, currency: 'MYR' },
  HKG: { low: 250, high: 350, currency: 'HKD' },
  NRT: { low: 15000, high: 25000, currency: 'JPY' },
  ICN: { low: 50000, high: 70000, currency: 'KRW' },
  DXB: { low: 50, high: 80, currency: 'AED' },
};

/** The fare range for an airport, or null when this app does not know — which is most airports. */
export function taxiRangeFor(iata: string | undefined): TaxiRange | null {
  const code = String(iata || '').trim().toUpperCase();
  return FARES[code] || null;
}

/** "300–500 THB". The dash is an en dash, because it is a range and not a subtraction. */
export function formatTaxiRange(range: TaxiRange | null | undefined): string {
  if (!range) return '';
  const { low, high, currency } = range;
  if (!Number.isFinite(low) || !Number.isFinite(high)) return '';
  return `${Math.round(low)}–${Math.round(high)} ${currency}`;
}

/**
 * The sentence, or null when the airport is unknown. Null is the signal to ask the question out rather than
 * to print nothing: lib/briefingQuestions.ts marks this deterministic, and a null answer falls through.
 */
export function answerTaxiEstimate(
  copy: { taxiEstimate: (amount: string) => string },
  iata: string | undefined,
): string | null {
  const text = formatTaxiRange(taxiRangeFor(iata));
  return text ? copy.taxiEstimate(text) : null;
}
