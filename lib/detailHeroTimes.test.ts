import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PALETTE_TOKENS } from './themeTokens.ts';
import {
  detailArrHeroKind,
  detailDepHeroKind,
  detailGold,
  detailHeroColor,
  detailOnTimeGreen,
  phaseRailUsesGold,
  departureStationStatus,
  showStationOnTime,
} from './detailHeroTimes.ts';

test('detail hero colour is ink, never green; red only cancelled/diverted', () => {
  const ink = PALETTE_TOKENS.light.text;
  assert.equal(detailHeroColor('scheduled', 'light', ink), ink);
  assert.equal(detailHeroColor('delayed', 'light', ink), ink);
  assert.equal(detailHeroColor('boarding', 'light', ink), ink);
  assert.notEqual(detailHeroColor('scheduled', 'light', ink), PALETTE_TOKENS.light.statusGreen);
  assert.equal(detailHeroColor('cancelled', 'light', ink), PALETTE_TOKENS.light.statusRed);
  assert.equal(detailHeroColor('diverted', 'dark', ink), PALETTE_TOKENS.dark.statusRed);
  assert.equal(detailOnTimeGreen('light'), PALETTE_TOKENS.light.statusGreen);
  assert.equal(detailGold('light'), PALETTE_TOKENS.light.gold);
});

test('dep hero: countdown until off-blocks, then Departed', () => {
  assert.equal(detailDepHeroKind({ status: 'scheduled', livePhase: 'scheduled', hasLanded: false }), 'countdown');
  assert.equal(detailDepHeroKind({ status: 'delayed', livePhase: 'delayed', hasLanded: false }), 'countdown');
  assert.equal(detailDepHeroKind({ status: 'boarding', livePhase: 'boarding', hasLanded: false }), 'countdown');
  assert.equal(detailDepHeroKind({ status: 'scheduled', livePhase: 'gateClosed', hasLanded: false }), 'countdown');
  assert.equal(detailDepHeroKind({ status: 'en-route', livePhase: 'departed', hasLanded: false }), 'departed');
  assert.equal(detailDepHeroKind({ status: 'en-route', livePhase: 'enRoute', hasLanded: false }), 'departed');
  assert.equal(detailDepHeroKind({ status: 'landed', livePhase: 'landed', hasLanded: true }), 'departed');
  assert.equal(detailDepHeroKind({ status: 'cancelled', livePhase: 'cancelled', hasLanded: false }), 'cancelled');
});

test('arr hero: countdown until landed', () => {
  assert.equal(detailArrHeroKind({ status: 'en-route', livePhase: 'enRoute', hasLanded: false }), 'countdown');
  assert.equal(detailArrHeroKind({ status: 'landed', livePhase: 'landed', hasLanded: true }), 'landed');
  assert.equal(detailArrHeroKind({ status: 'diverted', livePhase: 'scheduled', hasLanded: false }), 'cancelled');
});

test('on time label is small and skipped when delayed', () => {
  assert.equal(showStationOnTime({ delayed: false, cancelled: false }), true);
  assert.equal(showStationOnTime({ delayed: true, cancelled: false }), false);
  assert.equal(showStationOnTime({ delayed: false, cancelled: true }), false);
  assert.equal(showStationOnTime({ delayed: false, cancelled: false, offsetMin: 12 }), false);
  assert.equal(showStationOnTime({ delayed: false, cancelled: false, offsetMin: -4 }), true);
});

test('phase rail gold only during boarding / last call', () => {
  assert.equal(phaseRailUsesGold('open'), true);
  assert.equal(phaseRailUsesGold('closing'), true);
  assert.equal(phaseRailUsesGold('lastCall'), true);
  assert.equal(phaseRailUsesGold('none'), false);
  assert.equal(phaseRailUsesGold('none'), false);
  assert.equal(phaseRailUsesGold(undefined), false);
});

test('[B18] a departure that left late still says so after landing', () => {
  // The bug: `delayed` is false once a flight is airborne, and nothing else was consulted, so a departure
  // forty minutes behind schedule wore a green "On time" all the way to the gate.
  assert.equal(
    departureStationStatus({ delayed: false, cancelled: false, offsetMin: 40, counting: false }),
    'delayed',
  );
});

test('[B18] a departure that actually was on time still says on time after landing', () => {
  assert.equal(
    departureStationStatus({ delayed: false, cancelled: false, offsetMin: 0, counting: false }),
    'onTime',
  );
  // Left early: good news, and still good news on the ground.
  assert.equal(
    departureStationStatus({ delayed: false, cancelled: false, offsetMin: -5, counting: false }),
    'onTime',
  );
});

test('[B18] before departure nothing changes: the live flag still speaks', () => {
  assert.equal(
    departureStationStatus({ delayed: true, cancelled: false, offsetMin: null, counting: true }),
    'delayed',
  );
  assert.equal(
    departureStationStatus({ delayed: false, cancelled: false, offsetMin: null, counting: true }),
    'onTime',
  );
});

test('[B18] a running-late flag with no clock behind it says nothing once the flight has gone', () => {
  // Departed, flagged late, but no two times to compare: a green "On time" would be a lie and a gold
  // "Delayed" would be a guess, so the station says nothing.
  assert.equal(
    departureStationStatus({ delayed: true, cancelled: false, offsetMin: null, counting: false }),
    null,
  );
});

test('[B18] a cancelled flight has no departure status at all', () => {
  assert.equal(
    departureStationStatus({ delayed: true, cancelled: true, offsetMin: 40, counting: true }),
    null,
  );
  assert.equal(
    departureStationStatus({ delayed: false, cancelled: true, offsetMin: null, counting: false }),
    null,
  );
});
