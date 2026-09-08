import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifySearchInput,
  createMemorySink,
  daysBeforeDeparture,
  getLoggedEvents,
  initAnalytics,
  isAllowedFlightAddedSource,
  isAllowedJourneyPhase,
  isAllowedMode,
  isAllowedModuleId,
  isAllowedSearchInputType,
  isOnTravelDay,
  mapLiveBoardPhase,
  pickTravelDayFlight,
  resetAnalyticsForTests,
  setAnalyticsConsent,
  setAnalyticsSink,
  trackAppOpenedOnTravelDay,
  trackFlightAdded,
  trackModuleUsed,
  trackSearchStarted,
  validateEvent,
  type TravelDayFlight,
} from './analytics.ts';

function bkkFlight(partial: Partial<TravelDayFlight> = {}): TravelDayFlight {
  return {
    origin: 'BKK',
    originCountry: 'TH',
    destination: 'AMS',
    destCountry: 'NL',
    status: 'scheduled',
    scheduledDeparture: '2026-09-08T22:00:00+07:00',
    scheduledArrival: '2026-09-09T05:30:00+02:00',
    ...partial,
  };
}

async function withConsent(granted: boolean): Promise<ReturnType<typeof createMemorySink>> {
  resetAnalyticsForTests();
  const sink = createMemorySink();
  setAnalyticsSink(sink);
  await initAnalytics({ sink });
  await setAnalyticsConsent(granted);
  return sink;
}

test('classifySearchInput: flight number, place, unknown — never returns raw text', () => {
  assert.equal(classifySearchInput('TG205', false), 'flight_number');
  assert.equal(classifySearchInput('ek 373', false), 'flight_number');
  assert.equal(classifySearchInput('Bangkok', true), 'place');
  assert.equal(classifySearchInput('???', false), 'unknown');
});

test('mapLiveBoardPhase maps FIDS phases onto the four funnel values', () => {
  assert.equal(mapLiveBoardPhase('scheduled', 600), 'pre_departure');
  assert.equal(mapLiveBoardPhase('delayed', 400), 'pre_departure');
  assert.equal(mapLiveBoardPhase('scheduled', 120), 'airport');
  assert.equal(mapLiveBoardPhase('boarding', 40), 'airport');
  assert.equal(mapLiveBoardPhase('gateClosed', 10), 'airport');
  assert.equal(mapLiveBoardPhase('departed', 0), 'in_flight');
  assert.equal(mapLiveBoardPhase('enRoute', null), 'in_flight');
  assert.equal(mapLiveBoardPhase('landed', null), 'arrived');
});

test('daysBeforeDeparture is a whole number of days', () => {
  const now = Date.parse('2026-09-08T00:00:00Z');
  assert.equal(daysBeforeDeparture(Date.parse('2026-09-10T12:00:00Z'), now), 2);
  assert.equal(daysBeforeDeparture(null, now), 0);
});

test('isOnTravelDay: departure or arrival calendar day in airport TZ', () => {
  const now = Date.parse('2026-09-08T15:00:00+07:00');
  assert.equal(isOnTravelDay(bkkFlight(), now), true);
  assert.equal(isOnTravelDay(bkkFlight({
    scheduledDeparture: '2026-09-20T22:00:00+07:00',
    scheduledArrival: '2026-09-21T05:30:00+02:00',
  }), now), false);
  assert.equal(isOnTravelDay(bkkFlight({ status: 'cancelled' }), now), false);
});

test('search_started fires once per distinct query with allowed properties only', async () => {
  const sink = await withConsent(true);
  const a = await trackSearchStarted({ raw: 'TG205' });
  const again = await trackSearchStarted({ raw: 'TG205' });
  const b = await trackSearchStarted({ raw: 'Bangkok', placeMatched: true });
  assert.equal(a, true);
  assert.equal(again, false);
  assert.equal(b, true);
  assert.equal(sink.events.filter(e => e.name === 'search_started').length, 2);
  const first = sink.events[0];
  assert.equal(first.params.input_type, 'flight_number');
  assert.equal(first.params.raw_length, 5);
  assert.ok(!('raw' in first.params));
  assert.ok(!JSON.stringify(first.params).includes('TG205'));
  assert.equal(validateEvent('search_started', first.params), true);
});

