const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./familyPush');

const quiet = { log() {}, warn() {}, error() {} };
const TOKEN_A = 'ExponentPushToken[aaa]';
const TOKEN_B = 'ExponentPushToken[bbb]';

/** Minimal Express stand-in: records the routes, then lets a test call one. */
function fakeApp() {
  const routes = new Map();
  const app = {
    put: (path, h) => routes.set(`PUT ${path}`, h),
    get: (path, h) => routes.set(`GET ${path}`, h),
    post: (path, h) => routes.set(`POST ${path}`, h),
  };
  async function call(method, path, { body = {}, params = {} } = {}) {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `no route for ${method} ${path}`);
    let code = 200;
    let payload;
    const res = {
      status(c) { code = c; return res; },
      json(p) { payload = p; return res; },
    };
    await handler({ body, params }, res);
    return { status: code, body: payload };
  }
  return { app, call, routes };
}

/** Expo Push stand-in. `tickets` decides what each message gets back. */
function fakeExpo(tickets = null) {
  const calls = [];
  async function fetchImpl(url, init) {
    const messages = JSON.parse(init.body);
    calls.push({ url, messages });
    const data = tickets
      ? tickets.slice(0, messages.length)
      : messages.map(() => ({ status: 'ok', id: 'tick' }));
    return { status: 200, async json() { return { data }; } };
  }
  return { fetchImpl, calls };
}

/** A fixed point in 2027, so a fixture is never accidentally already expired against the wall clock. */
const BASE_MS = Date.UTC(2027, 2, 13, 9, 0, 0);

function shareBody(over = {}) {
  const createdMs = BASE_MS;
  return {
    flightKey: 'kl875',
    token: 'tok123456789',
    createdMs,
    expiresMs: createdMs + F.SHARE_TTL_MS,
    travelerName: 'Sarah',
    ...over,
  };
}

async function wired(opts = {}) {
  // Every share lives on the same clock as the fixtures, unless a test drives its own.
  const store = F.createFamilyShareStore({ now: opts.now || (() => BASE_MS) });
  const expo = fakeExpo(opts.tickets);
  const sender = F.createFamilyPushSender({ store, fetchImpl: expo.fetchImpl, log: quiet });
  const { app, call } = fakeApp();
  F.registerFamilyPushRoutes(app, { store, sender, log: quiet });
  return { store, sender, expo, call };
}

// ── PUT /family-share ────────────────────────────────────────────────────────

test('PUT /family-share stores the record and echoes only the public fields', async () => {
  const { call } = await wired();
  const r = await call('PUT', '/family-share', { body: shareBody() });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.flightKey, 'kl875');
  assert.equal(r.body.travelerName, 'Sarah');
  assert.equal('followers' in r.body, false, 'follower list never comes back');
});

test('PUT /family-share needs a token', async () => {
  const { call } = await wired();
  const r = await call('PUT', '/family-share', { body: { flightKey: 'kl875' } });
  assert.equal(r.status, 400);
});

test('PUT /family-share cannot extend its own expiry past the 8-day window', async () => {
  const { store, call } = await wired();
  const createdMs = BASE_MS;
  await call('PUT', '/family-share', {
    body: shareBody({ createdMs, expiresMs: createdMs + 365 * 24 * 3600 * 1000 }),
  });
  const rec = await store.get('tok123456789');
  assert.equal(rec.expiresMs, createdMs + F.SHARE_TTL_MS);
});

test('PUT /family-share on an existing token keeps the followers already registered', async () => {
  const { store, call } = await wired();
  await call('PUT', '/family-share', { body: shareBody() });
  await call('POST', '/family-share/:token/follow', {
    params: { token: 'tok123456789' },
    body: { pushToken: TOKEN_A, name: 'Mum' },
  });
  await call('PUT', '/family-share', { body: shareBody({ travelerName: 'Sarah K' }) });
  const rec = await store.get('tok123456789');
  assert.equal(rec.followers.length, 1, 'a re-upload must not wipe the followers');
  assert.equal(rec.travelerName, 'Sarah K');
});

