/** Smart paywall moments — pure rules (lib/smartPaywallStore.ts persists them). */

export type SmartPaywallMoment =
  | 'landing'
  | 'search_quota'
  | 'live_map'
  | 'history'
  | 'credits'
  | 'generic';

export const LANDING_PAYWALL_DELAY_MS = 3000;

export const FALLBACK_MONTHLY_LABEL = '€2,99';
export const FALLBACK_YEARLY_LABEL = '€19,99';

export function localDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Exact AsyncStorage key from the product spec. */
export function paywallDismissedStorageKey(dateKey: string): string {
  return `paywall_dismissed_${dateKey}`;
}

export function paywallShownStorageKey(dateKey: string): string {
  return `paywall_shown_${dateKey}`;
}

export function landingPaywallStorageKey(flightKey: string): string {
  return `paywall_landing_${String(flightKey || '').trim()}`;
}

export function highlightToMoment(highlight?: string | null): SmartPaywallMoment {
  const h = String(highlight || '').trim().toLowerCase();
  if (h === 'landing' || h.startsWith('landing:')) return 'landing';
  if (h === 'search_quota') return 'search_quota';
  if (h === 'live_map' || h.includes('live map') || h.includes('livemap')) return 'live_map';
  if (h === 'history') return 'history';
  if (h === 'credits') return 'credits';
  return 'generic';
}

export type SmartPaywallGate = {
  isPro: boolean;
  betaMode: boolean;
  /** 1 = first app open (after recordAppOpen). Never show on the first launch. */
  launchCount: number;
  dismissedToday: boolean;
  shownToday: boolean;
  landingAlreadyShown: boolean;
  moment: SmartPaywallMoment;
};

/** Reward-moment gate: never on first open, never twice in a day, once per landing. */
export function shouldShowSmartPaywall(s: SmartPaywallGate): boolean {
  if (s.isPro || s.betaMode) return false;
  if (s.launchCount <= 1) return false;
  if (s.dismissedToday || s.shownToday) return false;
  if (s.moment === 'landing' && s.landingAlreadyShown) return false;
  return true;
}
