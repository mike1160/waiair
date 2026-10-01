/**
 * [W/19] Why a body never arrived — written down, and nothing else.
 *
 * The honest limit of this file: fetchMessageTexts lives in lib/gmailInboxStore.ts, which imports
 * AsyncStorage, so it cannot be executed here. The reason-classifying and the notebook are tested for real;
 * the claim that the function's *return value* is unchanged is checked structurally against the real source
 * — the only out.push sites, the only returns, and the fact that every recording call is a statement and so
 * cannot be part of any expression that feeds the result. Written out rather than implied, because a
 * reimplementation of that loop here would prove nothing about the loop that ships.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MAX_BODY_FETCH_NOTES,
  bodyEmptySeen,
  bodyFetchLines,
  bodyFetchNotes,
  bodyFetchSeen,
  errorBodyReason,
  httpBodyReason,
  noteBodyEmpty,
  noteBodyFetch,
  startBodyFetchLog,
} from './bodyFetchLog.ts';

const STORE = readFileSync(new URL('./gmailInboxStore.ts', import.meta.url), 'utf8');

/** The real fetchMessageTexts, from `export async function` to the closing brace in column one. */
function fetchMessageTextsSource(): string {
  const start = STORE.indexOf('export async function fetchMessageTexts');
  assert.ok(start >= 0, 'fetchMessageTexts must still exist');
  const end = STORE.indexOf('\n}\n', start);
  assert.ok(end > start, 'and still end');
  return STORE.slice(start, end + 3);
}

test('an HTTP status is the whole diagnosis', () => {
  assert.equal(httpBodyReason(429), 'http 429');
  assert.equal(httpBodyReason(401), 'http 401');
  assert.equal(httpBodyReason(503), 'http 503');
  assert.equal(httpBodyReason(0), 'http ?');
  assert.equal(httpBodyReason(NaN), 'http ?');
});

test('a thrown error lands in one of four buckets', () => {
  assert.equal(errorBodyReason(new Error('Aborted')), 'timeout');
  assert.equal(errorBodyReason(new Error('The request timed out.')), 'timeout');
  assert.equal(errorBodyReason(new Error('Network request failed')), 'network');
  assert.equal(errorBodyReason(new Error('Failed to fetch')), 'network');
  assert.equal(errorBodyReason(new Error('device is offline')), 'network');
  assert.equal(errorBodyReason(new SyntaxError('Unexpected token in JSON')), 'bad json');
  assert.equal(errorBodyReason(new Error('something odd happened')), 'error: something odd happened');
  assert.equal(errorBodyReason(null), 'error');
});

test('a long error message is cut, so the line still fits on the card', () => {
  const reason = errorBodyReason(new Error('x'.repeat(200)));
  assert.ok(reason.length <= 40, `too long: ${reason.length}`);
});

test('the count is right even when the list is full', () => {
  startBodyFetchLog();
  for (let i = 0; i < MAX_BODY_FETCH_NOTES + 3; i++) noteBodyFetch(`id-${i}`, 'http 429');
  assert.equal(bodyFetchNotes().length, MAX_BODY_FETCH_NOTES, 'at most five reasons');
  assert.equal(bodyFetchSeen(), MAX_BODY_FETCH_NOTES + 3, 'and the truth about how many there were');
  const lines = bodyFetchLines();
  assert.equal(lines[0], 'bodies: 8 unread · 0 empty · first 5');
  assert.equal(lines.length, 1 + MAX_BODY_FETCH_NOTES);
});

test('a body that arrived empty is counted apart from one that never arrived', () => {
  startBodyFetchLog();
  noteBodyFetch('aaaaaaaaaaaaaaaa', 'http 429');
  noteBodyEmpty('bbbbbbbbbbbbbbbb');
  assert.equal(bodyFetchSeen(), 1);
  assert.equal(bodyEmptySeen(), 1);
  assert.deepEqual(bodyFetchLines(), [
    'bodies: 1 unread · 1 empty',
    '  aaaaaaaa · http 429',
    '  bbbbbbbb · empty body',
  ]);
});

test('a run with nothing to report says nothing', () => {
  startBodyFetchLog();
  assert.deepEqual(bodyFetchLines(), []);
  assert.equal(bodyFetchSeen(), 0);
});

test('the notebook is emptied per run, so last import is not reported as this one', () => {
  startBodyFetchLog();
  noteBodyFetch('old', 'http 500');
  startBodyFetchLog();
  assert.deepEqual(bodyFetchNotes(), []);
  assert.equal(bodyFetchSeen(), 0);
});

test('ids are shortened and no mail content can reach a line', () => {
  startBodyFetchLog();
  noteBodyFetch('19a2b3c4d5e6f708', 'http 403');
  const [, line] = bodyFetchLines();
  assert.equal(line, '  19a2b3c4 · http 403');
  // The only two inputs are an id and a reason: there is no parameter a subject or a body could arrive in.
  assert.equal(noteBodyFetch.length, 2);
});

test('every failure path in the real fetchMessageTexts records a reason', () => {
  const src = fetchMessageTextsSource();
  assert.ok(src.includes('startBodyFetchLog();'), 'a fresh notebook per run');
  assert.ok(src.includes("for (const id of list) noteBodyFetch(id, 'no token');"), 'no token: every id');
  assert.ok(src.includes('noteBodyFetch(id, httpBodyReason(res.status));'), 'a refused request: its status');
  assert.ok(src.includes('noteBodyFetch(id, errorBodyReason(e));'), 'a thrown error: its kind');
  assert.ok(src.includes("if (!body.trim() && !ldFlight?.flightNumber) noteBodyEmpty(id);"), 'and an empty body');
});

test('the return value is untouched: the same two pushes, the same returns', () => {
  const src = fetchMessageTextsSource();
  // The two expressions that build the result, byte for byte as they were before the instrumentation.
  assert.ok(src.includes('out.push({ id, subject, from, text: `${ldText}\\n${body}`, attachments });'));
  assert.ok(src.includes('out.push({ id, subject, from, text: body, attachments });'));
  assert.equal((src.match(/out\.push\(/g) || []).length, 2, 'no third way out');
  assert.deepEqual(src.match(/return [^;]*;/g), ['return [];', 'return [];', 'return out;'],
    'two empty returns (no ids, no token) and the result — as before');
  // A statement, never part of an expression: whatever it did could not change what is pushed.
  for (const call of src.match(/.*note(BodyFetch|BodyEmpty)\(.*/g) || []) {
    assert.ok(
      /^\s*(if \(!body\.trim\(\) && !ldFlight\?\.flightNumber\) )?note(BodyFetch|BodyEmpty)\(|^\s*for \(const id of list\) noteBodyFetch\(/.test(call),
      `recording must be a statement of its own: ${call.trim()}`,
    );
  }
});

test('the reasons reach the screen, under the counts, and nowhere else', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.ok(app.includes('bodyNotes: bodyFetchLines(),'), 'read once, after the import loop');
  assert.equal((app.match(/bodyFetchLines\(/g) || []).length, 1, 'and read nowhere else');
  const diagnostics = readFileSync(new URL('./importDiagnostics.ts', import.meta.url), 'utf8');
  assert.ok(
    diagnostics.includes('return [counts, state, ...d.errors, ...(d.bodyNotes || [])];'),
    'the lines go on the card the traveller can already photograph',
  );
});
