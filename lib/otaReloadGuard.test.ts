import assert from 'node:assert/strict';
import { test } from 'node:test';
import { otaUpdateKey, shouldReloadForUpdate } from './otaReloadGuard.ts';

test('OTA reload guard: one reload per update id or rollback, never for nothing', () => {
  const update = { isAvailable: true, isRollBackToEmbedded: false, manifest: { id: '01a0b027-47e3-7365-b057-c261347e9abf' } };
  const key = otaUpdateKey(update, '1.21.0');
  assert.equal(key, '01a0b027-47e3-7365-b057-c261347e9abf');
  assert.equal(shouldReloadForUpdate(key, null), true, 'first time: reload');
  // The update failed to launch and the app is back on the embedded bundle: the same update is offered again.
  assert.equal(shouldReloadForUpdate(key, key), false, 'same update again: no reload loop');
  // A newer update gets its own single reload.
  assert.equal(shouldReloadForUpdate(otaUpdateKey({ ...update, manifest: { id: 'next' } }, '1.21.0'), key), true);

  const rollback = { isAvailable: true, isRollBackToEmbedded: true, manifest: undefined };
  assert.equal(otaUpdateKey(rollback, '1.21.0'), 'rollback:1.21.0');
  assert.equal(shouldReloadForUpdate('rollback:1.21.0', key), true);
  assert.equal(shouldReloadForUpdate('rollback:1.21.0', 'rollback:1.21.0'), false);

  assert.equal(otaUpdateKey({ isAvailable: false, manifest: undefined }, '1.21.0'), '');
  assert.equal(shouldReloadForUpdate('', null), false);
  assert.equal(otaUpdateKey({ isAvailable: true, manifest: {} }, '1.21.0'), '', 'no id: nothing to key on');
});
