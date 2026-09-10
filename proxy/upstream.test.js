const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  UPSTREAM_TIMEOUT_MS,
  FIDS_RESULT_CAP,
  fetchWithAbort,
  isUpstreamTimeout,
  fidsDaySlices,
  utcWindowSlices,
  mergeFidsBodies,
  mergeJsonArrays,
  pruneTtlMap,
  ttlGet,
  ttlSet,
} = require('./upstream.js');

function abortingHang(_url, opts) {
  return new Promise((_, reject) => {
    const signal = opts && opts.signal;
    if (!signal) return;
    const fail = () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      reject(err);
    };
    if (signal.aborted) fail();
    else signal.addEventListener('abort', fail, { once: true });
  });
}

test('fetchWithAbort times out a hung upstream and yields 504', async () => {
  await assert.rejects(
    () => fetchWithAbort('https://example.invalid/hang', {}, 40, abortingHang),
    (e) => isUpstreamTimeout(e) && e.status === 504 && e.code === 'UPSTREAM_TIMEOUT',
  );
});

test('fetchWithAbort maps a thrown network error to 502', async () => {
  await assert.rejects(
    () => fetchWithAbort('https://example.invalid/fail', {}, 200, async () => {
      throw new Error('ECONNRESET');
    }),
    (e) => e.status === 502 && e.code === 'UPSTREAM_FAILED',
  );
});

test('full-day FIDS is two 12h slices and merge caps total results', () => {
  const slices = fidsDaySlices('2026-09-09');
  assert.equal(slices.length, 2);
  assert.match(slices[0].from, /00:00/);
  assert.match(slices[1].to, /23:59/);

  const flight = (n) => ({
    number: `VN${n}`,
    movement: { scheduledTime: { utc: `2026-09-09T${String(n % 24).padStart(2, '0')}:00:00Z` } },
  });
  const morning = JSON.stringify({ arrivals: Array.from({ length: 900 }, (_, i) => flight(i)) });
  const afternoon = JSON.stringify({ arrivals: Array.from({ length: 900 }, (_, i) => flight(i + 900)) });
  const merged = JSON.parse(mergeFidsBodies([morning, afternoon], 'Arrival', 1000));
  assert.equal(merged.arrivals.length, 1000);
  assert.equal(FIDS_RESULT_CAP, 1500);
});

test('36h window splits into 12h slices and aircraft merge caps', () => {
  const to = new Date('2026-09-09T15:00:00Z');
  const from = new Date(to.getTime() - 36 * 3600000);
  const slices = utcWindowSlices(from, to, 12);
  assert.equal(slices.length, 3);
  const span = slices[slices.length - 1].to.getTime() - slices[0].from.getTime();
  assert.equal(span, 36 * 3600000);

  const parts = [
    JSON.stringify(Array.from({ length: 800 }, (_, i) => ({ number: `A${i}`, departure: { scheduledTime: { utc: `2026-09-08T${i}` } } }))),
    JSON.stringify(Array.from({ length: 800 }, (_, i) => ({ number: `B${i}`, departure: { scheduledTime: { utc: `2026-09-09T${i}` } } }))),
  ];
  const merged = JSON.parse(mergeJsonArrays(parts, 1000));
  assert.equal(merged.length, 1000);
});

test('TTL maps drop expired entries so FIDS/aircraft caches cannot grow unbounded', () => {
  const map = new Map();
  ttlSet(map, 'a', { at: 1000, text: 'old' }, 30_000, 1000);
  ttlSet(map, 'b', { at: 2000, text: 'newer' }, 30_000, 2000);
  assert.equal(ttlGet(map, 'a', 30_000, 20_000).text, 'old');
  assert.equal(ttlGet(map, 'a', 30_000, 32_000), undefined);
  assert.equal(map.has('a'), false);
  pruneTtlMap(map, 30_000, 40_000);
  assert.equal(map.size, 0);
  assert.equal(UPSTREAM_TIMEOUT_MS, 15_000);
});
