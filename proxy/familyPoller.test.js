/**
 * Family Safety Mode — the poll round that releases follower moments when their time comes.
 * The proxy is the authoritative clock: the device can queue a moment but cannot schedule a remote push.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./familyPush');
const E = require('./expoPush');

const quiet = { log() {}, warn() {}, error() {} };
const TOKEN_A = 'ExponentPushToken[aaa]';
const TOKEN_B = 'ExponentPushToken[bbb]';
const SHARE = 'tok123456789';
const BASE_MS = Date.UTC(2027, 2, 13, 9, 0, 0);
const MIN = 60 * 1000;

function fakeExpo(tickets = null) {
  const calls = [];
  async function fetchImpl(url, init) {
    const messages = JSON.parse(init.body);
    calls.push({ messages });
    const data = tickets
      ? tickets.slice(0, messages.length)
      : messages.map(() => ({ status: 'ok', id: 'tick' }));
    return { status: 200, async json() { return { data }; } };
  }
  return { fetchImpl, calls };
}

/** A share with two followers and whatever moments the test queues. */
async function wired({ clock = { t: BASE_MS }, followers = [TOKEN_A, TOKEN_B], expiresMs } = {}) {
  const store = F.createFamilyShareStore({ now: () => clock.t });
  const expo = fakeExpo();
  const sender = F.createFamilyPushSender({ store, fetchImpl: expo.fetchImpl, log: quiet });
  await store.put({
    flightKey: 'kl875',
    token: SHARE,
    createdMs: BASE_MS,
    expiresMs: expiresMs ?? BASE_MS + F.SHARE_TTL_MS,
    travelerName: 'Sarah',
  });
  for (const f of followers) await store.follow(SHARE, f);
  return { store, sender, expo, clock };
}

function moment(key, triggerMs, over = {}) {
  return { key, kind: 'landed', triggerMs, title: `title ${key}`, body: `body ${key}`, urgent: false, ...over };
}

// ── the four cases ───────────────────────────────────────────────────────────

test('a moment due inside the window is sent to every follower', async () => {
  const { store, sender, expo, clock } = await wired();
  await store.putMoments(SHARE, [moment('m1', BASE_MS + 4 * MIN)]);

  const result = await sender.releaseDue(clock.t);
  assert.equal(result.considered, 1);
  assert.equal(result.sent, 2, 'both followers');
  assert.equal(expo.calls.length, 1);
  assert.deepEqual(expo.calls[0].messages.map(m => m.to), [TOKEN_A, TOKEN_B]);
  assert.equal(expo.calls[0].messages[0].title, 'title m1');
});

test('a moment still half an hour away is left alone', async () => {
  const { store, sender, expo, clock } = await wired();
  await store.putMoments(SHARE, [moment('m1', BASE_MS + 30 * MIN)]);

  const result = await sender.releaseDue(clock.t);
  assert.equal(result.considered, 0);
  assert.equal(expo.calls.length, 0);

  // ... and goes out on the round that reaches it.
  clock.t = BASE_MS + 25 * MIN;
  const later = await sender.releaseDue(clock.t);
  assert.equal(later.considered, 1);
  assert.equal(expo.calls.length, 1);
});

test('a moment already sent is never sent a second time', async () => {
  const { store, sender, expo, clock } = await wired();
  await store.putMoments(SHARE, [moment('m1', BASE_MS + 1 * MIN)]);

  assert.equal((await sender.releaseDue(clock.t)).considered, 1);
  assert.equal(expo.calls.length, 1);
  assert.equal(store.wasSent(SHARE, 'm1'), true);

  // Three more poll rounds, including after the trigger has passed.
  for (const t of [BASE_MS + 5 * MIN, BASE_MS + 10 * MIN, BASE_MS + 60 * MIN]) {
    clock.t = t;
    assert.equal((await sender.releaseDue(t)).considered, 0);
  }
  assert.equal(expo.calls.length, 1, 'still exactly one push');

  // Re-uploading the same queue must not resurrect it either.
  await store.putMoments(SHARE, [moment('m1', BASE_MS + 1 * MIN)]);
  assert.equal((await sender.releaseDue(clock.t)).considered, 0);
  assert.equal(expo.calls.length, 1);
});

test('an expired share is skipped, and its queue goes with it', async () => {
  const clock = { t: BASE_MS };
  const { store, sender, expo } = await wired({ clock, expiresMs: BASE_MS + 10 * MIN });
  await store.putMoments(SHARE, [moment('m1', BASE_MS + 20 * MIN)]);

  clock.t = BASE_MS + 30 * MIN;
  const result = await sender.releaseDue(clock.t);
  assert.equal(result.shares, 0, 'the share is gone');
  assert.equal(result.considered, 0);
  assert.equal(expo.calls.length, 0);
  assert.equal(await store.get(SHARE), null);
});

