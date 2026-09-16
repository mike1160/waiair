import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardingPassSummary, julianDayToIso, parseBcbp, searchSeedFromBoardingPass } from './bcbp.ts';

/** 60-character single-leg BCBP for TG403 BKK → SIN on Julian day 258 (15 Sep 2026). */
const BCBP = `M1${'DOE/JOHN'.padEnd(20, ' ')}EABC123 BKKSINTG 0403 258Y012A0045 100`;

test('parseBcbp reads flight, route, date, seat and PNR from a BCBP barcode', () => {
  const pass = parseBcbp(BCBP);
  assert.ok(pass);
  assert.equal(pass.flightNumber, 'TG403');
  assert.equal(pass.from, 'BKK');
  assert.equal(pass.to, 'SIN');
  assert.equal(pass.pnr, 'ABC123');
  assert.equal(pass.seat, '12A');
  assert.equal(pass.compartment, 'Y');
  assert.equal(pass.sequence, '45');
  assert.equal(pass.dateIso, julianDayToIso(258, new Date(Date.UTC(2026, 8, 15))));
  assert.equal(pass.dateIso, '2026-09-15');
});

test('parseBcbp ignores trailing line breaks and typed flight numbers still work', () => {
  const pass = parseBcbp(`${BCBP}\r\n`);
  assert.equal(pass?.flightNumber, 'TG403');
  assert.equal(parseBcbp('tg 403')?.flightNumber, 'TG403');
  assert.equal(parseBcbp(''), null);
});

test('boardingPassSummary is flight · route · Found!', () => {
  assert.equal(
    boardingPassSummary({ flightNumber: 'TG403', from: 'BKK', to: 'SIN' }),
    'TG403 · BKK → SIN · Found!',
  );
});

test('searchSeedFromBoardingPass is flight number + date + origin for Continue', () => {
  const pass = parseBcbp(BCBP);
  assert.ok(pass);
  assert.deepEqual(searchSeedFromBoardingPass(pass), {
    query: 'TG403',
    dateYmd: '2026-09-15',
    originIata: 'BKK',
  });
  assert.deepEqual(searchSeedFromBoardingPass({ flightNumber: 'br 75' }), { query: 'BR75' });
});
