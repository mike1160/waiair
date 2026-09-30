import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  IMPORT_DATE_TOLERANCE_DAYS,
  dayNumber,
  daysBetween,
  flightDateWithinTolerance,
  importDateVerdict,
  resolvedFlightVerdict,
} from './importFlightDate.ts';

const TODAY = '2026-09-30';

test('[W/11] the KL844 case: a months-old confirmation is already flown, not today', () => {
  assert.equal(importDateVerdict({ dateIso: '2026-03-04', todayIso: TODAY }), 'flown');
  // And the lookup's answer for today is refused as a different rotation of the same number.
  assert.equal(resolvedFlightVerdict({ dateIso: '2026-03-04', flightIso: '2026-09-30T14:05:00+02:00' }), 'unclear');
});

test('[W/11] no date is its own state, and is never read as today', () => {
  assert.equal(importDateVerdict({ dateIso: undefined, todayIso: TODAY }), 'unclear');
  assert.equal(importDateVerdict({ dateIso: null, todayIso: TODAY }), 'unclear');
  assert.equal(importDateVerdict({ dateIso: '', todayIso: TODAY }), 'unclear');
  assert.equal(importDateVerdict({ dateIso: 'next Tuesday', todayIso: TODAY }), 'unclear');
  assert.equal(importDateVerdict({ dateIso: '2026-02-31', todayIso: TODAY }), 'unclear', 'not 3 March');
});

test('[W/11] an upcoming trip is fine, and yesterday still counts', () => {
  assert.equal(importDateVerdict({ dateIso: '2026-10-05', todayIso: TODAY }), 'ok');
  assert.equal(importDateVerdict({ dateIso: TODAY, todayIso: TODAY }), 'ok');
  // A flight that left yesterday may still be in the air, or its bags still on the belt.
  assert.equal(importDateVerdict({ dateIso: '2026-09-29', todayIso: TODAY }), 'ok');
  assert.equal(importDateVerdict({ dateIso: '2026-09-28', todayIso: TODAY }), 'flown');
});

test('[W/11] seven days: a reschedule is accepted, a monthly rotation is not', () => {
  assert.equal(IMPORT_DATE_TOLERANCE_DAYS, 7);
  const claimed = '2026-10-04';
  for (const shift of ['2026-10-04', '2026-10-06', '2026-10-11', '2026-09-27']) {
    assert.equal(flightDateWithinTolerance(claimed, shift), true, `${shift} is a plausible reschedule`);
  }
  for (const other of ['2026-10-12', '2026-09-26', '2026-11-04', '2026-09-04']) {
    assert.equal(flightDateWithinTolerance(claimed, other), false, `${other} is another rotation`);
  }
});

test('[W/11] the tolerance reads a timestamp as well as a bare date', () => {
  assert.equal(flightDateWithinTolerance('2026-10-04', '2026-10-05T23:55:00+07:00'), true);
  assert.equal(flightDateWithinTolerance('2026-10-04', '2026-10-04'), true);
});

test('[W/11] a flight whose date cannot be read is refused, not assumed to match', () => {
  assert.equal(flightDateWithinTolerance('2026-10-04', ''), false);
  assert.equal(flightDateWithinTolerance('2026-10-04', undefined), false);
  assert.equal(flightDateWithinTolerance('2026-10-04', 'soon'), false);
  assert.equal(resolvedFlightVerdict({ dateIso: '2026-10-04', flightIso: '' }), 'unclear');
});

test('[W/11] a lookup for an undated add is left alone', () => {
  // "Track TG208", typed by hand: nearest-to-now is the right answer and this must not interfere.
  assert.equal(resolvedFlightVerdict({ dateIso: undefined, flightIso: '2026-09-30T13:00:00+07:00' }), 'ok');
  assert.equal(resolvedFlightVerdict({ dateIso: '', flightIso: '' }), 'ok');
});

test('[W/11] the day arithmetic crosses months, years and a leap day', () => {
  assert.equal(daysBetween('2026-09-30', '2026-10-01'), 1);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2, '2028 is a leap year');
  assert.equal(daysBetween('2026-10-04', '2026-10-04'), 0);
  assert.equal(daysBetween('nonsense', '2026-10-04'), null);
  assert.equal(dayNumber('1970-01-01'), 0);
  assert.equal(dayNumber('not a date'), null);
});

