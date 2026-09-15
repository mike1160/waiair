/**
 * Flight-number search quota on the device (rules in lib/searchQuota.ts). Counted only for user-typed flight-number
 * searches: board loads, tracked-flight polling and refreshes never call these helpers.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { loadCreditSession } from './creditAccount';
import { SearchQuotaError } from './net';
import {
  DAY_HEADER,
  DEVICE_HEADER,
  RC_USER_HEADER,
  SEARCH_COUNT_DAILY_PREFIX,
  SEARCH_HEADER,
  TIER_HEADER,
  exhaustLedger,
  localDayKey,
  parseSearchLedger,
  quotaCheck,
  recordSearch,
  searchLedgerKey,
  type QuotaCheck,
  type SearchLedger,
  type SearchTier,
} from './searchQuota';

const DEVICE_ID_KEY = 'waiair.device.id.v1';

async function readLedger(key: string): Promise<SearchLedger> {
  try {
    return parseSearchLedger(await AsyncStorage.getItem(key));
  } catch {
    return parseSearchLedger(null);
  }
}

async function writeLedger(key: string, ledger: SearchLedger): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(ledger));
  } catch { /* the proxy still enforces the quota */ }
}

/** Yesterday's (and older) daily ledgers are no longer needed. */
async function pruneOldDailyLedgers(today: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const old = keys.filter(k => k.startsWith(SEARCH_COUNT_DAILY_PREFIX) && k !== `${SEARCH_COUNT_DAILY_PREFIX}${today}`);
    if (old.length) await AsyncStorage.multiRemove(old);
  } catch { /* best effort */ }
}

/** Throws SearchQuotaError when this search would go over the tier's limit (already counted numbers are free). */
export async function ensureFlightSearchAllowed(flightNumber: string, tier: SearchTier): Promise<QuotaCheck> {
  const check = quotaCheck(await readLedger(searchLedgerKey(tier, localDayKey())), tier, flightNumber);
  if (!check.allowed) throw new SearchQuotaError(tier, check.limit, check.used);
  return check;
}

/** Counts a search that returned flights. */
export async function recordFlightSearch(flightNumber: string, tier: SearchTier): Promise<void> {
  const day = localDayKey();
  const key = searchLedgerKey(tier, day);
  await writeLedger(key, recordSearch(await readLedger(key), flightNumber));
  void pruneOldDailyLedgers(day);
}

/** The proxy refused (402): the local count follows so the next search opens the paywall without a request. */
export async function markSearchQuotaExhausted(tier: SearchTier): Promise<void> {
  const key = searchLedgerKey(tier, localDayKey());
  await writeLedger(key, exhaustLedger(await readLedger(key), tier));
}

/** Random install ID for the proxy's per-device quota (no personal data). */
export async function searchDeviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored && /^[A-Za-z0-9-]{16,64}$/.test(stored)) return stored;
    const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return '';
  }
}

/**
 * Headers for a user search on /flight/:number. The proxy only accepts Pro with the RevenueCat ID (checked there) and
 * credits with the signed credits session; anything else counts as free.
 */
export async function flightSearchHeaders(tier: SearchTier): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    [SEARCH_HEADER]: '1',
    [TIER_HEADER]: tier,
    [DAY_HEADER]: localDayKey(),
  };
  const deviceId = await searchDeviceId();
  if (deviceId) headers[DEVICE_HEADER] = deviceId;
  if (tier === 'pro') {
    try {
      const appUserId = await Purchases.getAppUserID();
      if (appUserId) headers[RC_USER_HEADER] = appUserId;
    } catch { /* unverified → free on the proxy */ }
  }
  if (tier !== 'free') {
    try {
      const session = await loadCreditSession();
      if (session?.sessionToken) headers.Authorization = `Bearer ${session.sessionToken}`;
    } catch { /* no session */ }
  }
  return headers;
}
