import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bannerCopy,
  evaluateConnection,
  findSameDayConnections,
  formatGapLabel,
  MCT_DIFFERENT_TERMINAL_MIN,
  MCT_SAME_TERMINAL_MIN,
} from './connectionCheck.ts';

const inn = {
  number: 'KL644',
  origin: 'BKK',
  destination: 'AMS',
  originCountry: 'TH',
  destCountry: 'NL',
  arrTerminal: '3',
  scheduledArrival: '2026-09-16T06:00:00+02:00',
  arrivalTime: '2026-09-16T06:00:00+02:00',
};

const out = {
  number: 'KL1009',
  origin: 'AMS',
  destination: 'LHR',
  originCountry: 'NL',
  destCountry: 'GB',
  depTerminal: '3',
  scheduledDeparture: '2026-09-16T07:45:00+02:00',
  departureTime: '2026-09-16T07:45:00+02:00',
};

test('formatGapLabel uses hours and minutes', () => {
  assert.equal(formatGapLabel(105), '1h 45m');
  assert.equal(formatGapLabel(25), '25m');
});

test('same airport same terminal: 30 min MCT, 1h45m is green', () => {
  const c = evaluateConnection(inn, out);
  assert.equal(c.sameAirport, true);
  assert.equal(c.sameTerminal, true);
  assert.equal(c.mctMin, MCT_SAME_TERMINAL_MIN);
  assert.equal(c.tone, 'green');
  assert.equal(bannerCopy(c).text, 'Connection safe — 1h 45m between flights');
});

test('different terminal needs 60 min — 45 min is orange', () => {
  const c = evaluateConnection(inn, {
    ...out,
    depTerminal: '2',
    scheduledDeparture: '2026-09-16T06:45:00+02:00',
    departureTime: '2026-09-16T06:45:00+02:00',
  });
  assert.equal(c.sameTerminal, false);
  assert.equal(c.mctMin, MCT_DIFFERENT_TERMINAL_MIN);
  assert.equal(c.tone, 'orange');
  assert.match(bannerCopy(c).text, /Connection at risk/);
});

test('negative gap is missed (red)', () => {
  const delayed = { ...inn, status: 'en-route' as const };
  const c = evaluateConnection(
    delayed,
    { ...out, scheduledDeparture: '2026-09-16T05:00:00+02:00', departureTime: '2026-09-16T05:00:00+02:00' },
    Date.parse('2026-09-16T06:10:00+02:00'),
  );
  assert.equal(c.reason, 'missed');
  assert.equal(bannerCopy(c).text, 'Connection missed');
});

test('different airport cannot connect', () => {
  const c = evaluateConnection(inn, { ...out, origin: 'RTM' });
  assert.equal(c.reason, 'cannot_connect');
  assert.equal(c.tone, 'red');
});

test('findSameDayConnections pairs two tracked flights on the same day', () => {
  const list = findSameDayConnections([out, inn]);
  assert.equal(list.length, 1);
  assert.equal(list[0].incoming.number, 'KL644');
  assert.equal(list[0].outgoing.number, 'KL1009');
});
