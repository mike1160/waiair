import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  markNotifyAsked,
  markNotifyResolved,
  notifySnapshot,
  resetNotifyState,
} from './notifyPermissionState.ts';

test('[W/14] nothing asked yet reads as unknown', () => {
  resetNotifyState();
  assert.deepEqual(notifySnapshot(1000), { phase: 'unknown', waitedMs: 0 });
});

test('[W/14] a question that has not come back shows how long it has been open', () => {
  // The case this exists for: the system dialog is up, or stuck behind a full-screen modal.
  resetNotifyState();
  markNotifyAsked(1000);
  assert.deepEqual(notifySnapshot(1000), { phase: 'pending', waitedMs: 0 });
  assert.deepEqual(notifySnapshot(9500), { phase: 'pending', waitedMs: 8500 });
});

test('[W/14] an answer records how long it took', () => {
  resetNotifyState();
  markNotifyAsked(1000);
  markNotifyResolved(true, 2400);
  assert.deepEqual(notifySnapshot(99999), { phase: 'granted', waitedMs: 1400 });
});

test('[W/14] the boolean the caller already has maps to granted or denied', () => {
  resetNotifyState();
  markNotifyAsked(0);
  markNotifyResolved(false, 120);
  assert.equal(notifySnapshot(500).phase, 'denied');
  markNotifyAsked(0);
  markNotifyResolved('error', 30);
  assert.equal(notifySnapshot(500).phase, 'error');
});

test('[W/14] an answer without a question does not invent a duration', () => {
  resetNotifyState();
  markNotifyResolved(true, 5000);
  assert.deepEqual(notifySnapshot(6000), { phase: 'granted', waitedMs: 0 });
});

test('[W/14] a second question replaces the first', () => {
  resetNotifyState();
  markNotifyAsked(1000);
  markNotifyResolved(true, 1500);
  markNotifyAsked(9000);
  assert.deepEqual(notifySnapshot(9750), { phase: 'pending', waitedMs: 750 });
});
