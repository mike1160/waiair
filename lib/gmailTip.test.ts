import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GMAIL_TIP_DISMISSED_KEY, GMAIL_TIP_MS, dismissedFromStored, shouldShowGmailTip } from './gmailTip.ts';

const base = { trackedCount: 1, gmailConnected: false, dismissed: false };

test('the tip waits for the first flight', () => {
  assert.equal(shouldShowGmailTip({ ...base, trackedCount: 0 }), false, 'nothing tracked yet: no tip');
  assert.equal(shouldShowGmailTip(base), true, 'the first flight is the moment');
  assert.equal(shouldShowGmailTip({ ...base, trackedCount: 4 }), true);
});

test('nothing to offer someone who is already signed in', () => {
  assert.equal(shouldShowGmailTip({ ...base, gmailConnected: true }), false);
  assert.equal(shouldShowGmailTip({ ...base, gmailConnected: true, trackedCount: 9 }), false);
});

test('"Later" means never again, and once a run is enough', () => {
  assert.equal(shouldShowGmailTip({ ...base, dismissed: true }), false);
  assert.equal(shouldShowGmailTip({ ...base, shownThisSession: true }), false);
});

test('what is read back from storage', () => {
  assert.equal(GMAIL_TIP_DISMISSED_KEY, 'onboarding:gmailTipDismissed');
  assert.equal(dismissedFromStored('1'), true);
  assert.equal(dismissedFromStored(''), false);
  assert.equal(dismissedFromStored(null), false);
  assert.equal(dismissedFromStored(undefined), false);
  // Anything the app did not write itself is not a dismissal.
  assert.equal(dismissedFromStored('0'), false);
  assert.equal(dismissedFromStored('true'), false);
});

test('the tip stays long enough to be read', () => {
  assert.equal(GMAIL_TIP_MS, 20_000);
  // Longer than the scan-results card, which appears when the user is already looking at the app.
  assert.ok(GMAIL_TIP_MS > 15_000);
});
