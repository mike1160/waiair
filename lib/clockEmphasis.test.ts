import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CLOCK_AMBER,
  CLOCK_GREEN,
  CLOCK_RED,
  clockColor,
  clockEmphasis,
  pulseTiming,
} from './clockEmphasis.ts';

test('the clock gets louder as departure comes closer', () => {
  assert.deepEqual(clockEmphasis({ minutesUntil: 400 }), { tone: 'default', pulse: 'none', strike: false });
  assert.deepEqual(clockEmphasis({ minutesUntil: 181 }), { tone: 'default', pulse: 'none', strike: false });
  assert.deepEqual(clockEmphasis({ minutesUntil: 180 }), { tone: 'amber', pulse: 'subtle', strike: false }, '3h: amber');
  assert.deepEqual(clockEmphasis({ minutesUntil: 60 }), { tone: 'amber', pulse: 'subtle', strike: false }, '1h: still amber');
  assert.deepEqual(clockEmphasis({ minutesUntil: 59 }), { tone: 'red', pulse: 'strong', strike: false }, 'under 1h: red');
  assert.deepEqual(clockEmphasis({ minutesUntil: -5 }), { tone: 'red', pulse: 'strong', strike: false }, 'past due');
  assert.deepEqual(clockEmphasis({ minutesUntil: null }), { tone: 'default', pulse: 'none', strike: false }, 'unknown: quiet');
});

test('boarding and later are green and still; cancelled is red and struck through', () => {
  for (const phase of ['boarding', 'departed', 'landed'] as const) {
    assert.deepEqual(clockEmphasis({ minutesUntil: 5, phase }), { tone: 'green', pulse: 'none', strike: false }, phase);
  }
  assert.deepEqual(clockEmphasis({ minutesUntil: 5, phase: 'cancelled' }), { tone: 'red', pulse: 'none', strike: true });
  assert.deepEqual(
    clockEmphasis({ minutesUntil: 5, phase: 'cancelled', delayed: true }),
    { tone: 'red', pulse: 'none', strike: true },
    'cancelled wins over delayed',
  );
});

test('a delayed flight shows its new time in amber, however far away', () => {
  assert.deepEqual(clockEmphasis({ minutesUntil: 900, delayed: true }), { tone: 'amber', pulse: 'subtle', strike: false });
  assert.deepEqual(clockEmphasis({ minutesUntil: 20, delayed: true }), { tone: 'amber', pulse: 'strong', strike: false });
});

test('a delay stays amber after boarding, departure and landing — green would read as good news', () => {
  for (const phase of ['boarding', 'departed', 'landed'] as const) {
    assert.deepEqual(
      clockEmphasis({ minutesUntil: -30, phase, delayed: true }),
      { tone: 'amber', pulse: 'none', strike: false },
      `${phase}: the new time is amber and still`,
    );
  }
  assert.equal(clockColor(clockEmphasis({ minutesUntil: -30, phase: 'landed', delayed: true }).tone, '#111'), CLOCK_AMBER);
  // Without a delay those phases are green, exactly as before.
  assert.deepEqual(clockEmphasis({ minutesUntil: -30, phase: 'landed' }), { tone: 'green', pulse: 'none', strike: false });
});

test('tones map to the spec colours and the default stays the screen colour', () => {
  assert.equal(clockColor('amber', '#111'), CLOCK_AMBER);
  assert.equal(clockColor('red', '#111'), CLOCK_RED);
  assert.equal(clockColor('green', '#111'), CLOCK_GREEN);
  assert.equal(clockColor('default', '#111'), '#111');
  assert.equal(CLOCK_AMBER, '#F5A623');
  assert.equal(CLOCK_RED, '#E53935');
  assert.equal(CLOCK_GREEN, '#2E7D32');
});

test('pulse timing: stronger and faster inside the last hour, none when still', () => {
  const strong = pulseTiming('strong');
  const subtle = pulseTiming('subtle');
  assert.ok(strong && subtle);
  assert.ok(strong.from < subtle.from, 'strong dips further');
  assert.ok(strong.duration < subtle.duration, 'strong beats faster');
  assert.equal(pulseTiming('none'), null);
});

test('arrival clock: no countdown urgency — amber only when late, green when early or landed, never red', () => {
  const arr = (o: Parameters<typeof clockEmphasis>[0]) => clockEmphasis({ leg: 'arrival', ...o });
  // One minute early, landing in 20 minutes: was red and pulsing, now green and still.
  assert.deepEqual(arr({ minutesUntil: 20, phase: 'scheduled', early: true }), { tone: 'green', pulse: 'none', strike: false });
  // On time, landing in 20 minutes: the screen's own colour.
  assert.deepEqual(arr({ minutesUntil: 20, phase: 'scheduled' }), { tone: 'default', pulse: 'none', strike: false });
  // Late: amber, whether still flying or landed.
  assert.deepEqual(arr({ minutesUntil: 20, phase: 'scheduled', delayed: true }), { tone: 'amber', pulse: 'none', strike: false });
  assert.deepEqual(arr({ phase: 'landed', delayed: true }), { tone: 'amber', pulse: 'none', strike: false });
  // Landed on time or early: green.
  assert.deepEqual(arr({ phase: 'landed' }), { tone: 'green', pulse: 'none', strike: false });
  // Cancelled still wins.
  assert.deepEqual(arr({ phase: 'cancelled', early: true }), { tone: 'red', pulse: 'none', strike: true });
  for (const minutesUntil of [5, 30, 59, 90, 200]) {
    assert.notEqual(arr({ minutesUntil, phase: 'scheduled', early: true }).tone, 'red');
  }
});

test('departure clock keeps its countdown urgency', () => {
  assert.deepEqual(clockEmphasis({ minutesUntil: 30, phase: 'scheduled' }), { tone: 'red', pulse: 'strong', strike: false });
  assert.deepEqual(clockEmphasis({ leg: 'departure', minutesUntil: 30, phase: 'scheduled' }), { tone: 'red', pulse: 'strong', strike: false });
});
