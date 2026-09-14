const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http2 = require('node:http2');
const forge = require('node-forge');
const W = require('./walletUpdates');
const { flightPassContent } = require('./flightPass');
const { BR75_BKK_AMS, BCBP_TG403, selfSigned } = require('./passkitFixtures');

const DEPARTURE = Date.parse('2026-09-15T05:15:00Z');
const ARRIVAL = Date.parse('2026-09-15T17:20:00Z');
const MIN = 60_000;
const quiet = { log() {}, warn() {}, error() {} };

/** BR75 with live changes applied, as AeroDataBox would return it. */
function br75({ status = 'Expected', gate = 'E4', depRevised = null, arrTerminal = '', belt = '', aircraft = null } = {}) {
  return {
    ...BR75_BKK_AMS,
    status,
    aircraft: aircraft ? { model: aircraft } : BR75_BKK_AMS.aircraft,
    departure: { ...BR75_BKK_AMS.departure, gate, ...(depRevised ? { revisedTime: depRevised } : {}) },
    arrival: {
      ...BR75_BKK_AMS.arrival,
      ...(arrTerminal ? { terminal: arrTerminal } : {}),
      ...(belt ? { baggageBelt: belt } : {}),
    },
  };
}
const content = raw => flightPassContent(raw, 'BR75');
/** Content as it comes back from JSONB (dates as strings). */
const stored = raw => JSON.parse(JSON.stringify(content(raw)));
const lookupOf = (...legs) => ({ status: 200, text: JSON.stringify(legs) });

test('migration: wallet_registrations with the requested columns, wallet_passes for the pass content', async () => {
  const registrations = W.MIGRATION_SQL.find(sql => /CREATE TABLE IF NOT EXISTS wallet_registrations/.test(sql));
  for (const column of ['id BIGSERIAL PRIMARY KEY', 'flight_number TEXT NOT NULL', 'serial_number TEXT NOT NULL', 'push_token TEXT NOT NULL',
    'device_id TEXT NOT NULL', 'created_at TIMESTAMPTZ', 'last_pushed_at TIMESTAMPTZ']) {
    assert.ok(registrations.includes(column), column);
  }
  assert.match(registrations, /UNIQUE \(device_id, serial_number\)/);
  assert.ok(W.MIGRATION_SQL.some(sql => /CREATE TABLE IF NOT EXISTS wallet_passes/.test(sql)));

  const queries = [];
  await W.createWalletStore({ async query(sql) { queries.push(sql); return { rows: [] }; } }).migrate();
  assert.deepEqual(queries, W.MIGRATION_SQL);
});

test('flight pass texts: gate change, delay, boarding, arrival terminal, landing with belt, belt after landing', () => {
  const base = content(br75());
  assert.deepEqual(W.flightUpdateTexts(base, content(br75())), []);
  assert.deepEqual(W.flightUpdateTexts(base, content(br75({ gate: 'E6' }))), ['Gate changed to E6']);
  assert.deepEqual(W.flightUpdateTexts(content(br75({ gate: '' })), base), ['Gate E4 assigned']);

  const delayed = content(br75({ depRevised: { utc: '2026-09-15 06:05Z', local: '2026-09-15 13:05+07:00' } }));
  assert.equal(delayed.delayMin, 50);
  assert.deepEqual(W.flightUpdateTexts(base, delayed), ['Delayed — now departs 13:05']);

  assert.deepEqual(W.flightUpdateTexts(base, content(br75({ status: 'Boarding', gate: 'E6' }))), ['Gate changed to E6', 'Boarding has started']);
  const boarding = content(br75({ status: 'Boarding' }));
  assert.deepEqual(W.flightUpdateTexts(boarding, boarding), []);

  const enRoute = content(br75({ status: 'Departed' }));
  assert.deepEqual(W.flightUpdateTexts(enRoute, content(br75({ status: 'Departed', arrTerminal: '3' }))), ['Arrival terminal: 3']);
  assert.deepEqual(W.flightUpdateTexts(enRoute, content(br75({ status: 'Arrived' }))), ['Landed']);
  assert.deepEqual(W.flightUpdateTexts(enRoute, content(br75({ status: 'Arrived', belt: 'Belt 12' }))), ['Landed — baggage belt 12']);
  assert.deepEqual(W.flightUpdateTexts(content(br75({ status: 'Arrived' })), content(br75({ status: 'Arrived', belt: '12' }))), ['Baggage belt: 12']);
  assert.deepEqual(W.flightUpdateTexts(content(br75({ status: 'Arrived', belt: 'TBA' })), content(br75({ status: 'Arrived' }))), []);
});

