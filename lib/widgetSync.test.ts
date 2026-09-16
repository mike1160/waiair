import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  pickNextTrackedFlights,
  widgetCardFromSnapshots,
  type WidgetFlightSnapshot,
} from './widgetCard.ts';

const now = Date.parse('2026-09-16T10:00:00+07:00');

function snap(over: Partial<WidgetFlightSnapshot> = {}): WidgetFlightSnapshot {
  return {
    key: 'BR75-BKK-AMS',
    flightNumber: 'BR75',
    origin: 'BKK',
    destination: 'AMS',
    status: 'scheduled',
    scheduledTime: '2026-09-16T23:50:00+07:00',
    departureTime: '2026-09-16T23:50:00+07:00',
    gate: 'D8',
    originCountry: 'TH',
    destCountry: 'NL',
    ...over,
  };
}

test('empty tracked list writes an empty widget card, not a blank payload', () => {
  const card = widgetCardFromSnapshots([], now);
  assert.equal(card.hasFlight, false);
  assert.equal(card.flightNumber, '');
  assert.ok(card.emptyTitle);
  assert.ok(card.brandLabel);
});

test('widget card is flight number, route, departure clock, status and gate', () => {
  const card = widgetCardFromSnapshots([snap()], now);
  assert.equal(card.hasFlight, true);
  assert.equal(card.flightNumber, 'BR75');
  assert.equal(card.from, 'BKK');
  assert.equal(card.to, 'AMS');
  assert.match(card.departureTime, /\d/);
  assert.ok(card.statusLabel);
  assert.equal(card.gate, 'D8');
});

test('delayed and boarding status labels reach the widget card', () => {
  const delayed = widgetCardFromSnapshots([snap({ status: 'delayed', delay: 40 })], now);
  assert.match(delayed.statusLabel.toLowerCase(), /delay/);
  const boarding = widgetCardFromSnapshots([
    snap({
      status: 'boarding',
      scheduledTime: '2026-09-16T10:25:00+07:00',
      departureTime: '2026-09-16T10:25:00+07:00',
    }),
  ], now);
  assert.match(boarding.statusLabel.toLowerCase(), /board/);
});

test('next widget flight skips landed legs when a later one is still open', () => {
  const landed = snap({
    key: 'TG401',
    flightNumber: 'TG401',
    status: 'landed',
    scheduledTime: '2026-09-16T08:00:00+07:00',
    departureTime: '2026-09-16T08:00:00+07:00',
    actualArrival: '2026-09-16T09:10:00+07:00',
  });
  const next = snap();
  assert.equal(pickNextTrackedFlights([landed, next], now)[0]?.flightNumber, 'BR75');
  assert.equal(widgetCardFromSnapshots([landed, next], now).flightNumber, 'BR75');
});
