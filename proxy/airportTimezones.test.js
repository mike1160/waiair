const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isIanaZone,
  timeZoneAt,
  longitudeZone,
  formatAirportLocal,
  shiftDateKey,
  createAirportTimezones,
} = require('./airportTimezones');

const quiet = { log() {}, warn() {}, error() {} };

/** Airport coordinates as in the OurAirports database, including airports in multi-zone countries. */
const AIRPORTS = {
  TPE: { lat: 25.0777, lon: 121.2328, tz: 'Asia/Taipei' },
  BKK: { lat: 13.6811, lon: 100.7473, tz: 'Asia/Bangkok' },
  HKT: { lat: 8.1132, lon: 98.3169, tz: 'Asia/Bangkok' },
  HND: { lat: 35.5523, lon: 139.7800, tz: 'Asia/Tokyo' },
  DPS: { lat: -8.7482, lon: 115.1670, tz: 'Asia/Makassar' },
  PER: { lat: -31.9403, lon: 115.9669, tz: 'Australia/Perth' },
  JFK: { lat: 40.6398, lon: -73.7789, tz: 'America/New_York' },
  PHX: { lat: 33.4343, lon: -112.0116, tz: 'America/Phoenix' },
  CUN: { lat: 21.0365, lon: -86.8771, tz: 'America/Cancun' },
  KEF: { lat: 63.9850, lon: -22.6056, tz: 'Atlantic/Reykjavik' },
};
const airportsMap = () => new Map(Object.entries(AIRPORTS).map(([code, a]) => [code, { iata: code, lat: a.lat, lon: a.lon }]));

/** 23:30 in Bangkok, 00:30 the next day in Taipei — the moment TPE's live board came back empty. */
const LATE_EVENING = Date.parse('2026-09-14T16:30:00Z');

test('timeZoneAt: IANA zone from airport coordinates, also in multi-zone countries; bad input or lookup → null', () => {
  for (const [code, a] of Object.entries(AIRPORTS)) assert.equal(timeZoneAt(a.lat, a.lon), a.tz, code);
  assert.equal(timeZoneAt(Number.NaN, 100), null);
  assert.equal(timeZoneAt(13.7, 100.7, () => { throw new Error('boom'); }), null);
  assert.equal(timeZoneAt(13.7, 100.7, () => 'Not/AZone'), null);
  assert.equal(isIanaZone('Asia/Taipei'), true);
  assert.equal(isIanaZone('Mars/Olympus'), false);
  assert.equal(longitudeZone(121.2), 'Etc/GMT-8');
  assert.equal(longitudeZone(-73.8), 'Etc/GMT+5');
  assert.equal(longitudeZone(3), 'Etc/GMT');
});

test('live window for TPE (not in the old 31-airport table) is Taipei time, not the server UTC clock', () => {
  const tz = createAirportTimezones({ airportsByIata: airportsMap(), log: quiet });
  // 00:30 Taipei: today's live board runs from local midnight to 06:30 — the old UTC fallback asked for 10:30–22:30.
  assert.deepEqual(tz.localWindow('TPE', 0, LATE_EVENING), {
    from: '2026-09-15%2000:00', to: '2026-09-15%2006:30', tz: 'Asia/Taipei', date: '2026-09-15',
  });
  assert.deepEqual(tz.localWindow('tpe', 0, Date.parse('2026-09-14T08:00:00Z')), {
    from: '2026-09-14%2010:00', to: '2026-09-14%2022:00', tz: 'Asia/Taipei', date: '2026-09-14',
  });
  assert.deepEqual(tz.localWindow('BKK', 0, LATE_EVENING), {
    from: '2026-09-14%2017:30', to: '2026-09-15%2005:30', tz: 'Asia/Bangkok', date: '2026-09-14',
  });
  assert.deepEqual(tz.localWindow('PHX', 0, LATE_EVENING), {
    from: '2026-09-14%2003:30', to: '2026-09-14%2015:30', tz: 'America/Phoenix', date: '2026-09-14',
  });
});

test('other days: the whole airport-local day, shifted from the airport\'s own today', () => {
  const tz = createAirportTimezones({ airportsByIata: airportsMap(), log: quiet });
  assert.deepEqual(tz.localWindow('TPE', 1, LATE_EVENING), {
    from: '2026-09-16%2000:00', to: '2026-09-16%2023:59', tz: 'Asia/Taipei', date: '2026-09-16',
  });
  assert.equal(tz.localWindow('TPE', -1, LATE_EVENING).date, '2026-09-14');
  assert.equal(tz.localWindow('JFK', -1, LATE_EVENING).date, '2026-09-13');
  assert.equal(shiftDateKey('2026-12-31', 1), '2027-01-01');
  assert.equal(formatAirportLocal(new Date(LATE_EVENING), 'Asia/Taipei'), '2026-09-15 00:30');
});

test('today: database zone first, then the hint for airports not in the database, then UTC (warned once)', () => {
  const warnings = [];
  const tz = createAirportTimezones({ airportsByIata: airportsMap(), log: { ...quiet, warn: (...a) => warnings.push(a.join(' ')) } });
  assert.equal(tz.today('TPE', 'UTC', LATE_EVENING), '2026-09-15');
  assert.equal(tz.today('XXX', 'Asia/Tokyo', LATE_EVENING), '2026-09-15');
  assert.equal(tz.today('XXX', 'not a zone', LATE_EVENING), '2026-09-14');
  assert.equal(tz.timeZoneFor('XXX'), null);

  assert.deepEqual(tz.localWindow('XXX', 0, LATE_EVENING).tz, 'UTC');
  tz.localWindow('XXX', 0, LATE_EVENING);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /XXX/);
});

test('zones are looked up once per airport, and airports loaded after startup are found', () => {
  const airportsByIata = new Map();
  let lookups = 0;
  const tz = createAirportTimezones({
    airportsByIata,
    lookup: (lat, lon) => { lookups += 1; return timeZoneAt(lat, lon); },
    log: quiet,
  });
  assert.equal(tz.timeZoneFor('TPE'), null);
  airportsByIata.set('TPE', { lat: AIRPORTS.TPE.lat, lon: AIRPORTS.TPE.lon });
  assert.equal(tz.timeZoneFor('TPE'), 'Asia/Taipei');
  assert.equal(tz.timeZoneFor('TPE'), 'Asia/Taipei');
  assert.equal(lookups, 1);

  // Boundary lookup without an answer: whole-hour zone from the longitude.
  const offshore = createAirportTimezones({
    airportsByIata: new Map([['ZZZ', { lat: 25, lon: 121.2 }]]),
    lookup: () => { throw new Error('no zone'); },
    log: quiet,
  });
  assert.equal(offshore.localWindow('ZZZ', 0, LATE_EVENING).tz, 'Etc/GMT-8');
  assert.equal(offshore.today('ZZZ', undefined, LATE_EVENING), '2026-09-15');
});
