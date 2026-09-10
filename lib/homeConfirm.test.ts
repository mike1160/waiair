import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HOME_CONFIRM_DIM,
  HOME_CONFIRM_LEGACY_OVERLAY_MS,
  HOME_CONFIRM_MS,
  HOME_CONFIRM_REDUCED_GREET_MS,
  HOME_CONFIRM_TAKEOFF_DEG,
  homeConfirmBeforeMount,
  homeConfirmBlocksConsent,
  homeConfirmDim,
  homeConfirmDurationMs,
  homeConfirmLocksPlane,
  homeConfirmOnBackground,
  homeConfirmPlan,
  homeConfirmShowChip,
  homeConfirmShowGreet,
  homeConfirmSkipLegacyOverlay,
  homeConfirmSlideCards,
  homeConfirmUseTrackedBand,
} from './homeConfirm.ts';

test('motion sequence is idle → takeoff → dim → greet → mounted → chip → still under 1.6 s', () => {
  const plan = homeConfirmPlan({ reduced: false, foreground: true });
  assert.equal(plan.start, 'takeoff');
  assert.deepEqual(plan.steps.map(s => s.state), ['dim', 'greet', 'mounted', 'chip', 'still']);
  const total = homeConfirmDurationMs(plan);
  assert.ok(total < 1600, `sequence ${total}ms`);
  assert.ok(total < HOME_CONFIRM_LEGACY_OVERLAY_MS);
  assert.equal(
    HOME_CONFIRM_MS.takeoff + HOME_CONFIRM_MS.dim + HOME_CONFIRM_MS.greet
      + HOME_CONFIRM_MS.mounted + HOME_CONFIRM_MS.chip,
    total,
  );
  assert.equal(HOME_CONFIRM_TAKEOFF_DEG, 15);
  assert.equal(HOME_CONFIRM_DIM, 0.3);
});

test('reduce-motion is an instant tracked mount with a static 1 s greet', () => {
  const plan = homeConfirmPlan({ reduced: true, foreground: true });
  assert.equal(plan.start, 'mounted');
  assert.deepEqual(plan.steps, [{ state: 'still', delayMs: HOME_CONFIRM_REDUCED_GREET_MS }]);
  assert.equal(homeConfirmDurationMs(plan), 1000);
  assert.equal(homeConfirmShowGreet('mounted'), true);
  assert.equal(homeConfirmShowChip('mounted', true), true);
  assert.equal(homeConfirmSlideCards('mounted', true), false);
  assert.equal(homeConfirmBeforeMount('mounted'), false);
});

test('background during the sequence finishes instantly', () => {
  assert.equal(homeConfirmPlan({ reduced: false, foreground: false }).start, 'still');
  assert.deepEqual(homeConfirmPlan({ reduced: false, foreground: false }).steps, []);
  assert.equal(homeConfirmOnBackground('takeoff'), 'still');
  assert.equal(homeConfirmOnBackground('greet'), 'still');
  assert.equal(homeConfirmOnBackground('mounted'), 'still');
  assert.equal(homeConfirmOnBackground('idle'), 'idle');
  assert.equal(homeConfirmOnBackground('still'), 'still');
});

test('visibility flags: greet on the horizon, tracked after greet, no legacy overlay', () => {
  assert.equal(homeConfirmBeforeMount('takeoff'), true);
  assert.equal(homeConfirmBeforeMount('greet'), true);
  assert.equal(homeConfirmBeforeMount('mounted'), false);
  assert.equal(homeConfirmUseTrackedBand('greet'), false);
  assert.equal(homeConfirmUseTrackedBand('mounted'), true);
  assert.equal(homeConfirmLocksPlane('takeoff'), true);
  assert.equal(homeConfirmLocksPlane('still'), false);
  assert.equal(homeConfirmShowGreet('dim'), false);
  assert.equal(homeConfirmShowGreet('greet'), true);
  assert.equal(homeConfirmDim('takeoff'), false);
  assert.equal(homeConfirmDim('dim'), true);
  assert.equal(homeConfirmShowChip('mounted', false), false);
  assert.equal(homeConfirmShowChip('chip'), true);
  assert.equal(homeConfirmSlideCards('mounted', false), true);
  assert.equal(homeConfirmBlocksConsent('takeoff'), true);
  assert.equal(homeConfirmBlocksConsent('still'), false);
  assert.equal(homeConfirmSkipLegacyOverlay(), true);
});