test('applyUpdate: update text becomes the "Latest update" value; other shown fields push silently; unchanged does nothing', () => {
  const row = { pass_kind: 'flight', content: stored(br75()) };
  const gate = W.applyUpdate(row, content(br75({ gate: 'E6' })), DEPARTURE - 60 * MIN);
  assert.equal(gate.changed, true);
  assert.equal(gate.content.statusMessage, 'Gate changed to E6');

  const aircraft = W.applyUpdate({ pass_kind: 'flight', content: gate.content }, content(br75({ gate: 'E6', aircraft: 'Airbus A350' })), DEPARTURE);
  assert.deepEqual([aircraft.changed, aircraft.texts, aircraft.content.statusMessage], [true, [], 'Gate changed to E6']);

  assert.equal(W.applyUpdate(row, content(br75()), DEPARTURE).changed, false);
  // The pickup pass does not show the gate.
  assert.equal(W.applyUpdate({ pass_kind: 'pickup', content: stored(br75()) }, content(br75({ gate: 'E6' })), DEPARTURE).changed, false);
});

test('pickup pass texts: "time to leave" once within 45 min, landed → arrivals hall, baggage belt', () => {
  const flying = br75({ status: 'Departed' });
  let row = { pass_kind: 'pickup', content: stored(flying) };

  const early = W.applyUpdate(row, content(flying), ARRIVAL - 50 * MIN);
  assert.deepEqual([early.changed, early.texts], [false, []]);

  const leave = W.applyUpdate(row, content(flying), ARRIVAL - 44 * MIN);
  assert.deepEqual(leave.texts, ['Flight lands in 44 min — time to leave']);
  assert.equal(leave.content.sent.leave, true);
  row = { pass_kind: 'pickup', content: JSON.parse(JSON.stringify(leave.content)) };
  assert.deepEqual(W.applyUpdate(row, content(flying), ARRIVAL - 39 * MIN).texts, []);

  const landed = W.applyUpdate(row, content(br75({ status: 'Arrived' })), ARRIVAL + 2 * MIN);
  assert.deepEqual(landed.texts, ['Flight landed — walk to arrivals hall']);
  assert.equal(landed.content.sent.leave, true);
  row = { pass_kind: 'pickup', content: JSON.parse(JSON.stringify(landed.content)) };
  const belt = W.applyUpdate(row, content(br75({ status: 'Arrived', belt: '7' })), ARRIVAL + 15 * MIN);
  assert.deepEqual(belt.texts, ['Baggage belt: 7 — passenger collecting bags']);
  assert.equal(belt.content.statusMessage, 'Baggage belt: 7 — passenger collecting bags');

  // Landing with the belt already known: both in one update.
  const both = W.applyUpdate({ pass_kind: 'pickup', content: stored(flying) }, content(br75({ status: 'Arrived', belt: '7' })), ARRIVAL);
  assert.deepEqual(both.texts, ['Flight landed — walk to arrivals hall', 'Baggage belt: 7 — passenger collecting bags']);
  assert.equal(both.content.statusMessage, 'Flight landed — walk to arrivals hall · Baggage belt: 7 — passenger collecting bags');
});

test('sealBarcode / openBarcode: no plain passenger data, wrong key or tampering gives ""; auth token per serial', () => {
  const key = crypto.randomBytes(32);
  const sealed = W.sealBarcode(key, BCBP_TG403);
  assert.ok(!sealed.includes('DOE') && !sealed.includes('ABC123'));
  assert.notEqual(W.sealBarcode(key, BCBP_TG403), sealed);
  assert.equal(W.openBarcode(key, sealed), BCBP_TG403);
  assert.equal(W.openBarcode(crypto.randomBytes(32), sealed), '');
  const [iv, tag, data] = sealed.split('.');
  const flipped = Buffer.from(data, 'base64url');
  flipped[0] ^= 1;
  assert.equal(W.openBarcode(key, [iv, tag, flipped.toString('base64url')].join('.')), '');
  assert.equal(W.openBarcode(key, ''), '');

  const token = W.authenticationToken(key, 'BR75-2026-09-15-BKK');
  assert.ok(token.length >= 16);
  assert.equal(W.authenticationToken(key, 'BR75-2026-09-15-BKK'), token);
  assert.notEqual(W.authenticationToken(key, 'PICKUP-BR75-2026-09-15-BKK'), token);
  assert.equal(W.sameToken(token, token), true);
  assert.equal(W.sameToken(token, `${token}x`), false);
  assert.equal(W.sameToken('', token), false);
});

