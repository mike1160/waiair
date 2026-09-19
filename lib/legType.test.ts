import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detailLegType } from './legType.ts';

test('a tracked flight is read on its own leg, whatever the board tab says', () => {
  // The case that broke: tracked as a departure, board tab on arrivals (the default while the board is on).
  assert.equal(detailLegType('departure', 'arrival'), 'departure');
  assert.equal(detailLegType('arrival', 'departure'), 'arrival');
});

test('a flight opened from the board follows the board tab', () => {
  assert.equal(detailLegType(undefined, 'arrival'), 'arrival');
  assert.equal(detailLegType(null, 'departure'), 'departure');
});
