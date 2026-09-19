import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_STATUS_COLOR, airlineShort, boardStatus, boardStatusPulses } from './airportBoard.ts';

test('where the flight is wins over being late', () => {
  assert.equal(boardStatus({ status: 'scheduled' }), 'on_time');
  assert.equal(boardStatus({ status: 'scheduled', delayed: true }), 'delayed');
  assert.equal(boardStatus({ status: 'delayed' }), 'delayed');
  assert.equal(boardStatus({ status: 'scheduled', depOffsetMin: 20 }), 'delayed');
  assert.equal(boardStatus({ status: 'scheduled', depOffsetMin: -3 }), 'on_time', 'early is not late');
  assert.equal(boardStatus({ status: 'boarding', delayed: true }), 'boarding');
  assert.equal(boardStatus({ status: 'scheduled', livePhase: 'boarding' }), 'boarding');
  assert.equal(boardStatus({ status: 'en-route', delayed: true }), 'departed');
  assert.equal(boardStatus({ status: 'scheduled', livePhase: 'enRoute' }), 'departed');
  assert.equal(boardStatus({ status: 'landed', depOffsetMin: 40 }), 'landed');
  assert.equal(boardStatus({ status: 'cancelled', delayed: true }), 'cancelled');
  assert.equal(boardStatus({ status: 'diverted' }), 'cancelled');
});

test('the spec colours, and only boarding pulses', () => {
  assert.equal(BOARD_STATUS_COLOR.on_time, '#00FF41');
  assert.equal(BOARD_STATUS_COLOR.delayed, '#FF3B30');
  assert.equal(BOARD_STATUS_COLOR.boarding, '#FFC600');
  assert.equal(BOARD_STATUS_COLOR.landed, '#888888');
  assert.equal(boardStatusPulses('boarding'), true);
  assert.equal(boardStatusPulses('delayed'), false);
});

test('the airline is its first word, upper case', () => {
  assert.equal(airlineShort('Thai Airways'), 'THAI');
  assert.equal(airlineShort('KLM'), 'KLM');
  assert.equal(airlineShort('Emirates'), 'EMIRATES');
  assert.equal(airlineShort(''), '');
  assert.equal(airlineShort(null), '');
});