test('legFromLookup: the stored leg (same date and airport), not whatever is closest to now', () => {
  const nextDay = {
    ...BR75_BKK_AMS,
    departure: { ...BR75_BKK_AMS.departure, gate: 'F1', scheduledTime: { utc: '2026-09-16 05:15Z', local: '2026-09-16 12:15+07:00' } },
  };
  const pass = stored(br75());
  assert.equal(W.legFromLookup(lookupOf(nextDay, br75({ gate: 'E6' })), pass, 'BR75').gate, 'E6');
  assert.equal(W.legFromLookup(lookupOf(nextDay), pass, 'BR75'), null);
  assert.equal(W.legFromLookup({ status: 204, text: '' }, pass, 'BR75'), null);
  assert.equal(W.legFromLookup({ status: 200, text: 'not json' }, pass, 'BR75'), null);
});

test('isFinished and checkIntervalMs: hourly far ahead, 15 min in the last hours or cruising, 5 min around departure/landing', () => {
  const c = stored(br75());
  assert.equal(W.isFinished(c, DEPARTURE), false);
  assert.equal(W.isFinished({ ...c, status: 'cancelled' }, DEPARTURE), true);
  assert.equal(W.isFinished({ ...c, status: 'landed' }, ARRIVAL + 30 * MIN), false);
  assert.equal(W.isFinished({ ...c, status: 'landed' }, ARRIVAL + 91 * MIN), true);
  assert.equal(W.isFinished({ ...c, status: 'landed', baggageBelt: '7' }, ARRIVAL + 5 * MIN), true);
  assert.equal(W.isFinished(c, DEPARTURE + 37 * 60 * MIN), true);

  assert.equal(W.checkIntervalMs(c, 'flight', DEPARTURE - 13 * 60 * MIN), 60 * MIN);
  assert.equal(W.checkIntervalMs(c, 'flight', DEPARTURE - 4 * 60 * MIN), 15 * MIN);
  assert.equal(W.checkIntervalMs(c, 'flight', DEPARTURE - 60 * MIN), 5 * MIN);
  assert.equal(W.checkIntervalMs({ ...c, status: 'enRoute' }, 'flight', DEPARTURE + 60 * MIN), 15 * MIN);
  assert.equal(W.checkIntervalMs({ ...c, status: 'enRoute' }, 'flight', ARRIVAL - 30 * MIN), 5 * MIN);
  // Pickup follows the arrival.
  assert.equal(W.checkIntervalMs(c, 'pickup', DEPARTURE - 60 * MIN), 60 * MIN);
  assert.equal(W.checkIntervalMs(c, 'pickup', ARRIVAL - 60 * MIN), 5 * MIN);
});

function memoryWalletStore(rows) {
  const calls = { prune: 0, updateContent: [] };
  return {
    rows,
    calls,
    async prune() { calls.prune += 1; },
    async registeredPasses() { return rows.map(r => JSON.parse(JSON.stringify(r))); },
    async updateContent(serial, next) {
      calls.updateContent.push(serial);
      rows.find(r => r.serial_number === serial).content = JSON.parse(JSON.stringify(next));
    },
  };
}

test('updater tick: one lookup per flight, changed passes stored and pushed; interval, budget and finished passes respected', async () => {
  const store = memoryWalletStore([
    { serial_number: 'BR75-2026-09-15-BKK', pass_kind: 'flight', flight_number: 'BR75', content: stored(br75()) },
    { serial_number: 'PICKUP-BR75-2026-09-15-BKK', pass_kind: 'pickup', flight_number: 'BR75', content: stored(br75()) },
    { serial_number: 'TG403-2026-09-15-BKK', pass_kind: 'flight', flight_number: 'TG403', content: { ...stored(br75()), status: 'cancelled' } },
  ]);
  let t = DEPARTURE - 75 * MIN;
  let budget = true;
  let leg = br75({ gate: 'E6' });
  const fetched = [];
  const pushes = [];
  const updater = W.createWalletUpdater({
    store,
    fetchFlightStatus: async (number) => { fetched.push(number); return lookupOf(leg); },
    pushWalletUpdate: async (number, changes) => { pushes.push([number, changes]); return { sent: 2 }; },
    canSpend: () => budget,
    now: () => t,
    log: quiet,
  });

  assert.deepEqual(await updater.tick(), { flights: 1, checked: 1, pushed: 2 });
  assert.deepEqual(fetched, ['BR75']);
  assert.deepEqual(store.calls.updateContent, ['BR75-2026-09-15-BKK']);
  assert.deepEqual(pushes, [['BR75', [{ serial: 'BR75-2026-09-15-BKK', kind: 'flight', texts: ['Gate changed to E6'] }]]]);
  assert.equal(store.rows[0].content.statusMessage, 'Gate changed to E6');

  t += 60_000;
  assert.equal((await updater.tick()).checked, 0);
  t += 4 * MIN;
  assert.deepEqual(await updater.tick(), { flights: 1, checked: 1, pushed: 0 });
  assert.equal(pushes.length, 1);

  budget = false;
  leg = br75({ gate: 'E6', status: 'Boarding' });
  t += 5 * MIN;
  assert.equal((await updater.tick()).checked, 0);
  budget = true;
  const round = await updater.tick();
  assert.equal(round.checked, 1);
  assert.deepEqual(pushes[1][1][0].texts, ['Boarding has started']);
  assert.equal(fetched.length, 3);
  assert.equal(store.calls.prune, 5);
});

