import test from 'node:test';
import assert from 'node:assert/strict';

import { briefingChips, briefingGroupFor } from './briefingQuestions.ts';

test('every phase the app has maps to a group of questions', () => {
  assert.equal(briefingGroupFor('PREP'), 'prep');
  assert.equal(briefingGroupFor('EVE'), 'prep');
  assert.equal(briefingGroupFor('PRACTICAL'), 'prep');
  assert.equal(briefingGroupFor('FINAL'), 'prep');
  assert.equal(briefingGroupFor('DEPARTURE'), 'departure');
  assert.equal(briefingGroupFor('STOPOVER'), 'departure');
  assert.equal(briefingGroupFor('INFLIGHT'), 'inflight');
  assert.equal(briefingGroupFor('ARRIVED'), 'arrived');
  assert.equal(briefingGroupFor('COMPLETED'), 'arrived');
});

test('no phase, no questions', () => {
  assert.equal(briefingGroupFor(null), null);
  assert.equal(briefingGroupFor(undefined), null);
  assert.deepEqual(briefingChips(null), []);
});

test('a real delay outranks the clock', () => {
  assert.equal(briefingGroupFor('PREP', 45), 'delay');
  assert.equal(briefingGroupFor('DEPARTURE', 45), 'delay');
});

test('a small delay is not a delay', () => {
  assert.equal(briefingGroupFor('DEPARTURE', 15), 'departure', '15 is the threshold, not past it');
  assert.equal(briefingGroupFor('DEPARTURE', 10), 'departure');
  assert.equal(briefingGroupFor('DEPARTURE', 0), 'departure');
});

test('a delay stops mattering once the flight is in the air', () => {
  // Asking about compensation is for the gate; in the air the useful question is how to get to the hotel.
  assert.equal(briefingGroupFor('INFLIGHT', 90), 'inflight');
  assert.equal(briefingGroupFor('ARRIVED', 90), 'arrived');
  assert.equal(briefingGroupFor('COMPLETED', 90), 'arrived');
});

test('never more than three chips', () => {
  for (const phase of ['PREP', 'EVE', 'PRACTICAL', 'FINAL', 'DEPARTURE', 'STOPOVER',
    'INFLIGHT', 'ARRIVED', 'COMPLETED'] as const) {
    for (const delay of [0, 45]) {
      const chips = briefingChips(phase, { delayMinutes: delay, weatherAlert: true });
      assert.ok(chips.length <= 3, `${phase}/${delay} gave ${chips.length}`);
    }
  }
});

test('the roads question only appears when there is actually a weather alert', () => {
  const without = briefingChips('ARRIVED', {});
  const withAlert = briefingChips('ARRIVED', { weatherAlert: true });
  assert.ok(!without.some(c => c.topic === 'roads'), 'no alert, no worry invented');
  assert.ok(withAlert.some(c => c.topic === 'roads'));
});

test('before departure nothing needs the network', () => {
  // The whole prep set is answered on the device: tapping any of them costs nothing.
  assert.ok(briefingChips('PREP', {}).every(c => c.source === 'deterministic'));
});

test('the delay set leads with the answer the app already knows', () => {
  const chips = briefingChips('DEPARTURE', { delayMinutes: 45 });
  assert.equal(chips[0].topic, 'compensation');
  assert.equal(chips[0].source, 'deterministic');
});

test('every chip carries a label key and a known source', () => {
  for (const phase of ['PREP', 'DEPARTURE', 'INFLIGHT', 'ARRIVED'] as const) {
    for (const chip of briefingChips(phase, { delayMinutes: 0, weatherAlert: true })) {
      assert.match(chip.labelKey, /^briefingQ[A-Z]/, `${chip.topic} needs a label key`);
      assert.ok(chip.source === 'ai' || chip.source === 'deterministic');
    }
  }
});

test('[U/1] rebooking is answered by the app, not by the model', () => {
  const chips = briefingChips('DEPARTURE', { delayMinutes: 45 });
  const alt = chips.find(c => c.topic === 'alternatives');
  assert.ok(alt, 'still offered');
  assert.equal(alt.source, 'deterministic', 'only the airline can rebook');
});

test('[U/1] the taxi question is offered on arrival and answered on the device', () => {
  const chips = briefingChips('ARRIVED', {});
  const taxi = chips.find(c => c.topic === 'taxiCash');
  assert.ok(taxi, 'the first thing asked at an arrivals taxi rank');
  assert.equal(taxi.source, 'deterministic');
});

test('[U/1] a weather alert outranks which bus to take', () => {
  const alerted = briefingChips('ARRIVED', { weatherAlert: true }).map(c => c.topic);
  assert.ok(alerted.includes('roads'), 'the alert survives the three-chip limit');
  assert.ok(!alerted.includes('publicTransport'), 'the bus gives up its place');
  const calm = briefingChips('ARRIVED', {}).map(c => c.topic);
  assert.deepEqual(calm, ['toCentre', 'taxiCash', 'publicTransport']);
});
