import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SYNC_FIRST_RUN_DAYS,
  SYNC_INTERVAL_MS,
  shouldRunGmailSync,
  syncNotification,
  syncScanDays,
  type SyncNotificationCopy,
} from './gmailAutoSyncRules.ts';
import type { GmailInboxItem } from './gmailInboxScan.ts';

const NOW = 1_800_000_000_000;
const PRO = { isPro: true, connected: true, autoSyncOn: true, now: NOW };

const COPY: SyncNotificationCopy = {
  gmailSyncFoundTitle: '✈️ New travel email found',
  gmailSyncFoundOne: (s: string) => `${s} added to your trip`,
  gmailSyncFoundMany: (n: number) => `${n} new travel emails`,
};

const item = (id: string, sender: string): GmailInboxItem =>
  ({ id, kind: 'hotel', sender, senderDomain: 'booking.com', subject: 'Booking confirmation', dateMs: NOW });

test('the sync runs for a connected Pro user with the toggle on, once a day', () => {
  assert.equal(shouldRunGmailSync({ ...PRO, lastSyncMs: null }), true, 'never run before');
  assert.equal(shouldRunGmailSync({ ...PRO, lastSyncMs: NOW - SYNC_INTERVAL_MS }), true, 'exactly a day');
  assert.equal(shouldRunGmailSync({ ...PRO, lastSyncMs: NOW - SYNC_INTERVAL_MS + 1000 }), false, 'too soon');
  assert.equal(shouldRunGmailSync({ ...PRO, lastSyncMs: NOW - 60_000 }), false);
});

test('free users, a disconnected inbox and the toggle off never sync', () => {
  assert.equal(shouldRunGmailSync({ ...PRO, isPro: false, lastSyncMs: null }), false, 'free: manual only');
  assert.equal(shouldRunGmailSync({ ...PRO, connected: false, lastSyncMs: null }), false);
  assert.equal(shouldRunGmailSync({ ...PRO, autoSyncOn: false, lastSyncMs: null }), false);
});

test('a last-sync stamp in the future is treated as due, not as never again', () => {
  assert.equal(shouldRunGmailSync({ ...PRO, lastSyncMs: NOW + 5 * SYNC_INTERVAL_MS }), true);
  assert.equal(syncScanDays(NOW + SYNC_INTERVAL_MS, NOW), SYNC_FIRST_RUN_DAYS);
});

test('the scan window covers everything since the last sync', () => {
  assert.equal(syncScanDays(null, NOW), 90, 'first run');
  assert.equal(syncScanDays(NOW - SYNC_INTERVAL_MS, NOW), 1);
  assert.equal(syncScanDays(NOW - 3.2 * SYNC_INTERVAL_MS, NOW), 4, 'rounded up');
  assert.equal(syncScanDays(NOW - 400 * SYNC_INTERVAL_MS, NOW), 90, 'capped');
  assert.equal(syncScanDays(NOW - 1000, NOW), 1, 'never less than a day');
});

test('nothing new means no notification at all', () => {
  assert.equal(syncNotification([], COPY), null);
});

test('one find names it; several are counted', () => {
  assert.deepEqual(syncNotification([item('m1', 'Holiday Inn Bangkok')], COPY), {
    title: '✈️ New travel email found',
    body: 'Holiday Inn Bangkok added to your trip',
  });
  assert.deepEqual(syncNotification([item('m1', 'Booking.com'), item('m2', 'Agoda')], COPY), {
    title: '✈️ New travel email found',
    body: '2 new travel emails',
  });
  const nameless = { ...item('m3', ''), subject: '' } as GmailInboxItem;
  assert.equal(syncNotification([nameless], COPY)?.body, '1 new travel emails', 'no name: fall back to the count');
});
