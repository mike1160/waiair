import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNotificationData } from './notificationDeepLink.ts';
import { findNotificationMatch, isGmailImportNotification, notificationTarget } from './notificationTarget.ts';

const TRACKED = [
  { key: 'BR75|2026-09-15', flightNumber: 'BR75', flightId: 'br75-id' },
  { key: 'KL875|2026-10-05', flightNumber: 'KL875', flightId: 'kl875-id' },
];
const BOARD = [
  { id: 'tg403-id', number: 'TG403' },
];

test('a notification for a tracked flight opens its detail card', () => {
  const data = buildNotificationData({ flightNumber: 'KL875', kind: 'boarding', flightKey: 'KL875|2026-10-05' });
  const target = notificationTarget(data, { tracked: TRACKED, board: BOARD });
  assert.equal(target.screen, 'detail');
  assert.deepEqual(target.screen === 'detail' ? target.match : null, { where: 'tracked', index: 1 });
  assert.equal(target.screen === 'detail' ? target.focusSection : null, 'boarding');
  assert.equal(target.defer, false);
});

test('all four notification kinds route to the detail card, each at its own section', () => {
  const cases: Array<[string, string]> = [
    ['boarding', 'boarding'],
    ['delay', 'eu261'],
    ['gate', 'gate'],
    ['landed', 'globe'],
  ];
  for (const [kind, section] of cases) {
    const data = buildNotificationData({ flightNumber: 'BR75', kind, flightKey: 'BR75|2026-09-15' });
    const target = notificationTarget(data, { tracked: TRACKED, board: BOARD });
    assert.equal(target.screen, 'detail', `${kind} must open the detail card`);
    assert.equal(target.screen === 'detail' ? target.focusSection : null, section, `${kind} section`);
  }
});

test('a flight from the airport board is found too', () => {
  const data = buildNotificationData({ flightNumber: 'TG403', kind: 'gate' });
  const target = notificationTarget(data, { tracked: TRACKED, board: BOARD });
  assert.deepEqual(target.screen === 'detail' ? target.match : null, { where: 'board', index: 0 });
});

test('an unknown flight number falls back to a placeholder card and keeps looking', () => {
  const data = buildNotificationData({ flightNumber: 'QF1', kind: 'landed' });
  const target = notificationTarget(data, { tracked: TRACKED, board: BOARD });
  assert.equal(target.screen, 'stub');
  assert.equal(target.screen === 'stub' ? target.flightNumber : '', 'QF1');
  assert.equal(target.defer, true);
});

test('an unknown key with no flight number falls back to home — and is retried', () => {
  // A Family Safety Mode push: only ever a flightKey, so nothing can be drawn until the list is read.
  const target = notificationTarget({ kind: 'landed', source: 'family', flightKey: 'someone-elses-key' },
    { tracked: TRACKED, board: BOARD });
  assert.equal(target.screen, 'home');
  assert.equal(target.defer, true, 'the whole point of [B17]: do not drop the route');
  assert.ok(target.screen === 'home' && target.route, 'the route is kept for the retry');
});

test('a notification with no data falls back to home and is not retried', () => {
  for (const raw of [null, undefined, {}, 'nonsense', 42, { kind: 'boarding' }]) {
    const target = notificationTarget(raw, { tracked: TRACKED, board: BOARD });
    assert.equal(target.screen, 'home', `${JSON.stringify(raw)} must fall back to home`);
    assert.equal(target.defer, false, 'there is nothing here to resolve later');
    assert.equal(target.screen === 'home' ? target.route : 'x', null);
  }
});

test('a cold start resolves nothing yet, so every tap defers', () => {
  // The bug [B17] fixes: at launch the tracked list is still being read from storage.
  const data = buildNotificationData({ flightNumber: 'BR75', kind: 'boarding', flightKey: 'BR75|2026-09-15' });
  const target = notificationTarget(data, {});
  assert.equal(target.screen, 'stub');
  assert.equal(target.defer, true);
});

test('the Gmail auto-sync notification is not a flight', () => {
  assert.equal(isGmailImportNotification({ gmailImport: '1' }), true);
  assert.equal(isGmailImportNotification({ gmailImport: '0' }), false);
  assert.equal(isGmailImportNotification(null), false);
  assert.equal(notificationTarget({ gmailImport: '1' }).screen, 'gmailImport');
});

test('a key is trusted over a number, so a rotation cannot open the wrong leg', () => {
  const twoLegs = [
    { key: 'BR75|2026-09-15', flightNumber: 'BR75' },
    { key: 'BR75|2026-09-22', flightNumber: 'BR75' },
  ];
  const data = buildNotificationData({ flightNumber: 'BR75', kind: 'gate', flightKey: 'BR75|2026-09-22' });
  assert.deepEqual(
    findNotificationMatch(notificationTarget(data, { tracked: twoLegs }).route!, twoLegs, []),
    { where: 'tracked', index: 1 },
  );
});

test('lowercase and spaced flight numbers still match', () => {
  const target = notificationTarget({ flightNumber: 'kl 875', kind: 'landed' }, { tracked: TRACKED });
  assert.deepEqual(target.screen === 'detail' ? target.match : null, { where: 'tracked', index: 1 });
});
