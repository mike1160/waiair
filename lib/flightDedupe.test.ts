import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dedupeRouteFlights } from './flightDedupe.ts';

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