// ── the rest of the round ────────────────────────────────────────────────────

test('a share with no followers queues fine but sends nothing', async () => {
  const { store, sender, expo, clock } = await wired({ followers: [] });
  await store.putMoments(SHARE, [moment('m1', BASE_MS)]);
  const result = await sender.releaseDue(clock.t);
  assert.equal(result.considered, 0);
  assert.equal(expo.calls.length, 0);
  assert.equal(store.wasSent(SHARE, 'm1'), false, 'not burned — it can still go out once someone follows');
});

test('several due moments go out oldest first, each exactly once', async () => {
  const { store, sender, expo, clock } = await wired({ followers: [TOKEN_A] });
  await store.putMoments(SHARE, [
    moment('late', BASE_MS + 5 * MIN),
    moment('early', BASE_MS - 10 * MIN),
    moment('far', BASE_MS + 90 * MIN),
  ]);
  const result = await sender.releaseDue(clock.t);
  assert.equal(result.considered, 2, 'the far one waits');
  assert.deepEqual(expo.calls.map(c => c.messages[0].title), ['title early', 'title late']);
});

test('queueing needs a share that exists, and replaces what was there', async () => {
  const { store } = await wired();
  await assert.rejects(() => store.putMoments('ghost', [moment('m1', BASE_MS)]), /unknown_share/);

  assert.equal((await store.putMoments(SHARE, [moment('a', BASE_MS), moment('b', BASE_MS)])).queued, 2);
  assert.equal((await store.putMoments(SHARE, [moment('c', BASE_MS)])).queued, 1, 'replaced, not merged');
  assert.deepEqual((await store.dueMoments(SHARE, BASE_MS)).map(m => m.key), ['c']);

  // Rubbish in the payload is dropped rather than queued.
  assert.equal((await store.putMoments(SHARE, [{ key: '', triggerMs: 1 }, { key: 'x' }, null])).queued, 0);
});

test('the sent-set forgets entries older than a day, so it cannot grow for ever', async () => {
  const clock = { t: BASE_MS };
  const { store, sender } = await wired({ clock, followers: [TOKEN_A] });
  await store.putMoments(SHARE, [moment('m1', BASE_MS)]);
  await sender.releaseDue(clock.t);
  assert.equal(store.sentSize(), 1);

  clock.t = BASE_MS + F.SENT_RETENTION_MS + MIN;
  store.purge();
  assert.equal(store.sentSize(), 0);
});

test('urgent still interrupts when released by the poller', async () => {
  const { store, sender, expo, clock } = await wired({ followers: [TOKEN_A] });
  await store.putMoments(SHARE, [
    moment('risk', BASE_MS, { kind: 'connection_risk', urgent: true }),
  ]);
  await sender.releaseDue(clock.t);
  assert.equal(expo.calls[0].messages[0].priority, 'high');
  assert.equal(expo.calls[0].messages[0].sound, 'default');
  assert.equal(expo.calls[0].messages[0].data.kind, 'connection_risk');
});

// ── the hook into the flight poller ──────────────────────────────────────────

test('the expoPush poller calls the follower round once per tick', async () => {
  const seen = [];
  const poller = E.createExpoPushPoller({
    store: {
      async prune() {}, async listFlights() { return []; },
      async getState() { return null; }, async saveState() {},
    },
    fetchFlightStatus: async () => ({ status: 200, text: '[]' }),
    sender: { async send() { return { sent: 0 }; }, async processReceipts() { return {}; } },
    now: () => BASE_MS,
    log: quiet,
    followerTick: async (at) => { seen.push(at); return { considered: 1, sent: 2 }; },
  });
  const round = await poller.tick();
  assert.deepEqual(seen, [BASE_MS]);
  assert.deepEqual(round.followers, { considered: 1, sent: 2 });
});

test('a follower round that throws does not break the flight round', async () => {
  const poller = E.createExpoPushPoller({
    store: {
      async prune() {}, async listFlights() { return []; },
      async getState() { return null; }, async saveState() {},
    },
    fetchFlightStatus: async () => ({ status: 200, text: '[]' }),
    sender: { async send() { return { sent: 0 }; }, async processReceipts() { return {}; } },
    now: () => BASE_MS,
    log: quiet,
    followerTick: async () => { throw new Error('expo down'); },
  });
  const round = await poller.tick();
  assert.equal(round.error, undefined, 'the round still completes');
  assert.equal(round.followers, null);
});
