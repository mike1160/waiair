import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usableAirportCode } from './airportCode.ts';
import {
  parseAircraftFlightItem,
  pickInboundAircraftFlight,
  type InboundAircraftFlight,
} from './inboundAircraft.ts';
import { formatAirportClock } from './flightTimes.ts';

function leg(partial: Partial<InboundAircraftFlight> & Pick<InboundAircraftFlight, 'number' | 'destination' | 'arrivalIso'>): InboundAircraftFlight {
  return {
    originCity: partial.originCity || '',
    originIata: partial.originIata || '',
    scheduledArrival: partial.scheduledArrival || partial.arrivalIso,
    revisedArrival: partial.revisedArrival || partial.arrivalIso,
    delayed: partial.delayed ?? false,
    landed: partial.landed ?? true,
    ...partial,
  };
}

const OZ747 = {
  originIata: 'HKT',
  originCountry: 'TH',
  ourNumber: 'OZ747',
  depIso: '2026-09-06T15:56:00+07:00',
};

test('usableAirportCode maps ICAO to IATA (VTSP → HKT Phuket, not Hong Kong)', () => {
  assert.equal(usableAirportCode('VTSP'), 'HKT');
  assert.equal(usableAirportCode('RKSI'), 'ICN');
  assert.equal(usableAirportCode('HKT'), 'HKT');
  assert.equal(usableAirportCode('UNKN'), '');
});

test('inboundAircraft: OZ712 TPE→ICN is rejected for HKT→ICN departure', () => {
  const oz712 = leg({
    number: 'OZ 712',
    originCity: 'Taipei',
    originIata: 'TPE',
    destination: 'ICN',
    scheduledArrival: '2026-09-06T15:55:00+09:00',
    revisedArrival: '2026-09-06T15:52:00+09:00',
    arrivalIso: '2026-09-06T15:52:00+09:00',
  });
  const picked = pickInboundAircraftFlight([oz712], OZ747);
  assert.equal(picked, null);
});

test('inboundAircraft: OZ746 ICN→HKT is accepted before OZ747', () => {
  const oz746 = leg({
    number: 'OZ746',
    originCity: 'Seoul',
    originIata: 'ICN',
    destination: 'HKT',
    scheduledArrival: '2026-09-06T14:25:00+07:00',
    revisedArrival: '2026-09-06T14:20:00+07:00',
    arrivalIso: '2026-09-06T14:20:00+07:00',
  });
  const oz712 = leg({
    number: 'OZ712',
    originCity: 'Taipei',
    originIata: 'TPE',
    destination: 'ICN',
    arrivalIso: '2026-09-06T15:52:00+09:00',
  });
  const picked = pickInboundAircraftFlight([oz712, oz746], OZ747);
  assert.equal(picked?.number, 'OZ746');
});

test('inboundAircraft: turnaround under 30 min is rejected', () => {
  const tight = leg({
    number: 'OZ746',
    originIata: 'ICN',
    destination: 'HKT',
    arrivalIso: '2026-09-06T15:52:00+07:00',
  });
  assert.equal(pickInboundAircraftFlight([tight], OZ747), null);
});

test('inboundAircraft: ICAO dest VTSP matches origin HKT', () => {
  const oz746 = leg({
    number: 'OZ746',
    originIata: 'ICN',
    destination: 'VTSP',
    arrivalIso: '2026-09-06T14:20:00+07:00',
  });
  const picked = pickInboundAircraftFlight([oz746], { ...OZ747, originIata: 'HKT' });
  assert.equal(picked?.number, 'OZ746');
});

test('inboundAircraft: inbound times are compared in origin timezone (Phuket UTC+7)', () => {
  const seoulWall = leg({
    number: 'OZ712',
    originIata: 'TPE',
    destination: 'ICN',
    scheduledArrival: '2026-09-06T15:55:00+09:00',
    revisedArrival: '2026-09-06T15:52:00+09:00',
    arrivalIso: '2026-09-06T15:52:00+09:00',
  });
  assert.equal(pickInboundAircraftFlight([seoulWall], OZ747), null);

  const hktInbound = leg({
    number: 'OZ746',
    originIata: 'ICN',
    destination: 'HKT',
    scheduledArrival: '2026-09-06T14:25:00+07:00',
    revisedArrival: '2026-09-06T14:20:00+07:00',
    arrivalIso: '2026-09-06T14:20:00+07:00',
  });
  const picked = pickInboundAircraftFlight([hktInbound], OZ747);
  assert.ok(picked);
  assert.equal(formatAirportClock(picked.scheduledArrival, 'HKT', false, 'TH'), '14:25');
  assert.equal(formatAirportClock(picked.revisedArrival, 'HKT', false, 'TH'), '14:20');
  assert.notEqual(formatAirportClock(picked.revisedArrival, 'HKT', false, 'TH'), '15:52');
});

test('parseAircraftFlightItem reads AeroDataBox departure/arrival sides', () => {
  const parsed = parseAircraftFlightItem({
    number: 'OZ746',
    status: 'Arrived',
    departure: { airport: { iata: 'ICN', municipalityName: 'Seoul' } },
    arrival: {
      airport: { icao: 'VTSP', iata: 'HKT' },
      scheduledTime: { utc: '2026-09-06T07:25:00Z', local: '2026-09-06 14:25+07:00' },
      runwayTime: { utc: '2026-09-06T07:20:00Z', local: '2026-09-06 14:20+07:00' },
    },
  });
  assert.equal(parsed?.number, 'OZ746');
  assert.equal(parsed?.destination, 'HKT');
  assert.equal(parsed?.landed, true);
});
