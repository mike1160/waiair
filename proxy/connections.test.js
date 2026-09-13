const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  ENOUGH_CONNECTIONS,
  MAX_HUB_ATTEMPTS,
  buildConnections,
  candidateHubs,
  collectConnections,
  rankHubs,
  regionForCountry,
  timeZonesFromItems,
} = require('./connections.js');

function row(number, remote, utc, extra = {}) {
  return {
    number,
    status: 'Expected',
    codeshareStatus: 'IsOperator',
    movement: { airport: { iata: remote, timeZone: 'Asia/Dubai' }, scheduledTime: { utc, local: utc } },
    ...extra,
  };
}

test('regions and candidate hubs (both directions, Middle East always appended, endpoints excluded)', () => {
  assert.equal(regionForCountry('de'), 'europe');
  assert.equal(regionForCountry('TR'), 'europe');
  assert.equal(regionForCountry('EG'), 'africa');
  assert.equal(regionForCountry('QA'), 'middleEast');
  assert.equal(regionForCountry(''), 'other');

  const berBkk = candidateHubs('BER', 'BKK', 'DE', 'TH');
  assert.deepEqual(berBkk.slice(0, 8), ['AMS', 'FRA', 'LHR', 'CDG', 'MUC', 'VIE', 'ZRH', 'IST']);
  assert.deepEqual(berBkk.slice(-2), ['AMM', 'BEY']);
  assert.equal(new Set(berBkk).size, berBkk.length);
  assert.deepEqual(candidateHubs('BKK', 'BER', 'TH', 'DE'), berBkk);

  const amsJfk = candidateHubs('AMS', 'JFK', 'NL', 'US');
  assert.deepEqual(amsJfk.slice(0, 5), ['LHR', 'FRA', 'CDG', 'MAD', 'LIS']);
  assert.ok(!amsJfk.includes('AMS'));

  assert.deepEqual(candidateHubs('NBO', 'SYD', 'KE', 'AU'), ['DXB', 'DOH', 'AUH', 'KWI', 'BAH', 'RUH', 'AMM', 'BEY']);
});

test('rankHubs: busiest shared hubs first, hubs a board rules out are dropped, max 5', () => {
  const candidates = ['AMS', 'IST', 'DXB', 'DOH', 'AUH'];
  const originDepartures = [
    row('EK 46', 'DXB', '2026-09-14 13:40Z'), row('EK 48', 'DXB', '2026-09-14 15:40Z'), row('EK 50', 'DXB', '2026-09-14 17:40Z'),
    row('QR 80', 'DOH', '2026-09-14 12:00Z'),
    row('TK 1', 'IST', '2026-09-14 09:00Z'), row('TK 3', 'IST', '2026-09-14 19:00Z'),
    row('KL 1', 'AMS', '2026-09-14 08:00Z', { codeshareStatus: 'IsCodeshared' }),
  ];
  const destArrivals = [
    row('EK 384', 'DXB', '2026-09-15 06:00Z'), row('EK 372', 'DXB', '2026-09-15 08:00Z'),
    row('TK 68', 'IST', '2026-09-15 05:00Z'), row('TK 64', 'IST', '2026-09-15 07:00Z'),
  ];
  assert.deepEqual(rankHubs(candidates, originDepartures, destArrivals), ['IST', 'DXB']);
  assert.deepEqual(rankHubs(candidates, null, null), candidates.slice(0, MAX_HUB_ATTEMPTS));
  assert.deepEqual(rankHubs(candidates, originDepartures, null), ['DXB', 'IST', 'DOH']);
  assert.equal(rankHubs([...candidates, 'KWI', 'BAH'], null, null).length, 5);
});

