import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCAN_DAYS_DEFAULT,
  classifyKind,
  filterImported,
  gmailQuery,
  groupItems,
  itemFromMetadata,
  matchesTravel,
  senderDomain,
  senderName,
  truncateSubject,
  type GmailInboxItem,
} from './gmailInboxScan.ts';

test('gmail query covers the window, the travel senders and the subject keywords', () => {
  const q = gmailQuery(SCAN_DAYS_DEFAULT);
  assert.match(q, /newer_than:90d/);
  assert.match(q, /from:\(.*booking\.com.*agoda\.co\.th.*\)/);
  assert.match(q, /subject:\(.*"booking confirmation".*"pick-up confirmation".*\)/);
  assert.match(gmailQuery(365), /newer_than:365d/);
});

test('sender header → domain and display name', () => {
  assert.equal(senderDomain('"Booking.com" <noreply@booking.com>'), 'booking.com');
  assert.equal(senderDomain('mail@news.klm.com'), 'klm.com', 'subdomains map to the known domain');
  assert.equal(senderName('"Agoda" <no-reply@agoda.co.th>'), 'Agoda');
  assert.equal(senderName('no-reply@hertz.com'), 'hertz.com', 'no display name: the domain');
  assert.equal(senderDomain('broken'), '');
});

test('travel mail is recognised by sender domain or subject keyword', () => {
  assert.equal(matchesTravel('x@booking.com', 'Anything'), true);
  assert.equal(matchesTravel('x@unknown.org', 'Your booking confirmation'), true);
  assert.equal(matchesTravel('x@unknown.org', 'Bevestiging van je reis'), true);
  assert.equal(matchesTravel('x@unknown.org', 'Weekly newsletter'), false);
});

test('kind comes from the sender, else from a subject keyword', () => {
  assert.equal(classifyKind('x@thaiairways.com', 'Anything'), 'flight');
  assert.equal(classifyKind('x@agoda.com', 'Anything'), 'hotel');
  assert.equal(classifyKind('x@sixt.com', 'Anything'), 'carRental');
  assert.equal(classifyKind('x@unknown.org', 'Your e-ticket for TG922'), 'flight');
  assert.equal(classifyKind('x@unknown.org', 'Hotel confirmation'), 'hotel');
  assert.equal(classifyKind('x@unknown.org', 'Your rental in Phuket'), 'carRental');
  assert.equal(classifyKind('x@unknown.org', 'Reservation confirmed'), '', 'travel, but the kind is unknown');
});

test('metadata headers become one results item; non-travel and unknown-kind mail is dropped', () => {
  const item = itemFromMetadata('m1', [
    { name: 'From', value: '"Thai Airways" <no-reply@thaiairways.com>' },
    { name: 'Subject', value: 'Your e-ticket TG922 BKK-FRA' },
    { name: 'Date', value: 'Wed, 16 Sep 2026 08:00:00 +0700' },
  ], '1789000000000');
  assert.deepEqual(
    [item?.id, item?.kind, item?.sender, item?.senderDomain, item?.dateMs],
    ['m1', 'flight', 'Thai Airways', 'thaiairways.com', 1789000000000],
  );
  // internalDate missing: the Date header is used.
  const fallback = itemFromMetadata('m2', [
    { name: 'From', value: 'x@booking.com' },
    { name: 'Subject', value: 'Booking confirmation' },
    { name: 'Date', value: 'Wed, 16 Sep 2026 08:00:00 +0000' },
  ], null);
  assert.equal(fallback?.dateMs, Date.parse('Wed, 16 Sep 2026 08:00:00 +0000'));
  assert.equal(itemFromMetadata('m3', [{ name: 'From', value: 'x@unknown.org' }, { name: 'Subject', value: 'Hi' }], '1'), null);
  assert.equal(itemFromMetadata('', [{ name: 'From', value: 'x@booking.com' }], '1'), null);
});

test('imported ids are filtered out, groups are ordered and newest first', () => {
  const mk = (id: string, kind: GmailInboxItem['kind'], dateMs: number): GmailInboxItem =>
    ({ id, kind, sender: 's', senderDomain: 'd', subject: 's', dateMs });
  const items = [mk('a', 'hotel', 2), mk('b', 'flight', 1), mk('c', 'flight', 3), mk('d', 'carRental', 4)];
  assert.deepEqual(filterImported(items, ['a']).map(i => i.id), ['b', 'c', 'd']);
  assert.deepEqual(filterImported(items, new Set(['b', 'c'])).map(i => i.id), ['a', 'd']);
  assert.deepEqual(groupItems(items).map(g => [g.kind, g.items.map(i => i.id)]), [
    ['flight', ['c', 'b']],
    ['hotel', ['a']],
    ['carRental', ['d']],
  ]);
  assert.deepEqual(groupItems([mk('a', 'hotel', 1)]).map(g => g.kind), ['hotel'], 'empty groups are left out');
});

test('subject lines are truncated for the results row', () => {
  assert.equal(truncateSubject('short subject'), 'short subject');
  const long = 'Your booking confirmation for Bangkok, Thailand — 4 nights';
  assert.ok(truncateSubject(long).length <= 40, truncateSubject(long));
  assert.ok(truncateSubject(long).length >= 38, 'trailing spaces trimmed, not a short cut');
  assert.match(truncateSubject(long), /…$/);
});
