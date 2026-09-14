const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CREATE_TABLE_SQL,
  TRACK_MAX_AGE_MS,
  statusFromLookup,
  statusChangedText,
  createTrackedFlights,
  createFlightTracker,
} = require('./trackedFlights');

const NOW = Date.parse('2026-09-14T09:00:00Z');

function flight(status) {
  return JSON.stringify([{
    number: 'TG 403',
    status,
    airline: { name: 'Thai Airways' },
    departure: {
      airport: { iata: 'BKK', municipalityName: 'Bangkok' },
      scheduledTime: { utc: '2026-09-14 04:05Z', local: '2026-09-14 11:05+07:00' },
    },
    arrival: {
      airport: { iata: 'SIN', municipalityName: 'Singapore' },
      scheduledTime: { utc: '2026-09-14 07:30Z', local: '2026-09-14 15:30+08:00' },
    },
  }]);
}

/** Records queries; SELECT COUNT answers `count`. */
function fakePool(count = 0) {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return { rows: /COUNT/.test(sql) ? [{ n: count }] : [] };
    },
  };
}

/** In-memory stand-in for createTrackedFlights. */
function memoryStore(rows) {
  const calls = { expire: [], update: [] };
  return {
    rows,
    calls,
    async expire(before) { calls.expire.push(before); },
    async listActive() { return rows.filter(r => r.active !== false).map(r => ({ ...r })); },
    async update(id, status, active) {
      calls.update.push([id, status, active]);
      Object.assign(rows.find(r => r.id === id), { last_status: status, active });
    },
  };
}

function setupTracker({ rows, lookups = {}, pushStatuses = [], canSpend, languages = {} }) {
  const store = memoryStore(rows);
  const fetched = [];
  const pushes = [];
  const errors = [];
  const warnings = [];
  const tracker = createFlightTracker({
    store,
    fetchFlightStatus: async (number) => {
      fetched.push(number);
      const answer = lookups[number];
      if (answer instanceof Error) throw answer;
      return answer || { status: 204, text: '' };
    },
    push: async (to, messages) => {
      const status = pushStatuses.shift() || 200;
      if (status !== 200) throw new Error(`line_push_${status}`);
      pushes.push({ to, text: messages[0].text });
    },
    preferences: { getLanguage: async (id) => languages[id] || 'th' },
    canSpend,
    now: () => NOW,
    log: { warn: (...a) => warnings.push(a.join(' ')), error: (...a) => errors.push(a.join(' ')) },
  });
  return { tracker, store, fetched, pushes, errors, warnings };
}