test('pushWalletUpdate: every device of the flight; gone tokens removed; delivered ones marked', async () => {
  const removed = [];
  const marked = [];
  const store = {
    async pushTokens(number) { assert.equal(number, 'BR75'); return ['aaa', 'bbb', 'ccc', 'ddd']; },
    async removePushToken(token) { removed.push(token); },
    async markPushed(number, tokens) { marked.push([number, tokens]); },
  };
  const responses = {
    aaa: { status: 200, reason: '' },
    bbb: { status: 410, reason: 'Unregistered' },
    ccc: { status: 400, reason: 'BadDeviceToken' },
  };
  const pushWalletUpdate = W.createWalletPush({
    store,
    sendPush: async (token) => { if (!responses[token]) throw new Error('socket hang up'); return responses[token]; },
    log: quiet,
  });
  assert.deepEqual(await pushWalletUpdate('BR75', [{ texts: ['Gate changed to E6'] }]), { devices: 4, sent: 1, failed: 3 });
  assert.deepEqual(removed, ['bbb', 'ccc']);
  assert.deepEqual(marked, [['BR75', ['aaa']]]);
});

/** RSA-2048 identity (PEM) for a local TLS test server or client. */
function tlsIdentity(commonName) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const keys = { privateKey: forge.pki.privateKeyFromPem(privateKey), publicKey: forge.pki.publicKeyFromPem(publicKey) };
  return { cert: forge.pki.certificateToPem(selfSigned(commonName, keys, ['localhost']).cert), key: privateKey };
}

test('APNs sender: HTTP/2 POST /3/device/<token>, topic = pass type, "{}" body, Pass Type ID certificate as TLS client', async () => {
  const serverId = tlsIdentity('localhost');
  const clientId = tlsIdentity('Pass Type ID: pass.test.waiair');
  const seen = [];
  const server = http2.createSecureServer({ ...serverId, requestCert: true, rejectUnauthorized: false });
  server.on('stream', (stream, headers) => {
    let body = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => { body += chunk; });
    stream.on('end', () => {
      const peer = stream.session.socket.getPeerCertificate();
      seen.push({ method: headers[':method'], path: headers[':path'], topic: headers['apns-topic'], body, client: peer.subject.CN });
      if (headers[':path'].endsWith('/gone')) {
        stream.respond({ ':status': 410 });
        stream.end(JSON.stringify({ reason: 'Unregistered' }));
      } else {
        stream.respond({ ':status': 200 });
        stream.end();
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const apns = W.createApnsSender({
    credentials: async () => clientId,
    topic: 'pass.test.waiair',
    host: `https://127.0.0.1:${server.address().port}`,
    connectOptions: { ca: serverId.cert, servername: 'localhost' },
  });
  try {
    const token = 'ab'.repeat(32);
    assert.deepEqual(await apns.send(token), { status: 200, reason: '' });
    assert.deepEqual(await apns.send('gone'), { status: 410, reason: 'Unregistered' });
    assert.deepEqual(seen, [
      { method: 'POST', path: `/3/device/${token}`, topic: 'pass.test.waiair', body: '{}', client: 'Pass Type ID: pass.test.waiair' },
      { method: 'POST', path: '/3/device/gone', topic: 'pass.test.waiair', body: '{}', client: 'Pass Type ID: pass.test.waiair' },
    ]);
  } finally {
    apns.close();
    await new Promise(resolve => server.close(resolve));
  }
});
