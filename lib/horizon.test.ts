import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TRACKED_SKY_BAND,
  horizonBandHeight,
  horizonParkedX,
  horizonPlaneAction,
  horizonPlaneModeForPhase,
  horizonShowAliveDecor,
  horizonTrackedHeight,
  resolveHorizonPlaneMode,
} from './horizon.ts';

test('tracked horizon height is inset plus the 120 px sky band', () => {
  assert.equal(TRACKED_SKY_BAND, 120);
  assert.equal(horizonTrackedHeight(0), 120);
  assert.equal(horizonTrackedHeight(54), 174);
  assert.equal(horizonBandHeight(54, 'tracked', true), 174);
  assert.equal(horizonBandHeight(54, 'tracked', false), 174);
  assert.equal(horizonBandHeight(54, 'search', false), 210);
  assert.equal(horizonBandHeight(54, 'search', true), 82);
});

test('plane flies once on tracked in_flight mount, then stays still', () => {
  assert.equal(horizonPlaneModeForPhase('in_flight'), 'once');
  assert.equal(horizonPlaneModeForPhase('checkin'), 'parked');
  assert.equal(horizonPlaneModeForPhase('leave'), 'parked');
  assert.equal(horizonPlaneModeForPhase('boarding'), 'parked');
  assert.equal(horizonPlaneModeForPhase('baggage'), 'off');
  assert.equal(
    resolveHorizonPlaneMode({ band: 'tracked', collapsed: false, plane: 'parked' }),
    'parked',
  );
  assert.equal(horizonParkedX(390), 62);
  assert.equal(
    horizonPlaneAction({
      mode: 'parked',
      reduced: false,
      foreground: true,
      onceArmed: false,
      onceConsumed: false,
    }),
    'park',
  );

  const ready = {
    mode: 'once' as const,
    reduced: false,
    foreground: true,
    onceArmed: true,
    onceConsumed: false,
  };
  assert.equal(horizonPlaneAction(ready), 'once');
  assert.equal(horizonPlaneAction({ ...ready, onceConsumed: true }), 'hold');
  assert.equal(horizonPlaneAction({ ...ready, onceArmed: false }), 'hide');
  assert.equal(horizonPlaneAction({ ...ready, reduced: true }), 'hide');
  assert.equal(horizonPlaneAction({ ...ready, foreground: false }), 'hide');
  assert.equal(
    horizonPlaneAction({ ...ready, onceConsumed: true, foreground: false }),
    'hold',
  );
  assert.equal(
    horizonPlaneAction({ ...ready, onceConsumed: true, reduced: true }),
    'hide',
  );
});

test('empty-home cruise plane follows reduce-motion and background', () => {
  const cruise = {
    mode: 'cruise' as const,
    reduced: false,
    foreground: true,
    onceArmed: false,
    onceConsumed: false,
  };
  assert.equal(horizonPlaneAction(cruise), 'cruise');
  assert.equal(horizonPlaneAction({ ...cruise, reduced: true }), 'hide');
  assert.equal(horizonPlaneAction({ ...cruise, foreground: false }), 'hide');
  assert.equal(
    resolveHorizonPlaneMode({ band: 'search', collapsed: false }),
    'cruise',
  );
  assert.equal(
    resolveHorizonPlaneMode({ band: 'search', collapsed: true }),
    'off',
  );
  assert.equal(
    resolveHorizonPlaneMode({ band: 'search', collapsed: false, plane: 'off' }),
    'cruise',
    'empty home ignores tracked plane=off',
  );
  assert.equal(
    resolveHorizonPlaneMode({ band: 'search', collapsed: false, plane: 'once' }),
    'cruise',
    'empty home ignores tracked plane=once',
  );
  assert.equal(horizonBandHeight(54, 'search', false), 54 + 156);
  assert.notEqual(horizonBandHeight(54, 'search', false), horizonTrackedHeight(54));
});

test('tracked horizon has no empty-home sky decor — only the plane', () => {
  assert.equal(horizonShowAliveDecor('search'), true);
  assert.equal(horizonShowAliveDecor('tracked'), false);
});
