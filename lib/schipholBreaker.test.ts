import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHIPHOL_COOLDOWN_MS,
  afterFailure,
  afterSuccess,
  isConfigFailure,
  isOpen,
  type SchipholBreaker,
} from './schipholBreaker.ts';

const NOW = Date.parse('2026-09-24T09:00:00Z');

test('a refused request stops the calls; a bad moment does not', () => {
  // What every AMS search was hitting: the API answers 400 and will keep answering 400.
  assert.equal(isConfigFailure(400), true);
  assert.equal(isConfigFailure(401), true);
  assert.equal(isConfigFailure(403), true);
  assert.equal(isConfigFailure(404), true);
  // A blip is worth another try later, so it must not disable the lookups for half an hour.
  assert.equal(isConfigFailure(500), false);
  assert.equal(isConfigFailure(503), false);
  assert.equal(isConfigFailure(429), false);
  assert.equal(isConfigFailure(undefined), false);
  assert.equal(isConfigFailure(null), false);
});

test('after a 400 the lookups pause, and come back by themselves', () => {
  let state: SchipholBreaker = null;
  assert.equal(isOpen(state, NOW), false, 'nothing is paused to begin with');

  state = afterFailure(state, 400, NOW);
  assert.equal(isOpen(state, NOW), true);
  assert.equal(isOpen(state, NOW + SCHIPHOL_COOLDOWN_MS - 1), true, 'still paused inside the half hour');
  assert.equal(isOpen(state, NOW + SCHIPHOL_COOLDOWN_MS), false, 'and tries again after it');
});

test('a timeout or a server error leaves the lookups alone', () => {
  let state: SchipholBreaker = null;
  state = afterFailure(state, 503, NOW);
  assert.equal(state, null);
  assert.equal(isOpen(state, NOW), false);
  state = afterFailure(state, undefined, NOW);
  assert.equal(isOpen(state, NOW), false);
});

test('a working key clears the pause without restarting the app', () => {
  let state: SchipholBreaker = afterFailure(null, 401, NOW);
  assert.equal(isOpen(state, NOW), true);
  state = afterSuccess();
  assert.equal(state, null);
  assert.equal(isOpen(state, NOW), false);
});

test('the board never depends on the lookups: a paused breaker is not an error', () => {
  // enrichAmsBoard() returns the flights it was given whenever the lookup fails or is paused, so an AMS
  // search still lists its flights — only the gate and belt are missing. This states that contract: the
  // breaker only ever decides whether to call, never whether there are results.
  const state = afterFailure(null, 400, NOW);
  assert.equal(isOpen(state, NOW), true);
  assert.equal(typeof isOpen(state, NOW), 'boolean', 'the breaker answers a question, it does not throw');
});
