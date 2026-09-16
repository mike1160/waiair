import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FALLBACK_MONTHLY_LABEL,
  FALLBACK_YEARLY_LABEL,
  LANDING_PAYWALL_DELAY_MS,
  highlightToMoment,
  landingPaywallStorageKey,
  localDateKey,
  paywallDismissedStorageKey,
  paywallShownStorageKey,
  shouldShowSmartPaywall,
  type SmartPaywallGate,
} from './smartPaywall.ts';

function gate(over: Partial<SmartPaywallGate> = {}): SmartPaywallGate {
  return {
    isPro: false,
    betaMode: false,
    launchCount: 3,
    dismissedToday: false,
    shownToday: false,
    landingAlreadyShown: false,
    moment: 'landing',
    ...over,
  };
}

test('dismissal key matches paywall_dismissed_{date}', () => {
  assert.equal(paywallDismissedStorageKey('2026-09-16'), 'paywall_dismissed_2026-09-16');
  assert.equal(paywallShownStorageKey('2026-09-16'), 'paywall_shown_2026-09-16');
  assert.equal(landingPaywallStorageKey('TG205-BKK-AMS'), 'paywall_landing_TG205-BKK-AMS');
});

test('local date key is calendar date, not UTC slice', () => {
  assert.equal(localDateKey(new Date(2026, 8, 16, 23, 30, 0)), '2026-09-16');
});

test('landing paywall waits 3 seconds after the celebration', () => {
  assert.equal(LANDING_PAYWALL_DELAY_MS, 3000);
});

test('fallback prices use European comma', () => {
  assert.equal(FALLBACK_MONTHLY_LABEL, '€2,99');
  assert.equal(FALLBACK_YEARLY_LABEL, '€19,99');
});

test('highlight maps to paywall moment', () => {
  assert.equal(highlightToMoment('landing'), 'landing');
  assert.equal(highlightToMoment('search_quota'), 'search_quota');
  assert.equal(highlightToMoment('live_map'), 'live_map');
  assert.equal(highlightToMoment('history'), 'history');
  assert.equal(highlightToMoment('credits'), 'credits');
  assert.equal(highlightToMoment('platinum'), 'generic');
  assert.equal(highlightToMoment(undefined), 'generic');
});

test('never show on first app open, Pro, beta, or after today\'s dismiss/show', () => {
  assert.equal(shouldShowSmartPaywall(gate()), true);
  assert.equal(shouldShowSmartPaywall(gate({ launchCount: 1 })), false);
  assert.equal(shouldShowSmartPaywall(gate({ launchCount: 0 })), false);
  assert.equal(shouldShowSmartPaywall(gate({ isPro: true })), false);
  assert.equal(shouldShowSmartPaywall(gate({ betaMode: true })), false);
  assert.equal(shouldShowSmartPaywall(gate({ dismissedToday: true })), false);
  assert.equal(shouldShowSmartPaywall(gate({ shownToday: true })), false);
});

test('landing paywall only once per flight', () => {
  assert.equal(shouldShowSmartPaywall(gate({ moment: 'landing', landingAlreadyShown: true })), false);
  assert.equal(shouldShowSmartPaywall(gate({ moment: 'live_map', landingAlreadyShown: true })), true);
});
