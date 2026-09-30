import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasTemperature, knownTemperature } from './temperatureValue.ts';

test('[W/12] null is not zero degrees — the whole bug in one line', () => {
  // Number(null) is 0 and Number.isFinite(0) is true, which is how Bangkok came to be 0°.
  assert.equal(knownTemperature(null), null);
  assert.equal(Number(null), 0, 'the trap this exists to avoid');
  assert.equal(Number.isFinite(Number(null)), true, 'and why the old guard did not catch it');
});

test('[W/12] every other way of saying nothing is also nothing', () => {
  // Number([]) is 0 and Number(false) is 0, so a whitelist of number-and-string is the only safe rule.
  for (const absent of [undefined, '', '   ', '\n', NaN, Infinity, -Infinity, 'warm', {}, [], [0], true, false]) {
    assert.equal(knownTemperature(absent), null, `${JSON.stringify(absent)} is not a temperature`);
  }
});

test('[W/12] a real zero survives, because winter exists', () => {
  assert.equal(knownTemperature(0), 0);
  assert.equal(knownTemperature('0'), 0);
  assert.equal(knownTemperature(-12.5), -12.5);
  assert.equal(hasTemperature(0), true);
});

test('[W/12] ordinary readings pass through, strings included', () => {
  assert.equal(knownTemperature(26.4), 26.4);
  assert.equal(knownTemperature('26.4'), 26.4);
  assert.equal(knownTemperature(' 31 '), 31);
  assert.equal(hasTemperature(26.4), true);
  assert.equal(hasTemperature(null), false);
});
