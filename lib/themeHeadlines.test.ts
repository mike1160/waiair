import assert from 'node:assert/strict';
import { test } from 'node:test';
import { themeHeadlines, type ThemeHeadlineCopy } from './themeHeadlines.ts';

const COPY: ThemeHeadlineCopy = {
  eagleCountdown: h => `T-minus ${h} hours to departure`,
  eagleGo: 'All systems go',
  eagleLaunch: 'You are go for launch',
  cockpitClearance: 'Cleared for takeoff',
  cockpitCruise: ft => `Cruising altitude ${ft} ft`,
  cockpitApproach: 'Gear down, flaps set',
  cockpitArrived: 'You have arrived at your destination',
  spaceNavigating: 'Navigating the cosmos',
  spaceApproaching: 'Approaching destination',
  spaceTouchdown: city => `Touchdown on planet ${city}`,
  holoJourney: 'Your journey begins',
  holoClouds: 'Floating above the clouds',
  holoHome: 'Welcome home',
};

test('every theme that has a voice uses it', () => {
  assert.deepEqual(themeHeadlines('cockpit', COPY), [
    'Cleared for takeoff',
    'Cruising altitude 35,000 ft',
    'Gear down, flaps set',
    'You have arrived at your destination',
  ]);
  assert.deepEqual(themeHeadlines('holo', COPY), [
    'Your journey begins',
    'Floating above the clouds',
    'Welcome home',
  ]);
});

test('the lines that need a fact are left out when the fact is missing', () => {
  // Eagle counts down only when there is something to count down to.
  assert.deepEqual(themeHeadlines('eagle', COPY), ['All systems go', 'You are go for launch']);
  assert.equal(themeHeadlines('eagle', COPY, { hoursToDeparture: 6 })[0], 'T-minus 6 hours to departure');
  // A departure in the past is not a countdown.
  assert.deepEqual(themeHeadlines('eagle', COPY, { hoursToDeparture: -3 }).length, 2);
  assert.deepEqual(themeHeadlines('eagle', COPY, { hoursToDeparture: null }).length, 2);
  // Half an hour still rounds to something sayable rather than "T-minus 0.5".
  assert.equal(themeHeadlines('eagle', COPY, { hoursToDeparture: 1.4 })[0], 'T-minus 1 hours to departure');

  // Deep Space names the planet only when there is one.
  assert.deepEqual(themeHeadlines('deepspace', COPY), ['Navigating the cosmos', 'Approaching destination']);
  assert.equal(
    themeHeadlines('deepspace', COPY, { destinationCity: 'Bangkok' }).at(-1),
    'Touchdown on planet Bangkok',
  );
  assert.equal(themeHeadlines('deepspace', COPY, { destinationCity: '   ' }).length, 2);
});

test('every other theme is left exactly as it was', () => {
  for (const id of ['classic', 'day', 'midnight', 'blackout', 'vapor', 'arctic', 'airport', 'kids', 'thai']) {
    assert.deepEqual(themeHeadlines(id, COPY), [], id);
  }
  assert.deepEqual(themeHeadlines(null, COPY), []);
  assert.deepEqual(themeHeadlines(undefined, COPY), []);
});
