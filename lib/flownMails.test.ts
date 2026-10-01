/**
 * [W/19] Variant 1a: a confirmation for a trip that is over stays on the list, unticked, with a label.
 *
 * Three mails from last month turned up on every scan, ticked in advance, and importing them did nothing —
 * they produce no flight, so they are never written off as imported, and the pre-selection sees exactly what
 * it looks for: a travel brand confirming a booking.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MAX_FLOWN_MAILS,
  flownMailIds,
  mergeFlownMails,
  parseFlownMails,
  preselectIds,
} from './flownMails.ts';
import { parseImportedMessages, planImports } from './gmailImport.ts';

const TODAY = '2026-10-01';

test('the plan names the mails whose trip is over, with the date it rejected', () => {
  const plan = planImports(parseImportedMessages([
    { id: 'f1', subject: 'Uw boeking is bevestigd', from: 'no-reply@klm.com', text: 'KL843 Amsterdam - Bangkok 02-09-2026' },
    { id: 'f2', subject: 'E-ticket', from: 'no-reply@thaiairways.com', text: 'TG920 Bangkok - Frankfurt 20-09-2026' },
  ], { todayIso: TODAY }), []);
  assert.deepEqual(plan.flownMails, [
    { id: 'f1', dateIso: '2026-09-02' },
    { id: 'f2', dateIso: '2026-09-20' },
  ]);
});

test('a mail that also named a flight worth tracking is not remembered as flown', () => {
  const plan = planImports(parseImportedMessages([{
    id: 'mixed',
    subject: 'Uw boeking is bevestigd',
    from: 'no-reply@klm.com',
    text: 'KL843 Amsterdam - Bangkok 02-09-2026\nKL844 Bangkok - Amsterdam 20-11-2026',
  }], { todayIso: TODAY }), []);
  assert.deepEqual(plan.flownMails, [], 'it is imported, so the next scan never offers it again');
  assert.deepEqual(plan.importedIds, ['mixed']);
});

test('a mail with no readable date is not remembered either: unclear is not over', () => {
  const plan = planImports(parseImportedMessages([
    { id: 'u1', subject: 'Uw boeking is bevestigd', from: 'no-reply@klm.com', text: 'KL843 Amsterdam - Bangkok' },
  ], { todayIso: TODAY }), []);
  assert.deepEqual(plan.flownMails, []);
  assert.deepEqual(plan.skippedOnlyIds, ['u1'], 'still reported, just not as a trip that is over');
});

test('a mail whose date is now in the future is dropped from the memory', () => {
  /*
   * The case this must not get in the way of: the airline moved the flight, sent the change on the same
   * thread, and the mail that was over yesterday is a trip again today. Clearing is driven by what the mail
   * produced, which is the only evidence available here.
   */
  const known = [{ id: 'f1', dateIso: '2026-09-02' }];
  const plan = planImports(parseImportedMessages([{
    id: 'f1',
    subject: 'Uw boeking is gewijzigd',
    from: 'no-reply@klm.com',
    text: 'KL843 AMS - BKK 20-11-2026',
  }], { todayIso: TODAY }), []);
  assert.deepEqual(plan.importedIds, ['f1']);
  assert.deepEqual(mergeFlownMails(known, plan.flownMails, plan.importedIds), []);
});

test('the memory keeps the newest reading of a date it has seen before', () => {
  const merged = mergeFlownMails(
    [{ id: 'a', dateIso: '2026-09-02' }, { id: 'b', dateIso: '2026-09-03' }],
    [{ id: 'a', dateIso: '2026-09-05' }],
  );
  assert.deepEqual(merged, [{ id: 'b', dateIso: '2026-09-03' }, { id: 'a', dateIso: '2026-09-05' }]);
});

test('the memory has a ceiling, and the oldest records fall off it', () => {
  const known = Array.from({ length: MAX_FLOWN_MAILS }, (_, i) => ({ id: `m${i}`, dateIso: '2026-09-01' }));
  const merged = mergeFlownMails(known, [{ id: 'new', dateIso: '2026-09-02' }]);
  assert.equal(merged.length, MAX_FLOWN_MAILS);
  assert.equal(merged[merged.length - 1].id, 'new');
  assert.equal(merged.some(m => m.id === 'm0'), false, 'the oldest goes, not the newest');
});

