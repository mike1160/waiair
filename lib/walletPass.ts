/**
 * Flight pass → Apple Wallet. Scanned boarding pass: raw barcode from AsyncStorage, one-time token from the proxy, pass with
 * the barcode. Otherwise the plain pass. Shown in Apple's add-pass sheet (modules/wallet-pass); builds without that module
 * fall back to Safari. Pro users send their RevenueCat ID so the proxy makes the pass updatable (push updates).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { addPassFromUrl, AddPassButton } from '../modules/wallet-pass';
import { fetchWithTimeout } from './net';
import { boardingPassStorageKey, isBcbpBarcode, normalizeBcbp, walletPassUrl } from './boardingPassBarcode';
import { passDateParam, passFromParam, plainWalletPassUrl, walletPassRecordKey, walletProHeaders, type WalletPassRecord } from './walletButton';
import { PROXY_BASE } from './proxyUrl.ts';

const PROXY = PROXY_BASE;
const TOKEN_TIMEOUT_MS = 10000;

export type WalletAddResult = 'added' | 'cancelled' | 'failed';

/** Keeps the raw BCBP of a scanned boarding pass under boarding_pass_{flightNumber}; ignores anything that is not BCBP. */
export async function saveBoardingPassBarcode(flightNumber: string, raw: string): Promise<void> {
  const barcode = normalizeBcbp(raw);
  if (!flightNumber || !isBcbpBarcode(barcode)) return;
  try {
    await AsyncStorage.setItem(boardingPassStorageKey(flightNumber), barcode);
  } catch { /* the Wallet button then adds the plain pass */ }
}

export async function loadBoardingPassBarcode(flightNumber: string): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(boardingPassStorageKey(flightNumber));
    return stored && isBcbpBarcode(stored) ? stored : null;
  } catch {
    return null;
  }
}

async function proHeaders(isPro: boolean): Promise<Record<string, string>> {
  if (!isPro) return {};
  try {
    return walletProHeaders(true, await Purchases.getAppUserID());
  } catch {
    return {};
  }
}

/** The pass last added to Wallet for this number (date + departure airport); null when none was added here. */
export async function loadWalletPassRecord(flightNumber: string): Promise<WalletPassRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(walletPassRecordKey(flightNumber));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.date === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function saveWalletPassRecord(flightNumber: string, departureIso?: string | null, originIata?: string | null): Promise<void> {
  const date = passDateParam(departureIso);
  if (!date) return;
  const record: WalletPassRecord = { date, ...(passFromParam(originIata) ? { from: passFromParam(originIata) as string } : {}) };
  try {
    await AsyncStorage.setItem(walletPassRecordKey(flightNumber), JSON.stringify(record));
  } catch { /* the stale banner then stays quiet */ }
}

/** POST the stored barcode for a one-time token (name and PNR stay out of URLs); null when the proxy refuses. */
async function barcodePassUrl(number: string, barcode: string, departureIso?: string | null, originIata?: string | null): Promise<string | null> {
  const res = await fetchWithTimeout(`${PROXY}/passes/flight/${encodeURIComponent(number)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode }),
  }, TOKEN_TIMEOUT_MS);
  const json = await res.json().catch(() => null);
  return res.ok && typeof json?.token === 'string' ? walletPassUrl(PROXY, number, json.token, departureIso, originIata) : null;
}

/**
 * iOS only. Scanned boarding pass for this flight → pass with its barcode (token flow); otherwise the plain pass. Free
 * users get a working pass without push updates.
 */
export async function addFlightPassToWallet(
  flightNumber: string,
  { isPro, departureIso, originIata }: { isPro: boolean; departureIso?: string | null; originIata?: string | null },
): Promise<WalletAddResult> {
  if (Platform.OS !== 'ios') return 'failed';
  const number = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  if (!number) return 'failed';
  try {
    const barcode = await loadBoardingPassBarcode(number);
    const url = barcode
      ? await barcodePassUrl(number, barcode, departureIso, originIata)
      : plainWalletPassUrl(PROXY, number, departureIso, originIata);
    if (!url) return 'failed';
    if (!AddPassButton) {
      // Binary without the WalletPass module: Safari shows the add sheet (plain request, so no push updates).
      await Linking.openURL(url);
      return 'added';
    }
    const result = await addPassFromUrl(url, await proHeaders(isPro));
    // Remembered so a later change of date or boarding airport can say the pass is out of date.
    if (result === 'added') await saveWalletPassRecord(number, departureIso, originIata);
    return result;
  } catch {
    return 'failed';
  }
}
