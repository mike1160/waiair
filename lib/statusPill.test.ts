import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PALETTE_TOKENS } from './themeTokens.ts';
import {
  STATUS_PILL_TONES,
  resolveStatusPillTone,
  statusPillToneFromPhase,
} from './statusPill.ts';

const P = PALETTE_TOKENS.light;

const PHASE_TO_TONE: Array<[string, ReturnType<typeof statusPillToneFromPhase>]> = [
  ['boarding', 'active'],
  ['last-call', 'active'],
  ['last_call', 'active'],
  ['lastcall', 'active'],
  ['departed', 'active'],
  ['in_flight', 'active'],
  ['in-flight', 'active'],
  ['en-route', 'active'],
  ['enRoute', 'active'],
  ['gate-closed', 'active'],
  ['gateClosed', 'active'],
  ['scheduled', 'scheduled'],
  ['checkin', 'scheduled'],
  ['leave', 'scheduled'],
  ['at_airport', 'scheduled'],
  ['gate', 'scheduled'],
  ['landed', 'landed'],
  ['arrived', 'landed'],
  ['baggage', 'landed'],
  ['transport', 'landed'],
  ['done', 'landed'],
  ['delayed', 'delayed'],
  ['cancelled', 'cancelled'],
  ['canceled', 'cancelled'],
  ['diverted', 'cancelled'],
];

test('phase → pill table: active gold, scheduled muted, landed navy-on-cream, delayed gold, cancelled red', () => {
  for (const [phase, tone] of PHASE_TO_TONE) {
    assert.equal(statusPillToneFromPhase(phase), tone, phase);
  }
});

test('cancellation overrules every phase; delayed does not override airborne', () => {
  assert.equal(statusPillToneFromPhase('boarding', { cancelled: true }), 'cancelled');
  assert.equal(statusPillToneFromPhase('in_flight', { delayed: true }), 'active');
  assert.equal(statusPillToneFromPhase('scheduled', { delayed: true }), 'delayed');
  assert.equal(statusPillToneFromPhase('scheduled', { boarding: true }), 'active');
});

test('pill colours: no blue En route; delayed shares gold with active', () => {
  assert.equal(STATUS_PILL_TONES.active.fg, P.gold);
  assert.equal(STATUS_PILL_TONES.active.bg, '#2A2000');
  assert.equal(STATUS_PILL_TONES.delayed.fg, P.gold);
  assert.equal(STATUS_PILL_TONES.delayed.bg, STATUS_PILL_TONES.active.bg);
  assert.equal(STATUS_PILL_TONES.scheduled.fg, P.textMuted);
  assert.equal(STATUS_PILL_TONES.scheduled.bg, P.bg);
  assert.equal(STATUS_PILL_TONES.landed.fg, P.navy);
  assert.equal(STATUS_PILL_TONES.landed.bg, P.bg);
  assert.equal(STATUS_PILL_TONES.cancelled.fg, P.statusRed);
  assert.ok(!('enRoute' in STATUS_PILL_TONES));
  assert.notEqual(STATUS_PILL_TONES.active.fg, P.statusBlue);
  assert.notEqual(STATUS_PILL_TONES.active.bg, '#1A4A8A');
  assert.equal(resolveStatusPillTone('enRoute'), 'active');
  assert.equal(resolveStatusPillTone('onTime'), 'scheduled');
});
