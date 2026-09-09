import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SKYWRITE_LETTER_BAND,
  SKYWRITE_WIDTH_SPAN,
  claimSkywrite,
  localYmd,
  peekSkywriteYmd,
  resetSkywriteMemory,
  skywriteDue,
  skywriteFrame,
  skywriteLetterHeight,
  skywriteShouldRun,
} from './skywrite.ts';

test('skywrite key fires once per local day and again after reset', () => {
  resetSkywriteMemory();
  const today = '2026-09-09';
  assert.equal(skywriteDue(null, today), true);
  assert.equal(skywriteDue(today, today), false);
  assert.equal(skywriteDue('2026-09-08', today), true);
  assert.equal(claimSkywrite(today), true);
  assert.equal(peekSkywriteYmd(), today);
  assert.equal(claimSkywrite(today), false);
  assert.equal(skywriteDue(peekSkywriteYmd(), today), false);
  resetSkywriteMemory();
  assert.equal(skywriteDue(peekSkywriteYmd(), today), true);
  assert.equal(claimSkywrite(today), true);
  assert.equal(claimSkywrite('2026-09-10'), true);
});

test('skywrite is off for reduce-motion, background, collapsed, and in-progress crossings', () => {
  const ok = {
    due: true,
    reduced: false,
    foreground: true,
    expanded: true,
    crossingStartsNow: true,
    afterMount: true,
    width: 390,
  };
  assert.equal(skywriteShouldRun(ok), true);
  assert.equal(skywriteShouldRun({ ...ok, reduced: true }), false);
  assert.equal(skywriteShouldRun({ ...ok, foreground: false }), false);
  assert.equal(skywriteShouldRun({ ...ok, expanded: false }), false);
  assert.equal(skywriteShouldRun({ ...ok, crossingStartsNow: false }), false);
  assert.equal(skywriteShouldRun({ ...ok, afterMount: false }), false);
  assert.equal(skywriteShouldRun({ ...ok, due: false }), false);
  assert.equal(skywriteShouldRun({ ...ok, width: 40 }), false);
});

test('skywrite letters are ~7.5% of the band, middle 70% of width, below the status inset', () => {
  assert.equal(SKYWRITE_LETTER_BAND, 0.075);
  assert.equal(SKYWRITE_WIDTH_SPAN, 0.7);
  assert.equal(skywriteLetterHeight(200), 15);
  const frame = skywriteFrame(400, 210, 54);
  assert.ok(Math.abs(frame.x - 60) < 1e-6);
  assert.ok(Math.abs(frame.width - 280) < 1e-6);
  assert.equal(frame.height, 15.75);
  assert.ok(frame.y >= 54 + 36);
  assert.ok(frame.y + frame.height <= 210);
  assert.ok(localYmd(Date.parse('2026-09-09T20:00:00+07:00')).length === 10);
});
