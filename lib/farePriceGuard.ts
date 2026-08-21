/** Drop extreme fare outliers before they reach flight-search UI. */

export const ANOMALY_MEDIAN_MULTIPLIER = 5;
export const SHORT_HAUL_MAX_EUR = 2500;
export const SHORT_HAUL_HOURS = 3;
/** Drop cached teaser fares that sit far below a realistic cluster. */
export const LOW_P75_RATIO = 0.45;

export type PricedFare = {
  origin: string;
  destination: string;
  departDate: string;
  price: number;
};

/** Rough units-per-EUR so a €2,500 cap works in USD/GBP/THB quotes. */
const TO_EUR: Record<string, number> = {
  eur: 1,
  usd: 0.92,
  gbp: 1.17,
  chf: 1.05,
  aud: 0.56,
  cad: 0.63,
  sgd: 0.68,
  thb: 0.026,
  rub: 0.01,
  jpy: 0.0058,
  krw: 0.00063,
  idr: 0.000055,
  vnd: 0.000034,
  inr: 0.01,
};

/** Quotes in these units are already "small"; do not treat 80k as local cash. */
const SMALL_CCY = new Set(['eur', 'usd', 'gbp', 'chf', 'aud', 'cad', 'sgd']);

/** Min raw amount before a local cash currency is a plausible read of the quote. */
const HIGH_SCALE_MIN: Record<string, number> = {
  thb: 15000,
  rub: 20000,
  jpy: 40000,
  inr: 20000,
  krw: 200000,
  idr: 200000,
  vnd: 200000,
};

/**
 * Travelpayouts sometimes ignores `currency` and returns THB/RUB.
 * If we asked for EUR and got 81,287, convert instead of showing that as euros.
 */
export function alignQuotedPrice(
  price: number,
  requested: string,
  hintedLocal?: string | null,
): number {
  const req = String(requested || 'eur').toLowerCase();
  if (!Number.isFinite(price) || price <= 0) return price;
  if (!SMALL_CCY.has(req) || price < 20000) return price;

  const hint = String(hintedLocal || '').toLowerCase();
  let from = 'rub';
  if (hint && hint !== req && TO_EUR[hint] != null) {
    const min = HIGH_SCALE_MIN[hint] ?? 20000;
    if (price >= min) from = hint;
  }
  const eur = priceToEur(price, from);
  const out = TO_EUR[req] ?? 1;
  if (!Number.isFinite(eur) || out <= 0) return price;
  return Math.max(1, Math.round(eur / out));
}

export function priceToEur(price: number, currency?: string): number {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  const rate = TO_EUR[String(currency || 'eur').toLowerCase()] ?? 1;
  return n * rate;
}

export function medianPrice(prices: number[]): number | null {
  const sorted = prices.filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function routeDateKey(f: PricedFare): string {
  return `${String(f.origin || '').toUpperCase()}|${String(f.destination || '').toUpperCase()}|${String(f.departDate || '')}`;
}

export function filterAnomalousFares<T extends PricedFare>(
  fares: T[],
  opts?: {
    currency?: string;
    durationHours?: (fare: T) => number | null | undefined;
  },
): T[] {
  if (!Array.isArray(fares) || !fares.length) return [];
  const currency = opts?.currency;
  const groups = new Map<string, T[]>();
  for (const fare of fares) {
    const key = routeDateKey(fare);
    const list = groups.get(key);
    if (list) list.push(fare);
    else groups.set(key, [fare]);
  }

  const kept: T[] = [];
  for (const [, group] of groups) {
    const median = medianPrice(group.map(f => f.price));
    const cap = median != null ? median * ANOMALY_MEDIAN_MULTIPLIER : Infinity;
    for (const fare of group) {
      const hours = opts?.durationHours?.(fare);
      const eur = priceToEur(fare.price, currency);
      const shortHaul = hours != null && Number.isFinite(hours) && hours < SHORT_HAUL_HOURS;
      let reason: 'median' | 'short-haul-cap' | null = null;
      if (shortHaul && Number.isFinite(eur) && eur > SHORT_HAUL_MAX_EUR) {
        reason = 'short-haul-cap';
      } else if (median != null && fare.price > cap) {
        reason = 'median';
      }
      if (reason) {
        console.warn('[farePriceGuard] dropped anomaly', {
          origin: fare.origin,
          destination: fare.destination,
          departDate: fare.departDate,
          price: fare.price,
          median,
          reason,
        });
        continue;
      }
      kept.push(fare);
    }
  }

  if (kept.length >= 3) {
    const sorted = kept.map(f => f.price).filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
    const p75 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
    const floor = p75 * LOW_P75_RATIO;
    if (p75 >= floor * 2) {
      return kept.filter(fare => {
        if (fare.price >= floor) return true;
        console.warn('[farePriceGuard] dropped too-low teaser', {
          origin: fare.origin,
          destination: fare.destination,
          departDate: fare.departDate,
          price: fare.price,
          p75,
          floor,
        });
        return false;
      });
    }
  }
  return kept;
}
