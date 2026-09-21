import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APP_MODES,
  FLIP_HALF_MS,
  FLIP_STAGGER_MS,
  MODE_EMOJI,
  flipCells,
  flipDurationMs,
  isModeTheme,
  kidsPhaseKey,
  modeForTheme,
  themeForMode,
} from './modes.ts';

test('five modes, each with its emoji', () => {
  assert.deepEqual(APP_MODES, ['day', 'night', 'airport', 'kids', 'blackout']);
  assert.equal(MODE_EMOJI.day, '☀️');
  assert.equal(MODE_EMOJI.night, '🌙');
  assert.equal(MODE_EMOJI.airport, '✈️');
  assert.equal(MODE_EMOJI.kids, '👶');
  assert.equal(MODE_EMOJI.blackout, '⬛');
});

test('blackout is a mode of its own, like airport and kids', () => {
  assert.equal(modeForTheme('blackout', true), 'blackout');
  assert.equal(themeForMode('blackout'), 'blackout');
  assert.equal(isModeTheme('blackout'), true);
  // Coming back out of blackout returns the user's own light or dark theme, not blackout again.
  assert.equal(themeForMode('night', { dark: 'blackout' }), 'classic', 'a mode theme is never remembered as the dark one');
  assert.equal(themeForMode('day', { light: 'blossom' }), 'blossom');
});

test('a theme maps to its mode', () => {
  assert.equal(modeForTheme('airport', true), 'airport');
  assert.equal(modeForTheme('kids', false), 'kids');
  assert.equal(modeForTheme('day', false), 'day');
  assert.equal(modeForTheme('classic', true), 'night');
  assert.equal(modeForTheme('gold', true), 'night', 'any dark theme is Night');
  assert.equal(modeForTheme('blossom', false), 'day', 'any light theme is Day');
});

test('Day and Night return to the user\'s own theme, never to Airport or Kids', () => {
  assert.equal(themeForMode('airport'), 'airport');
  assert.equal(themeForMode('kids'), 'kids');
  assert.equal(themeForMode('day'), 'day', 'nothing remembered yet');
  assert.equal(themeForMode('night'), 'classic');
  assert.equal(themeForMode('night', { dark: 'spotter' }), 'spotter', 'a Spotter user keeps Spotter');
  assert.equal(themeForMode('day', { light: 'blossom' }), 'blossom');
  assert.equal(themeForMode('night', { dark: 'airport' }), 'classic', 'Airport is not a Night theme');
  assert.equal(themeForMode('day', { light: 'kids' }), 'day', 'Kids is not a Day theme');
  assert.equal(isModeTheme('airport'), true);
  assert.equal(isModeTheme('classic'), false);
});

test('the kids phase ladder follows the clock before departure', () => {
  const at = (m: number) => kidsPhaseKey({ phase: 'scheduled', minutesToDeparture: m });
  assert.equal(at(30 * 60), 'kids_phase_tomorrow', '>24h');
  assert.equal(at(24 * 60 + 1), 'kids_phase_tomorrow');
  assert.equal(at(24 * 60), 'kids_phase_pack', '12–24h');
  assert.equal(at(12 * 60 + 1), 'kids_phase_pack');
  assert.equal(at(12 * 60), 'kids_phase_almost', '3–12h');
  assert.equal(at(3 * 60 + 1), 'kids_phase_almost');
  assert.equal(at(3 * 60), 'kids_phase_to_airport', '1–3h');
  assert.equal(at(61), 'kids_phase_to_airport');
  assert.equal(at(60), 'kids_phase_soon', '<1h');
  assert.equal(at(0), 'kids_phase_soon');
  assert.equal(at(-20), 'kids_phase_soon', 'past departure but not boarded yet');
});

test('the flight phase wins over the clock', () => {
  assert.equal(kidsPhaseKey({ phase: 'boarding', minutesToDeparture: 900 }), 'kids_phase_boarding');
  assert.equal(kidsPhaseKey({ phase: 'inflight', minutesToDeparture: -60 }), 'kids_phase_inflight');
  assert.equal(kidsPhaseKey({ phase: 'landed', minutesToDeparture: -600 }), 'kids_phase_landed');
  assert.equal(kidsPhaseKey({ phase: 'cancelled', minutesToDeparture: 60 }), null);
  assert.equal(kidsPhaseKey({ phase: 'scheduled', minutesToDeparture: null }), null, 'unknown time: no card');
});

test('a split-flap value flips only the characters that change', () => {
  assert.deepEqual(flipCells('12:25', '12:40').map(c => c.flips), [false, false, false, true, true]);
  assert.deepEqual(flipCells('S107', 'S107').map(c => c.flips), [false, false, false, false]);
  const shorter = flipCells('B12', 'C3');
  assert.equal(shorter.length, 3, 'the old value is cleared to its full width');
  assert.deepEqual(shorter.map(c => c.to), ['C', '3', ' ']);
  assert.deepEqual(flipCells('', 'T1').map(c => c.from), [' ', ' ']);
});

test('the flip takes the last changing cell plus both halves', () => {
  assert.equal(flipDurationMs('12:25', '12:25'), 0, 'nothing changes, nothing moves');
  assert.equal(flipDurationMs('12:25', '12:40'), 4 * FLIP_STAGGER_MS + 2 * FLIP_HALF_MS);
  assert.equal(flipDurationMs('A', 'B'), 2 * FLIP_HALF_MS);
  assert.equal(FLIP_STAGGER_MS, 40);
  assert.equal(FLIP_HALF_MS, 80);
});
