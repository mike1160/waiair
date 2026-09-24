/** Flight-number search quota — pure, no React Native imports (lib/searchQuotaStore.ts persists it). */

export type SearchTier = 'free' | 'credits' | 'pro';

/** Per calendar month, on the device's own clock. */
export const FREE_MONTHLY_SEARCHES = 10;
export const CREDITS_DAILY_SEARCHES = 50;
export const PRO_DAILY_SEARCHES = 100;

/** @deprecated The lifetime ledger. Never read any more: an old install simply starts its first month. */
export const SEARCH_COUNT_FREE_KEY = 'search_count_free';
export const SEARCH_COUNT_DAILY_PREFIX = 'search_count_daily_';
export const SEARCH_COUNT_MONTHLY_PREFIX = 'search_count_monthly_';

/** Only requests with this header count on the proxy: user-typed flight-number searches. */
export const SEARCH_HEADER = 'X-WaiAir-Search';
export const TIER_HEADER = 'X-WaiAir-Tier';
export const DEVICE_HEADER = 'X-WaiAir-Device';
export const DAY_HEADER = 'X-WaiAir-Day';
export const RC_USER_HEADER = 'X-WaiAir-RC-User';

/** Remembered numbers per period, so searching the same flight again is free (and the ledger stays small). */
const MAX_REMEMBERED_NUMBERS = 200;

export type SearchLedger = { count: number; numbers: string[] };

export type QuotaCheck = {
  allowed: boolean;
  /** This number was already counted in the period: no new search is used. */
  alreadyCounted: boolean;
  used: number;
  limit: number;
};

export function searchTierFor({ isPro, creditBalance }: { isPro: boolean; creditBalance: number }): SearchTier {
  if (isPro) return 'pro';
  return creditBalance > 0 ? 'credits' : 'free';
}

/**
 * Free: 10 a month. Credits: 50 a day. Pro: 100 a day.
 *
 * Free used to be ten for the life of the install, which quietly ended the app for anyone who tried eleven
 * flights — there was no way back, ever. A month is a limit someone can live with and understand.
 */
export function searchLimit(tier: SearchTier): { period: 'month' | 'day'; max: number } {
  if (tier === 'pro') return { period: 'day', max: PRO_DAILY_SEARCHES };
  if (tier === 'credits') return { period: 'day', max: CREDITS_DAILY_SEARCHES };
  return { period: 'month', max: FREE_MONTHLY_SEARCHES };
}

/** Device-local YYYY-MM-DD: the daily quota resets at the user's own midnight. */
export function localDayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dailySearchKey(day: string): string {
  return `${SEARCH_COUNT_DAILY_PREFIX}${day}`;
}

/** 'YYYY-MM' from a 'YYYY-MM-DD' day, so the month follows the same local clock as the daily tiers. */
export function monthFromDay(day: string): string {
  const m = String(day || '').match(/^(\d{4}-\d{2})/);
  return m ? m[1] : localDayKey().slice(0, 7);
}

export function monthlySearchKey(day: string): string {
  return `${SEARCH_COUNT_MONTHLY_PREFIX}${monthFromDay(day)}`;
}

/** AsyncStorage key of the tier's ledger: this month's free count, or today's daily count. */
export function searchLedgerKey(tier: SearchTier, day: string): string {
  return searchLimit(tier).period === 'month' ? monthlySearchKey(day) : dailySearchKey(day);
}

export function normalizeSearchNumber(flightNumber: string): string {
  return String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
}

/** Stored ledger → { count, numbers }; a plain number (older format) is a count without remembered numbers. */
export function parseSearchLedger(raw: string | null | undefined): SearchLedger {
  if (!raw) return { count: 0, numbers: [] };
  try {
    const value = JSON.parse(raw);
    if (typeof value === 'number' && Number.isFinite(value)) return { count: Math.max(0, Math.floor(value)), numbers: [] };
    const count = Number(value?.count);
    const numbers = Array.isArray(value?.numbers) ? value.numbers.map(String) : [];
    return { count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0, numbers };
  } catch {
    return { count: 0, numbers: [] };
  }
}

export function quotaCheck(ledger: SearchLedger, tier: SearchTier, flightNumber: string): QuotaCheck {
  const { max } = searchLimit(tier);
  const number = normalizeSearchNumber(flightNumber);
  const alreadyCounted = !!number && ledger.numbers.includes(number);
  return { allowed: alreadyCounted || ledger.count < max, alreadyCounted, used: ledger.count, limit: max };
}

/** Counts a search for a number not yet counted in the period. */
export function recordSearch(ledger: SearchLedger, flightNumber: string): SearchLedger {
  const number = normalizeSearchNumber(flightNumber);
  if (!number || ledger.numbers.includes(number)) return ledger;
  return { count: ledger.count + 1, numbers: [...ledger.numbers, number].slice(-MAX_REMEMBERED_NUMBERS) };
}

/** The proxy said the quota is used up (402): the app's count follows, so the next search does not hit the network. */
export function exhaustLedger(ledger: SearchLedger, tier: SearchTier): SearchLedger {
  return { ...ledger, count: Math.max(ledger.count, searchLimit(tier).max) };
}
