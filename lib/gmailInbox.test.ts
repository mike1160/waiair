import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INBOX_FILTERS,
  filterOf,
  ignoreItem,
  inboxBadge,
  inboxList,
  itemsFromQueue,
  linkItem,
  matchesQuery,
  mergeInbox,
  removeItem,
  replaceItem,
  tabCounts,
  tabOf,
  titleOf,
  unlinkItem,
  unprocessed,
  type InboxItem,
} from './gmailInbox.ts';

function item(over: Partial<InboxItem> & { messageId: string }): InboxItem {
  return {
    kind: 'hotel',
    title: '',
    startYmd: '',
    place: '',
    status: 'waiting',
    savedMs: 1_700_000_000_000,
    ...over,
  };
}

const HOTEL = item({
  messageId: 'm-hotel', kind: 'hotel', title: 'Holiday Inn Bangkok',
  startYmd: '2026-10-10', place: 'Bangkok', savedMs: 300,
});
const CAR = item({
  messageId: 'm-car', kind: 'carRental', title: 'Hertz', startYmd: '2026-10-11',
  place: 'Suvarnabhumi Airport', savedMs: 200, status: 'suggested', suggestedFlightKey: 'TG921', matchScore: 65,
});
const DINNER = item({
  messageId: 'm-dinner', kind: 'restaurant', title: 'Gaggan', startYmd: '2026-10-14',
  place: 'Bangkok', savedMs: 100, status: 'linked', linkedToTripKey: 'TG921', linkedBy: 'auto', linkedAt: 500,
});
const FERRY = item({
  messageId: 'm-ferry', kind: 'ferry', title: 'Stena Line', startYmd: '2026-09-01',
  place: 'Hoek van Holland', savedMs: 50, status: 'ignored', ignoredAt: 600,
});

const ALL = [HOTEL, CAR, DINNER, FERRY];

test('a status belongs to exactly one tab, and both unanswered ones share it', () => {
  assert.equal(tabOf('waiting'), 'new');
  assert.equal(tabOf('suggested'), 'new');
  assert.equal(tabOf('linked'), 'linked');
  assert.equal(tabOf('ignored'), 'ignored');
  assert.deepEqual(tabCounts(ALL), { new: 2, linked: 1, ignored: 1 });
  assert.deepEqual(unprocessed(ALL).map(i => i.messageId), ['m-hotel', 'm-car']);
});

test('the envelope counts what still wants an answer, and goes quiet when nothing does', () => {
  assert.deepEqual(inboxBadge(ALL), { kind: 'count', n: 2 });
  assert.deepEqual(inboxBadge([DINNER, FERRY]), { kind: 'dot' }, 'everything dealt with');
  // Never scanned: the envelope claims nothing at all.
  assert.equal(inboxBadge([]), null);
  assert.deepEqual(inboxBadge([], { scanned: true }), { kind: 'dot' });
});

test('each tab shows only its own, newest first', () => {
  assert.deepEqual(inboxList(ALL, { tab: 'new' }).map(i => i.messageId), ['m-hotel', 'm-car']);
  assert.deepEqual(inboxList(ALL, { tab: 'linked' }).map(i => i.messageId), ['m-dinner']);
  assert.deepEqual(inboxList(ALL, { tab: 'ignored' }).map(i => i.messageId), ['m-ferry']);
});

test('sorting by trip date puts the undated last, not first', () => {
  const undated = item({ messageId: 'm-none', savedMs: 900 });
  const list = inboxList([HOTEL, CAR, undated], { tab: 'new', sort: 'tripDate' });
  assert.deepEqual(list.map(i => i.messageId), ['m-hotel', 'm-car', 'm-none']);
  // Newest first is the default, and reads the other way round here.
  assert.deepEqual(
    inboxList([HOTEL, CAR, undated], { tab: 'new' }).map(i => i.messageId),
    ['m-none', 'm-hotel', 'm-car'],
  );
});

test('the filter chips divide every kind between them', () => {
  assert.equal(filterOf('flight'), 'flights');
  assert.equal(filterOf('cabinUpgrade'), 'flights', 'a flight extra belongs with the flight');
  assert.equal(filterOf('lounge'), 'flights');
  assert.equal(filterOf('hotel'), 'hotels');
  assert.equal(filterOf('hostel'), 'stay');
  assert.equal(filterOf('camping'), 'stay');
  assert.equal(filterOf('carRental'), 'transport');
  assert.equal(filterOf('ferry'), 'transport');
  assert.equal(filterOf('restaurant'), 'activities');
  assert.equal(filterOf('diving'), 'activities');
  // Whatever no chip claims is findable under "other" rather than invisible.
  assert.equal(filterOf('insurance'), 'other');
  assert.equal(filterOf('visa'), 'other');
  assert.deepEqual(INBOX_FILTERS[0], 'all');

  assert.deepEqual(inboxList(ALL, { tab: 'new', filter: 'hotels' }).map(i => i.messageId), ['m-hotel']);
  assert.deepEqual(inboxList(ALL, { tab: 'new', filter: 'transport' }).map(i => i.messageId), ['m-car']);
  assert.deepEqual(inboxList(ALL, { tab: 'new', filter: 'activities' }), []);
});

