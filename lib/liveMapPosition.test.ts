import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  interpolatePosition,
  lerpHeading,
  positionFromCoords,
} from './liveMapPosition.ts';

test('lerpHeading takes the short way around 360', () => {
  assert.equal(Math.round(lerpHeading(350, 10, 0.5)), 0);
});

test('interpolatePosition moves along the great circle', () => {
  const from = { latitude: 13.69, longitude: 100.75, heading: 0 };
  const to = { latitude: 52.31, longitude: 4.76, heading: 90 };
  const mid = interpolatePosition(from, to, 0.5);
  assert.ok(mid);
  assert.ok(mid.latitude > from.latitude && mid.latitude < to.latitude);
  assert.equal(Math.round(mid.heading), 45);
});

test('positionFromCoords rejects empty coords', () => {
  assert.equal(positionFromCoords(0, 0), null);
  assert.ok(positionFromCoords(13.7, 100.5, 180));
});
