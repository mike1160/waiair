import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_PHOTO_ATTEMPTS,
  RESTAURANTS_TTL_MS,
  createPhotoClaims,
  currencySymbol,
  parseRestaurants,
  parseRestaurantsCache,
  priceLabel,
  ratingLabel,
  restaurantMapsUrl,
  restaurantMeta,
  restaurantPhotoOffset,
  restaurantPhotoQueries,
  restaurantPhotoSubject,
  restaurantsCacheKey,
  restaurantsCacheValue,
  restaurantsUrl,
  toRestaurant,
  type Restaurant,
} from './restaurants.ts';
import {
  NEIGHBOURHOOD_COVERAGE,
  exploreMapsUrl,
  hasNeighbourhoods,
  neighbourhoodChips,
  neighbourhoodCity,
} from './neighbourhoods.ts';

const row = (name: string, rating: number | null, extra: Record<string, unknown> = {}) => ({
  placeId: `p-${name}`,
  name,
  rating,
  ratingCount: 100,
  priceLevel: 2,
  cuisine: 'Thai restaurant',
  openNow: true,
  address: `${name}, Bangkok`,
  lat: 13.7,
  lng: 100.5,
  ...extra,
});

const restaurant = (over: Partial<Restaurant> = {}): Restaurant => ({
  placeId: 'p1',
  name: 'Nahm',
  rating: 4.2,
  ratingCount: 900,
  priceLevel: 2,
  cuisine: 'Thai restaurant',
  openNow: true,
  address: 'Nahm, Bangkok',
  lat: 13.7,
  lng: 100.5,
  ...over,
});

test('the proxy body becomes a list sorted by rating, unrated last', () => {
  const list = parseRestaurants([row('mid', 4), row('none', null), row('top', 4.8)]);
  assert.deepEqual(list.map(r => r.name), ['top', 'mid', 'none']);
  assert.deepEqual(parseRestaurants(null), [], 'a broken body is an empty list, never a crash');
  assert.deepEqual(parseRestaurants({ places: [] }), []);
});

test('a row without a name is dropped; unknown fields read as null', () => {
  assert.equal(toRestaurant({ rating: 5 }), null);
  assert.equal(toRestaurant(null), null);
  const bare = toRestaurant({ name: 'Somtam Nua' })!;
  assert.equal(bare.rating, null);
  assert.equal(bare.priceLevel, null);
  assert.equal(bare.openNow, null, 'unknown hours is not "closed"');
  assert.equal(bare.cuisine, '');
});

test('the price level is the local currency symbol, repeated', () => {
  assert.equal(priceLabel(2, 'THB'), '฿฿');
  assert.equal(priceLabel(1, 'EUR'), '€');
  assert.equal(priceLabel(4, 'GBP'), '££££');
  assert.equal(priceLabel(2, 'MYR'), '$$', 'a multi-letter symbol is not repeated into RMRM');
  assert.equal(priceLabel(4, 'MYR'), '$$$$');
  assert.equal(priceLabel(2, 'SGD'), '$$', 'S$ would read as S$S$');
  assert.equal(priceLabel(3, 'AED'), '$$$');
  assert.equal(priceLabel(2, 'KRW'), '₩₩', 'one-character symbols still repeat');
  assert.equal(priceLabel(3, null), '$$$', 'an unmapped currency falls back to $');
  assert.equal(priceLabel(null, 'THB'), '', 'no level, no symbols');
  assert.equal(priceLabel(0, 'THB'), '', 'free is not shown as a price');
  assert.equal(currencySymbol('thb'), '฿');
  assert.equal(currencySymbol('ZZZ'), '$');
});

test('the rating reads as one decimal with a star', () => {
  assert.equal(ratingLabel(4.2), '⭐ 4.2');
  assert.equal(ratingLabel(5), '⭐ 5.0');
  assert.equal(ratingLabel(null), '');
  assert.equal(ratingLabel(0), '');
});

test('the meta line carries what is known, and calls out only "open now"', () => {
  assert.equal(
    restaurantMeta(restaurant(), 'THB', 'Open now'),
    '⭐ 4.2  ·  ฿฿  ·  Thai restaurant  ·  Open now',
  );
  assert.equal(
    restaurantMeta(restaurant({ openNow: false }), 'THB', 'Open now'),
    '⭐ 4.2  ·  ฿฿  ·  Thai restaurant',
    'closed is left unsaid rather than shown as closed',
  );
  assert.equal(
    restaurantMeta(restaurant({ rating: null, priceLevel: null, cuisine: '', openNow: null }), 'THB', 'Open now'),
    '',
    'a place we know nothing about shows no meta line at all',
  );
});

