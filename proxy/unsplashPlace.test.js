const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PER_PAGE, cacheKey, createPlacePhotos, normalizeQuery } = require('./unsplashPlace.js');

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

/** A page of `n` distinct results for the same phrase. */
function pageResponse(n) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      results: Array.from({ length: n }, (_, i) => ({
        id: `id${i}`,
        urls: { regular: `https://images.unsplash.com/r${i}` },
        user: { name: 'Ann', links: { html: 'https://unsplash.com/@ann' } },
        links: { download_location: `https://api.unsplash.com/photos/r${i}/download` },
      })),
    }),
  };
}

test('an offset picks the nth result, so a list of restaurants gets different photos', async () => {
  let searches = 0;
  const photos = createPlacePhotos({
    accessKey: 'key',
    fetchImpl: async (url) => {
      if (url.includes('download')) return { ok: true, status: 200, json: async () => ({}) };
      searches += 1;
      return pageResponse(8);
    },
  });

  const urls = [];
  for (let i = 0; i < 8; i += 1) {
    const photo = await photos.get(['Thai food Bangkok'], i);
    urls.push(photo.url);
  }
  assert.equal(new Set(urls).size, 8, 'eight rows, eight different photos');
  assert.equal(searches, 1, 'and all of them from a single Unsplash call');
  assert.match(urls[0], /r0$/);
  assert.match(urls[7], /r7$/);
});

test('an offset past the end of the page wraps instead of showing nothing', async () => {
  const photos = createPlacePhotos({
    accessKey: 'key',
    fetchImpl: async (url) => (url.includes('download')
      ? { ok: true, status: 200, json: async () => ({}) }
      : pageResponse(3)),
  });
  assert.equal((await photos.one('Bangkok food', 4)).url, (await photos.one('Bangkok food', 1)).url);
  assert.equal((await photos.one('Bangkok food', 3)).url, (await photos.one('Bangkok food', 0)).url);
});

test('without an offset the pick stays random, as the hotel and country cards expect', async () => {
  const photos = createPlacePhotos({
    accessKey: 'key',
    random: () => 0.9,
    fetchImpl: async (url) => (url.includes('download')
      ? { ok: true, status: 200, json: async () => ({}) }
      : pageResponse(5)),
  });
  assert.match((await photos.get(['Bangkok hotel'])).url, /r4$/, '0.9 of five results');
});

test('a whole page is requested, and a displayed photo is registered with Unsplash once', async () => {
  const calls = [];
  const photos = createPlacePhotos({
    accessKey: 'key',
    fetchImpl: async (url) => {
      calls.push(url);
      return url.includes('download') ? { ok: true, status: 200, json: async () => ({}) } : pageResponse(4);
    },
  });
  await photos.one('Bangkok food', 2);
  await photos.one('Bangkok food', 2);
  assert.match(calls[0], new RegExp(`per_page=${PER_PAGE}`));
  assert.equal(calls.filter((u) => u.includes('download')).length, 1, 'the same photo is not registered twice');
});
