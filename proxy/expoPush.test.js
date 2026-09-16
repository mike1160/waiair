const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./expoPush');

const quiet = { log() {}, warn() {}, error() {} };
const TOKEN = 'ExponentPushToken[abc]';
const TOKEN_B = 'ExponentPushToken[xyz]';

function br75({ status = 'Expected', gate = 'E4', delayMin = 0, dest = 'AMS' } = {}) {
  const sched = { utc: '2026-09-15 05:15Z', local: '2026-09-15 12:15+07:00' };
  const revised = delayMin
    ? { utc: `2026-09-15 ${String(5 + Math.floor(delayMin / 60)).padStart(2, '0')}:${String((15 + delayMin) % 60).padStart(2, '0')}Z` }
    : null;
  return {
    number: 'BR75',
    status,
    departure: {
      gate,
      scheduledTime: sched,
      ...(revised ? { revisedTime: { utc: revised.utc, local: revised.utc } } : {}),
    },
    arrival: { airport: { iata: dest, municipalityName: 'Amsterdam' } },
  };
}

function lookupOf(leg) {
  return { status: 200, text: JSON.stringify([leg]) };
}

/** In-memory Postgres stand-in that survives a "Railway restart" (new store, same rows). */
function memoryPool() {
  const tokens = [];
  const state = new Map();
  const tickets = [];
  let id = 1;
  return {
    tokens,
    state,
    tickets,
    async query(sql, params = []) {
      const q = sql.replace(/\s+/g, ' ').trim();
      if (/CREATE TABLE|CREATE INDEX/.test(q)) return { rows: [] };
      if (/INSERT INTO push_tokens/.test(q)) {
        const [token, flight, platform] = params;
        const existing = tokens.find(r => r.expo_token === token && r.flight_number === flight);
        if (existing) {
          existing.platform = platform || existing.platform;
          existing.updated_at = new Date();
        } else {
          tokens.push({
            id: id++,
            expo_token: token,
            flight_number: flight,
            platform,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
        return { rows: [] };
      }
      if (/DELETE FROM push_tokens WHERE expo_token = \$1 AND flight_number = \$2/.test(q)) {
        const keep = tokens.filter(r => !(r.expo_token === params[0] && r.flight_number === params[1]));
        tokens.length = 0;
        tokens.push(...keep);
        return { rows: [] };
      }
      if (/DELETE FROM push_tokens WHERE expo_token = \$1/.test(q)) {
        const keep = tokens.filter(r => r.expo_token !== params[0]);
        tokens.length = 0;
        tokens.push(...keep);
        return { rows: [] };
      }
      if (/DELETE FROM push_tokens WHERE updated_at/.test(q)) return { rows: [] };
      if (/DELETE FROM push_tickets WHERE created_at/.test(q)) return { rows: [] };
      if (/DELETE FROM push_tickets WHERE ticket_id = ANY/.test(q)) {
        const ids = new Set(params[0]);
        const keep = tickets.filter(t => !ids.has(t.ticket_id));
        tickets.length = 0;
        tickets.push(...keep);
        return { rows: [] };
      }
      if (/SELECT DISTINCT expo_token FROM push_tokens/.test(q)) {
        const flight = params[0];
        const set = [...new Set(tokens.filter(r => r.flight_number === flight).map(r => r.expo_token))].sort();
        return { rows: set.map(expo_token => ({ expo_token })) };
      }
      if (/SELECT DISTINCT flight_number FROM push_tokens/.test(q)) {
        const set = [...new Set(tokens.map(r => r.flight_number))].sort();
        return { rows: set.map(flight_number => ({ flight_number })) };
      }
      if (/SELECT flight_number, last_gate/.test(q)) {
        const row = state.get(params[0]);
        return { rows: row ? [row] : [] };
      }
      if (/INSERT INTO push_flight_state/.test(q)) {
        state.set(params[0], {
          flight_number: params[0],
          last_gate: params[1],
          last_delay_min: params[2],
          last_status: params[3],
          last_dest: params[4],
        });
        return { rows: [] };
      }
      if (/INSERT INTO push_tickets/.test(q)) {
        if (!tickets.some(t => t.ticket_id === params[0])) {
          tickets.push({ ticket_id: params[0], expo_token: params[1], created_at: new Date() });
        }
        return { rows: [] };
      }
      if (/SELECT ticket_id, expo_token FROM push_tickets/.test(q)) {
        return { rows: tickets.map(t => ({ ticket_id: t.ticket_id, expo_token: t.expo_token })) };
      }
      throw new Error(`unhandled sql: ${q}`);
    },
  };
}

test('migration: push_tokens has requested columns plus unique token+flight', () => {
  const table = E.MIGRATION_SQL.find(sql => /CREATE TABLE IF NOT EXISTS push_tokens/.test(sql));
  for (const column of [
    'id SERIAL PRIMARY KEY',
    'expo_token TEXT NOT NULL',
    'flight_number TEXT NOT NULL',
    'platform TEXT',
    'created_at TIMESTAMPTZ',
    'updated_at TIMESTAMPTZ',
  ]) {
    assert.ok(table.includes(column), column);
  }
  assert.match(table, /UNIQUE \(expo_token, flight_number\)/);
});

test('store: upsert token+flight, delete one flight, tokens survive a new store (restart)', async () => {
  const pool = memoryPool();
  const store = E.createExpoPushStore(pool);
  await store.migrate();
  await store.register({ token: TOKEN, flightNumber: 'br 75', platform: 'ios' });
  await store.register({ token: TOKEN, flightNumber: 'BR75', platform: 'ios' });
  await store.register({ token: TOKEN_B, flightNumber: 'BR75', platform: 'android' });
  assert.deepEqual(await store.tokensForFlight('BR75'), [TOKEN, TOKEN_B]);
  assert.equal(pool.tokens.length, 2);

  await store.unregister({ token: TOKEN_B, flightNumber: 'BR75' });
  assert.deepEqual(await store.tokensForFlight('BR75'), [TOKEN]);

  const restarted = E.createExpoPushStore(pool);
  assert.deepEqual(await restarted.tokensForFlight('BR75'), [TOKEN]);
  assert.deepEqual(await restarted.listFlights(), ['BR75']);
});

test('detectPushEvents: first snapshot is silent; gate / delay>10 / boarding / landed', () => {
  const next = { flightNumber: 'BR75', gate: 'E6', delayMin: 0, status: 'scheduled', dest: 'AMS' };
  assert.deepEqual(E.detectPushEvents(null, next), []);

  const prev = { last_gate: 'E4', last_delay_min: 0, last_status: 'scheduled', last_dest: 'AMS' };
  const gate = E.detectPushEvents(prev, { ...next, gate: 'E6' });
  assert.equal(gate.length, 1);
  assert.equal(gate[0].title, 'Gate changed');
  assert.equal(gate[0].body, 'Flight BR75: gate changed to E6');

  const stillOnTime = E.detectPushEvents(prev, { ...next, gate: 'E4', delayMin: 8 });
  assert.deepEqual(stillOnTime, []);

  const delayed = E.detectPushEvents(prev, { ...next, gate: 'E4', delayMin: 15 });
  assert.equal(delayed[0].title, 'Flight delayed');
  assert.equal(delayed[0].body, 'Flight BR75 delayed by 15 minutes');

  const alreadyDelayed = E.detectPushEvents(
    { ...prev, last_delay_min: 15 },
    { ...next, gate: 'E4', delayMin: 16 },
  );
  assert.deepEqual(alreadyDelayed, []);

  const boarding = E.detectPushEvents(prev, { ...next, gate: 'E4', status: 'boarding' });
  assert.equal(boarding[0].title, 'Now boarding');
  assert.match(boarding[0].body, /boarding at gate E4/);

  const landed = E.detectPushEvents(
    { ...prev, last_status: 'en-route' },
    { ...next, gate: 'E4', status: 'landed', dest: 'AMS' },
  );
  assert.equal(landed[0].title, 'Landed!');
  assert.equal(landed[0].body, 'Flight BR75 has landed at AMS');
});

test('poller: gate change POSTs Expo Push API for every token of that flight', async () => {
  const pool = memoryPool();
  const store = E.createExpoPushStore(pool);
  await store.register({ token: TOKEN, flightNumber: 'BR75', platform: 'ios' });
  await store.saveState({ flightNumber: 'BR75', gate: 'E4', delayMin: 0, status: 'scheduled', dest: 'AMS' });

  const posts = [];
  const fetchImpl = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body) });
    return { status: 200, text: async () => JSON.stringify({ data: [{ status: 'ok', id: 'ticket-1' }] }) };
  };
  const sender = E.createExpoPushSender({ store, fetchImpl, log: quiet });
  const poller = E.createExpoPushPoller({
    store,
    fetchFlightStatus: async () => lookupOf(br75({ gate: 'E8' })),
    sender,
    log: quiet,
  });
  const result = await poller.tick();
  assert.equal(result.pushed, 1);
  assert.equal(posts[0].url, E.EXPO_PUSH_URL);
  assert.equal(posts[0].body[0].to, TOKEN);
  assert.equal(posts[0].body[0].title, 'Gate changed');
  assert.equal(posts[0].body[0].body, 'Flight BR75: gate changed to E8');
  assert.equal(posts[0].body[0].data.kind, 'gate');
});

