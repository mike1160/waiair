import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  boardingPassCardVisible,
  boardingPassShimmerPlayed,
  consumeBoardingPassShimmer,
  resetBoardingPassShimmerForTests,
} from './boardingPassCard.ts';

test('shimmer flag fires once per session', () => {
  resetBoardingPassShimmerForTests();
  assert.equal(boardingPassShimmerPlayed(), false);
  assert.equal(consumeBoardingPassShimmer(), true);
  assert.equal(boardingPassShimmerPlayed(), true);
  assert.equal(consumeBoardingPassShimmer(), false);
  assert.equal(consumeBoardingPassShimmer(), false);
});

test('boarding-pass card hides on input focus and returns on blur', () => {
  assert.equal(boardingPassCardVisible(false), true);
  assert.equal(boardingPassCardVisible(true), false);
});
