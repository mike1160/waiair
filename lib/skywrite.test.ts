import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  SKYWRITE_BASELINE_FRAC,
  SKYWRITE_CLIMB,
  SKYWRITE_LETTER_BAND,
  SKYWRITE_PLANE_TOP,
  SKYWRITE_TRAIL_STROKE,
  SKYWRITE_TRAIL_W,
  SKYWRITE_WIDTH_SPAN,
  WAIAIR_PATH,
  WAIAIR_VIEWBOX,
  claimSkywrite,
  localYmd,
  peekSkywriteYmd,
  resetSkywriteMemory,
  skywriteDue,
  skywriteFrame,
  skywriteLetterHeight,
  skywriteRevealT,
  skywriteShouldRun,
  skywriteStrokeWidth,
  skywriteSvgSnapshot,
} from './skywrite.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVG_OUT = join(ROOT, 'lib/skywrite.waiAir.svg');

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

test('W starts on the baseline and goes up (screen Y-down — not an M)', () => {
  const m = WAIAIR_PATH.match(/^M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/i);
  assert.ok(m, 'W starts with M x y L x y');
  const y0 = Number(m[2]);
  const y1 = Number(m[4]);
  assert.ok(y0 > WAIAIR_VIEWBOX.h * 0.7, 'W starts near the baseline (high y)');
  assert.ok(y1 < WAIAIR_VIEWBOX.h * 0.25, 'first stroke goes up toward the cap (low y)');
  assert.ok(y0 > y1, 'Y-down: baseline y > cap y');
});

test('letters are 8% of the band, on the plane climb line, stroke matches the contrail', () => {
  assert.equal(SKYWRITE_LETTER_BAND, 0.08);
  assert.equal(SKYWRITE_WIDTH_SPAN, 0.7);
  assert.equal(skywriteLetterHeight(200), 16);
  const frame = skywriteFrame(400, 210, 54);
  assert.ok(Math.abs(frame.x - 60) < 1e-6);
  assert.ok(Math.abs(frame.width - 280) < 1e-6);
  assert.equal(frame.height, 16.8);
  const decoTop = 54 + 8;
  const planeTop = decoTop + SKYWRITE_PLANE_TOP;
  const baseline = frame.y + frame.height * SKYWRITE_BASELINE_FRAC;
  const expected = planeTop - frame.x * SKYWRITE_CLIMB;
  assert.ok(Math.abs(baseline - expected) < 1e-6);
  assert.ok(Math.abs(skywriteStrokeWidth(frame.height) - SKYWRITE_TRAIL_STROKE * (20 / 16.8)) < 1e-6);
  assert.ok(localYmd(Date.parse('2026-09-09T20:00:00+07:00')).length === 10);
});

test('reveal follows the tail, never ahead of the nose', () => {
  const left = 60;
  const right = 340;
  assert.equal(skywriteRevealT(left - SKYWRITE_TRAIL_W - 10, left, right), 0);
  const midPlane = left + (right - left) / 2 - SKYWRITE_TRAIL_W;
  const t = skywriteRevealT(midPlane, left, right);
  assert.ok(t > 0.49 && t < 0.51);
  assert.equal(skywriteRevealT(right - SKYWRITE_TRAIL_W, left, right), 1);
  const noseLead = SKYWRITE_TRAIL_W + 22;
  const tAtNoseOverWord = skywriteRevealT(left - noseLead + 10, left, right);
  assert.equal(tAtNoseOverWord, 0, 'letters do not appear while only the nose has reached the word');
});

test('SVG snapshot of WaiAir is screen-Y and writes the fixture file', () => {
  const svg = skywriteSvgSnapshot();
  assert.match(svg, /viewBox="0 0 76 32"/);
  assert.match(svg, /fill="none"/);
  assert.ok(svg.includes(WAIAIR_PATH));
  assert.ok(!svg.includes('scale(1,-1)'), 'must not Y-flip the glyph path');
  mkdirSync(dirname(SVG_OUT), { recursive: true });
  writeFileSync(SVG_OUT, svg);
});
