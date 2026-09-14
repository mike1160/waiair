const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STALE_AFTER_MS,
  RETAIN_MS,
  allLegsLanded,
  markStale,
  createLandedFlights,
} = require('./landedFlights');

const HOUR = 60 * 60 * 1000;
const leg = (number, status) => ({ number, status, departure: { airport: { iata: 'BKK' } }, arrival: { airport: { iata: 'SIN' } } });
const body = (...legs) => JSON.stringify(legs);

function clock(start = Date.parse('2026-09-14T08:00:00Z')) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('allLegsLanded: Landed / Arrived on every leg; anything else, empty or invalid is not landed', () => {
  assert.equal(allLegsLanded(body(leg('TG 403', 'Arrived'))), true);
  assert.equal(allLegsLanded(body(leg('TG 403', 'landed'), leg('TG 403', 'Arrived'))), true);
  assert.equal(allLegsLanded(JSON.stringify(leg('TG 403', 'Landed'))), true);
  assert.equal(allLegsLanded(body(leg('TG 403', 'Arrived'), leg('TG 403', 'Expected'))), false);
  assert.equal(allLegsLanded(body(leg('TG 403', 'EnRoute'))), false);
  assert.equal(allLegsLanded('[]'), false);
  assert.equal(allLegsLanded('not json'), false);
});

test('markStale keeps the array shape and flags each leg', () => {
  const out = JSON.parse(markStale(body(leg('TG 403', 'Arrived'), leg('TG 403', 'Landed'))));
  assert.equal(Array.isArray(out), true);
  assert.equal(out.length, 2);
  for (const l of out) {
    assert.equal(l.stale, true);
    assert.equal(l.reason, 'flight_completed');
    assert.equal(l.number, 'TG 403');
  }
  assert.deepEqual(JSON.parse(markStale(JSON.stringify(leg('TG 403', 'Arrived')))).reason, 'flight_completed');
});

test('landed flight: live for 24h after it was first seen landed, then the stored response without an API call', () => {
  const c = clock();
  const store = createLandedFlights({ now: c.now });
  const key = 'flight:TG403';
  store.observe(key, 200, body(leg('TG 403', 'Arrived')));
  assert.equal(store.staleResponse(key), null);

  // Repeated live answers while landed do not restart the 24h clock.
  c.advance(20 * HOUR);
  store.observe(key, 200, body(leg('TG 403', 'Arrived')));
  assert.equal(store.staleResponse(key), null);

  c.advance(4 * HOUR + 1);
  const stale = store.staleResponse(key);
  assert.ok(stale);
  assert.equal(stale.status, 200);
  assert.equal(JSON.parse(stale.text)[0].status, 'Arrived');
  assert.equal(STALE_AFTER_MS, 24 * HOUR);
});

test('a live answer that has not landed (flying again, or never landed) is never stored and clears a landed entry', () => {
  const c = clock();
  const store = createLandedFlights({ now: c.now });
  const key = 'flight:TG403';
  store.observe(key, 200, body(leg('TG 403', 'EnRoute')));
  c.advance(30 * HOUR);
  assert.equal(store.staleResponse(key), null);
  assert.equal(store.size(), 0);

  store.observe(key, 200, body(leg('TG 403', 'Arrived')));
  c.advance(10 * HOUR);
  store.observe(key, 200, body(leg('TG 403', 'Arrived'), leg('TG 403', 'Expected')));
  c.advance(20 * HOUR);
  assert.equal(store.staleResponse(key), null);
  assert.equal(store.size(), 0);
});

test('errors are ignored; entries expire after 48h so the number is fetched live again', () => {
  const c = clock();
  const store = createLandedFlights({ now: c.now });
  store.observe('flight:TG403', 204, '');
  store.observe('flight:TG403', 500, body(leg('TG 403', 'Arrived')));
  assert.equal(store.size(), 0);

  store.observe('flight:TG403', 200, body(leg('TG 403', 'Arrived')));
  c.advance(RETAIN_MS - 1);
  assert.ok(store.staleResponse('flight:TG403'));
  c.advance(1);
  assert.equal(store.staleResponse('flight:TG403'), null);
  assert.equal(store.size(), 0);
});

test('the store is bounded: the oldest entry makes room', () => {
  const c = clock();
  const store = createLandedFlights({ now: c.now, maxEntries: 2 });
  store.observe('flight:A1', 200, body(leg('A 1', 'Arrived')));
  store.observe('flight:B2', 200, body(leg('B 2', 'Arrived')));
  store.observe('flight:C3', 200, body(leg('C 3', 'Arrived')));
  assert.equal(store.size(), 2);
  c.advance(25 * HOUR);
  assert.equal(store.staleResponse('flight:A1'), null);
  assert.ok(store.staleResponse('flight:C3'));
});
