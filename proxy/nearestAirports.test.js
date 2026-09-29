const assert = require('node:assert/strict');
const { test } = require('node:test');

const { hasScheduledService, rankNearestAirports } = require('./nearestAirports');

/** Real coordinates and real data flags, from OurAirports. */
const CDG = { iata: 'CDG', lat: 49.0128, lon: 2.55, type: 'large_airport', scheduledService: true };
const ORY = { iata: 'ORY', lat: 48.7233, lon: 2.3794, type: 'large_airport', scheduledService: true };
const LBG = { iata: 'LBG', lat: 48.9694, lon: 2.4414, type: 'large_airport', scheduledService: false };
const IST = { iata: 'IST', lat: 41.2751, lon: 28.7519, type: 'large_airport', scheduledService: true };
const ISL = { iata: 'ISL', lat: 40.9769, lon: 28.8146, type: 'large_airport', scheduledService: false };
const PARIS = [49.0, 2.35];

test('[W/4] an airport with no scheduled passenger service is never the nearest', () => {
  // Le Bourget is the closest large airport to this point, and handles business jets.
  const ranked = rankNearestAirports([CDG, ORY, LBG], ...PARIS, { limit: 3 });
  assert.deepEqual(ranked.map(a => a.iata), ['CDG', 'ORY']);
  assert.ok(!ranked.some(a => a.iata === 'LBG'));
});

test('[W/4] nor is a closed one', () => {
  const ranked = rankNearestAirports([IST, ISL], 41.0082, 28.9784, { limit: 2 });
  assert.deepEqual(ranked.map(a => a.iata), ['IST'], 'Atatürk is closer and takes no scheduled passengers');
});

test('[W/4] the filter is a preference: somewhere with nothing servable still gets an answer', () => {
  const ranked = rankNearestAirports([LBG, ISL], ...PARIS, { limit: 2 });
  assert.deepEqual(ranked.map(a => a.iata), ['LBG', 'ISL'], 'better a distant airport than none');
});

test('[W/4] unknown service is servable: a missing CSV column must not empty the list', () => {
  assert.equal(hasScheduledService({ iata: 'X' }), true);
  assert.equal(hasScheduledService({ iata: 'X', scheduledService: undefined }), true);
  assert.equal(hasScheduledService({ iata: 'X', scheduledService: false }), false);
  const noFlag = [{ iata: 'AAA', lat: 49.1, lon: 2.4 }, { iata: 'BBB', lat: 48.5, lon: 2.4 }];
  assert.deepEqual(rankNearestAirports(noFlag, ...PARIS, { limit: 2 }).map(a => a.iata), ['AAA', 'BBB']);
});

test('[W/4] results are nearest first, carry distanceKm, and respect the limit', () => {
  const ranked = rankNearestAirports([ORY, CDG], ...PARIS, { limit: 1 });
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].iata, 'CDG');
  assert.equal(typeof ranked[0].distanceKm, 'number');
  assert.ok(ranked[0].distanceKm > 14 && ranked[0].distanceKm < 15,
    `CDG is 14.7 km from the test point, got ${ranked[0].distanceKm}`);
});

test('[W/4] project decides the returned shape, and nothing else leaks', () => {
  const ranked = rankNearestAirports([CDG], ...PARIS, { project: a => ({ iata: a.iata }) });
  assert.deepEqual(Object.keys(ranked[0]).sort(), ['distanceKm', 'iata']);
});

test('[W/4] bad input is empty, and airports without coordinates are skipped', () => {
  assert.deepEqual(rankNearestAirports([CDG], NaN, 2.35), []);
  assert.deepEqual(rankNearestAirports([CDG], 49, undefined), []);
  assert.deepEqual(rankNearestAirports(null, ...PARIS), []);
  const broken = [{ iata: 'NOPOS', scheduledService: true }, CDG];
  assert.deepEqual(rankNearestAirports(broken, ...PARIS, { limit: 3 }).map(a => a.iata), ['CDG']);
});
