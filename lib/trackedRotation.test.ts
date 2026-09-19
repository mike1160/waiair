import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkinHoursBeforeDeparture, resolveHomeNow } from './homeNow.ts';
import { isTrackedRotation, matchTrackedRotation, scheduledDepartureMs } from './trackedRotation.ts';

const slug = (n: string) => String(n || '').replace(/\s+/g, '').toUpperCase();
const HOUR = 60 * 60 * 1000;

/** A flight-number row as App.tsx maps it (boardSide 'both'; scheduledTime is the arrival once landed). */
function row(over: Record<string, unknown>) {
  return {
    number: 'TG 208',
    airline: 'Thai Airways',
    airlineCode: 'TG',
    origin: 'BKK',
    originCountry: 'TH',
    destination: 'HKT',
    destCountry: 'TH',
    boardSide: 'both' as const,
    status: 'scheduled',
    scheduledTime: '',
    ...over,
  } as { number: string; scheduledTime: string } & Record<string, any>;
}

function trackedOf(f: ReturnType<typeof row>) {
  return {
    flightNumber: slug(f.number),
    scheduledTime: f.scheduledTime,
    trackedDepMs: scheduledDepartureMs(f) ?? undefined,
  };
}

// ---------- TG208: yesterday's rotation must not replace tomorrow's tracked flight ----------

test('TG208: yesterday\'s rotation from the API is rejected and the phase stays checkin', () => {
  const tracked = row({
    scheduledTime: '2026-09-21T20:00:00+07:00',
    scheduledDeparture: '2026-09-21T20:00:00+07:00',
    scheduledArrival: '2026-09-21T21:25:00+07:00',
  });
  const t = trackedOf(tracked);
  assert.equal(t.trackedDepMs, Date.parse('2026-09-21T13:00:00Z'));

  // Yesterday's TG208, landed: the row's scheduledTime has switched to its arrival.
  const yesterday = row({
    status: 'landed',
    scheduledTime: '2026-09-20T21:25:00+07:00',
    scheduledDeparture: '2026-09-20T20:00:00+07:00',
    scheduledArrival: '2026-09-20T21:25:00+07:00',
    actualDeparture: '2026-09-20T20:04:00+07:00',
    actualArrival: '2026-09-20T21:18:00+07:00',
  });
  assert.equal(isTrackedRotation(yesterday, t.trackedDepMs), false);
  assert.equal(matchTrackedRotation(t, [yesterday], slug), undefined);

  // Nothing matched: the app keeps the tracked flight's own data, which is still before check-in opens.
  const depMs = t.trackedDepMs!;
  const now = depMs - (checkinHoursBeforeDeparture(tracked) + 6) * HOUR;
  assert.equal(resolveHomeNow(tracked, now).phase, 'checkin');
  // Taking yesterday's row would have moved the flight past check-in.
  assert.notEqual(resolveHomeNow(yesterday, now).phase, 'checkin');
});

test('TG208: with both days in the answer, the tracked day wins even if the other is nearer by scheduledTime', () => {
  const tracked = row({ scheduledTime: '2026-09-21T20:00:00+07:00', scheduledDeparture: '2026-09-21T20:00:00+07:00' });
  const t = { ...trackedOf(tracked), scheduledTime: '2026-09-21T02:00:00+07:00' };
  const yesterday = row({ scheduledTime: '2026-09-20T21:25:00+07:00', scheduledDeparture: '2026-09-20T20:00:00+07:00', status: 'landed' });
  const today = row({ scheduledTime: '2026-09-21T20:00:00+07:00', scheduledDeparture: '2026-09-21T20:00:00+07:00' });
  assert.equal(matchTrackedRotation(t, [yesterday, today], slug), today);
});

test('without an anchor (flights tracked before this change) matching is unchanged', () => {
  const yesterday = row({ scheduledTime: '2026-09-20T21:25:00+07:00', scheduledDeparture: '2026-09-20T20:00:00+07:00' });
  const legacy = { flightNumber: 'TG208', scheduledTime: '2026-09-21T20:00:00+07:00' };
  assert.equal(matchTrackedRotation(legacy, [yesterday], slug), yesterday);
});

