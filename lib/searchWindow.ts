/**
 * How far ahead a flight can be searched. One constant, so the window can later be made shorter for free
 * users and longer for Pro without hunting through the search screen.
 */

export const MAX_SEARCH_DAYS = 30;

/** Midnight, `days` after the given day, in local time — the last day a search may land on. */
export function searchWindowEnd(from: Date, days = MAX_SEARCH_DAYS): Date {
  const d = new Date(from.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d;
}
