import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUBSCRIPTION_TIMEOUT_MS,
  restoreNoteFor,
  withSubscriptionTimeout,
} from './subscriptionAction.ts';

const NO_WAIT = { timeoutMs: 1, sleep: async () => {} };

test('[W/18] a native promise that never resolves still settles, so busy cannot stick', () => {
  // The whole bug in one test: this used to leave `finally` unreached and both buttons disabled for good.
  return withSubscriptionTimeout(() => new Promise(() => {}), NO_WAIT).then(outcome => {
    assert.equal(outcome.kind, 'timeout');
  });
});

test('[W/18] a normal result comes through untouched', async () => {
  const outcome = await withSubscriptionTimeout(async () => ({ ok: true }), { timeoutMs: 5000 });
  assert.deepEqual(outcome, { kind: 'done', value: { ok: true } });
});

test('[W/18] a throw is an outcome, not an escape', async () => {
  // A real deadline here on purpose: NO_WAIT resolves the timeout instantly and would win the race.
  const outcome = await withSubscriptionTimeout(
    async () => { throw new Error('presentation failed'); },
    { timeoutMs: 5000 },
  );
  assert.equal(outcome.kind, 'failed');
  assert.equal((outcome as { error: Error }).error.message, 'presentation failed');
});

test('[W/18] fifteen seconds, and the deadline is injectable', () => {
  assert.equal(SUBSCRIPTION_TIMEOUT_MS, 15000);
});

test('[W/18] "no previous purchases" is its own visible answer, not a failure', () => {
  assert.equal(restoreNoteFor({ kind: 'done', value: { ok: false, message: 'No previous purchases found' } }), 'none');
  assert.equal(restoreNoteFor({ kind: 'done', value: { ok: false, message: 'no PREVIOUS purchases' } }), 'none');
});

test('[W/18] a purchase without an active entitlement is partial, which the traveller can act on', () => {
  assert.equal(
    restoreNoteFor({ kind: 'done', value: { ok: false, message: 'Purchases found, but entitlement "pro" is not active.' } }),
    'partial',
  );
  assert.equal(restoreNoteFor({ kind: 'done', value: { ok: false, message: 'Credits available: 4.' } }), 'partial');
});

test('[W/18] success, failure and timeout each have their own note', () => {
  assert.equal(restoreNoteFor({ kind: 'done', value: { ok: true } }), 'restored');
  assert.equal(restoreNoteFor({ kind: 'failed', error: new Error('x') }), 'failed');
  assert.equal(restoreNoteFor({ kind: 'timeout' }), 'timeout');
});

test('[W/18] a result with no message at all is a failure, never silence', () => {
  assert.equal(restoreNoteFor({ kind: 'done', value: { ok: false } }), 'failed');
  assert.equal(restoreNoteFor({ kind: 'done', value: { ok: false, message: '' } }), 'failed');
  assert.equal(restoreNoteFor({ kind: 'done', value: null as never }), 'failed');
});
