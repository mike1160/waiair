import assert from 'node:assert/strict';
import { test } from 'node:test';
import { needsScopePrompt, scopeGrantOutcome } from './googleScopeGate.ts';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

test('[W/10] a completed consent is granted even when the echoed list omits the scope', () => {
  // This is the bug: the SDK answers from its cache right after the consent screen.
  assert.equal(scopeGrantOutcome({ type: 'success', data: { scopes: [] } }), 'granted');
  assert.equal(scopeGrantOutcome({ type: 'success', data: { scopes: ['openid', 'email'] } }), 'granted');
  assert.equal(scopeGrantOutcome({ type: 'success', data: null }), 'granted');
  assert.equal(scopeGrantOutcome({ type: 'success' }), 'granted');
});

test('[W/10] and it is granted when the list does mention it, obviously', () => {
  assert.equal(scopeGrantOutcome({ type: 'success', data: { scopes: [SCOPE] } }), 'granted');
});

test('[W/10] only an outright non-success is a cancel', () => {
  assert.equal(scopeGrantOutcome({ type: 'cancelled' }), 'cancelled');
  assert.equal(scopeGrantOutcome({ type: 'noSavedCredentialFound' }), 'cancelled');
  assert.equal(scopeGrantOutcome(null), 'cancelled');
  assert.equal(scopeGrantOutcome(undefined), 'cancelled');
  assert.equal(scopeGrantOutcome({}), 'cancelled');
});

test('[W/10] the echoed list may still spare the traveller a needless prompt', () => {
  // Trusted in one direction only: a reason to skip asking, never a reason to discard a consent.
  assert.equal(needsScopePrompt([SCOPE], SCOPE), false);
  assert.equal(needsScopePrompt(['openid', 'email'], SCOPE), true);
  assert.equal(needsScopePrompt([], SCOPE), true);
  assert.equal(needsScopePrompt(null, SCOPE), true);
  assert.equal(needsScopePrompt(undefined, SCOPE), true);
  assert.equal(needsScopePrompt([SCOPE], ''), false, 'no scope asked for, nothing to prompt');
});