test('search looks at the name, the place and the kind', () => {
  assert.equal(matchesQuery(HOTEL, 'holiday'), true);
  assert.equal(matchesQuery(HOTEL, 'bangkok'), true);
  assert.equal(matchesQuery(HOTEL, 'hotel'), true, 'the kind itself is searchable');
  assert.equal(matchesQuery(HOTEL, 'hertz'), false);
  // Every word has to land, so two words narrow rather than widen.
  assert.equal(matchesQuery(HOTEL, 'holiday bangkok'), true);
  assert.equal(matchesQuery(HOTEL, 'holiday phuket'), false);
  // Accents are folded: a Zürich booking is found by typing zurich.
  assert.equal(matchesQuery(item({ messageId: 'z', place: 'Zürich' }), 'zurich'), true);
  // An empty search hides nothing.
  assert.equal(matchesQuery(FERRY, '   '), true);
  // And the kind can be searched in the app's own language.
  assert.equal(matchesQuery(HOTEL, 'hotels', () => 'Hotels'), true);
});

test('linking records which trip, when, and who decided', () => {
  const linked = linkItem(CAR, 'TG921-2026-10-10', 'manual', 999);
  assert.equal(linked.status, 'linked');
  assert.equal(linked.linkedToTripKey, 'TG921-2026-10-10');
  assert.equal(linked.linkedBy, 'manual');
  assert.equal(linked.linkedAt, 999);
  assert.equal(linked.suggestedFlightKey, 'TG921', 'what the app guessed is still readable');
});

test('ignoring keeps the booking, and it can come back', () => {
  const ignored = ignoreItem(HOTEL, 777);
  assert.equal(ignored.status, 'ignored');
  assert.equal(ignored.ignoredAt, 777);
  assert.equal(ignored.extras, HOTEL.extras, 'nothing is thrown away');

  const back = unlinkItem(ignored);
  assert.equal(back.status, 'waiting');
  assert.equal(back.ignoredAt, undefined);
});

test('unlinking a suggestion returns it as a suggestion, not as a blank', () => {
  // The traveller disagreed with the link, not with the guess behind it.
  const linked = linkItem(CAR, 'TG921', 'auto', 1);
  const back = unlinkItem(linked);
  assert.equal(back.status, 'suggested');
  assert.equal(back.suggestedFlightKey, 'TG921');
  assert.equal(back.linkedToTripKey, undefined);
  assert.equal(back.linkedBy, undefined);
  // A plain waiting booking comes back plain.
  assert.equal(unlinkItem(linkItem(HOTEL, 'X', 'manual', 1)).status, 'waiting');
});

test('one change at a time, and removing means gone', () => {
  const changed = replaceItem(ALL, ignoreItem(HOTEL, 5));
  assert.equal(changed.length, 4);
  assert.equal(changed.find(i => i.messageId === 'm-hotel')?.status, 'ignored');
  assert.equal(changed.find(i => i.messageId === 'm-car')?.status, 'suggested', 'the rest are untouched');
  // An item the list has never seen is added rather than dropped.
  assert.equal(replaceItem(ALL, item({ messageId: 'new-one' })).length, 5);
  assert.deepEqual(removeItem(ALL, 'm-ferry').map(i => i.messageId), ['m-hotel', 'm-car', 'm-dinner']);
});

test('the queue becomes inbox items, with the day and place already read', () => {
  const queue = [
    {
      messageId: 'q1',
      extras: { hotel: { name: 'Holiday Inn Bangkok', address: '123 Sukhumvit Road, Bangkok', checkIn: '2026-10-10' } },
      savedMs: 10,
    },
    {
      messageId: 'q2',
      extras: { carRental: { company: 'Hertz', pickupLocation: 'BKK Airport', pickupTime: '2026-10-10T09:00' } },
      savedMs: 20,
      suggestedFlightKey: 'TG921',
      matchScore: 65,
    },
  ];
  const [hotel, car] = itemsFromQueue(queue);
  assert.equal(hotel.kind, 'hotel');
  assert.equal(hotel.title, 'Holiday Inn Bangkok');
  assert.equal(hotel.startYmd, '2026-10-10');
  assert.equal(hotel.place, 'Bangkok', 'read out of the address');
  assert.equal(hotel.status, 'waiting');

  assert.equal(car.kind, 'carRental');
  assert.equal(car.title, 'Hertz');
  assert.equal(car.status, 'suggested', 'a queued suggestion arrives as one');
  assert.equal(car.suggestedFlightKey, 'TG921');
  assert.equal(car.matchScore, 65);

  // A mail that named nothing says nothing, rather than inventing a title.
  assert.equal(titleOf({}), '');
  assert.deepEqual(itemsFromQueue([]), []);
});

test('the queue wins over an older decision about the same mail', () => {
  // It came back in a later scan, so it is waiting again whatever was once decided.
  const queue = [{ messageId: 'm-dinner', extras: { restaurant: { name: 'Gaggan', dateTime: '2026-10-14' } }, savedMs: 9 }];
  const merged = mergeInbox(queue, [DINNER, FERRY]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(i => i.messageId === 'm-dinner')?.status, 'waiting');
  assert.equal(merged.find(i => i.messageId === 'm-ferry')?.status, 'ignored');
  // Decisions about mails no longer queued are kept.
  assert.deepEqual(mergeInbox([], [DINNER]).map(i => i.status), ['linked']);
});