// ── GET /family-share/:token ─────────────────────────────────────────────────

test('GET /family-share/:token returns the public record and never a push token', async () => {
  const { call } = await wired();
  await call('PUT', '/family-share', { body: shareBody() });
  await call('POST', '/family-share/:token/follow', {
    params: { token: 'tok123456789' },
    body: { pushToken: TOKEN_A },
  });
  const r = await call('GET', '/family-share/:token', { params: { token: 'tok123456789' } });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['expiresMs', 'flightKey', 'travelerName']);
  assert.equal(JSON.stringify(r.body).includes('ExponentPushToken'), false);
});

test('GET /family-share/:token is a 404 for an unknown or expired share', async () => {
  let clock = BASE_MS;
  const { call } = await wired({ now: () => clock });
  assert.equal((await call('GET', '/family-share/:token', { params: { token: 'nope' } })).status, 404);

  await call('PUT', '/family-share', { body: shareBody({ createdMs: clock }) });
  assert.equal((await call('GET', '/family-share/:token', { params: { token: 'tok123456789' } })).status, 200);
  clock += F.SHARE_TTL_MS + 1;
  assert.equal(
    (await call('GET', '/family-share/:token', { params: { token: 'tok123456789' } })).status,
    404,
    'a share stops answering the moment it expires',
  );
});

// ── POST /family-share/:token/follow ─────────────────────────────────────────

test('follow registers a device, and the same device twice stays one follower', async () => {
  const { store, call } = await wired();
  await call('PUT', '/family-share', { body: shareBody() });
  const p = { params: { token: 'tok123456789' } };
  assert.equal((await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: TOKEN_A, name: 'Mum' } })).status, 200);
  assert.equal((await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: TOKEN_A, name: 'Mama' } })).status, 200);
  const rec = await store.get('tok123456789');
  assert.equal(rec.followers.length, 1);
  assert.equal(rec.followers[0].name, 'Mama');
});

test('follow rejects a bad push token, an unknown share, and a flood of followers', async () => {
  const { call } = await wired();
  await call('PUT', '/family-share', { body: shareBody() });
  const p = { params: { token: 'tok123456789' } };
  assert.equal((await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: 'nope' } })).status, 400);
  assert.equal(
    (await call('POST', '/family-share/:token/follow', { params: { token: 'ghost' }, body: { pushToken: TOKEN_A } })).status,
    404,
  );
  for (let i = 0; i < F.MAX_FOLLOWERS; i++) {
    await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: `ExponentPushToken[f${i}]` } });
  }
  const over = await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: 'ExponentPushToken[over]' } });
  assert.equal(over.status, 429, 'a leaked link cannot become a broadcast list');
});

// ── POST /family-push ────────────────────────────────────────────────────────

test('family-push fans one moment out to every follower', async () => {
  const { call, expo } = await wired();
  await call('PUT', '/family-share', { body: shareBody() });
  const p = { params: { token: 'tok123456789' } };
  await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: TOKEN_A, name: 'Mum' } });
  await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: TOKEN_B, name: 'Dad' } });

  const r = await call('POST', '/family-push', {
    body: {
      token: 'tok123456789',
      momentKind: 'landed',
      title: 'Sarah has landed in Bangkok',
      body: '✈️ Local time: 06:35',
      urgent: false,
    },
  });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.followers, r.body.sent, r.body.failed], [2, 2, 0]);
  assert.equal(expo.calls.length, 1);
  const msgs = expo.calls[0].messages;
  assert.deepEqual(msgs.map(m => m.to), [TOKEN_A, TOKEN_B]);
  assert.equal(msgs[0].title, 'Sarah has landed in Bangkok');
  assert.equal(msgs[0].data.kind, 'landed');
  assert.equal(msgs[0].data.flightKey, 'kl875');
});