test('buildConnections pairs operators within 60 min – 8 h, each onward flight once with the tightest feeder', () => {
  const originDepartures = [
    row('EK 46', 'DXB', '2026-09-14 13:40Z'),
    row('EK 50', 'DXB', '2026-09-14 13:10Z'),
    row('EK 52', 'DXB', '2026-09-14 13:20Z'),
    row('FZ 1', 'DXB', '2026-09-14 15:00Z'),
    row('LH 999', 'DXB', '2026-09-14 14:00Z', { status: 'Canceled' }),
    // Tomorrow's EK 60 must not pair with today's EK 60 arrival at the hub.
    row('EK 60', 'DXB', '2026-09-15 13:00Z'),
  ];
  const hubArrivals = [
    row('EK 46', 'BER', '2026-09-14 20:00Z'),
    row('EK 50', 'BER', '2026-09-14 19:30Z'),
    // Also reaches EK 384 (80 min) but EK 46 feeds it tighter (60 min) — EK 384 must appear once.
    row('EK 52', 'BER', '2026-09-14 19:40Z'),
    row('FZ 1', 'BER', '2026-09-14 21:30Z'),
    row('LH 999', 'BER', '2026-09-14 20:10Z'),
    row('EK 60', 'BER', '2026-09-14 20:00Z'),
  ];
  const hubDepartures = [
    row('EK 370', 'BKK', '2026-09-14 20:30Z'),
    row('EK 384', 'BKK', '2026-09-14 21:00Z'),
    row('QF 8384', 'BKK', '2026-09-14 21:00Z', { codeshareStatus: 'IsCodeshared' }),
    row('EK 999', 'BKK', '2026-09-14 22:00Z', { status: 'Cancelled' }),
    row('EK 372', 'BKK', '2026-09-14 23:45Z'),
  ];
  const destArrivals = [
    row('EK 384', 'DXB', '2026-09-15 06:15Z'),
    // Yesterday's EK 372 arrival (before today's departure) is not attached.
    row('EK 372', 'DXB', '2026-09-14 06:00Z'),
  ];

  const out = buildConnections({ from: 'BER', to: 'BKK', hub: 'DXB', originDepartures, hubArrivals, hubDepartures, destArrivals });
  const summary = out
    .map(c => [c.legs[0].number, c.legs[1].number, c.layoverMin])
    .sort((a, b) => (a[2] - b[2]) || String(a[0]).localeCompare(String(b[0])));
  // EK 370 at 20:30 is exactly 60 min after EK 50 lands (valid); only 30 min after EK 46 (too short).
  assert.deepEqual(summary, [['EK 46', 'EK 384', 60], ['EK 50', 'EK 370', 60], ['FZ 1', 'EK 372', 135]]);

  const viaEk384 = out.find(c => c.legs[1].number === 'EK 384');
  assert.equal(viaEk384.hub, 'DXB');
  assert.equal(viaEk384.legs[0].arrival.movement.scheduledTime.utc, '2026-09-14 20:00Z');
  assert.equal(viaEk384.legs[1].arrival.movement.scheduledTime.utc, '2026-09-15 06:15Z');
  assert.equal(out.find(c => c.legs[1].number === 'EK 372').legs[1].arrival, undefined);
  assert.equal(new Set(out.map(c => c.id)).size, out.length);
});

test('collectConnections stops after enough connections, skips failing hubs, never exceeds 5 hubs', async () => {
  const two = hub => [0, 1].map(i => ({ id: `${hub}${i}`, hub, layoverMin: 90, legs: [row('X 1', hub, `2026-09-14 1${i}:00Z`), row('X 2', 'BKK', '2026-09-14 20:00Z')] }));

  const early = await collectConnections(['DXB', 'DOH', 'IST'], async hub => two(hub));
  assert.ok(ENOUGH_CONNECTIONS <= 4);
  assert.deepEqual(early.hubsTried, ['DXB', 'DOH']);
  assert.equal(early.connections.length, 4);

  const failing = await collectConnections(['DXB', 'DOH', 'IST'], async hub => {
    if (hub === 'DXB') throw new Error('upstream');
    return two(hub);
  });
  assert.deepEqual(failing.hubsTried, ['DXB', 'DOH', 'IST']);

  const none = await collectConnections(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'], async () => []);
  assert.equal(none.hubsTried.length, 5);
  assert.deepEqual(none.connections, []);
});

test('timeZonesFromItems reads remote airport zones', () => {
  const zones = timeZonesFromItems([row('EK 46', 'DXB', '2026-09-14 13:40Z'), { movement: { airport: { name: 'Unknown' } } }]);
  assert.equal(zones.get('DXB'), 'Asia/Dubai');
  assert.equal(zones.size, 1);
});