// ---------- TG921: overnight flight, departs the 18th, lands the 19th ----------

test('TG921 overnight: the landed row (scheduledTime now the 19th arrival) is still the same rotation', () => {
  const tracked = row({
    number: 'TG 921',
    origin: 'FRA', originCountry: 'DE', destination: 'BKK', destCountry: 'TH',
    scheduledTime: '2026-09-18T13:25:00+02:00',
    scheduledDeparture: '2026-09-18T13:25:00+02:00',
    scheduledArrival: '2026-09-19T06:25:00+07:00',
  });
  const t = trackedOf(tracked);
  assert.equal(t.trackedDepMs, Date.parse('2026-09-18T11:25:00Z'));

  const landed = row({
    number: 'TG 921',
    origin: 'FRA', originCountry: 'DE', destination: 'BKK', destCountry: 'TH',
    status: 'landed',
    scheduledTime: '2026-09-19T06:25:00+07:00',
    scheduledDeparture: '2026-09-18T13:25:00+02:00',
    scheduledArrival: '2026-09-19T06:25:00+07:00',
    actualDeparture: '2026-09-18T13:34:00+02:00',
    actualArrival: '2026-09-19T06:49:00+07:00',
  });
  assert.equal(matchTrackedRotation(t, [landed], slug), landed);
});

test('TG921 tracked from the BKK arrival board: its scheduledTime is the arrival, the anchor is still the departure', () => {
  const fromArrivals = row({
    number: 'TG 921',
    origin: 'FRA', originCountry: 'DE', destination: 'BKK', destCountry: 'TH',
    boardSide: 'arrival',
    scheduledTime: '2026-09-19T06:25:00+07:00',
    scheduledDeparture: '2026-09-18T13:25:00+02:00',
  });
  const t = trackedOf(fromArrivals);
  assert.equal(t.trackedDepMs, Date.parse('2026-09-18T11:25:00Z'));
  const live = row({
    number: 'TG 921',
    origin: 'FRA', originCountry: 'DE', destination: 'BKK', destCountry: 'TH',
    status: 'en-route',
    scheduledTime: '2026-09-18T13:25:00+02:00',
    scheduledDeparture: '2026-09-18T13:25:00+02:00',
  });
  assert.equal(matchTrackedRotation(t, [live], slug), live);
});

// ---------- A delay past midnight ----------

test('delay past midnight: 23:30 on the 19th, now leaving 00:40 on the 20th, is the same rotation', () => {
  const tracked = row({
    scheduledTime: '2026-09-19T23:30:00+07:00',
    scheduledDeparture: '2026-09-19T23:30:00+07:00',
  });
  const t = trackedOf(tracked);
  const delayed = row({
    status: 'delayed',
    scheduledTime: '2026-09-19T23:30:00+07:00',
    revisedTime: '2026-09-20T00:40:00+07:00',
    scheduledDeparture: '2026-09-19T23:30:00+07:00',
    estimatedDeparture: '2026-09-20T00:40:00+07:00',
    departureTime: '2026-09-20T00:40:00+07:00',
  });
  assert.equal(matchTrackedRotation(t, [delayed], slug), delayed);
  // A row carrying only the new time (no schedule) is 70 minutes off the anchor: still accepted.
  const onlyNewTime = row({ scheduledTime: '', departureTime: '2026-09-20T00:40:00+07:00' });
  assert.equal(isTrackedRotation(onlyNewTime, t.trackedDepMs), true);
});

test('the 12-hour window: 11h59 accepted, 12h01 rejected; a row without any departure is not judged', () => {
  const anchor = Date.parse('2026-09-19T16:30:00Z');
  const at = (ms: number) => row({ scheduledDeparture: new Date(ms).toISOString() });
  assert.equal(isTrackedRotation(at(anchor + 11 * HOUR + 59 * 60000), anchor), true);
  assert.equal(isTrackedRotation(at(anchor - 12 * HOUR - 60000), anchor), false);
  assert.equal(isTrackedRotation(row({ boardSide: 'arrival', scheduledTime: '2026-09-18T06:25:00+07:00' }), anchor), true);
});
