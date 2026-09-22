import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WALLET_PRO_HEADER,
  WALLET_WINDOW_AFTER_MS,
  WALLET_WINDOW_BEFORE_MS,
  inWalletWindow,
  passDateParam,
  plainWalletPassUrl,
  walletPassStale,
  walletProHeaders,
} from './walletButton.ts';

const HOUR = 60 * 60 * 1000;

test('plain pass URL: /passes/flight/{NUMBER} without a token', () => {
  assert.equal(plainWalletPassUrl('https://waiair-production.up.railway.app/', 'tg 403'), 'https://waiair-production.up.railway.app/passes/flight/TG403');
});

test('Pro header only for Pro users with a RevenueCat ID', () => {
  assert.deepEqual(walletProHeaders(true, '$RCAnonymousID:abc123'), { [WALLET_PRO_HEADER]: '$RCAnonymousID:abc123' });
  assert.deepEqual(walletProHeaders(false, '$RCAnonymousID:abc123'), {});
  assert.deepEqual(walletProHeaders(true, ''), {});
  assert.deepEqual(walletProHeaders(true, null), {});
});

test('tracked card window: 48 h before departure until 12 h after', () => {
  const dep = Date.parse('2026-09-15T05:15:00Z');
  assert.equal(WALLET_WINDOW_BEFORE_MS, 48 * HOUR);
  assert.equal(inWalletWindow(dep, dep - 48 * HOUR), true);
  assert.equal(inWalletWindow(dep, dep - 48 * HOUR - 1), false);
  assert.equal(inWalletWindow(dep, dep), true);
  assert.equal(inWalletWindow(dep, dep + WALLET_WINDOW_AFTER_MS), true);
  assert.equal(inWalletWindow(dep, dep + WALLET_WINDOW_AFTER_MS + 1), false);
  assert.equal(inWalletWindow(null, dep), false);
  assert.equal(inWalletWindow(Number.NaN, dep), false);
});

test('the departure date rides along, so the pass is cut from the tracked day', () => {
  const proxy = 'https://waiair-production.up.railway.app';
  assert.equal(
    plainWalletPassUrl(proxy, 'br 75', '2026-09-29T12:15:00+07:00'),
    `${proxy}/passes/flight/BR75?date=2026-09-29`,
  );
  // AeroDataBox also writes local times with a space instead of the T.
  assert.equal(passDateParam('2026-09-29 23:50+07:00'), '2026-09-29', 'the local date, not the UTC one');
  // No date known: the URL stays exactly as it was before this fix.
  for (const bad of [undefined, null, '', '  ', 'tomorrow', '29-09-2026']) {
    assert.equal(passDateParam(bad), null, `${String(bad)} is not a date`);
    assert.equal(plainWalletPassUrl(proxy, 'BR75', bad), `${proxy}/passes/flight/BR75`);
  }
});

test('the pass is cut from the boarded leg: from= next to date=', () => {
  const proxy = 'https://waiair-production.up.railway.app';
  assert.equal(
    plainWalletPassUrl(proxy, 'BR75', '2026-09-29T12:15:00+07:00', 'bkk'),
    `${proxy}/passes/flight/BR75?date=2026-09-29&from=BKK`,
  );
  assert.equal(plainWalletPassUrl(proxy, 'BR75', null, 'BKK'), `${proxy}/passes/flight/BR75?from=BKK`);
  assert.equal(plainWalletPassUrl(proxy, 'BR75', null, 'not-an-iata'), `${proxy}/passes/flight/BR75`);
});

test('walletPassStale: another date or boarding airport than the pass in Wallet', () => {
  const pass = { date: '2026-09-29', from: 'TPE' };
  assert.equal(walletPassStale(null, '2026-09-29T07:45:00+08:00', 'TPE'), false, 'no pass added here');
  assert.equal(walletPassStale(pass, '2026-09-29T07:45:00+08:00', 'TPE'), false);
  assert.equal(walletPassStale(pass, '2026-09-30T07:45:00+08:00', 'TPE'), true, 'date moved');
  assert.equal(walletPassStale(pass, '2026-09-29T12:15:00+07:00', 'BKK'), true, 'boards in Bangkok now');
  assert.equal(walletPassStale({ date: '2026-09-29' }, '2026-09-29T12:15:00+07:00', 'BKK'), false, 'old record without airport');
});
