const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CACHE_TTL_MS,
  MISS_TTL_MS,
  cacheKey,
  toPhoto,
  createDestinationPhotos,
} = require('./unsplashDestination');

const HOUR = 60 * 60 * 1000;
const CITIES = { BKK: 'Bangkok', AMS: 'Amsterdam', HKT: 'Phuket' };

function result(id) {
  return {
    id,
    urls: { regular: `https://images.unsplash.com/photo-${id}?w=1080`, full: `https://images.unsplash.com/photo-${id}` },
    user: { name: `Photographer ${id}`, links: { html: `https://unsplash.com/@p${id}` } },
    links: { download_location: `https://api.unsplash.com/photos/${id}/download` },
  };
}

/** Fake Unsplash: search answers from `answers` (status + results), download pings are recorded. */
function fakeUnsplash(answers = []) {
  const searches = [];
  const downloads = [];
  const fetchImpl = async (url, init) => {
    if (url.includes('/download')) {
      downloads.push({ url, auth: init.headers.Authorization });
      return { ok: true, status: 200, json: async () => ({}) };
    }
    searches.push({ url, auth: init.headers.Authorization });
    const a = answers.shift() || { status: 200, results: [] };
    if (a.throws) throw new Error(a.throws);
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => ({ results: a.results || [] }) };
  };
  return { fetchImpl, searches, downloads };
}

function setup({ answers, random = () => 0, accessKey = 'test-key' } = {}) {
  let t = Date.parse('2026-09-14T08:00:00Z');
  const unsplash = fakeUnsplash(answers);
  const warnings = [];
  const photos = createDestinationPhotos({
    accessKey,
    cityFor: (iata) => CITIES[iata] || '',
    fetchImpl: unsplash.fetchImpl,
    now: () => t,
    random,
    log: { warn: (...a) => warnings.push(a.join(' ')) },
  });
  return { photos, unsplash, warnings, advance: (ms) => { t += ms; } };
}

test('BKK → search "Bangkok landmark", landscape, 3 results, Client-ID header; returns url + photographer with UTM', async () => {
  const { photos, unsplash } = setup({ answers: [{ status: 200, results: [result('a'), result('b'), result('c')] }], random: () => 0.5 });
  const photo = await photos.get('bkk');
  assert.equal(unsplash.searches.length, 1);
  const url = new URL(unsplash.searches[0].url);
  assert.equal(url.origin + url.pathname, 'https://api.unsplash.com/search/photos');
  assert.equal(url.searchParams.get('query'), 'Bangkok landmark');
  assert.equal(url.searchParams.get('orientation'), 'landscape');
  assert.equal(url.searchParams.get('per_page'), '3');
  assert.equal(unsplash.searches[0].auth, 'Client-ID test-key');
  assert.deepEqual(photo, {
    url: 'https://images.unsplash.com/photo-b?w=1080',
    photographer: 'Photographer b',
    photographerUrl: 'https://unsplash.com/@pb?utm_source=waiair&utm_medium=referral',
  });
  assert.deepEqual(unsplash.downloads.map(d => d.url), ['https://api.unsplash.com/photos/b/download']);
  assert.equal(cacheKey('BKK'), 'unsplash_dest_BKK');
});

test('cached for 24h per airport: no second Unsplash call until the cache expires', async () => {
  const { photos, unsplash, advance } = setup({
    answers: [{ status: 200, results: [result('a')] }, { status: 200, results: [result('z')] }],
  });
  const first = await photos.get('AMS');
  advance(CACHE_TTL_MS - 1);
  assert.deepEqual(await photos.get('AMS'), first);
  assert.equal(unsplash.searches.length, 1);
  advance(1);
  assert.equal((await photos.get('AMS')).url, 'https://images.unsplash.com/photo-z?w=1080');
  assert.equal(unsplash.searches.length, 2);
  assert.equal(CACHE_TTL_MS, 24 * HOUR);
});

test('parallel requests for the same airport share one Unsplash search', async () => {
  const { photos, unsplash } = setup({ answers: [{ status: 200, results: [result('a')] }] });
  const [a, b, c] = await Promise.all([photos.get('HKT'), photos.get('HKT'), photos.get('hkt')]);
  assert.equal(unsplash.searches.length, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
});

test('fallback null: no results, rate limit / error, network failure — remembered for an hour, then retried', async () => {
  const { photos, unsplash, warnings, advance } = setup({
    answers: [
      { status: 200, results: [] },
      { status: 403, results: [] },
      { throws: 'socket hang up' },
      { status: 200, results: [result('ok')] },
    ],
  });
  assert.equal(await photos.get('BKK'), null);
  assert.equal(await photos.get('AMS'), null);
  assert.equal(await photos.get('HKT'), null);
  assert.equal(unsplash.searches.length, 3);
  assert.match(warnings.join('\n'), /AMS Amsterdam \| HTTP 403/);
  assert.match(warnings.join('\n'), /HKT \| socket hang up/);

  // Within the hour: still null, no new calls.
  assert.equal(await photos.get('BKK'), null);
  assert.equal(unsplash.searches.length, 3);
  advance(MISS_TTL_MS);
  assert.equal((await photos.get('BKK')).url, 'https://images.unsplash.com/photo-ok?w=1080');
  assert.equal(unsplash.searches.length, 4);
});

test('invalid or unknown airports and a missing key never call Unsplash', async () => {
  const { photos, unsplash } = setup();
  assert.equal(await photos.get(''), null);
  assert.equal(await photos.get('BK'), null);
  assert.equal(await photos.get('../etc'), null);
  assert.equal(await photos.get('XYZ'), null); // unknown city: no search
  assert.equal(unsplash.searches.length, 0);

  const noKey = setup({ accessKey: '', answers: [{ status: 200, results: [result('a')] }] });
  assert.equal(await noKey.photos.get('BKK'), null);
  assert.equal(noKey.unsplash.searches.length, 0);
});

test('toPhoto skips results without an image URL', () => {
  assert.equal(toPhoto({ user: { name: 'x' } }), null);
  assert.equal(toPhoto(null), null);
  assert.equal(toPhoto({ urls: { full: 'https://images.unsplash.com/f' } }).url, 'https://images.unsplash.com/f');
  assert.equal(toPhoto({ urls: { regular: 'https://images.unsplash.com/r' } }).photographerUrl, '');
});