test('tapping a restaurant opens Google Maps on that exact place', () => {
  const url = restaurantMapsUrl(restaurant(), 'Bangkok');
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Nahm%20Bangkok&query_place_id=p1$/);
  assert.equal(
    restaurantMapsUrl(restaurant({ placeId: '' }), 'Bangkok'),
    'https://www.google.com/maps/search/?api=1&query=Nahm%20Bangkok',
    'without a place id it is still a working search',
  );
});

test('the photo queries are the cuisine and the city, never the restaurant name', () => {
  assert.deepEqual(restaurantPhotoQueries(restaurant(), 'Bangkok'), [
    'Thai restaurant food Bangkok',
    'Bangkok food',
    'Bangkok street food',
  ]);
  assert.ok(
    !restaurantPhotoQueries(restaurant(), 'Bangkok').some(q => q.includes('Nahm')),
    'a restaurant name has no Unsplash photo, so asking for one only spends the hourly quota',
  );
  assert.deepEqual(restaurantPhotoQueries(restaurant({ cuisine: '' }), 'Bangkok'), [
    'Bangkok food',
    'Bangkok street food',
  ]);
  assert.deepEqual(restaurantPhotoQueries(restaurant({ cuisine: '' }), ''), [], 'nothing to search, no request');
});

test('one cache key and one proxy URL per neighbourhood', () => {
  assert.equal(restaurantsCacheKey('Sukhumvit', 'Bangkok'), 'waiair.restaurants.v1.sukhumvit|bangkok');
  assert.equal(
    restaurantsCacheKey('sukhumvit', 'BANGKOK'),
    restaurantsCacheKey('Sukhumvit', 'Bangkok'),
    'case cannot cause a second lookup for the same area',
  );
  assert.notEqual(restaurantsCacheKey('Silom', 'Bangkok'), restaurantsCacheKey('Sukhumvit', 'Bangkok'));
  assert.equal(restaurantsCacheKey('', ''), '');

  assert.equal(
    restaurantsUrl('https://proxy.test/', 'Khao San Road', 'Bangkok', 'nl'),
    'https://proxy.test/places/restaurants?area=Khao+San+Road&city=Bangkok&lang=nl',
  );
  assert.equal(
    restaurantsUrl('https://proxy.test', 'Marina', 'Dubai', 'nl', 25.2528, 55.3644),
    'https://proxy.test/places/restaurants?area=Marina&city=Dubai&lang=nl&lat=25.2528&lng=55.3644',
    'the arrival airport keeps a generic area name in the right city',
  );
  assert.equal(
    restaurantsUrl('https://proxy.test', 'Marina', 'Dubai', undefined, null, null),
    'https://proxy.test/places/restaurants?area=Marina&city=Dubai',
    'no coordinates: no bias parameters',
  );
  assert.equal(restaurantsUrl('https://proxy.test', '', ''), '', 'nothing to ask, no request');
});

test('the cache holds for 24h, then reads as a miss', () => {
  const now = 1_800_000_000_000;
  const value = restaurantsCacheValue(parseRestaurants([row('Nahm', 4.6)]), now);
  assert.equal(parseRestaurantsCache(value, now + RESTAURANTS_TTL_MS - 1)?.length, 1);
  assert.equal(parseRestaurantsCache(value, now + RESTAURANTS_TTL_MS), null, 'expired');
  assert.equal(parseRestaurantsCache('not json', now), null);
  assert.equal(parseRestaurantsCache(null, now), null);
  assert.deepEqual(parseRestaurantsCache(restaurantsCacheValue([], now), now), [], 'an empty result is remembered');
});

test('the curated cities each get their own chips', () => {
  const bkk = neighbourhoodChips('BKK');
  assert.deepEqual(bkk.map(c => c.label), ['Sukhumvit', 'Silom', 'Chinatown', 'Khao San Road', 'Ari', 'Thonglor']);
  assert.equal(bkk[0].kind, 'area');
  assert.equal(bkk[0].kind === 'area' ? bkk[0].city : '', 'Bangkok');

  assert.deepEqual(neighbourhoodChips('DXB').map(c => c.label), ['Downtown', 'Marina', 'Deira', 'JBR', 'Business Bay', 'Old Dubai']);
  assert.deepEqual(neighbourhoodChips('AMS').map(c => c.label), ['Jordaan', 'De Pijp', 'Centrum', 'Oud-Zuid', 'NDSM', 'Westerpark']);
  assert.equal(neighbourhoodChips('CDG')[0].label, 'Le Marais');
  assert.equal(neighbourhoodChips('KUL')[0].label, 'KLCC');
  assert.equal(neighbourhoodChips('HKT')[0].label, 'Patong');
  assert.equal(neighbourhoodChips('CNX')[0].label, 'Nimman');
  assert.equal(neighbourhoodChips('SIN')[0].label, 'Clarke Quay');
});

