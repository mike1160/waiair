/** Scanned boarding pass → Apple Wallet: raw barcode in AsyncStorage, one-time token from the proxy, pass opened in Safari. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { fetchWithTimeout } from './net';
import { boardingPassStorageKey, isBcbpBarcode, normalizeBcbp, walletPassUrl } from './boardingPassBarcode';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const TOKEN_TIMEOUT_MS = 10000;

/** Keeps the raw BCBP of a scanned boarding pass under boarding_pass_{flightNumber}; ignores anything that is not BCBP. */
export async function saveBoardingPassBarcode(flightNumber: string, raw: string): Promise<void> {
  const barcode = normalizeBcbp(raw);
  if (!flightNumber || !isBcbpBarcode(barcode)) return;
  try {
    await AsyncStorage.setItem(boardingPassStorageKey(flightNumber), barcode);
  } catch { /* the Wallet button then reports failure */ }
}

export async function loadBoardingPassBarcode(flightNumber: string): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(boardingPassStorageKey(flightNumber));
    return stored && isBcbpBarcode(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * iOS: POST the stored barcode for a one-time token (name and PNR stay out of URLs), then open the pass URL in Safari,
 * which shows the Wallet add sheet. false when there is no barcode, the proxy refuses, or this is not iOS.
 */
export async function addBoardingPassToWallet(flightNumber: string): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const barcode = await loadBoardingPassBarcode(flightNumber);
  if (!barcode) return false;
  const number = String(flightNumber).replace(/\s+/g, '').toUpperCase();
  try {
    const res = await fetchWithTimeout(`${PROXY}/passes/flight/${encodeURIComponent(number)}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    }, TOKEN_TIMEOUT_MS);
    const json = await res.json().catch(() => null);
    if (!res.ok || typeof json?.token !== 'string') return false;
    await Linking.openURL(walletPassUrl(PROXY, number, json.token));
    return true;
  } catch {
    return false;
  }
}
