const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  MISS_TTL_MS,
  SEARCH_TTL_MS,
  cleanTerm,
  createRestaurantPlaces,
  rankRestaurants,
  searchText,
  toRestaurant,
} = require('./restaurantPlaces');

const place = (name, rating, extra = {}) => ({
  id: `p-${name}`,
  displayName: { text: name },
  rating,
  userRatingCount: 100,
  priceLevel: 'PRICE_LEVEL_MODERATE',
  primaryTypeDisplayName: { text: 'Thai restaurant' },
  currentOpeningHours: { openNow: true },
  formattedAddress: `${name}, Bangkok`,
  location: { latitude: 13.7, longitude: 100.5 },
  ...extra,
});

const okRes = (json) => ({ ok: true, status: 200, json: async () => json });

test('a place becomes the fields the card shows', () => {
  assert.deepEqual(toRestaurant(place('Nahm', 4.55)), {
    placeId: 'p-Nahm',
    name: 'Nahm',
    rating: 4.6,
    ratingCount: 100,
    priceLevel: 2,
    cuisine: 'Thai restaurant',
    openNow: true,
    address: 'Nahm, Bangkok',
    lat: 13.7,
    lng: 100.5,
  });
});

test('missing fields read as null, a nameless place is dropped', () => {
  const bare = toRestaurant({ id: 'x', displayName: { text: 'Somtam' } });
  assert.equal(bare.rating, null);
  assert.equal(bare.priceLevel, null);
  assert.equal(bare.openNow, null, 'unknown opening hours is not "closed"');
  assert.equal(bare.cuisine, '');
  assert.equal(toRestaurant({ rating: 5 }), null);
  assert.equal(toRestaurant(null), null);
});

test('highest rating first, capped at 8; unrated places go last', () => {
  const list = rankRestaurants([
    place('three', 3.1),
    place('none', undefined),
    place('five', 5),
    place('four', 4.2),
    ...Array.from({ length: 8 }, (_, i) => place(`filler${i}`, 3.5)),
  ]);
  assert.equal(list.length, 8);
  assert.deepEqual(list.slice(0, 3).map(r => r.name), ['five', 'four', 'filler0']);
  assert.ok(!list.some(r => r.name === 'none'), 'unrated dropped off the end of a full list');
  assert.deepEqual(rankRestaurants(null), []);
});

test('a tie is broken by how many people rated it', () => {
  const list = rankRestaurants([
    place('few', 4.5, { userRatingCount: 12 }),
    place('many', 4.5, { userRatingCount: 2000 }),
  ]);
  assert.deepEqual(list.map(r => r.name), ['many', 'few']);
});

test('the query is the neighbourhood plus the city, quoted', () => {
  assert.equal(searchText('Sukhumvit Bangkok'), 'restaurants in "Sukhumvit Bangkok"');
  assert.equal(cleanTerm('  Khao San\nRoad  '), 'Khao San Road', 'newlines cannot break out of the query');
  assert.equal(cleanTerm('x'.repeat(200)).length, 80);
});

test('the search sends one Places call and caches it for 24h', async () => {
  const calls = [];
  let now = 1_000;
  const places = createRestaurantPlaces({
    apiKey: 'k',
    now: () => now,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return okRes({ places: [place('Nahm', 4.6)] }); },
  });

  const first = await places.search({ area: 'Sukhumvit', city: 'Bangkok' });
  assert.deepEqual(first.map(r => r.name), ['Nahm']);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /places:searchText$/);
  assert.equal(calls[0].init.headers['X-Goog-Api-Key'], 'k');
  assert.match(calls[0].init.headers['X-Goog-FieldMask'], /places\.rating/);
  assert.deepEqual(JSON.parse(calls[0].init.body).textQuery, 'restaurants in "Sukhumvit Bangkok"');

  now += SEARCH_TTL_MS - 1;
  await places.search({ area: 'sukhumvit', city: 'BANGKOK' });
  assert.equal(calls.length, 1, 'same neighbourhood, still cached, case-insensitive');

  await places.search({ area: 'Silom', city: 'Bangkok' });
  assert.equal(calls.length, 2, 'another neighbourhood is its own lookup');

  now += 2;
  await places.search({ area: 'Sukhumvit', city: 'Bangkok' });
  assert.equal(calls.length, 3, 'past the TTL it is fetched again');
});