test('both Tokyo and both London airports share their city list', () => {
  assert.deepEqual(neighbourhoodChips('HND').map(c => c.label), neighbourhoodChips('NRT').map(c => c.label));
  assert.deepEqual(neighbourhoodChips('LGW').map(c => c.label), neighbourhoodChips('LHR').map(c => c.label));
  assert.equal(neighbourhoodCity('HND'), 'Tokyo');
  assert.equal(neighbourhoodCity('LGW'), 'London');
});

test('an unknown city gets one Explore chip that opens Google Maps', () => {
  const chips = neighbourhoodChips('BSL', 'Basel', city => `Explore ${city}`);
  assert.equal(chips.length, 1);
  assert.equal(chips[0].kind, 'explore');
  assert.equal(chips[0].label, 'Explore Basel');
  assert.equal(
    chips[0].kind === 'explore' ? chips[0].url : '',
    'https://www.google.com/maps/search/?api=1&query=restaurants%20in%20Basel',
  );
  assert.equal(exploreMapsUrl('Basel'), 'https://www.google.com/maps/search/?api=1&query=restaurants%20in%20Basel');
  assert.equal(hasNeighbourhoods('BSL'), false);
  assert.equal(hasNeighbourhoods('BKK'), true);
});

test('no city at all means no section', () => {
  assert.deepEqual(neighbourhoodChips('', ''), []);
  assert.deepEqual(neighbourhoodChips(null, null), []);
  assert.deepEqual(neighbourhoodChips('ZZ', ' '), [], 'a malformed code with no city name shows nothing');
});

test('the curated city name wins over the airport city, but the airport city is used when there is none', () => {
  assert.equal(neighbourhoodCity('NRT', 'Narita'), 'Tokyo');
  assert.equal(neighbourhoodCity('BSL', 'Basel'), 'Basel');
  assert.equal(neighbourhoodChips('BKK', 'Suvarnabhumi')[0].kind === 'area'
    ? (neighbourhoodChips('BKK', 'Suvarnabhumi')[0] as { city: string }).city
    : '', 'Bangkok');
});

test('the worldwide list covers every continent, and the curated cities stayed as they were', () => {
  assert.ok(NEIGHBOURHOOD_COVERAGE.cities >= 130, `only ${NEIGHBOURHOOD_COVERAGE.cities} cities`);
  assert.ok(NEIGHBOURHOOD_COVERAGE.airports >= NEIGHBOURHOOD_COVERAGE.cities, 'every city has at least one airport');

  // The ten cities that existed before the worldwide expansion, exactly as they were.
  assert.deepEqual(neighbourhoodChips('BKK').map(c => c.label), ['Sukhumvit', 'Silom', 'Chinatown', 'Khao San Road', 'Ari', 'Thonglor']);
  assert.deepEqual(neighbourhoodChips('DXB').map(c => c.label), ['Downtown', 'Marina', 'Deira', 'JBR', 'Business Bay', 'Old Dubai']);
  assert.deepEqual(neighbourhoodChips('AMS').map(c => c.label), ['Jordaan', 'De Pijp', 'Centrum', 'Oud-Zuid', 'NDSM', 'Westerpark']);
  assert.deepEqual(neighbourhoodChips('SIN').map(c => c.label), ['Clarke Quay', 'Chinatown', 'Little India', 'Orchard', 'Tiong Bahru']);
  assert.deepEqual(neighbourhoodChips('NRT').map(c => c.label), ['Shinjuku', 'Shibuya', 'Ginza', 'Asakusa', 'Shimokitazawa', 'Nakameguro']);
  assert.deepEqual(neighbourhoodChips('LHR').map(c => c.label), ['Soho', 'Shoreditch', 'Notting Hill', 'Borough Market', 'Mayfair', 'Camden']);
  assert.deepEqual(neighbourhoodChips('CDG').map(c => c.label), ['Le Marais', 'Montmartre', 'Saint-Germain', 'Oberkampf', 'Bastille', 'Canal Saint-Martin']);
  assert.deepEqual(neighbourhoodChips('HKT').map(c => c.label), ['Patong', 'Old Town', 'Kata', 'Karon', 'Rawai', 'Kamala']);
  assert.deepEqual(neighbourhoodChips('CNX').map(c => c.label), ['Nimman', 'Old City', 'Santitham', 'Night Bazaar']);
  assert.deepEqual(neighbourhoodChips('KUL').map(c => c.label), ['KLCC', 'Bukit Bintang', 'Bangsar', 'Chow Kit', 'Petaling Street', 'Mont Kiara']);
});

