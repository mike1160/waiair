import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkinHoursBeforeDeparture, resolveHomeNow } from './homeNow.ts';
import {
  isTrackedRotation,
  matchTrackedRotation,
  scheduledDepartureMs,
  trackedAnchorMs,
} from './trackedRotation.ts';

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

/* ── G9687: the anchor is derived, so the guard is never simply off ───────────────────────────────
 *
 * The hole this closes: `trackedDepMs` was set once, in newTracked(), and loadTracked() never filled it in
 * again. Every flight already on the device therefore had no anchor, isTrackedRotation() answered "yes" to
 * everything, and a foreign rotation was written over the tracked one — including over the tracked
 * scheduledTime, which is what tripMoments.ts compares against, so that guard went blind with it.
 */

/** G9687 Sharjah → Phuket, departing 03:15 on 26 Sep, landing ~09:43 local. */
const G9687 = {
  number: 'G9 687',
  airline: 'Air Arabia',
  airlineCode: 'G9',
  origin: 'SHJ',
  originCountry: 'AE',
  destination: 'HKT',
  destCountry: 'TH',
  boardSide: 'both' as const,
  status: 'scheduled',
  scheduledTime: '2026-09-26T03:15:00+04:00',
  scheduledDeparture: '2026-09-26T03:15:00+04:00',
  scheduledArrival: '2026-09-26T09:43:00+07:00',
};

test('G9687: an anchor is derived when none was stored', () => {
  const stored = { scheduledTime: G9687.scheduledTime, flight: G9687 };
  const anchor = trackedAnchorMs(stored);
  assert.equal(anchor, Date.parse('2026-09-26T03:15:00+04:00'));

  // An anchor already on file is never recomputed: it is the one thing a refresh cannot move.
  assert.equal(trackedAnchorMs({ ...stored, trackedDepMs: 12345 }), 12345);

  // Nothing to go on at all stays undefined rather than guessing a day.
  assert.equal(trackedAnchorMs({}), undefined);
  assert.equal(trackedAnchorMs({ scheduledTime: '' }), undefined);
});

test('G9687: the next day\'s rotation is rejected against a derived anchor', () => {
  const anchor = trackedAnchorMs({ scheduledTime: G9687.scheduledTime, flight: G9687 });
  const tomorrow = {
    ...G9687,
    scheduledTime: '2026-09-27T03:15:00+04:00',
    scheduledDeparture: '2026-09-27T03:15:00+04:00',
    scheduledArrival: '2026-09-27T09:43:00+07:00',
  };
  assert.equal(isTrackedRotation(G9687, anchor), true, 'the tracked day is itself');
  assert.equal(isTrackedRotation(tomorrow, anchor), false, '24h out is another flight');

  // And the matcher keeps the tracked day even when only the wrong one comes back.
  const tracked = { flightNumber: 'G9687', scheduledTime: G9687.scheduledTime, trackedDepMs: anchor };
  assert.equal(matchTrackedRotation(tracked, [tomorrow], slug), undefined, 'nothing matched: keep what we have');
  assert.equal(matchTrackedRotation(tracked, [tomorrow, G9687], slug)?.scheduledTime, G9687.scheduledTime);
});

test('G9687: with the wrong rotation rejected, the home screen reads the tracked day', () => {
  // 07:00 in Phuket on the 26th: the flight is in the air, landing at 09:43 local — under three hours away.
  const now = Date.parse('2026-09-26T07:00:00+07:00');
  const onTime = resolveHomeNow({
    ...G9687,
    status: 'en-route',
    arrivalTime: G9687.scheduledArrival,
  } as never, now);
  assert.match(onTime.landsIn, /^2h|^3h/, `lands within hours, got "${onTime.landsIn}"`);

  /*
   * The same moment with tomorrow's rotation believed: this is what the screen showed — "arrives in 23h" for
   * a six-hour flight, and a check-in that opened a day early. It is the shape of the bug, not a wish.
   */
  const drifted = resolveHomeNow({
    ...G9687,
    scheduledTime: '2026-09-27T03:15:00+04:00',
    scheduledDeparture: '2026-09-27T03:15:00+04:00',
    scheduledArrival: '2026-09-27T09:43:00+07:00',
    arrivalTime: '2026-09-27T09:43:00+07:00',
  } as never, now);
  assert.match(drifted.landsIn, /^2[0-9]h/, `the drifted record lands a day out, got "${drifted.landsIn}"`);
  assert.notEqual(onTime.landsIn, drifted.landsIn, 'the two readings differ, which is why the guard matters');
});

test('the anchor survives a rewritten scheduledTime', () => {
  /*
   * diffTracked writes `scheduledTime: live.scheduledTime || prev.scheduledTime`, so a foreign row that got
   * through moved the tracked time with it. trackedDepMs is spread through untouched, so a flight that has
   * one can still tell which rotation it is — and reject the row that would have drifted it further.
   */
  const anchor = Date.parse('2026-09-26T03:15:00+04:00');
  const drifted = {
    scheduledTime: '2026-09-27T03:15:00+04:00',
    trackedDepMs: anchor,
    flight: { ...G9687, scheduledDeparture: '2026-09-27T03:15:00+04:00' },
  };
  assert.equal(trackedAnchorMs(drifted), anchor, 'the stored anchor wins over the drifted time');
  assert.equal(isTrackedRotation(drifted.flight, trackedAnchorMs(drifted)), false);
});
