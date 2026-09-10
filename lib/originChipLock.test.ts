import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  flightSearchOriginLock,
  originChipDisplayIata,
  originChipUnlocksOnClear,
} from './originChipLock.ts';

test('type KL777 with results locks chip to AMS; clear field unlocks to previous origin', () => {
  const previous = 'BKK';
  assert.equal(originChipUnlocksOnClear(''), true);
  assert.equal(originChipUnlocksOnClear('KL777'), false);

  assert.deepEqual(
    flightSearchOriginLock({ query: 'KL777', flightNumber: 'KL777', lookedUp: false, hitOrigin: 'AMS', hitCount: 1 }),
    { lock: false },
  );
  assert.deepEqual(
    flightSearchOriginLock({ query: 'KL777', flightNumber: 'KL777', lookedUp: true, hitOrigin: 'AMS', hitCount: 0 }),
    { lock: false },
  );

  const locked = flightSearchOriginLock({
    query: 'KL777',
    flightNumber: 'KL777',
    lookedUp: true,
    hitOrigin: 'AMS',
    hitCount: 1,
  });
  assert.deepEqual(locked, { lock: true, iata: 'AMS' });
  assert.equal(
    originChipDisplayIata({ locked: true, lockedIata: 'AMS', previousOrigin: previous }),
    'AMS',
  );

  const cleared = flightSearchOriginLock({ query: '', flightNumber: 'KL777', lookedUp: true, hitOrigin: 'AMS', hitCount: 1 });
  assert.deepEqual(cleared, { lock: false });
  assert.equal(
    originChipDisplayIata({ locked: false, lockedIata: 'AMS', parsedOrigin: '', previousOrigin: previous }),
    'BKK',
  );
});

test('place search does not lock the origin chip', () => {
  assert.deepEqual(
    flightSearchOriginLock({ query: 'seoul', lookedUp: true, hitOrigin: 'ICN', hitCount: 3 }),
    { lock: false },
  );
  assert.equal(
    originChipDisplayIata({
      locked: false,
      parsedOrigin: 'NRT',
      needsOrigin: false,
      previousOrigin: 'BKK',
    }),
    'NRT',
  );
});