test('one sample per region has chips and a sensible city name', () => {
  const cases: Array<[string, string, string]> = [
    ['HKG', 'Hong Kong', 'Mong Kok'],
    ['DPS', 'Bali', 'Seminyak'],
    ['SGN', 'Ho Chi Minh City', 'District 1'],
    ['BOM', 'Mumbai', 'Bandra'],
    ['KIX', 'Osaka', 'Dotonbori'],
    ['PVG', 'Shanghai', 'The Bund'],
    ['DOH', 'Doha', 'The Pearl'],
    ['TLV', 'Tel Aviv', 'Florentin'],
    ['BCN', 'Barcelona', 'Gothic Quarter'],
    ['BER', 'Berlin', 'Mitte'],
    ['FRA', 'Frankfurt', 'Sachsenhausen'],
    ['CPT', 'Cape Town', 'V&A Waterfront'],
    ['CAI', 'Cairo', 'Zamalek'],
    ['JFK', 'New York', 'Brooklyn'],
    ['MEX', 'Mexico City', 'Condesa'],
    ['GRU', 'São Paulo', 'Vila Madalena'],
    ['SYD', 'Sydney', 'Darling Harbour'],
    ['AKL', 'Auckland', 'Ponsonby'],
    ['SVO', 'Moscow', 'Arbat'],
    ['ALA', 'Almaty', 'Medeu'],
  ];
  for (const [iata, city, firstArea] of cases) {
    const chips = neighbourhoodChips(iata);
    assert.equal(chips[0]?.kind, 'area', `${iata} should have curated areas`);
    assert.equal(chips[0]?.label, firstArea, iata);
    assert.equal(neighbourhoodCity(iata), city, iata);
    assert.ok(chips.length >= 4, `${iata} has only ${chips.length} chips`);
  }
});

test('a city with two airports shares one list', () => {
  for (const [a, b] of [['NRT', 'HND'], ['LHR', 'LGW'], ['ICN', 'GMP'], ['MXP', 'LIN'], ['JFK', 'EWR'], ['IAD', 'DCA']]) {
    assert.deepEqual(
      neighbourhoodChips(a).map(c => c.label),
      neighbourhoodChips(b).map(c => c.label),
      `${a} and ${b} serve the same city`,
    );
    assert.equal(neighbourhoodCity(a), neighbourhoodCity(b));
  }
});

test('each row asks for its own Unsplash result, and a retry jumps a whole list further', () => {
  const offsets = Array.from({ length: 8 }, (_, i) => restaurantPhotoOffset(i, 0, 8));
  assert.deepEqual(offsets, [0, 1, 2, 3, 4, 5, 6, 7], 'first try: the row position');
  assert.equal(restaurantPhotoOffset(2, 1, 8), 10, 'a retry cannot land on another row\'s first try');
  assert.equal(restaurantPhotoOffset(2, 2, 8), 18);
  const all = new Set<number>();
  for (let row = 0; row < 8; row += 1) {
    for (let attempt = 0; attempt < MAX_PHOTO_ATTEMPTS; attempt += 1) all.add(restaurantPhotoOffset(row, attempt, 8));
  }
  assert.equal(all.size, 8 * MAX_PHOTO_ATTEMPTS, 'no two rows ever ask for the same result');
});

test('the cached photo belongs to the restaurant at its position', () => {
  const r = restaurant();
  assert.equal(restaurantPhotoSubject(r, 3), 'p1#3');
  assert.notEqual(restaurantPhotoSubject(r, 3), restaurantPhotoSubject(r, 11), 'a retry is its own cache entry');
  assert.notEqual(restaurantPhotoSubject(r, 0), 'p1', 'photos cached before per-row offsets are never read again');
  assert.equal(restaurantPhotoSubject(restaurant({ placeId: '' }), 1), 'Nahm#1');
});

test('a photo already on screen is refused to every other row of the list', () => {
  const claims = createPhotoClaims();
  assert.equal(claims.claim('https://img/a', 0), true);
  assert.equal(claims.claim('https://img/a', 3), false, 'row 3 must pick another photo');
  assert.equal(claims.claim('https://img/b', 3), true);
  assert.equal(claims.claim('https://img/a', 0), true, 'a row may keep its own photo across re-renders');

  claims.release(0);
  assert.equal(claims.claim('https://img/a', 5), true, 'a released photo is free again');
  claims.clear();
  assert.equal(claims.claim('https://img/b', 7), true, 'a new neighbourhood starts empty');
});
