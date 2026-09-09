import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DETAIL_IDENTITY_HOST,
  atDestinationLeadLanding,
  beforeDepartureCollapsed,
  detailJourneyPhase,
  detailJourneySectionOrder,
} from './detailJourney.ts';

test('section order snapshot for a pre-departure flight', () => {
  const phase = detailJourneyPhase({ status: 'scheduled' });
  assert.equal(phase, 'pre_departure');
  assert.deepEqual(detailJourneySectionOrder(phase), [
    'yourTimes',
    'actions',
    'beforeDeparture',
    'atDestination',
    'extras',
  ]);
  assert.equal(beforeDepartureCollapsed(phase), false);
  assert.equal(atDestinationLeadLanding(phase), false);
});

test('section order snapshot for a landed flight', () => {
  const phase = detailJourneyPhase({ status: 'landed' });
  assert.equal(phase, 'landed');
  assert.deepEqual(detailJourneySectionOrder(phase), [
    'yourTimes',
    'actions',
    'atDestination',
    'beforeDeparture',
    'extras',
  ]);
  assert.equal(beforeDepartureCollapsed(phase), true);
  assert.equal(atDestinationLeadLanding(phase), true);
});

test('in flight: YourTimes then AtDestination above BeforeDeparture', () => {
  const phase = detailJourneyPhase({ status: 'en-route', livePhase: 'enRoute' });
  assert.equal(phase, 'in_flight');
  assert.deepEqual(detailJourneySectionOrder(phase), [
    'yourTimes',
    'actions',
    'atDestination',
    'beforeDeparture',
    'extras',
  ]);
  assert.equal(beforeDepartureCollapsed(phase), false);
});

test('no duplicate flight identity on the page', () => {
  assert.equal(DETAIL_IDENTITY_HOST, 'hero');
  for (const phase of ['pre_departure', 'in_flight', 'landed'] as const) {
    const ids = detailJourneySectionOrder(phase);
    assert.equal(ids.includes('identity' as never), false);
    assert.equal(ids.includes('headRow' as never), false);
    assert.equal(new Set(ids).size, ids.length);
  }
});
