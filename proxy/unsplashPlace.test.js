const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cacheKey, createPlacePhotos, normalizeQuery } = require('./unsplashPlace.js');

function photoResponse(id) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      results: [{
        urls: { regular: `https://images.unsplash.com/${id}` },
        user: { name: 'Ann', links: { html: 'https://unsplash.com/@ann' } },
        links: { download_location: `https://api.unsplash.com/photos/${id}/download` },
      }],
    }),
  };
}

const emptyResponse = { ok: true, status: 200, json: async () => ({ results: [] }) };

test('phrases are normalised for search and cache key', () => {
  assert.equal(normalizeQuery('  Holiday   Inn Bangkok '), 'holiday inn bangkok');
  assert.equal(normalizeQuery('ab'), '', 'too short to search');
  assert.equal(normalizeQuery('x'.repeat(200)).length, 80);
  assert.equal(cacheKey('Bangkok Hotel'), 'unsplash_place_bangkok hotel');
});

test('the first phrase with a photo wins, and landscape orientation is requested', async () => {
  const calls = [];
  const photos = createPlacePhotos({
    accessKey: 'key',
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('download')) return { ok: true, status: 200, json: async () => ({}) };
      return url.includes('holiday%20inn%20bangkok') ? emptyResponse : photoResponse('p1');
    },
    random: () => 0,
  });
  const photo = await photos.get(['Holiday Inn Bangkok', 'Bangkok hotel', 'Bangkok travel']);
  assert.deepEqual(photo, {
    url: 'https://images.unsplash.com/p1',
    photographer: 'Ann',
    photographerUrl: 'https://unsplash.com/@ann?utm_source=waiair&utm_medium=referral',
  });
  const searches = calls.filter(u => u.includes('/search/photos'));
  assert.equal(searches.length, 2, 'stops at the first phrase with a photo');
  for (const url of searches) assert.match(url, /orientation=landscape/);
  assert.ok(calls.some(u => u.includes('/download')), 'a displayed photo is registered with Unsplash');
});

test('phrases are cached and in-flight lookups are shared; no key means no photo', async () => {
  let searches = 0;
  const photos = createPlacePhotos({
    accessKey: 'key',
    fetchImpl: async (url) => {
      if (url.includes('/search/photos')) searches += 1;
      return url.includes('download') ? { ok: true, status: 200, json: async () => ({}) } : photoResponse('p2');
    },
    random: () => 0,
  });
  const [a, b] = await Promise.all([photos.get(['Thailand landmark']), photos.get(['Thailand landmark'])]);
  assert.deepEqual(a, b);
  await photos.get(['thailand   LANDMARK']);
  assert.equal(searches, 1, 'one search for the same normalised phrase');

  const keyless = createPlacePhotos({ accessKey: '', fetchImpl: async () => photoResponse('p3') });
  assert.equal(await keyless.get(['Thailand landmark']), null);
});

test('an Unsplash error or no result is a null photo, never a throw', async () => {
  const failing = createPlacePhotos({
    accessKey: 'key',
    fetchImpl: async () => { throw new Error('network down'); },
    log: { warn() {} },
  });
  assert.equal(await failing.get(['Japan landmark']), null);

  const http = createPlacePhotos({
    accessKey: 'key',
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }),
    log: { warn() {} },
  });
  assert.equal(await http.get(['Japan landmark']), null);

  const none = createPlacePhotos({ accessKey: 'key', fetchImpl: async () => emptyResponse });
  assert.equal(await none.get(['Netherlands landmark', 'Netherlands skyline']), null);
});
