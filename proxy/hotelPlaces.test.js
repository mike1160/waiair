const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanPlaceId, cleanQuery, createHotelPlaces, toSuggestion } = require('./hotelPlaces');

// Hotel autocomplete tests — Google Places API (New) responses are faked.

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    const route = routes.find(r => url.includes(r.match));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: route.status == null || route.status < 400, status: route.status || 200, json: async () => route.body };
  };
  return { impl, calls };
}

const AUTOCOMPLETE = {
  suggestions: [
    {
      placePrediction: {
        placeId: 'ChIJ40Q1nhWc4jAR7xbEgblbmnA',
        text: { text: 'Centara Grand at CentralWorld, Rama I Road, Bangkok, Thailand' },
        structuredFormat: {
          mainText: { text: 'Centara Grand at CentralWorld' },
          secondaryText: { text: 'Rama I Road, Bangkok, Thailand' },
        },
      },
    },
    { queryPrediction: { text: { text: 'centara grand hotels' } } },
  ],
};

test('toSuggestion maps place predictions and skips query predictions', () => {
  assert.deepEqual(toSuggestion(AUTOCOMPLETE.suggestions[0]), {
    placeId: 'ChIJ40Q1nhWc4jAR7xbEgblbmnA',
    name: 'Centara Grand at CentralWorld',
    secondary: 'Rama I Road, Bangkok, Thailand',
  });
  assert.equal(toSuggestion(AUTOCOMPLETE.suggestions[1]), null);
});

test('cleanQuery / cleanPlaceId reject junk', () => {
  assert.equal(cleanQuery('  Centara   Grand '), 'Centara Grand');
  assert.equal(cleanPlaceId('ChIJ40Q1nhWc4jAR7xbEgblbmnA'), 'ChIJ40Q1nhWc4jAR7xbEgblbmnA');
  assert.equal(cleanPlaceId('../../etc/passwd'), '');
});

test('suggest: lodging-only POST with key header, bias and session; cached per query', async () => {
  const { impl, calls } = fakeFetch([{ match: 'places:autocomplete', body: AUTOCOMPLETE }]);
  let acquired = 0;
  const places = createHotelPlaces({ apiKey: 'k', fetchImpl: impl, acquire: () => { acquired += 1; } });
  const list = await places.suggest({ q: 'Centara Grand', lang: 'nl', lat: 13.69, lng: 100.75, session: 'a1b2c3d4-0000-4000-8000-000000000000' });
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Centara Grand at CentralWorld');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.includedPrimaryTypes, ['lodging']);
  assert.equal(body.languageCode, 'nl');
  assert.equal(body.sessionToken, 'a1b2c3d4-0000-4000-8000-000000000000');
  assert.equal(body.locationBias.circle.center.latitude, 13.69);
  assert.equal(calls[0].init.headers['X-Goog-Api-Key'], 'k');
  await places.suggest({ q: 'centara grand', lang: 'nl', lat: 13.69, lng: 100.75 });
  assert.equal(calls.length, 1, 'second identical query is served from cache');
  assert.equal(acquired, 1);
});

test('suggest: short query, no key or upstream error → empty, no billed call for short/no key', async () => {
  const { impl, calls } = fakeFetch([{ match: 'places:autocomplete', status: 403, body: {} }]);
  assert.deepEqual(await createHotelPlaces({ apiKey: '', fetchImpl: impl }).suggest({ q: 'Centara' }), []);
  const places = createHotelPlaces({ apiKey: 'k', fetchImpl: impl, log: { warn() {} } });
  assert.deepEqual(await places.suggest({ q: 'Ce' }), []);
  assert.equal(calls.length, 0);
  assert.deepEqual(await places.suggest({ q: 'Centara' }), []);
  assert.equal(calls.length, 1);
});

test('suggest: spend guard error propagates before calling Google', async () => {
  const { impl, calls } = fakeFetch([{ match: 'places:autocomplete', body: AUTOCOMPLETE }]);
  const err = Object.assign(new Error('over'), { code: 'rate_limited', status: 429 });
  const places = createHotelPlaces({ apiKey: 'k', fetchImpl: impl, acquire: () => { throw err; } });
  await assert.rejects(places.suggest({ q: 'Centara' }), /over/);
  assert.equal(calls.length, 0);
});

test('details: field mask, session token, name + address', async () => {
  const { impl, calls } = fakeFetch([{
    match: '/places/ChIJ',
    body: { id: 'ChIJ40Q1nhWc4jAR7xbEgblbmnA', displayName: { text: 'Centara Grand at CentralWorld' }, formattedAddress: '999/99 Rama I Rd, Pathum Wan, Bangkok 10330, Thailand' },
  }]);
  const places = createHotelPlaces({ apiKey: 'k', fetchImpl: impl });
  const place = await places.details({ placeId: 'ChIJ40Q1nhWc4jAR7xbEgblbmnA', lang: 'en', session: 'a1b2c3d4-0000-4000-8000-000000000000' });
  assert.deepEqual(place, {
    placeId: 'ChIJ40Q1nhWc4jAR7xbEgblbmnA',
    name: 'Centara Grand at CentralWorld',
    address: '999/99 Rama I Rd, Pathum Wan, Bangkok 10330, Thailand',
  });
  assert.equal(calls[0].init.headers['X-Goog-FieldMask'], 'id,displayName,formattedAddress');
  assert.match(calls[0].url, /sessionToken=a1b2c3d4/);
  assert.equal(await places.details({ placeId: 'bad id!' }), null);
});
