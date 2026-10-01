/**
 * [W/19] Three counts that add up.
 *
 * A scan of three already-flown confirmations reported "3 already flown" and "3 emails produced nothing" at
 * the same time, about the same three mails. Both lines came from the same plan: an already-flown mail has
 * no flights left, so `empty` is true and it landed in unparsedIds as well as in flightSkipped. And the one
 * number behind the second line was the sum of three different things — mails read and empty, mails whose
 * body never arrived, and these — so no wording of it could have been true.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isEmptyOutcome, parseImportedMessages, planImports, summarizeImport } from './gmailImport.ts';

const TODAY = '2026-10-01';

/** Three confirmations for trips that are over. Dated well outside the grace window, as real ones were. */
const FLOWN = [
  { id: 'f1', subject: 'Uw boeking is bevestigd', from: 'no-reply@klm.com', text: 'KL843 Amsterdam - Bangkok 02-09-2026' },
  { id: 'f2', subject: 'Uw boeking is bevestigd', from: 'no-reply@klm.com', text: 'KL844 Bangkok - Amsterdam 16-09-2026' },
  { id: 'f3', subject: 'E-ticket', from: 'no-reply@thaiairways.com', text: 'TG920 Bangkok - Frankfurt 20-09-2026' },
];

function flownOutcome() {
  return summarizeImport(planImports(parseImportedMessages(FLOWN, { todayIso: TODAY }), []));
}

test('three flown mails: alreadyFlown 3, unparsed 0, unreadable 0', () => {
  const outcome = flownOutcome();
  assert.equal(outcome.alreadyFlown, 3);
  assert.equal(outcome.unparsed, 0, 'these mails were read perfectly well and said exactly what they said');
  assert.equal(outcome.unreadable, 0, 'and every body arrived');
  assert.equal(outcome.dateUnclear, 0);
  assert.equal(outcome.flightsAdded, 0);
});

test('no mail is counted twice', () => {
  const plan = planImports(parseImportedMessages(FLOWN, { todayIso: TODAY }), []);
  assert.deepEqual(plan.unparsedIds, [], 'a mail with a reason is not also a mail with none');
  assert.deepEqual(plan.skippedOnlyIds, ['f1', 'f2', 'f3']);
  assert.equal(plan.flightsSkipped.length, 3);
  const outcome = flownOutcome();
  const reported = outcome.alreadyFlown + outcome.dateUnclear + outcome.unparsed + outcome.unreadable;
  assert.equal(reported, 3, 'three mails in, three mails accounted for');
});

test('a flown mail still stays pending, so a later scan can look again', () => {
  const plan = planImports(parseImportedMessages(FLOWN, { todayIso: TODAY }), []);
  assert.deepEqual(plan.importedIds, [], 'nothing came of them, so none is written off as imported');
});

test('a mail with no date at all is unclear, not flown and not unparsed', () => {
  const plan = planImports(parseImportedMessages([
    { id: 'u1', subject: 'Uw boeking is bevestigd', from: 'no-reply@klm.com', text: 'KL843 Amsterdam - Bangkok' },
  ], { todayIso: TODAY }), []);
  const outcome = summarizeImport(plan);
  assert.equal(outcome.dateUnclear, 1);
  assert.equal(outcome.alreadyFlown, 0);
  assert.equal(outcome.unparsed, 0);
  assert.deepEqual(plan.skippedOnlyIds, ['u1']);
});

test('a mail that really did hold nothing is still counted as unparsed', () => {
  const plan = planImports(parseImportedMessages([
    { id: 'n1', subject: 'Our autumn newsletter', from: 'news@example.com', text: 'Read about our new lounges' },
  ], { todayIso: TODAY }), []);
  const outcome = summarizeImport(plan);
  assert.equal(outcome.unparsed, 1);
  assert.equal(outcome.alreadyFlown, 0);
  assert.equal(outcome.unreadable, 0);
  assert.deepEqual(plan.skippedOnlyIds, [], 'nothing to say about it, which is the whole difference');
});

test('one mail with a flown leg and a future leg is reported once in each column', () => {
  const plan = planImports(parseImportedMessages([{
    id: 'mixed',
    subject: 'Uw boeking is bevestigd',
    from: 'no-reply@klm.com',
    text: 'KL843 Amsterdam - Bangkok 02-09-2026\nKL844 Bangkok - Amsterdam 20-11-2026',
  }], { todayIso: TODAY }), []);
  const outcome = summarizeImport(plan);
  assert.equal(outcome.alreadyFlown, 1);
  assert.equal(outcome.unparsed, 0, 'the mail produced a flight, so it is not an empty mail');
  assert.deepEqual(plan.importedIds, ['mixed']);
  assert.equal(plan.flights.length, 1);
});

test('the three counts are three separate lines on the screen', () => {
  const screen = readFileSync(new URL('../screens/GmailImportScreen.tsx', import.meta.url), 'utf8');
  for (const expr of [
    'outcome.alreadyFlown ? `✕  ${t().gmailResultFlown(outcome.alreadyFlown)}`',
    'outcome.dateUnclear ? `✕  ${t().gmailResultDateUnclear(outcome.dateUnclear)}`',
    'outcome.unparsed ? `✕  ${t().gmailResultFailed(outcome.unparsed)}`',
    'outcome.unreadable ? `✕  ${t().gmailResultUnreadable(outcome.unreadable)}`',
  ]) {
    assert.ok(screen.includes(expr), `the result card must report: ${expr}`);
  }
  assert.equal(screen.includes('outcome.failed'), false, 'the summed count is gone, not merely unused');
});

test('every shipped locale can say a body never arrived', () => {
  const root = new URL('../', import.meta.url);
  const paths = [
    'i18n/locales/en.json', 'i18n/locales/nl.json', 'zh_translations.json', 'i18n/locales/th.json',
    'i18n/locales/de.json', 'i18n/locales/ru.json', 'i18n/locales/ja.json', 'i18n/locales/ko.json',
    'i18n/locales/vi.json', 'i18n/locales/id.json', 'i18n/locales/es.json',
  ];
  const en = JSON.parse(readFileSync(new URL('i18n/locales/en.json', root), 'utf8')) as Record<string, string>;
  for (const rel of paths) {
    const json = JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as Record<string, string>;
    const value = json.gmailResultUnreadable;
    assert.equal(typeof value, 'string', `${rel} is missing gmailResultUnreadable`);
    assert.ok(value.includes(' | '), `${rel} needs a singular and a plural`);
    assert.ok(value.includes('{n}'), `${rel} must carry the count`);
    if (rel !== 'i18n/locales/en.json') {
      assert.notEqual(value, en.gmailResultUnreadable, `${rel} is still the English string`);
    }
  }
  // The four locales that are not shipped are deliberately left alone.
  for (const rel of ['i18n/locales/ar.json', 'i18n/locales/fr.json', 'i18n/locales/it.json', 'i18n/locales/pt.json']) {
    const json = JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as Record<string, string>;
    assert.equal('gmailResultUnreadable' in json, false, `${rel} must stay untouched`);
  }
});

test('an empty outcome still means empty', () => {
  assert.equal(isEmptyOutcome(flownOutcome()), false, 'three flown confirmations is not "nothing happened"');
  assert.equal(isEmptyOutcome(summarizeImport(planImports([], []))), true);
});