test('migrate creates tracked_flights (one row per LINE user + flight) and an index on active rows', async () => {
  const pool = fakePool();
  await createTrackedFlights(pool).migrate();
  assert.equal(pool.queries.length, 2);
  assert.match(pool.queries[0].sql, /CREATE TABLE IF NOT EXISTS tracked_flights \( id BIGSERIAL PRIMARY KEY, line_user_id TEXT NOT NULL, flight_number TEXT NOT NULL, last_status TEXT, last_checked TIMESTAMPTZ,/);
  assert.match(pool.queries[0].sql, /UNIQUE \(line_user_id, flight_number\)/);
  assert.match(pool.queries[1].sql, /CREATE INDEX IF NOT EXISTS tracked_flights_active_idx .* WHERE active/);
  assert.equal(CREATE_TABLE_SQL.includes('notify_token'), false);
});

test('store: track upserts with the baseline status, countActive skips the same flight, expire takes a cutoff', async () => {
  const pool = fakePool(3);
  const store = createTrackedFlights(pool);
  await store.track('U1', 'TG403', 'enRoute');
  assert.match(pool.queries[0].sql, /ON CONFLICT \(line_user_id, flight_number\) DO UPDATE SET last_status = EXCLUDED\.last_status, last_checked = NOW\(\), active = TRUE/);
  assert.deepEqual(pool.queries[0].params, ['U1', 'TG403', 'enRoute']);
  assert.equal(await store.countActive('U1', 'TG403'), 3);
  assert.match(pool.queries[1].sql, /WHERE line_user_id = \$1 AND active AND flight_number <> \$2/);
  const cutoff = new Date(NOW);
  await store.expire(cutoff);
  assert.deepEqual(pool.queries[2].params, [cutoff]);
  await store.update(7, 'landed', false);
  assert.deepEqual(pool.queries[3].params, [7, 'landed', false]);
  await assert.rejects(store.track('', 'TG403', 'scheduled'), /missing_line_user_id/);
});

test('statusFromLookup: STRINGS.status key for a found flight, empty otherwise', () => {
  assert.equal(statusFromLookup({ status: 200, text: flight('EnRoute') }, NOW), 'enRoute');
  assert.equal(statusFromLookup({ status: 200, text: flight('Arrived') }, NOW), 'landed');
  assert.equal(statusFromLookup({ status: 200, text: '[]' }, NOW), '');
  assert.equal(statusFromLookup({ status: 204, text: '' }, NOW), '');
  assert.equal(statusFromLookup({ status: 500, text: 'oops' }, NOW), '');
  assert.equal(statusFromLookup({ status: 200, text: 'not json' }, NOW), '');
  assert.equal(statusFromLookup({ error: new Error('rate_limited') }, NOW), '');
});

test('statusChangedText in English and Thai', () => {
  assert.equal(statusChangedText('TG403', 'enRoute', 'landed', 'en'), '✈️ TG403 — status changed: En Route → Landed');
  assert.equal(statusChangedText('TG403', 'enRoute', 'landed', 'th'), '✈️ TG403 — สถานะเปลี่ยน: กำลังเดินทาง → ลงจอดแล้ว');
  assert.equal(statusChangedText('TG403', 'enRoute', 'landed'), statusChangedText('TG403', 'enRoute', 'landed', 'th'));
});

test('tick: one lookup per flight, push only on a change, final status ends tracking', async () => {
  const { tracker, store, fetched, pushes } = setupTracker({
    rows: [
      { id: 1, line_user_id: 'Uen', flight_number: 'TG403', last_status: 'enRoute' },
      { id: 2, line_user_id: 'Uth', flight_number: 'TG403', last_status: 'enRoute' },
      { id: 3, line_user_id: 'Usame', flight_number: 'TG403', last_status: 'landed' },
      { id: 4, line_user_id: 'Uen', flight_number: 'FD3001', last_status: 'scheduled' },
    ],
    lookups: { TG403: { status: 200, text: flight('Arrived') }, FD3001: { status: 200, text: flight('Expected') } },
    languages: { Uen: 'en' },
  });
  const result = await tracker.tick();
  assert.deepEqual(fetched, ['TG403', 'FD3001']);
  assert.deepEqual(pushes, [
    { to: 'Uen', text: '✈️ TG403 — status changed: En Route → Landed' },
    { to: 'Uth', text: '✈️ TG403 — สถานะเปลี่ยน: กำลังเดินทาง → ลงจอดแล้ว' },
  ]);
  assert.deepEqual(store.calls.update, [[1, 'landed', false], [2, 'landed', false], [3, 'landed', false], [4, 'scheduled', true]]);
  assert.deepEqual(result, { flights: 2, checked: 2, pushed: 2 });
  assert.deepEqual(store.calls.expire, [new Date(NOW - TRACK_MAX_AGE_MS)]);

  // Landed rows are inactive now: the next round only checks FD3001.
  fetched.length = 0;
  await tracker.tick();
  assert.deepEqual(fetched, ['FD3001']);
  assert.equal(pushes.length, 2);
});

test('tick: a failed push keeps last_status so the next round retries; failed lookups change nothing', async () => {
  const { tracker, store, pushes, errors } = setupTracker({
    rows: [
      { id: 1, line_user_id: 'U1', flight_number: 'TG403', last_status: 'boarding' },
      { id: 2, line_user_id: 'U2', flight_number: 'FD3001', last_status: 'scheduled' },
    ],
    lookups: { TG403: { status: 200, text: flight('Departed') }, FD3001: new Error('upstream_timeout') },
    pushStatuses: [429],
  });
  await tracker.tick();
  assert.deepEqual(store.calls.update, []);
  assert.equal(store.rows[0].last_status, 'boarding');
  assert.equal(errors.length, 2);
  assert.match(errors[0], /push failed: TG403 line_push_429/);
  assert.match(errors[1], /lookup failed: FD3001 upstream_timeout/);

  await tracker.tick();
  assert.deepEqual(pushes, [{ to: 'U1', text: '✈️ TG403 — สถานะเปลี่ยน: กำลังขึ้นเครื่อง → กำลังเดินทาง' }]);
  assert.deepEqual(store.calls.update, [[1, 'enRoute', true]]);
});

test('tick: stops calling AeroDataBox when the hour budget is low, and never overlaps itself', async () => {
  const low = setupTracker({
    rows: [{ id: 1, line_user_id: 'U1', flight_number: 'TG403', last_status: 'scheduled' }],
    lookups: { TG403: { status: 200, text: flight('Departed') } },
    canSpend: () => false,
  });
  assert.deepEqual(await low.tracker.tick(), { flights: 1, checked: 0, pushed: 0 });
  assert.deepEqual(low.fetched, []);
  assert.match(low.warnings[0], /budget low — 1 flights wait/);

  let release;
  const slow = createFlightTracker({
    store: memoryStore([{ id: 1, line_user_id: 'U1', flight_number: 'TG403', last_status: 'scheduled' }]),
    fetchFlightStatus: () => new Promise((resolve) => { release = () => resolve({ status: 204, text: '' }); }),
    push: async () => {},
    now: () => NOW,
  });
  const first = slow.tick();
  await new Promise(r => setImmediate(r));
  assert.deepEqual(await slow.tick(), { skipped: 'running' });
  release();
  assert.deepEqual(await first, { flights: 1, checked: 1, pushed: 0 });
});