test('flight_added and second_flight_added: second only on the second lifetime add', async () => {
  const sink = await withConsent(true);
  const now = Date.parse('2026-09-08T00:00:00Z');
  const dep = Date.parse('2026-09-11T00:00:00Z');
  assert.equal(await trackFlightAdded({ source: 'search', depUtcMs: dep, now }), true);
  assert.equal(sink.events.filter(e => e.name === 'second_flight_added').length, 0);
  assert.equal(await trackFlightAdded({ source: 'calendar', depUtcMs: dep, now: now + 86_400_000 }), true);
  const seconds = sink.events.filter(e => e.name === 'second_flight_added');
  assert.equal(seconds.length, 1);
  assert.equal(seconds[0].params.days_since_first_flight, 1);
  assert.equal(await trackFlightAdded({ source: 'email', depUtcMs: dep, now: now + 2 * 86_400_000 }), true);
  assert.equal(sink.events.filter(e => e.name === 'second_flight_added').length, 1);
  assert.equal(sink.events.filter(e => e.name === 'flight_added').length, 3);
  assert.ok(isAllowedFlightAddedSource(sink.events[0].params.source));
});

test('app_opened_on_travel_day fires once when a tracked flight is today', async () => {
  const sink = await withConsent(true);
  const now = Date.parse('2026-09-08T15:00:00+07:00');
  const miss = await trackAppOpenedOnTravelDay([bkkFlight({
    scheduledDeparture: '2026-09-20T22:00:00+07:00',
    scheduledArrival: '2026-09-21T05:30:00+02:00',
  })], { now });
  assert.equal(miss, false);
  const hit = await trackAppOpenedOnTravelDay([bkkFlight({ status: 'boarding' })], {
    now,
    livePhaseFor: () => 'boarding',
    minutesUntilDepFor: () => 40,
  });
  assert.equal(hit, true);
  assert.equal(sink.events[0].name, 'app_opened_on_travel_day');
  assert.equal(sink.events[0].params.phase, 'airport');
  assert.ok(isAllowedJourneyPhase(sink.events[0].params.phase));
});

test('pickTravelDayFlight prefers in-progress over later phases', () => {
  const now = Date.parse('2026-09-08T15:00:00+07:00');
  const picked = pickTravelDayFlight(
    [
      bkkFlight({ status: 'scheduled' }),
      bkkFlight({ status: 'en-route', origin: 'BKK', destination: 'SIN' }),
    ],
    now,
    f => (f.status === 'en-route' ? 'enRoute' : 'scheduled'),
    () => 200,
  );
  assert.equal(picked?.phase, 'in_flight');
});

test('module_used: allowed module/mode/phase; fids_board and morning_briefing once per session', async () => {
  const sink = await withConsent(true);
  assert.equal(await trackModuleUsed('radar', { mode: 'traveller', flightPhase: 'airport' }), true);
  assert.equal(await trackModuleUsed('radar', { mode: 'traveller', flightPhase: 'airport' }), true);
  assert.equal(await trackModuleUsed('fids_board', { mode: 'pro', flightPhase: 'pre_departure' }), true);
  assert.equal(await trackModuleUsed('fids_board', { mode: 'pro', flightPhase: 'pre_departure' }), false);
  assert.equal(await trackModuleUsed('morning_briefing', { mode: 'traveller', flightPhase: 'airport' }), true);
  assert.equal(await trackModuleUsed('morning_briefing', { mode: 'traveller', flightPhase: 'airport' }), false);
  assert.equal(sink.events.filter(e => e.name === 'module_used').length, 4);
  for (const e of sink.events) {
    assert.ok(isAllowedModuleId(e.params.module));
    assert.ok(isAllowedMode(e.params.mode));
    assert.ok(isAllowedJourneyPhase(e.params.flight_phase));
  }
});

test('nothing fires when consent is declined or unset', async () => {
  resetAnalyticsForTests();
  const sink = createMemorySink();
  await initAnalytics({ sink });
  assert.equal(await trackSearchStarted({ raw: 'TG205' }), false);
  assert.equal(await trackFlightAdded({ source: 'search', depUtcMs: Date.now() + 86_400_000 }), false);
  assert.equal(await trackModuleUsed('radar'), false);
  await setAnalyticsConsent(false);
  assert.equal(await trackSearchStarted({ raw: 'AMS', placeMatched: true }), false);
  assert.equal(sink.events.length, 0);
  assert.equal(getLoggedEvents().length, 0);
});

test('search_started input_type values stay inside the allowed set', () => {
  for (const v of ['place', 'flight_number', 'unknown'] as const) {
    assert.equal(isAllowedSearchInputType(v), true);
  }
  assert.equal(isAllowedSearchInputType('text'), false);
});