test('[W/11] the grace period is adjustable, and the tolerance can be tightened', () => {
  assert.equal(importDateVerdict({ dateIso: '2026-09-28', todayIso: TODAY, graceDays: 5 }), 'ok');
  assert.equal(flightDateWithinTolerance('2026-10-04', '2026-10-06', 1), false);
  assert.equal(flightDateWithinTolerance('2026-10-04', '2026-10-04', 0), true);
});

/*
 * [W/11] Through the real parser, because the pure rules above only matter if the pipeline applies them.
 * These are the three shapes a confirmation arrives in, on text of the kind KLM actually sends.
 */
import { AUTO_IMPORT_THRESHOLD, parseImportedMessages } from './gmailImport.ts';

const PROBE_NOW = Date.parse('2026-09-30T09:00:00Z');
const mail = (id: string, subject: string, text: string) => ({ id, subject, text, from: 'info@klm.com' });

test('[W/11] an upcoming confirmation is offered exactly as before', () => {
  const [p] = parseImportedMessages(
    [mail('a', 'Your booking KL844 on 5 October 2026', 'KL844 Amsterdam to Bangkok, 5 October 2026, 14:05')],
    { todayIso: TODAY, now: PROBE_NOW },
  );
  assert.equal(p.flights.length, 1);
  assert.equal(p.flights[0].dateIso, '2026-10-05');
  assert.equal(p.skippedFlights, undefined);
});

test('[W/11] a months-old confirmation is skipped, and says it has already flown', () => {
  const [p] = parseImportedMessages(
    [mail('b', 'Your booking KL844 on 4 March 2026', 'KL844 Amsterdam to Bangkok, 4 March 2026, 14:05')],
    { todayIso: TODAY, now: PROBE_NOW },
  );
  assert.deepEqual(p.flights, [], 'not offered');
  assert.deepEqual(p.skippedFlights, [{ number: 'KL844', reason: 'flown' }], 'and not silent about it');
});

test('[W/11] an undated confirmation was auto-imported at 95 and is now skipped as unclear', () => {
  const undated = mail('c', 'Your booking KL844', 'KL844 Amsterdam to Bangkok. Check in online.');
  // Without a today to compare against nothing is judged, and this is what used to reach the tracker:
  // confidence 95, comfortably over the auto-import threshold, with no date at all to place it on. It was
  // then looked up with no date and came back as whatever KL844 was flying today. That is the bug.
  const [before] = parseImportedMessages([undated], { now: PROBE_NOW });
  assert.equal(before.flights[0]?.dateIso, undefined);
  assert.ok((before.flights[0]?.confidence ?? 0) >= AUTO_IMPORT_THRESHOLD, 'it was tracked without being asked');

  const [after] = parseImportedMessages([undated], { todayIso: TODAY, now: PROBE_NOW });
  assert.deepEqual(after.flights, []);
  assert.deepEqual(after.skippedFlights, [{ number: 'KL844', reason: 'unclear' }]);
});

test('[W/11] the wiring: the date reaches the lookup and a wrong day is refused', () => {
  const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'), 'utf8');
  assert.ok(
    app.includes('await fetchFlightByNumber(clean, dateIso ? { date: dateIso } : undefined)'),
    'the lookup was called with no date at all, which is why it answered with today',
  );
  assert.ok(app.includes('resolvedFlightVerdict({'), 'and the answer is checked against the claimed date');
  assert.ok(app.includes("showToast(t().gmailFlightDateUnclear(clean));"), 'a refusal says so');
});

test('[W/11] the skip counts reach the screen', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const screen = readFileSync(join(root, 'screens/GmailImportScreen.tsx'), 'utf8');
  assert.ok(screen.includes('t().gmailResultFlown(outcome.alreadyFlown)'));
  assert.ok(screen.includes('t().gmailResultDateUnclear(outcome.dateUnclear)'));
  const imp = readFileSync(join(root, 'lib/gmailImport.ts'), 'utf8');
  assert.ok(imp.includes('!o.alreadyFlown && !o.dateUnclear'), 'and a skip-only scan does not read as empty');
});
