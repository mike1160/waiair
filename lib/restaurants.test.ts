import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RESTAURANTS_TTL_MS,
  currencySymbol,
  parseRestaurants,
  parseRestaurantsCache,
  priceLabel,
  ratingLabel,
  restaurantMapsUrl,
  restaurantMeta,
  restaurantPhotoQueries,
  restaurantsCacheKey,
  restaurantsCacheValue,
  restaurantsUrl,
  toRestaurant,
  type Restaurant,
} from './restaurants.ts';
import {
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
  assert.equal(priceLabel(2, 'MYR'), 'RMRM');
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

test('the photo queries go from this restaurant to its cuisine to the city', () => {
  assert.deepEqual(restaurantPhotoQueries(restaurant(), 'Bangkok'), [
    'Nahm Bangkok food',
    'Thai restaurant food Bangkok',
    'Bangkok food',
  ]);
  assert.deepEqual(restaurantPhotoQueries(restaurant({ cuisine: '' }), 'Bangkok'), [
    'Nahm Bangkok food',
    'Bangkok food',
  ]);
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
  const chips = neighbourhoodChips('GVA', 'Geneva', city => `Explore ${city}`);
  assert.equal(chips.length, 1);
  assert.equal(chips[0].kind, 'explore');
  assert.equal(chips[0].label, 'Explore Geneva');
  assert.equal(
    chips[0].kind === 'explore' ? chips[0].url : '',
    'https://www.google.com/maps/search/?api=1&query=restaurants%20in%20Geneva',
  );
  assert.equal(exploreMapsUrl('Geneva'), 'https://www.google.com/maps/search/?api=1&query=restaurants%20in%20Geneva');
  assert.equal(hasNeighbourhoods('GVA'), false);
  assert.equal(hasNeighbourhoods('BKK'), true);
});

test('no city at all means no section', () => {
  assert.deepEqual(neighbourhoodChips('', ''), []);
  assert.deepEqual(neighbourhoodChips(null, null), []);
  assert.deepEqual(neighbourhoodChips('ZZ', ' '), [], 'a malformed code with no city name shows nothing');
});

test('the curated city name wins over the airport city, but the airport city is used when there is none', () => {
  assert.equal(neighbourhoodCity('NRT', 'Narita'), 'Tokyo');
  assert.equal(neighbourhoodCity('GVA', 'Geneva'), 'Geneva');
  assert.equal(neighbourhoodChips('BKK', 'Suvarnabhumi')[0].kind === 'area'
    ? (neighbourhoodChips('BKK', 'Suvarnabhumi')[0] as { city: string }).city
    : '', 'Bangkok');
});
