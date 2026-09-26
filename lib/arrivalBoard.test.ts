import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARRIVAL_BOARD_BLANK,
  ARRIVAL_BOARD_REFRESH_MS,
  ARRIVAL_BOARD_WINDOW_MS,
  arrivalBoardLive,
  arrivalBoardView,
  arrivalMessageText,
  arrivalNavigateQuery,
  boardLabel,
  hasLanded,
  terminalLabel,
} from './arrivalBoard.ts';

const CLOCK = (ms: number) => new Date(ms).toISOString().slice(11, 16);
const LANDED = Date.parse('2026-09-26T12:00:00Z');

const FLIGHT = {
  flightNumber: 'BR75',
  origin: 'BKK',
  destination: 'AMS',
  destCity: 'Amsterdam',
  airlineCode: 'BR',
  status: 'landed',
  gate: 'D7',
  baggage: '12',
  arrTerminal: '3',
};

test('the board shows the flight, where it came from, and when it touched down', () => {
  const view = arrivalBoardView(
    { flightKey: 'BR75|1', flight: FLIGHT, travelerName: 'Sarah', landedAtMs: LANDED, now: LANDED + 60_000 },
    CLOCK,
  );
  assert.ok(view);
  assert.equal(view.flightNumber, 'BR75');
  assert.equal(view.origin, 'BKK');
  assert.equal(view.destination, 'AMS');
  assert.equal(view.city, 'Amsterdam');
  assert.equal(view.landedAt, '12:00');
  assert.equal(view.travelerName, 'Sarah');
});

test('gate and baggage show when the airport has announced them', () => {
  const view = arrivalBoardView({ flightKey: 'k', flight: FLIGHT, landedAtMs: LANDED, now: LANDED }, CLOCK);
  assert.equal(view?.gate, 'D7');
  assert.equal(view?.baggage, '12');
  assert.equal(view?.terminal, 'T3');
});

test('gate and baggage are a dash until they are, never a guess', () => {
  // The minutes right after landing: the belt has not been called yet.
  const view = arrivalBoardView(
    { flightKey: 'k', flight: { ...FLIGHT, gate: '', baggage: undefined }, landedAtMs: LANDED, now: LANDED },
    CLOCK,
  );
  assert.equal(view?.gate, ARRIVAL_BOARD_BLANK);
  assert.equal(view?.baggage, ARRIVAL_BOARD_BLANK);
});

test('the board retires itself two hours after landing', () => {
  const within = arrivalBoardView(
    { flightKey: 'k', flight: FLIGHT, landedAtMs: LANDED, now: LANDED + ARRIVAL_BOARD_WINDOW_MS - 1000 },
    CLOCK,
  );
  assert.ok(within, 'still up at one hour fifty-nine');
  const after = arrivalBoardView(
    { flightKey: 'k', flight: FLIGHT, landedAtMs: LANDED, now: LANDED + ARRIVAL_BOARD_WINDOW_MS + 1000 },
    CLOCK,
  );
  assert.equal(after, null, 'gone at two hours one');
});

test('msLeft counts the board down', () => {
  const view = arrivalBoardView(
    { flightKey: 'k', flight: FLIGHT, landedAtMs: LANDED, now: LANDED + 30 * 60_000 },
    CLOCK,
  );
  assert.equal(view?.msLeft, 90 * 60_000);
});

test('a board that was closed stays closed, and one with no landing never opens', () => {
  assert.equal(arrivalBoardLive({ landedAtMs: LANDED, now: LANDED, dismissed: true }), false);
  assert.equal(arrivalBoardLive({ landedAtMs: 0, now: LANDED }), false);
  assert.equal(arrivalBoardLive({ landedAtMs: null, now: LANDED }), false);
  assert.equal(arrivalBoardLive({ now: LANDED }), false);
});

test('a landing time a minute in the future is a clock disagreement, not a reason to refuse', () => {
  assert.equal(arrivalBoardLive({ landedAtMs: LANDED + 60_000, now: LANDED }), true);
});

test('no flight number, no board', () => {
  assert.equal(
    arrivalBoardView({ flightKey: 'k', flight: { ...FLIGHT, flightNumber: '' }, landedAtMs: LANDED, now: LANDED }, CLOCK),
    null,
  );
});

test('landed is recognised however the source spells it', () => {
  for (const s of ['landed', 'Landed', 'LANDED', 'arrived', 'on the ground', 'on_the_ground']) {
    assert.equal(hasLanded(s), true, s);
  }
  for (const s of ['boarding', 'en-route', 'scheduled', 'delayed', '', null, undefined]) {
    assert.equal(hasLanded(s), false, String(s));
  }
});

test('a terminal is written the way a board writes it', () => {
  assert.equal(terminalLabel('2'), 'T2');
  assert.equal(terminalLabel('t2'), 'T2');
  assert.equal(terminalLabel('T2'), 'T2');
  assert.equal(terminalLabel('Terminal 3'), 'T3');
  assert.equal(terminalLabel('West'), 'WEST');
  assert.equal(terminalLabel(''), '');
});

test('board values are capitals, and a missing one is the blank', () => {
  assert.equal(boardLabel('d7'), 'D7');
  assert.equal(boardLabel(''), ARRIVAL_BOARD_BLANK);
  assert.equal(boardLabel(null), ARRIVAL_BOARD_BLANK);
});

test('the message names the city the traveller actually landed in', () => {
  const copy = { arrivalBoardWhatsApp: (city: string) => `Hey! I see you have landed in ${city} 🛬 All good?` };
  const view = arrivalBoardView({ flightKey: 'k', flight: FLIGHT, landedAtMs: LANDED, now: LANDED }, CLOCK)!;
  assert.equal(arrivalMessageText(view, copy), 'Hey! I see you have landed in Amsterdam 🛬 All good?');
  // No city in the data: the airport code is better than an empty sentence.
  assert.equal(arrivalMessageText({ city: '', destination: 'AMS' }, copy), 'Hey! I see you have landed in AMS 🛬 All good?');
});

test('the navigate query prefers the airport\'s real name', () => {
  assert.equal(arrivalNavigateQuery({ city: 'Amsterdam', destination: 'AMS' }, 'Schiphol Airport'), 'Schiphol Airport');
  assert.equal(arrivalNavigateQuery({ city: 'Amsterdam', destination: 'AMS' }), 'Amsterdam Airport (AMS)');
  assert.equal(arrivalNavigateQuery({ city: '', destination: 'AMS' }), 'AMS Airport');
});

test('the board asks for gate and belt every thirty seconds', () => {
  assert.equal(ARRIVAL_BOARD_REFRESH_MS, 30_000);
  assert.equal(ARRIVAL_BOARD_WINDOW_MS, 2 * 3600_000);
});
