import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TRACKED_SKY_BAND,
  PHOTO_OVERLAY_MAX_ALPHA,
  PHOTO_SHADE_MAX_ALPHA,
  capOverlayForPhoto,
  horizonBandHeight,
  horizonParkedX,
  horizonPlaneAction,
  horizonPlaneModeForPhase,
  horizonShowAliveDecor,
  horizonTrackedHeight,
  resolveHorizonPlaneMode,
} from './horizon.ts';

test('destination photo overlay: rgba stops capped at 20%, fade stop untouched, photo darkened at most 20% in total', () => {
  assert.deepEqual(
    capOverlayForPhoto(['rgba(6,12,28,0.84)', 'rgba(6,12,28,0.62)', 'rgba(6,12,28,0.28)', '#F7F3EA']),
    ['rgba(6,12,28,0.2)', 'rgba(6,12,28,0.2)', 'rgba(6,12,28,0.2)', '#F7F3EA'],
  );
  assert.deepEqual(capOverlayForPhoto(['rgba(13,27,46,0.22)', 'rgba(13,27,46,0)', 'rgba(1,2,3,0.9)']), ['rgba(13,27,46,0.2)', 'rgba(13,27,46,0)', 'rgba(1,2,3,0.9)']);
  const combined = 1 - (1 - PHOTO_SHADE_MAX_ALPHA) * (1 - PHOTO_OVERLAY_MAX_ALPHA);
  assert.ok(combined <= 0.2 + 1e-9, `combined darkening ${combined}`);
});

test('tracked horizon height is inset plus the 168 px sky band (room for the destination photo)', () => {
  assert.equal(TRACKED_SKY_BAND, 168);
  assert.equal(horizonTrackedHeight(0), 168);
  assert.equal(horizonTrackedHeight(54), 222);
  assert.equal(horizonBandHeight(54, 'tracked', true), 222);
  assert.equal(horizonBandHeight(54, 'tracked', false), 222);
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
