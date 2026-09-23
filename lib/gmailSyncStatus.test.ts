import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GMAIL_RECENT_MS, describeWaiting, formatSyncMoment, gmailBadgeFor, isSyncStatus } from './gmailSyncStatus.ts';

test('a stored sync status is only trusted when it has a real moment', () => {
  assert.equal(isSyncStatus({ ms: 1758300000000, found: 3 }), true);
  assert.equal(isSyncStatus({ ms: 0, found: 3 }), false);
  assert.equal(isSyncStatus({ found: 3 }), false);
  assert.equal(isSyncStatus(null), false);
});

test('the moment is shown in the day and month of the app language', () => {
  const ms = Date.UTC(2026, 8, 19, 7, 14);
  assert.match(formatSyncMoment(ms, 'en'), /19 Sep/);
  assert.match(formatSyncMoment(ms, 'nl'), /19 sep/);
  assert.equal(formatSyncMoment(0, 'en'), '');
});

test('waiting bookings become one line each, newest first, with the day they start', () => {
  const lines = describeWaiting([
    {
      messageId: 'm1',
      savedMs: 100,
      extras: { hotel: { name: 'Holiday Inn Bangkok', checkIn: '2026-10-21T14:00:00' } },
    },
    {
      messageId: 'm2',
      savedMs: 200,
      extras: { carRental: { company: 'Sixt', pickupTime: '2026-10-22T09:00:00' } },
    },
  ]);
  assert.deepEqual(lines.map(l => [l.messageId, l.kind, l.title, l.startYmd]), [
    ['m2', 'carRental', 'Sixt', '2026-10-22'],
    ['m1', 'hotel', 'Holiday Inn Bangkok', '2026-10-21'],
  ]);
});

test('a booking with neither a name nor a date is not listed: there is nothing to show or attach', () => {
  const lines = describeWaiting([
    { messageId: 'empty', savedMs: 1, extras: { hotel: { confirmationRef: 'ABC12345' } } },
    { messageId: 'dated', savedMs: 2, extras: { hotel: { checkIn: '2026-12-01' } } },
  ]);
  assert.deepEqual(lines.map(l => l.messageId), ['dated']);
  assert.equal(lines[0].title, '', 'a date with no name is still worth showing');
});

test('the envelope badge: a count when the scan found something, a dot when it recently found nothing', () => {
  const now = 1758300000000;
  assert.deepEqual(gmailBadgeFor({ ms: now - 60_000, found: 3 }, now), { kind: 'count', found: 3 });
  assert.deepEqual(gmailBadgeFor({ ms: now - 60_000, found: 0 }, now), { kind: 'dot' });
  // An old scan that found nothing says nothing.
  assert.equal(gmailBadgeFor({ ms: now - GMAIL_RECENT_MS - 1, found: 0 }, now), null);
  // A count stays, however old the scan is: those mails are still waiting.
  assert.deepEqual(gmailBadgeFor({ ms: now - 30 * GMAIL_RECENT_MS, found: 2 }, now), { kind: 'count', found: 2 });
  assert.equal(gmailBadgeFor(null, now), null);
  assert.equal(gmailBadgeFor({ ms: 0, found: 1 } as never, now), null, 'a status without a moment is not trusted');
});