test('the arrival airport biases the search, and is part of the cache key', async () => {
  const bodies = [];
  const places = createRestaurantPlaces({
    apiKey: 'k',
    fetchImpl: async (_url, init) => { bodies.push(JSON.parse(init.body)); return okRes({ places: [place('Nahm', 4.6)] }); },
  });

  await places.search({ area: 'Marina', city: 'Dubai', lat: 25.2528, lng: 55.3644 });
  assert.deepEqual(bodies[0].locationBias, { circle: { center: { latitude: 25.2528, longitude: 55.3644 }, radius: 50000 } });

  await places.search({ area: 'Marina', city: 'Dubai', lat: 25.2528, lng: 55.3644 });
  assert.equal(bodies.length, 1, 'the same area and bias is one lookup');

  await places.search({ area: 'Marina', city: 'Dubai' });
  assert.equal(bodies.length, 2, 'without the bias it is a different lookup');
  assert.equal(bodies[1].locationBias, undefined);

  await places.search({ area: 'Marina', city: 'Dubai', lat: 999, lng: 55 });
  assert.equal(bodies.length, 2, 'nonsense coordinates are ignored: the same lookup as no bias at all');
});

test('a failed lookup is not cached: the next tap tries again', async () => {
  const log = { warn: () => {} };
  let calls = 0;
  const flaky = createRestaurantPlaces({
    apiKey: 'k',
    log,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 503, json: async () => ({}) };
      return okRes({ places: [place('Nahm', 4.6)] });
    },
  });
  assert.deepEqual(await flaky.search({ area: 'Marina', city: 'Dubai' }), [], 'upstream down');
  const retry = await flaky.search({ area: 'Marina', city: 'Dubai' });
  assert.deepEqual(retry.map(r => r.name), ['Nahm'], 'a broken call never becomes a remembered "no restaurants"');
  assert.equal(calls, 2);
});

test('no key, an HTTP error and a throw all give an empty list without crashing', async () => {
  const log = { warn: () => {} };
  const keyless = createRestaurantPlaces({ apiKey: '', fetchImpl: async () => { throw new Error('never'); }, log });
  assert.deepEqual(await keyless.search({ area: 'Silom', city: 'Bangkok' }), []);

  let hits = 0;
  const broken = createRestaurantPlaces({
    apiKey: 'k',
    log,
    fetchImpl: async () => { hits += 1; return { ok: false, status: 500, json: async () => ({}) }; },
  });
  assert.deepEqual(await broken.search({ area: 'Silom', city: 'Bangkok' }), []);
  assert.equal(hits, 1);

  const throwing = createRestaurantPlaces({ apiKey: 'k', log, fetchImpl: async () => { throw new Error('offline'); } });
  assert.deepEqual(await throwing.search({ area: 'Silom', city: 'Bangkok' }), []);
});

test('an empty result is only remembered briefly, and no area means no call at all', async () => {
  let now = 0;
  let calls = 0;
  const places = createRestaurantPlaces({
    apiKey: 'k',
    now: () => now,
    fetchImpl: async () => { calls += 1; return okRes({ places: [] }); },
  });
  assert.deepEqual(await places.search({ area: 'Nowhere', city: 'Atlantis' }), []);
  now += MISS_TTL_MS - 1;
  await places.search({ area: 'Nowhere', city: 'Atlantis' });
  assert.equal(calls, 1, 'a miss is cached');
  now += 2;
  await places.search({ area: 'Nowhere', city: 'Atlantis' });
  assert.equal(calls, 2, 'but retried well before 24h');

  assert.deepEqual(await places.search({}), []);
  assert.deepEqual(await places.search({ area: '   ' }), []);
  assert.equal(calls, 2, 'an empty query never reaches Google');
});

test('the spend guard runs before the billed call and its error propagates', async () => {
  let calls = 0;
  const places = createRestaurantPlaces({
    apiKey: 'k',
    acquire: () => { throw Object.assign(new Error('over budget'), { status: 429 }); },
    fetchImpl: async () => { calls += 1; return okRes({ places: [] }); },
  });
  await assert.rejects(places.search({ area: 'Silom', city: 'Bangkok' }), /over budget/);
  assert.equal(calls, 0);
});
