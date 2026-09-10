import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOME_FIDS_TIMEOUT_MS, TimeoutError, withTimeout } from './net.ts';

test('home FIDS lookups share a 20s budget including body read', async () => {
  assert.equal(HOME_FIDS_TIMEOUT_MS, 20000);
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 20),
    (e: unknown) => e instanceof TimeoutError || (e as { name?: string })?.name === 'TimeoutError',
  );
});
