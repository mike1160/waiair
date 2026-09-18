import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COUNTRY_PHOTO_TTL_MS,
  HOTEL_PHOTO_TTL_MS,
  countryPhotoQueries,
  hotelPhotoQueries,
  parsePlacePhotoCache,
  placePhotoCacheValue,
  placePhotoKey,
  placePhotoTtl,
  placePhotoUrl,
} from './placePhoto.ts';

const PHOTO = { url: 'https://images.unsplash.com/x', photographer: 'Ann', photographerUrl: 'https://unsplash.com/@ann' };

test('hotel search priority: the hotel name, then the city, then city travel', () => {
  assert.deepEqual(hotelPhotoQueries('Holiday Inn Bangkok', 'Bangkok'), [
    'Holiday Inn Bangkok', 'Bangkok hotel', 'Bangkok travel',
  ]);
  assert.deepEqual(hotelPhotoQueries('', 'Bangkok'), ['Bangkok hotel', 'Bangkok travel']);
  assert.deepEqual(hotelPhotoQueries('  My   Hotel ', null), ['My Hotel'], 'whitespace collapsed');
  assert.deepEqual(hotelPhotoQueries('', ''), [], 'nothing to search: white card');
});

test('country search priority: landmark, then skyline, then temple', () => {
  assert.deepEqual(countryPhotoQueries('Thailand'), ['Thailand landmark', 'Thailand skyline', 'Thailand temple']);
  assert.deepEqual(countryPhotoQueries('Netherlands')[0], 'Netherlands landmark');
  assert.deepEqual(countryPhotoQueries('  '), []);
});

test('cache key is per subject and the TTL is 24h for hotels, 7 days for countries', () => {
  assert.equal(placePhotoKey('hotel', 'Holiday Inn Bangkok'), 'waiair.placePhoto.v1.hotel.holiday inn bangkok');
  assert.equal(placePhotoKey('country', 'Thailand'), 'waiair.placePhoto.v1.country.thailand');
  assert.equal(placePhotoKey('hotel', '   '), '');
  assert.equal(placePhotoTtl('hotel'), HOTEL_PHOTO_TTL_MS);
  assert.equal(placePhotoTtl('country'), COUNTRY_PHOTO_TTL_MS);
  assert.equal(HOTEL_PHOTO_TTL_MS, 86_400_000);
  assert.equal(COUNTRY_PHOTO_TTL_MS, 7 * 86_400_000);
});

test('cached photos expire; junk and "nothing found" read as no photo', () => {
  const now = 1_800_000_000_000;
  const fresh = placePhotoCacheValue(PHOTO, now);
  assert.deepEqual(parsePlacePhotoCache(fresh, HOTEL_PHOTO_TTL_MS, now + 1000), PHOTO);
  assert.equal(parsePlacePhotoCache(fresh, HOTEL_PHOTO_TTL_MS, now + HOTEL_PHOTO_TTL_MS), null, 'expired');
  assert.deepEqual(parsePlacePhotoCache(fresh, COUNTRY_PHOTO_TTL_MS, now + HOTEL_PHOTO_TTL_MS), PHOTO, '7 days for countries');
  assert.equal(parsePlacePhotoCache(placePhotoCacheValue(null, now), HOTEL_PHOTO_TTL_MS, now), null);
  assert.equal(parsePlacePhotoCache('not json', HOTEL_PHOTO_TTL_MS, now), null);
  assert.equal(parsePlacePhotoCache(null, HOTEL_PHOTO_TTL_MS, now), null);
  assert.equal(parsePlacePhotoCache(JSON.stringify({ at: now, photo: { url: 'http://insecure/x' } }), HOTEL_PHOTO_TTL_MS, now), null);
});

test('proxy URL carries the phrases in order, at most three', () => {
  assert.equal(
    placePhotoUrl('https://proxy.test/', ['Holiday Inn Bangkok', 'Bangkok hotel']),
    'https://proxy.test/photos/place?q=Holiday%20Inn%20Bangkok&q=Bangkok%20hotel',
  );
  const many = placePhotoUrl('https://proxy.test', ['a landmark', 'b skyline', 'c temple', 'd extra']);
  assert.equal(many.split('q=').length - 1, 3);
  assert.equal(placePhotoUrl('https://proxy.test', ['ab']), '', 'nothing searchable: no request');
});