test('family-push: urgent interrupts with a sound, ordinary does not', async () => {
  const { call, expo } = await wired();
  await call('PUT', '/family-share', { body: shareBody() });
  await call('POST', '/family-share/:token/follow', {
    params: { token: 'tok123456789' }, body: { pushToken: TOKEN_A },
  });

  await call('POST', '/family-push', {
    body: { token: 'tok123456789', momentKind: 'hotel_arrived', title: 't', body: 'b', urgent: false },
  });
  assert.equal(expo.calls[0].messages[0].priority, 'normal');
  assert.equal('sound' in expo.calls[0].messages[0], false);

  await call('POST', '/family-push', {
    body: { token: 'tok123456789', momentKind: 'connection_risk', title: 't', body: 'b', urgent: true },
  });
  assert.equal(expo.calls[1].messages[0].priority, 'high');
  assert.equal(expo.calls[1].messages[0].sound, 'default');
});

test('family-push: no followers sends nothing, unknown share is a 404', async () => {
  const { call, expo } = await wired();
  await call('PUT', '/family-share', { body: shareBody() });
  const none = await call('POST', '/family-push', {
    body: { token: 'tok123456789', momentKind: 'landed', title: 't', body: 'b' },
  });
  assert.equal(none.status, 200);
  assert.equal(none.body.sent, 0);
  assert.equal(expo.calls.length, 0, 'no followers, no call to Expo');

  const ghost = await call('POST', '/family-push', {
    body: { token: 'ghost', momentKind: 'landed', title: 't', body: 'b' },
  });
  assert.equal(ghost.status, 404);

  assert.equal((await call('POST', '/family-push', { body: {} })).status, 400);
});

test('family-push: a device that uninstalled stops being a follower', async () => {
  const { store, call } = await wired({
    tickets: [
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok', id: 'tick' },
    ],
  });
  await call('PUT', '/family-share', { body: shareBody() });
  const p = { params: { token: 'tok123456789' } };
  await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: TOKEN_A } });
  await call('POST', '/family-share/:token/follow', { ...p, body: { pushToken: TOKEN_B } });

  const r = await call('POST', '/family-push', {
    body: { token: 'tok123456789', momentKind: 'landed', title: 't', body: 'b' },
  });
  assert.equal(r.body.sent, 1);
  const rec = await store.get('tok123456789');
  assert.deepEqual(rec.followers.map(f => f.pushToken), [TOKEN_B]);
});

test('family-push survives Expo being down without throwing', async () => {
  const store = F.createFamilyShareStore();
  const sender = F.createFamilyPushSender({
    store,
    fetchImpl: async () => { throw new Error('network down'); },
    log: quiet,
  });
  const { app, call } = fakeApp();
  F.registerFamilyPushRoutes(app, { store, sender, log: quiet });
  await call('PUT', '/family-share', { body: shareBody() });
  await call('POST', '/family-share/:token/follow', {
    params: { token: 'tok123456789' }, body: { pushToken: TOKEN_A },
  });
  const r = await call('POST', '/family-push', {
    body: { token: 'tok123456789', momentKind: 'landed', title: 't', body: 'b' },
  });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.sent, r.body.failed], [0, 1]);
});

// ── the store itself ─────────────────────────────────────────────────────────

test('expired shares are purged rather than lingering in memory', async () => {
  let clock = BASE_MS;
  const store = F.createFamilyShareStore({ now: () => clock });
  await store.put(shareBody({ createdMs: clock }));
  assert.equal(store.size(), 1);
  clock += F.SHARE_TTL_MS + 1;
  store.purge();
  assert.equal(store.size(), 0);
});

test('publicShare never carries followers or push tokens', () => {
  const pub = F.publicShare({
    flightKey: 'kl875',
    token: 'tok',
    expiresMs: 5,
    travelerName: 'Sarah',
    followers: [{ pushToken: TOKEN_A }],
  });
  assert.deepEqual(pub, { flightKey: 'kl875', travelerName: 'Sarah', expiresMs: 5 });
  assert.equal(JSON.stringify(pub).includes('ExponentPushToken'), false);
});
