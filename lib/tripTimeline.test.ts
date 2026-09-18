import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasCarRow, hasHotelRow, tripTimelineRows, tripTimelineSlots } from './tripTimeline.ts';

const FLIGHT = { depIso: '2026-09-20T12:25', originCity: 'Bangkok', originIata: 'BKK' };

test('the departure row always leads, with the city and its time', () => {
  const rows = tripTimelineRows(FLIGHT);
  assert.deepEqual(rows, [{ kind: 'outbound', iso: '2026-09-20T12:25', title: 'Bangkok' }]);
  assert.deepEqual(tripTimelineRows({ originIata: 'BKK' }), [{ kind: 'outbound', iso: undefined, title: 'BKK' }]);
  assert.deepEqual(tripTimelineRows({}), [], 'no flight data: no rows');
});

test('hotel and car rental only get a row when they hold something', () => {
  assert.equal(hasHotelRow({ hotel: { name: 'Holiday Inn Bangkok' } }), true);
  assert.equal(hasHotelRow({ hotel: { address: 'Silom Road' } }), true);
  assert.equal(hasHotelRow({ hotel: {} }), false);
  assert.equal(hasHotelRow({}), false);
  assert.equal(hasHotelRow(null), false);
  assert.equal(hasCarRow({ carRental: { company: 'Hertz' } }), true);
  assert.equal(hasCarRow({ carRental: { pickupLocation: 'BKK T1' } }), true);
  assert.equal(hasCarRow({ carRental: {} }), false);
});

test('the return flight is the last row; hotel and car keep their own cards', () => {
  const rows = tripTimelineRows({
    ...FLIGHT,
    extras: { hotel: { name: 'Holiday Inn Bangkok' }, carRental: { company: 'Hertz' } },
    returnFlightNumber: 'TG923',
    returnIso: '2026-09-27T18:00',
  });
  assert.deepEqual(rows.map(r => r.kind), ['outbound', 'return']);
  assert.deepEqual(rows[1], { kind: 'return', iso: '2026-09-27T18:00', title: 'TG923' });
});

test('empty slots become invites; a filled slot has none', () => {
  assert.deepEqual(tripTimelineSlots(FLIGHT), ['hotel', 'return']);
  assert.deepEqual(tripTimelineSlots({ ...FLIGHT, extras: { hotel: { name: 'Holiday Inn' } } }), ['return']);
  assert.deepEqual(tripTimelineSlots({ ...FLIGHT, returnFlightNumber: 'TG923' }), ['hotel']);
  assert.deepEqual(
    tripTimelineSlots({ ...FLIGHT, extras: { hotel: { name: 'H' } }, returnFlightNumber: 'TG923' }),
    [],
    'nothing missing: no invites',
  );
});
