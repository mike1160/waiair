import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatRemainClock,
  overviewBarPct,
  overviewBarTone,
  remainingMinutesTo,
  shouldShowOverviewProgress,
} from './flightOverviewProgress.ts';

test('overview progress only for airborne phases', () => {
  assert.equal(shouldShowOverviewProgress('enRoute'), true);
  assert.equal(shouldShowOverviewProgress('en-route'), true);
  assert.equal(shouldShowOverviewProgress('departed'), true);
  assert.equal(shouldShowOverviewProgress('in_flight'), true);
  assert.equal(shouldShowOverviewProgress('scheduled'), false);
  assert.equal(shouldShowOverviewProgress('landed'), false);
  assert.equal(shouldShowOverviewProgress('cancelled'), false);
  assert.equal(shouldShowOverviewProgress('boarding'), false);
});

test('pct caps at 99 until landed, 100 when landed', () => {
  assert.equal(overviewBarPct(0.67, false), 67);
  assert.equal(overviewBarPct(1, false), 99);
  assert.equal(overviewBarPct(1.4, false), 99);
  assert.equal(overviewBarPct(0, false), 0);
  assert.equal(overviewBarPct(0.995, false), 99);
  assert.equal(overviewBarPct(1, true), 100);
});

test('tone: on time, delayed, unknown, landed', () => {
  assert.equal(overviewBarTone({ status: 'en-route', delay: 0 }), 'onTime');
  assert.equal(overviewBarTone({ status: 'en-route', delay: 22 }), 'delayed');
  assert.equal(overviewBarTone({ status: 'delayed' }), 'delayed');
  assert.equal(overviewBarTone({ status: 'unknown' }), 'unknown');
  assert.equal(overviewBarTone({ status: 'en-route', landed: true }), 'landed');
});

test('remaining clock localizes Dutch/Thai/English', () => {
  assert.equal(formatRemainClock(72, 'en'), '1h 12m');
  assert.equal(formatRemainClock(72, 'nl'), '1u 12m');
  assert.equal(formatRemainClock(72, 'th'), '1 ชม. 12 น.');
  assert.equal(formatRemainClock(12, 'nl'), '12m');
  assert.equal(formatRemainClock(60, 'en'), '1h');
  const now = Date.parse('2026-09-16T12:00:00Z');
  assert.equal(remainingMinutesTo(now + 72 * 60000, now), 72);
  assert.equal(remainingMinutesTo(now - 1000, now), null);
});
