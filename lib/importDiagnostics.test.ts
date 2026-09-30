import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IMPORT_DIAGNOSTIC_TIMEOUT_MS,
  MAX_DIAGNOSTIC_ERRORS,
  diagnosticsLines,
  emptyDiagnostics,
  importTimedOut,
  withDiagnosticError,
} from './importDiagnostics.ts';

test('[W/14] the 34-mail case reads off the screen', () => {
  // Three free flights, thirty-one refused, and Pro not yet answered by RevenueCat on a cold start.
  const d = {
    ...emptyDiagnostics(),
    added: 3,
    limitReached: 31,
    isPro: false,
    notify: { phase: 'granted' as const, waitedMs: 1400 },
    queueSaved: true,
  };
  const lines = diagnosticsLines(d);
  assert.equal(lines[0], 'added 3 · limit 31 · failed 0 · invalid 0');
  assert.equal(lines[1], 'isPro false · notify granted 1400ms · queue saved');
});

test('[W/14] a notification dialog that never came back is visible as such', () => {
  const d = { ...emptyDiagnostics(), notify: { phase: 'pending' as const, waitedMs: 19000 } };
  assert.ok(diagnosticsLines(d)[1].includes('notify pending 19000ms'));
});

test('[W/14] a queue that was not written says so, because then there is nothing to import', () => {
  assert.ok(diagnosticsLines(emptyDiagnostics())[1].includes('queue NOT saved'));
  assert.ok(diagnosticsLines({ ...emptyDiagnostics(), queueSaved: true })[1].includes('queue saved'));
});

test('[W/14] failed and invalid are counted, which they were not before', () => {
  const d = { ...emptyDiagnostics(), failed: 2, invalid: 1, alreadyTracked: 4 };
  assert.equal(diagnosticsLines(d)[0], 'added 0 · limit 0 · failed 2 · invalid 1 · already 4');
});

test('[W/14] errors are labelled by where they came from', () => {
  let d = emptyDiagnostics();
  d = withDiagnosticError(d, 'addTrackByNumber', new Error('Network request failed'));
  d = withDiagnosticError(d, 'applyGmailImports', 'boom');
  assert.deepEqual(d.errors, [
    'addTrackByNumber: Network request failed',
    'applyGmailImports: boom',
  ]);
  assert.deepEqual(diagnosticsLines(d).slice(2), d.errors);
});

test('[W/14] error text is trimmed, flattened and capped in length', () => {
  const d = withDiagnosticError(emptyDiagnostics(), 'x', `  a\n\nb   c  ${'y'.repeat(300)}`);
  assert.ok(!d.errors[0].includes('\n'));
  assert.ok(d.errors[0].startsWith('x: a b c '));
  assert.ok(d.errors[0].length <= 120 + 3, `got ${d.errors[0].length}`);
});

test('[W/14] the error list stops growing, so it cannot fill the card', () => {
  let d = emptyDiagnostics();
  for (let i = 0; i < 20; i += 1) d = withDiagnosticError(d, 'loop', `e${i}`);
  assert.equal(d.errors.length, MAX_DIAGNOSTIC_ERRORS);
  assert.equal(d.errors[0], 'loop: e0', 'the first ones are the informative ones');
});

test('[W/14] an empty or missing message still names where it happened', () => {
  assert.equal(withDiagnosticError(emptyDiagnostics(), 'doImport', undefined).errors[0], 'doImport: unknown');
  assert.equal(withDiagnosticError(emptyDiagnostics(), 'doImport', '').errors[0], 'doImport: unknown');
  assert.equal(withDiagnosticError(emptyDiagnostics(), 'doImport', {}).errors[0], 'doImport: unknown');
});

test('[W/14] twenty seconds without an outcome is a timeout', () => {
  assert.equal(IMPORT_DIAGNOSTIC_TIMEOUT_MS, 20000);
  assert.equal(importTimedOut(1000, 1000 + 19999), false);
  assert.equal(importTimedOut(1000, 1000 + 20000), true);
  assert.equal(importTimedOut(1000, 1000 + 60000), true);
  assert.equal(importTimedOut(1000, 5000, 1000), true, 'the limit is injectable for the tests');
});

test('[W/14] a nonsense clock never fires the timeout', () => {
  assert.equal(importTimedOut(NaN, 5000), false);
  assert.equal(importTimedOut(1000, NaN), false);
});

test('[W/14] no diagnostics at all renders nothing, rather than empty lines', () => {
  assert.deepEqual(diagnosticsLines(null), []);
  assert.deepEqual(diagnosticsLines(undefined), []);
});
