/** "Add to Apple Wallet" button rules and pass request parts — pure, no React Native imports. */

/** Header carrying the RevenueCat app user ID; the proxy checks the Pro entitlement before making a pass updatable. */
export const WALLET_PRO_HEADER = 'X-WaiAir-RC-User';

/** Tracked flights show the button from 48 h before departure until 12 h after it (still flying or just landed). */
export const WALLET_WINDOW_BEFORE_MS = 48 * 60 * 60 * 1000;
export const WALLET_WINDOW_AFTER_MS = 12 * 60 * 60 * 1000;

function slug(flightNumber: string): string {
  return String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
}

/** Plain pass (no scanned boarding pass): GET /passes/flight/{number}. */
export function plainWalletPassUrl(proxy: string, flightNumber: string): string {
  return `${String(proxy).replace(/\/$/, '')}/passes/flight/${encodeURIComponent(slug(flightNumber))}`;
}

/** Pro users send their RevenueCat ID so the pass gets push updates; free users send nothing. */
export function walletProHeaders(isPro: boolean, appUserId: string | null | undefined): Record<string, string> {
  const id = String(appUserId || '').trim();
  return isPro && id ? { [WALLET_PRO_HEADER]: id } : {};
}

/** Tracked-flight card: departure known and within the Wallet window. */
export function inWalletWindow(departureMs: number | null | undefined, now: number): boolean {
  if (departureMs == null || !Number.isFinite(departureMs)) return false;
  return departureMs - now <= WALLET_WINDOW_BEFORE_MS && now - departureMs <= WALLET_WINDOW_AFTER_MS;
}
