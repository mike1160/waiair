import test from 'node:test';
import assert from 'node:assert/strict';

import { calendarId, clearAdded, markAdded, wasAdded } from './addedThisSession.ts';

test('what was added is remembered, and nothing else is', () => {
  clearAdded();
  assert.equal(wasAdded('calendar', 'BR75@2026-09-15'), false);
  markAdded('calendar', 'BR75@2026-09-15');
  assert.equal(wasAdded('calendar', 'BR75@2026-09-15'), true);
  assert.equal(wasAdded('calendar', 'KL875@2026-10-05'), false, 'a different flight is a different answer');
});

test('the calendar and the wallet are remembered apart', () => {
  clearAdded();
  markAdded('calendar', 'BR75');
  assert.equal(wasAdded('calendar', 'BR75'), true);
  assert.equal(wasAdded('wallet', 'BR75'), false, 'in the calendar is not in Wallet');
});

test('something with no id is not remembered — it could not be told apart', () => {
  clearAdded();
  markAdded('calendar', '');
  assert.equal(wasAdded('calendar', ''), false);
  markAdded('calendar', '   ');
  assert.equal(wasAdded('calendar', '   '), false);
});

test('an id is matched however it was typed', () => {
  clearAdded();
  markAdded('wallet', 'br75');
  assert.equal(wasAdded('wallet', 'BR75'), true);
  assert.equal(wasAdded('wallet', ' br75 '), true);
});

test('one leg and the whole trip are different things', () => {
  const leg = calendarId(['BR75'], '2026-09-15T12:15:00+07:00');
  const trip = calendarId(['BR75', 'KL875'], '2026-09-15T12:15:00+07:00');
  assert.notEqual(leg, trip);
  clearAdded();
  markAdded('calendar', leg);
  assert.equal(wasAdded('calendar', leg), true);
  assert.equal(wasAdded('calendar', trip), false, 'adding one leg is not adding the trip');
});

test('the calendar id survives the ways a flight number gets written', () => {
  assert.equal(calendarId([' br 75 '], '2026-09-15'), 'BR75@2026-09-15');
  assert.equal(calendarId(['BR75']), 'BR75');
  assert.equal(calendarId([undefined, 'BR75']), 'BR75');
  assert.equal(calendarId([]), '');
  assert.equal(calendarId([undefined]), '');
});

test('clearing forgets everything', () => {
  markAdded('calendar', 'X1');
  clearAdded();
  assert.equal(wasAdded('calendar', 'X1'), false);
});
