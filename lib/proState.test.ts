import test from 'node:test';
import assert from 'node:assert/strict';

import { proAfterCheck, proAtLaunch, proFromStoredFlag } from './proState.ts';

test('a failed check never takes Pro away', () => {
  // The bug [U/1]: offline at launch, and a paying traveller found everything locked.
  assert.equal(proAfterCheck(true, { kind: 'failed' }), true);
});

test('a failed check does not hand out Pro either', () => {
  assert.equal(proAfterCheck(false, { kind: 'failed' }), false);
});

test('RevenueCat is believed in both directions', () => {
  assert.equal(proAfterCheck(false, { kind: 'answer', pro: true }), true, 'a purchase lands');
  assert.equal(proAfterCheck(true, { kind: 'answer', pro: false }), false, 'a cancellation lands too');
});

test('beta builds are Pro whatever anyone says', () => {
  assert.equal(proAfterCheck(false, { kind: 'answer', pro: false }, true), true);
  assert.equal(proAfterCheck(false, { kind: 'failed' }, true), true);
});

test('launch believes what was written down, and nothing else', () => {
  assert.equal(proAtLaunch('1'), true);
  assert.equal(proAtLaunch('0'), false);
  assert.equal(proAtLaunch(null), false);
  assert.equal(proAtLaunch(undefined), false);
  assert.equal(proAtLaunch(''), false);
  assert.equal(proAtLaunch('true'), false, 'only the flag the app actually writes');
});

test('beta mode is Pro at launch even with nothing stored', () => {
  assert.equal(proAtLaunch(null, true), true);
});

test('the stored flag is read strictly', () => {
  assert.equal(proFromStoredFlag('1'), true);
  assert.equal(proFromStoredFlag(' 1 '), true);
  assert.equal(proFromStoredFlag('0'), false);
  assert.equal(proFromStoredFlag('yes'), false);
});

test('a missing check is treated as a failure, not as a no', () => {
  assert.equal(proAfterCheck(true, undefined as never), true);
});
