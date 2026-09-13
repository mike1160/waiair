import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dedupeRouteFlights, uniqueFlightIds } from './flightDedupe.ts';

test('board ids are unique for FlashList (BER: same number as ghost "Unknown" row)', () => {
  const real = { id: 'EW 8765', number: 'EW 8765', scheduledTime: '2026-09-13T16:15:00+02:00' };
  const ghost = { id: 'EW 8765', number: 'EW 8765', scheduledTime: '2026-09-13T21:40:00+02:00' };
  const other = { id: 'FR 61', number: 'FR 61' };
  const out = uniqueFlightIds([real, other, ghost]);
  assert.equal(out.length, 3);
  assert.equal(new Set(out.map(f => f.id)).size, 3);
  assert.equal(out[0], real);
  assert.equal(out[2].id, 'EW 8765#2');
  const clean = [real, other];
  assert.equal(uniqueFlightIds(clean), clean);
});

test('same number + date + scheduled departure collapses to one row', () => {
  const a = {
    number: 'OZ 744',
    origin: 'HKT',
    destination: 'ICN',
    scheduledDeparture: '2026-09-09T11:45:00+07:00',
    codeshareStatus: 'IsOperator',
  };
  const b = {
    number: 'OZ744',
    origin: 'HKT',
    destination: 'ICN',
    scheduledDeparture: '2026-09-09T11:45:00+07:00',
    codeshareStatus: 'IsCodeshared',
  };
  const out = dedupeRouteFlights([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0].number, 'OZ 744');
  assert.ok(isOperating(out[0]));
});

function isOperating(f: { codeshareStatus?: string }) {
  return String(f.codeshareStatus || '').toLowerCase() === 'isoperator';
}

test('codeshare at the same slot keeps the operator and lists the marketing number', () => {
  const op = {
    number: 'OZ744',
    origin: 'HKT',
    destination: 'ICN',
    scheduledDeparture: '2026-09-09T11:45:00+07:00',
    codeshareStatus: 'IsOperator',
  };
  const cs = {
    number: 'KE1234',
    origin: 'HKT',
    destination: 'ICN',
    scheduledDeparture: '2026-09-09T11:45:00+07:00',
    codeshareStatus: 'IsCodeshared',
    operatingNumber: 'OZ744',
  };
  const out = dedupeRouteFlights([cs, op]);
  assert.equal(out.length, 1);
  assert.equal(out[0].number, 'OZ744');
  assert.equal(out[0].alsoCodeshare, 'KE1234');
});

test('two real flights at the same time stay separate', () => {
  const a = {
    number: 'FD3036',
    origin: 'HKT',
    destination: 'DMK',
    scheduledDeparture: '2026-09-09T07:40:00+07:00',
    codeshareStatus: 'IsOperator',
  };
  const b = {
    number: 'DD539',
    origin: 'HKT',
    destination: 'DMK',
    scheduledDeparture: '2026-09-09T07:40:00+07:00',
    codeshareStatus: 'IsOperator',
  };
  const out = dedupeRouteFlights([a, b]);
  assert.equal(out.length, 2);
});
