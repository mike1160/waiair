import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReverseGeocode, reverseGeocodeUrl } from './reverseGeocode.ts';

test('the lookup goes to a real reverse-geocoding endpoint, not Open-Meteo', () => {
  const url = reverseGeocodeUrl(13.69, 100.75);
  assert.equal(url, 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=13.69&longitude=100.75&localityLanguage=en');
  assert.doesNotMatch(url, /open-meteo/);
  assert.match(reverseGeocodeUrl(1, 2, 'nl'), /localityLanguage=nl$/);
  assert.match(reverseGeocodeUrl(1, 2, 'not-a-lang'), /localityLanguage=en$/);
});

test('city first, then locality; the region is subdivision and country', () => {
  assert.deepEqual(
    parseReverseGeocode({ city: 'Bang Phli', locality: 'Bang Phli', principalSubdivision: 'Samut Prakan', countryName: 'Thailand' }),
    { name: 'Bang Phli', region: 'Samut Prakan, Thailand' },
  );
  assert.deepEqual(
    parseReverseGeocode({ city: '', locality: 'Frankfurt-Flughafen', principalSubdivision: 'Hessen', countryName: 'Germany' }),
    { name: 'Frankfurt-Flughafen', region: 'Hessen, Germany' },
  );
});

test('an empty or broken answer is an unnamed place, never a crash', () => {
  assert.deepEqual(parseReverseGeocode(null), { name: '' });
  assert.deepEqual(parseReverseGeocode({}), { name: '', region: undefined });
  assert.deepEqual(parseReverseGeocode('nope'), { name: '' });
});
