const test = require('node:test');
const assert = require('node:assert/strict');
const { createInflight } = require('./inflight');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('parallel requests for the same board share one fetch; the key is free again afterwards', async () => {
  const joinedKeys = [];
  const inflight = createInflight({ onJoin: (key) => joinedKeys.push(key) });
  const gate = deferred();
  let fetches = 0;
  const fetchBoard = () => { fetches += 1; return gate.promise; };

  const key = 'flights-HKG-2026-09-14-Arrival';
  const a = inflight.run(key, fetchBoard);
  const b = inflight.run(key, fetchBoard);
  const c = inflight.run(key, fetchBoard);
  const other = inflight.run('flights-HKG-2026-09-14-Departure', async () => { fetches += 1; return 'dep'; });
  assert.deepEqual(inflight.stats(), { started: 2, joined: 2, pending: 2 });

  gate.resolve('arr');
  assert.deepEqual(await Promise.all([a, b, c, other]), ['arr', 'arr', 'arr', 'dep']);
  assert.equal(fetches, 2);
  assert.deepEqual(joinedKeys, [key, key]);
  assert.equal(inflight.stats().pending, 0);

  await inflight.run(key, fetchBoard);
  assert.equal(fetches, 3);
  assert.deepEqual(inflight.stats(), { started: 3, joined: 2, pending: 0 });
});

test('an upstream failure reaches every joiner, and the next request tries again', async () => {
  const inflight = createInflight();
  const gate = deferred();
  let fetches = 0;
  const fetchBoard = () => { fetches += 1; return gate.promise; };
  const a = inflight.run('k', fetchBoard);
  const b = inflight.run('k', fetchBoard);
  gate.reject(new Error('upstream_timeout'));
  await assert.rejects(a, /upstream_timeout/);
  await assert.rejects(b, /upstream_timeout/);
  assert.equal(fetches, 1);
  assert.equal(await inflight.run('k', async () => { fetches += 1; return 'ok'; }), 'ok');
  assert.equal(fetches, 2);
});

test('a non-shareable error (the starter\'s own budget limit) makes a joiner run its own fetch', async () => {
  const inflight = createInflight();
  const gate = deferred();
  const limit = Object.assign(new Error('Try again in 59 minutes.'), { code: 'rate_limited', status: 429 });
  const isShareable = (e) => e.code !== 'rate_limited';
  const starter = inflight.run('k', () => gate.promise, { shareError: isShareable });
  let ownFetches = 0;
  const joiner = inflight.run('k', async () => { ownFetches += 1; return 'joiner board'; }, { shareError: isShareable });
  gate.reject(limit);
  await assert.rejects(starter, /59 minutes/);
  assert.equal(await joiner, 'joiner board');
  assert.equal(ownFetches, 1);
});

test('a synchronous throw inside fn is a rejection, not a crash, and frees the key', async () => {
  const inflight = createInflight();
  await assert.rejects(inflight.run('k', () => { throw new Error('boom'); }), /boom/);
  assert.equal(inflight.stats().pending, 0);
});