test('poller: delay > 10 min, boarding, landed each send the requested copy', async () => {
  async function run(from, to) {
    const pool = memoryPool();
    const store = E.createExpoPushStore(pool);
    await store.register({ token: TOKEN, flightNumber: 'BR75' });
    await store.saveState({ flightNumber: 'BR75', ...from, dest: from.dest || 'AMS' });
    const posts = [];
    const fetchImpl = async (url, init) => {
      if (String(url).includes('push/send')) posts.push(JSON.parse(init.body));
      return { status: 200, text: async () => JSON.stringify({ data: [{ status: 'ok', id: 't' }] }) };
    };
    const sender = E.createExpoPushSender({ store, fetchImpl, log: quiet });
    const poller = E.createExpoPushPoller({
      store,
      fetchFlightStatus: async () => lookupOf(br75(to)),
      sender,
      log: quiet,
    });
    await poller.tick();
    return posts[0][0];
  }

  const delay = await run(
    { gate: 'E4', delayMin: 0, status: 'scheduled' },
    { gate: 'E4', delayMin: 22, status: 'Expected' },
  );
  assert.equal(delay.title, 'Flight delayed');
  assert.equal(delay.body, 'Flight BR75 delayed by 22 minutes');

  const boarding = await run(
    { gate: 'E4', delayMin: 0, status: 'scheduled' },
    { gate: 'E4', status: 'Boarding' },
  );
  assert.equal(boarding.title, 'Now boarding');

  const landed = await run(
    { gate: 'E4', delayMin: 0, status: 'en-route' },
    { gate: 'E4', status: 'Landed', dest: 'AMS' },
  );
  assert.equal(landed.title, 'Landed!');
  assert.match(landed.body, /landed at AMS/);
});

