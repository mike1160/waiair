import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOARDING_PASS_SHIMMER_MS,
  BOOKING_STUB_LIFT_AFTER_MS,
  boardingPassCardVisible,
  boardingPassShimmerPlayed,
  bookingStubLiftPlayed,
  consumeBoardingPassShimmer,
  consumeBookingStubLift,
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

test('boarding-pass card hides while the keyboard is up and returns when height is 0', () => {
  assert.equal(boardingPassCardVisible(false), true);
  assert.equal(boardingPassCardVisible(true), false);
});

test('stub lift fires once per session after the card shimmer', () => {
  resetBoardingPassShimmerForTests();
  assert.equal(BOARDING_PASS_SHIMMER_MS, 900);
  assert.equal(BOOKING_STUB_LIFT_AFTER_MS, 2400);
  assert.equal(bookingStubLiftPlayed(), false);
  assert.equal(consumeBookingStubLift(), true);
  assert.equal(bookingStubLiftPlayed(), true);
  assert.equal(consumeBookingStubLift(), false);
});
