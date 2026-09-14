import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CREDIT_PACKS,
  FREE_FLIGHT_ALLOWANCE,
  creditsForProduct,
  emptyLedger,
  freeFlightsLeft,
  markSettled,
  parseLedger,
  releaseTrack,
  reserveTrack,
  settleLocally,
  snapshotFor,
  type CreditLedger,
  type CreditSnapshot,
} from './credits.ts';

const signedOut = (ledger: CreditLedger): CreditSnapshot => snapshotFor(ledger, null, false);
const signedIn = (ledger: CreditLedger, balance: number, freeUsed: number): CreditSnapshot =>
  snapshotFor(ledger, { balance, freeUsed }, true);

test('credit packs match the store product IDs', () => {
  assert.deepEqual(CREDIT_PACKS.map(p => [p.productId, p.credits]), [
    ['com.waiair.credits.5', 5],
    ['com.waiair.credits.15', 15],
    ['com.waiair.credits.50', 50],
  ]);
  assert.equal(creditsForProduct('com.waiair.credits.15'), 15);
  assert.equal(creditsForProduct('waiair_pro_monthly'), 0);
  assert.equal(FREE_FLIGHT_ALLOWANCE, 3);
});

test('snapshot: signed out uses the device count and no credits; signed in uses the server', () => {
  const ledger = { ...emptyLedger(), freeUsed: 2 };
  assert.deepEqual(signedOut(ledger), { signedIn: false, balance: 0, freeUsed: 2 });
  assert.deepEqual(signedIn(ledger, 7, 3), { signedIn: true, balance: 7, freeUsed: 3 });
  assert.deepEqual(snapshotFor(ledger, null, true), { signedIn: true, balance: 0, freeUsed: 2 });
});

test('signed out: 3 free flights on the device, then the paywall (credits need sign-in)', () => {
  let ledger = emptyLedger();
  for (const key of ['f1', 'f2', 'f3']) {
    const r = reserveTrack(ledger, signedOut(ledger), key, false);
    assert.equal(r.allowed, true);
    ledger = settleLocally(r.ledger, key, false);
  }
  assert.equal(ledger.freeUsed, 3);
  assert.equal(freeFlightsLeft(ledger, signedOut(ledger)), 0);
  assert.equal(reserveTrack(ledger, signedOut(ledger), 'f4', false).allowed, false);
});

test('signed in: server free flights and balance, minus pending reservations', () => {
  let ledger = emptyLedger();
  const snap = () => signedIn(ledger, 2, 3);
  const a = reserveTrack(ledger, snap(), 'a', false);
  assert.equal(a.allowed, true);
  assert.equal(a.ledger.charges.a.kind, 'credit');
  ledger = a.ledger;
  ledger = reserveTrack(ledger, snap(), 'b', false).ledger;
  assert.equal(reserveTrack(ledger, snap(), 'c', false).allowed, false);

  // The proxy settles; the balance then comes back lower from the server.
  ledger = markSettled(ledger, 'a', 'credit');
  assert.equal(reserveTrack(ledger, signedIn(ledger, 1, 3), 'c', false).allowed, false);
  ledger = releaseTrack(ledger, 'b');
  assert.equal(reserveTrack(ledger, signedIn(ledger, 1, 3), 'c', false).allowed, true);
});

test('pending free reservations count against the server free flights', () => {
  let ledger = emptyLedger();
  ledger = reserveTrack(ledger, signedIn(ledger, 0, 2), 'x', false).ledger;
  assert.equal(ledger.charges.x.kind, 'free');
  assert.equal(freeFlightsLeft(ledger, signedIn(ledger, 0, 2)), 0);
  assert.equal(reserveTrack(ledger, signedIn(ledger, 0, 2), 'y', false).allowed, false);
});

test('once per flight: re-track is free, settled charges are not released, credits never settle locally', () => {
  let ledger = reserveTrack(emptyLedger(), signedIn(emptyLedger(), 3, 3), 'k', false).ledger;
  assert.equal(settleLocally(ledger, 'k', false), ledger);
  ledger = markSettled(ledger, 'k', 'credit');
  assert.equal(markSettled(ledger, 'k', 'free'), ledger);
  assert.equal(releaseTrack(ledger, 'k'), ledger);
  const again = reserveTrack(ledger, signedIn(ledger, 0, 3), 'k', false);
  assert.equal(again.allowed, true);
  assert.equal(again.ledger, ledger);
});

test('Pro is unlimited and never charged, even for flights reserved before upgrading', () => {
  const ledger = { ...emptyLedger(), freeUsed: 3 };
  const pro = reserveTrack(ledger, signedOut(ledger), 'p', true);
  assert.equal(pro.allowed, true);
  assert.equal(pro.ledger, ledger);

  const reserved = reserveTrack(emptyLedger(), signedOut(emptyLedger()), 'q', false).ledger;
  const upgraded = settleLocally(reserved, 'q', true);
  assert.equal(upgraded.freeUsed, 0);
  assert.equal(upgraded.charges.q, undefined);
});

test('parseLedger is defensive, ignores v1 balance fields and drops expired charges', () => {
  assert.deepEqual(parseLedger(null), emptyLedger());
  assert.deepEqual(parseLedger('not json'), emptyLedger());
  const day = 24 * 60 * 60 * 1000;
  const now = 100 * day;
  const ledger = parseLedger(JSON.stringify({
    purchased: 15, used: 2, freeUsed: '3',
    charges: {
      freshPending: { kind: 'credit', settled: false, at: now - day },
      oldPending: { kind: 'free', settled: false, at: now - 15 * day },
      recentSettled: { kind: 'free', settled: true, at: now - 20 * day },
      oldSettled: { kind: 'credit', settled: true, at: now - 31 * day },
      junk: { kind: 'gift', settled: true, at: now },
    },
  }), now);
  assert.deepEqual(Object.keys(ledger), ['freeUsed', 'charges']);
  assert.equal(ledger.freeUsed, 3);
  assert.deepEqual(Object.keys(ledger.charges).sort(), ['freshPending', 'recentSettled']);
});
