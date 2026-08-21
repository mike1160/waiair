/** Drop extreme fare outliers before they reach flight-search UI. */

export const ANOMALY_MEDIAN_MULTIPLIER = 5;
export const SHORT_HAUL_MAX_EUR = 2500;
export const SHORT_HAUL_HOURS = 3;

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
  thb: 0.026,
};

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
  return kept;
}
