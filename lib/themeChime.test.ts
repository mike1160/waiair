import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldChime, themeHasChime } from './themeChime.ts';

test('only Eagle and Cockpit have a chime at all', () => {
  assert.equal(themeHasChime('eagle'), true);
  assert.equal(themeHasChime('cockpit'), true);
  for (const id of ['classic', 'day', 'gold', 'platinum', 'spotter', 'airport', 'blackout',
    'vapor', 'arctic', 'kids', 'deepspace', 'holo', 'dutch', 'thai', '', null, undefined]) {
    assert.equal(themeHasChime(id), false, `${String(id)} must stay silent`);
  }
});

test('Eagle chimes on departure, Cockpit on boarding, and never on each other\'s moment', () => {
  assert.equal(shouldChime('eagle', 'boarding', 'en-route'), true);
  assert.equal(shouldChime('eagle', 'scheduled', 'boarding'), false);
  assert.equal(shouldChime('cockpit', 'scheduled', 'boarding'), true);
  assert.equal(shouldChime('cockpit', 'boarding', 'en-route'), false);
});

test('a chime is a transition: the same status twice is silent', () => {
  assert.equal(shouldChime('cockpit', 'boarding', 'boarding'), false);
  assert.equal(shouldChime('eagle', 'en-route', 'en-route'), false);
  // Delayed while boarding and back again is one boarding call, but two transitions into it. The screen
  // cannot show 'boarding' → 'delayed' → 'boarding' for one leg, so this is the honest reading of "again".
  assert.equal(shouldChime('cockpit', 'delayed', 'boarding'), true);
});

test('the first status ever seen is remembered, not sounded', () => {
  // Opening the app mid-boarding is not a boarding call.
  assert.equal(shouldChime('cockpit', null, 'boarding'), false);
  assert.equal(shouldChime('eagle', '', 'en-route'), false);
  assert.equal(shouldChime('cockpit', undefined, 'boarding'), false);
});

test('no flight, no chime', () => {
  assert.equal(shouldChime('eagle', 'boarding', null), false);
  assert.equal(shouldChime('cockpit', 'scheduled', ''), false);
});

test('a silent theme stays silent through any transition', () => {
  assert.equal(shouldChime('holo', 'scheduled', 'boarding'), false);
  assert.equal(shouldChime('airport', 'boarding', 'en-route'), false);
  assert.equal(shouldChime(null, 'boarding', 'en-route'), false);
});
