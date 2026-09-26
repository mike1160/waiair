import test from 'node:test';
import assert from 'node:assert/strict';

import { STAR_COUNT, STAR_OPACITY, STARS, starField } from './starField.ts';

test('the sky is the same sky every time', () => {
  // The whole point of seeding it: two calls cannot disagree, so the dots never move between renders.
  assert.deepEqual(starField(20, 7), starField(20, 7));
  assert.notDeepEqual(starField(20, 7), starField(20, 8));
});

test('every star is on screen and small', () => {
  for (const s of starField(200, 99)) {
    assert.ok(s.x >= 0 && s.x < 1, `x out of frame: ${s.x}`);
    assert.ok(s.y >= 0 && s.y < 1, `y out of frame: ${s.y}`);
    assert.ok(s.size >= 1 && s.size <= 2.5, `size out of range: ${s.size}`);
  }
});

test('the stars are actually scattered, not stacked in a line', () => {
  const stars = starField(60, 4);
  assert.ok(new Set(stars.map(s => s.x)).size > 55, 'x values repeat too often to be a field');
  assert.ok(new Set(stars.map(s => s.y)).size > 55, 'y values repeat too often to be a field');
  // Both halves of the screen get stars: a field bunched into one corner is not a sky.
  assert.ok(stars.some(s => s.y < 0.5) && stars.some(s => s.y >= 0.5));
});

test('the count is respected, including the silly ones', () => {
  assert.equal(starField(0, 1).length, 0);
  assert.equal(starField(-5, 1).length, 0);
  assert.equal(starField(3, 1).length, 3);
  assert.equal(STARS.length, STAR_COUNT);
});

test('the dots are drawn half transparent, as specified', () => {
  assert.equal(STAR_OPACITY, 0.5);
});