test('rubbish out of storage is ignored rather than trusted', () => {
  assert.deepEqual(parseFlownMails(null), []);
  assert.deepEqual(parseFlownMails('not a list'), []);
  assert.deepEqual(parseFlownMails([null, 3, { id: '' }, { id: 'ok' }]), [], 'no dateIso is not a record');
  assert.deepEqual(parseFlownMails([{ id: 'ok', dateIso: '2026-09-02T10:00:00Z' }]), [{ id: 'ok', dateIso: '2026-09-02' }]);
  assert.deepEqual(parseFlownMails([{ id: 'a', dateIso: '' }]), [{ id: 'a', dateIso: '' }], 'a flight with no date still counts');
  assert.deepEqual(
    parseFlownMails([{ id: 'a', dateIso: '2026-09-02' }, { id: 'a', dateIso: '2026-09-09' }]),
    [{ id: 'a', dateIso: '2026-09-02' }],
    'one record per id',
  );
});

test('a remembered mail is not ticked in advance; everything else still is', () => {
  const items = [{ id: 'strong-1' }, { id: 'flown-1' }, { id: 'weak-1' }];
  const picked = preselectIds(items, {
    strong: id => id.startsWith('strong') || id.startsWith('flown'),
    flown: flownMailIds([{ id: 'flown-1', dateIso: '2026-09-02' }]),
  });
  assert.deepEqual([...picked], ['strong-1']);
});

test('nothing remembered means nothing changes', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  const picked = preselectIds(items, { strong: () => true, flown: new Set() });
  assert.deepEqual([...picked], ['a', 'b']);
});

test('the import screen reads the memory and leaves the row on the list', () => {
  const screen = readFileSync(new URL('../screens/GmailImportScreen.tsx', import.meta.url), 'utf8');
  assert.ok(
    screen.includes('const flownIds = flownMailIds(await loadFlownMails());'),
    'the pre-selection has to know what a previous import judged',
  );
  assert.ok(screen.includes('flown: flownIds,'), 'and pass it to preselectIds rather than filtering items');
  assert.ok(
    screen.includes('{t().gmailAlreadyFlownTag}'),
    'an unticked row with no explanation is the bug in a quieter form',
  );
  assert.equal(
    /result\.items\.filter\([^)]*flown/.test(screen),
    false,
    'the mail must stay in items: hiding it is the one thing variant 1a rules out',
  );
});

test('App.tsx saves the memory after an import, clearing what produced something', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.ok(
    app.includes('await saveFlownMails(mergeFlownMails(await loadFlownMails(), plan.flownMails, plan.importedIds));'),
    'without plan.importedIds as the cleared list, a rebooked flight stays labelled as over',
  );
});

test('clearing the import history forgets these too', () => {
  const store = readFileSync(new URL('./gmailInboxStore.ts', import.meta.url), 'utf8');
  assert.ok(
    store.includes('await AsyncStorage.multiRemove([IMPORTED_IDS_KEY, FLOWN_MAILS_KEY]);'),
    '"every mail is offered again" has to include the labels and the pre-selection',
  );
  assert.ok(store.includes('[IMPORTED_IDS_KEY, SYNC_STATUS_KEY, FLOWN_MAILS_KEY]'), 'and so does disconnecting');
});

test('the label exists in every shipped language', () => {
  const root = new URL('../', import.meta.url);
  const shipped = [
    'i18n/locales/en.json', 'i18n/locales/nl.json', 'zh_translations.json', 'i18n/locales/th.json',
    'i18n/locales/de.json', 'i18n/locales/ru.json', 'i18n/locales/ja.json', 'i18n/locales/ko.json',
    'i18n/locales/vi.json', 'i18n/locales/id.json', 'i18n/locales/es.json',
  ];
  const en = JSON.parse(readFileSync(new URL('i18n/locales/en.json', root), 'utf8')) as Record<string, string>;
  for (const rel of shipped) {
    const json = JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as Record<string, string>;
    assert.equal(typeof json.gmailAlreadyFlownTag, 'string', `${rel} is missing gmailAlreadyFlownTag`);
    if (rel !== 'i18n/locales/en.json') {
      assert.notEqual(json.gmailAlreadyFlownTag, en.gmailAlreadyFlownTag, `${rel} is still English`);
    }
  }
  for (const rel of ['i18n/locales/ar.json', 'i18n/locales/fr.json', 'i18n/locales/it.json', 'i18n/locales/pt.json']) {
    const json = JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as Record<string, string>;
    assert.equal('gmailAlreadyFlownTag' in json, false, `${rel} must stay untouched`);
  }
});