test('receipts: DeviceNotRegistered deletes the token from Postgres', async () => {
  const pool = memoryPool();
  const store = E.createExpoPushStore(pool);
  await store.register({ token: TOKEN, flightNumber: 'BR75' });
  await store.saveTickets([{ ticketId: 'dead', token: TOKEN }]);
  const fetchImpl = async (url) => {
    assert.equal(url, E.EXPO_RECEIPTS_URL);
    return {
      status: 200,
      text: async () => JSON.stringify({
        data: { dead: { status: 'error', details: { error: 'DeviceNotRegistered' } } },
      }),
    };
  };
  const sender = E.createExpoPushSender({ store, fetchImpl, log: quiet });
  const result = await sender.processReceipts();
  assert.equal(result.dropped, 1);
  assert.deepEqual(await store.tokensForFlight('BR75'), []);
});

test('ticket DeviceNotRegistered on send also drops the token', async () => {
  const pool = memoryPool();
  const store = E.createExpoPushStore(pool);
  await store.register({ token: TOKEN, flightNumber: 'BR75' });
  const fetchImpl = async () => ({
    status: 200,
    text: async () => JSON.stringify({
      data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
    }),
  });
  const sender = E.createExpoPushSender({ store, fetchImpl, log: quiet });
  await sender.send('BR75', [{ kind: 'gate', title: 'Gate changed', body: 'Flight BR75: gate changed to E9' }]);
  assert.deepEqual(await store.tokensForFlight('BR75'), []);
});
