const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  UPSTREAM_TIMEOUT_MS,
  FIDS_RESULT_CAP,
  billedFetch,
  fetchWithAbort,
  flightNumberUrl,
  flightSearchDate,
  isUpstreamTimeout,
  fidsDaySlices,
  utcWindowSlices,
  mergeFidsBodies,
  mergeJsonArrays,
  pruneTtlMap,
  ttlGet,
  ttlSet,
} = require('./upstream.js');

test('flight search date: only real YYYY-MM-DD days reach AeroDataBox; no date keeps the undated live call', () => {
  assert.equal(flightSearchDate('2026-09-24'), '2026-09-24');
  for (const bad of ['', undefined, '2026-9-24', '24-09-2026', '2026-02-30', '2026-09-24T10:00', 'tomorrow', '2026-09-24/../x']) {
    assert.equal(flightSearchDate(bad), '', String(bad));
  }
  assert.equal(
    flightNumberUrl('TG922', '2026-09-24'),
    'https://aerodatabox.p.rapidapi.com/flights/number/TG922/2026-09-24?withAircraftImage=false&withLocation=true&withFlightPlan=false',
  );
  assert.equal(
    flightNumberUrl('EK373'),
    'https://aerodatabox.p.rapidapi.com/flights/number/EK373?withAircraftImage=false&withLocation=true&withFlightPlan=false',
  );
  assert.equal(flightNumberUrl('SQ731', 'bad'), flightNumberUrl('SQ731'));
});

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

test('over the cap, codeshares are dropped before evening operator flights', () => {
  const row = (n, hour, codeshareStatus, iata) => ({
    number: `KL ${n}`,
    codeshareStatus,
    movement: { airport: { iata }, scheduledTime: { local: `2026-09-15 ${String(hour).padStart(2, '0')}:00+02:00` } },
  });
  // Morning slice full of codeshares; the Seoul flight only exists in the evening slice.
  const morning = JSON.stringify({ departures: [
    ...Array.from({ length: 6 }, (_, i) => row(100 + i, 8, 'IsCodeshared', 'LHR')),
    row(1, 9, 'IsOperator', 'LHR'),
  ] });
  const evening = JSON.stringify({ departures: [
    row(855, 20, 'IsOperator', 'ICN'),
    row(900, 21, 'IsCodeshared', 'ICN'),
  ] });
  const { departures } = JSON.parse(mergeFidsBodies([morning, evening], 'Departure', 5));
  assert.equal(departures.length, 5);
  assert.ok(departures.some((f) => f.number === 'KL 855'), 'evening operator flight survives the cap');
  assert.ok(departures.some((f) => f.number === 'KL 1'));
  assert.deepEqual(departures.map((f) => f.number).slice(0, 3), ['KL 100', 'KL 101', 'KL 102'], 'order kept');

  // Under the cap nothing is dropped.
  assert.equal(JSON.parse(mergeFidsBodies([morning, evening], 'Departure', 50)).departures.length, 9);
  // Operators alone over the cap still respect it.
  assert.equal(JSON.parse(mergeFidsBodies([morning, evening], 'Departure', 1)).departures.length, 1);
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

test('billedFetch: budget check, then the log hook, then the fetch; a refused call neither logs nor fetches', async () => {
  const order = [];
  const res = await billedFetch('https://adb/fids', { headers: { a: '1' } }, {
    acquire: () => order.push('acquire'),
    onBilled: () => order.push('log'),
    fetch: async (url, opts) => { order.push(`fetch ${url} ${opts.headers.a}`); return { status: 200, text: '[]' }; },
  });
  assert.deepEqual(order, ['acquire', 'log', 'fetch https://adb/fids 1']);
  assert.deepEqual(res, { status: 200, text: '[]' });

  const refused = [];
  const limit = Object.assign(new Error('Try again in 59 minutes.'), { code: 'rate_limited' });
  await assert.rejects(billedFetch('https://adb/fids', {}, {
    acquire: () => { throw limit; },
    onBilled: () => refused.push('log'),
    fetch: async () => { refused.push('fetch'); },
  }), /59 minutes/);
  assert.deepEqual(refused, []);
});
