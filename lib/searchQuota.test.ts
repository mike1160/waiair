import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CREDITS_DAILY_SEARCHES,
  FREE_LIFETIME_SEARCHES,
  PRO_DAILY_SEARCHES,
  SEARCH_COUNT_FREE_KEY,
  dailySearchKey,
  exhaustLedger,
  localDayKey,
  parseSearchLedger,
  quotaCheck,
  recordSearch,
  searchLedgerKey,
  searchLimit,
  searchTierFor,
} from './searchQuota.ts';

test('tier: Pro wins, then a credits balance, else free', () => {
  assert.equal(searchTierFor({ isPro: true, creditBalance: 0 }), 'pro');
  assert.equal(searchTierFor({ isPro: false, creditBalance: 3 }), 'credits');
  assert.equal(searchTierFor({ isPro: false, creditBalance: 0 }), 'free');
});

test('limits: free 10 lifetime, credits 50 a day, Pro 100 a day; storage keys per period', () => {
  assert.deepEqual(searchLimit('free'), { period: 'lifetime', max: 10 });
  assert.deepEqual(searchLimit('credits'), { period: 'day', max: 50 });
  assert.deepEqual(searchLimit('pro'), { period: 'day', max: 100 });
  assert.deepEqual([FREE_LIFETIME_SEARCHES, CREDITS_DAILY_SEARCHES, PRO_DAILY_SEARCHES], [10, 50, 100]);
  assert.equal(searchLedgerKey('free', '2026-09-15'), SEARCH_COUNT_FREE_KEY);
  assert.equal(SEARCH_COUNT_FREE_KEY, 'search_count_free');
  assert.equal(searchLedgerKey('pro', '2026-09-15'), 'search_count_daily_2026-09-15');
  assert.equal(dailySearchKey('2026-09-16'), 'search_count_daily_2026-09-16');
  assert.equal(localDayKey(new Date(2026, 8, 15, 23, 59)), '2026-09-15');
  assert.equal(localDayKey(new Date(2026, 8, 16, 0, 0)), '2026-09-16');
});

test('free: 10 distinct flights, the 11th is blocked; searching an already counted flight again is free', () => {
  let ledger = parseSearchLedger(null);
  for (let i = 1; i <= 10; i++) {
    const check = quotaCheck(ledger, 'free', `TG${400 + i}`);
    assert.equal(check.allowed, true, `search ${i}`);
    ledger = recordSearch(ledger, `TG${400 + i}`);
  }
  assert.equal(ledger.count, 10);
  assert.deepEqual(quotaCheck(ledger, 'free', 'BR75'), { allowed: false, alreadyCounted: false, used: 10, limit: 10 });
  assert.deepEqual(quotaCheck(ledger, 'free', 'tg 403'), { allowed: true, alreadyCounted: true, used: 10, limit: 10 });
  assert.equal(recordSearch(ledger, 'TG403'), ledger);
  // Credits on the same device use their own daily ledger.
  assert.equal(quotaCheck(parseSearchLedger(null), 'credits', 'BR75').allowed, true);
});

test('ledger parsing tolerates old/corrupt values; a proxy 402 exhausts the local count', () => {
  assert.deepEqual(parseSearchLedger('7'), { count: 7, numbers: [] });
  assert.deepEqual(parseSearchLedger('{"count":3,"numbers":["TG403"]}'), { count: 3, numbers: ['TG403'] });
  assert.deepEqual(parseSearchLedger('not json'), { count: 0, numbers: [] });
  assert.deepEqual(parseSearchLedger('{"count":-4}'), { count: 0, numbers: [] });
  const exhausted = exhaustLedger({ count: 2, numbers: ['TG403'] }, 'credits');
  assert.equal(exhausted.count, 50);
  assert.equal(quotaCheck(exhausted, 'credits', 'BR75').allowed, false);
  assert.equal(quotaCheck(exhausted, 'credits', 'TG403').allowed, true);
});
