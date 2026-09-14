import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardingPassStorageKey, isBcbpBarcode, normalizeBcbp, walletPassUrl } from './boardingPassBarcode.ts';

/** 60-character single-leg BCBP for TG403 BKK → SIN (fictional passenger). */
const BCBP = `M1${'DOE/JOHN'.padEnd(20, ' ')}EABC123 BKKSINTG 0403 258Y012A0045 100`;

test('storage key per flight number: boarding_pass_TG403', () => {
  assert.equal(boardingPassStorageKey('tg 403'), 'boarding_pass_TG403');
});

test('isBcbpBarcode accepts a real BCBP (trailing line break ignored) and rejects typed flight numbers', () => {
  assert.equal(BCBP.length, 60);
  assert.equal(isBcbpBarcode(BCBP), true);
  assert.equal(isBcbpBarcode(`${BCBP}\r\n`), true);
  assert.equal(normalizeBcbp(`${BCBP}\n`), BCBP);
  assert.equal(normalizeBcbp(`  ${BCBP}`), `  ${BCBP}`);
  assert.equal(isBcbpBarcode('TG403'), false);
  assert.equal(isBcbpBarcode(BCBP.slice(0, 50)), false);
  assert.equal(isBcbpBarcode(''), false);
});

test('walletPassUrl carries only the token, never the barcode', () => {
  const url = walletPassUrl('https://waiair-production.up.railway.app/', 'tg403', 'abc_DEF-123');
  assert.equal(url, 'https://waiair-production.up.railway.app/passes/flight/TG403?token=abc_DEF-123');
  assert.equal(url.includes('DOE'), false);
});
