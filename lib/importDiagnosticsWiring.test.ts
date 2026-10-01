import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/** Where [W/14] had to land in files that import react-native. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/14] every result of addTrackByNumber is counted', () => {
  const app = read('App.tsx');
  for (const r of ["result==='limit'", "result==='failed'", "result==='invalid'"]) {
    assert.ok(app.includes(r), `${r} must be tallied`);
  }
  assert.ok(app.includes('alreadyTracked: diag.alreadyTracked+1'));
  assert.ok(app.includes('importDiagnosticsRef.current = diag;'), 'and handed to the screen');
});

test('[W/14] the diagnostics carry the Pro status and the permission state', () => {
  const app = read('App.tsx');
  assert.ok(app.includes('isPro: !!isProRef.current'), 'what the import actually ran with');
  assert.ok(app.includes('notify: notifySnapshot()'));
  assert.ok(app.includes('queueSaved: pending.length > 0'));
  // [W/19] Same re-read, now also picking up the body reasons fetchMessageTexts wrote on its way through.
  assert.ok(
    app.includes([
      '      diag={',
      '        ...diag,',
      '        added: addedFlights,',
      '        isPro: !!isProRef.current,',
      '        notify: notifySnapshot(),',
      '        bodyNotes: bodyFetchLines(),',
      '      };',
    ].join('\n')),
    're-read after the loop, since the entitlement answer may arrive during it',
  );
});

test('[W/14] the permission call records where it got to without changing what it decides', () => {
  const app = read('App.tsx');
  const fn = app.slice(app.indexOf('async function ensureNotifyPermission'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(body.includes('markNotifyAsked();'));
  assert.ok(body.includes('markNotifyResolved(true); return true;'));
  assert.ok(body.includes('markNotifyResolved(false); return false;'));
  assert.ok(body.includes("markNotifyResolved('error');"));
  assert.ok(body.includes('return status===\'granted\';'), 'the return values are untouched');
});

test('[W/14] the three silent failure points now write to the screen', () => {
  const app = read('App.tsx');
  for (const where of ["'applyGmailImports'", '`addTrackByNumber ${clean}`', '`dateMismatch ${clean}`']) {
    assert.ok(app.includes(`withDiagnosticError(`) && app.includes(where), `${where} must be recorded`);
  }
  // The toasts stay for the callers that are not behind a full-screen modal: no behaviour change.
  assert.ok(app.includes('showToast(e?.message || t().couldNotAdd(clean));'));
});

test('[W/14] doImport can no longer end in silence', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  assert.ok(screen.includes('Promise.race(['), 'the import races a deadline');
  assert.ok(screen.includes('IMPORT_DIAGNOSTIC_TIMEOUT_MS'), 'the tested one');
  assert.ok(screen.includes("setStalled('timeout');"));
  assert.ok(screen.includes('if (!outcomeOrNull) setStalled(\'noOutcome\');'), 'a null outcome is an answer too');
  assert.ok(screen.includes('} catch {'), 'and a throw is caught, which it was not before');
});

test('[W/14] a stalled import shows a failure and a retry, not a spinner', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  const success = screen.slice(screen.indexOf("if (phase === 'success')"));
  assert.ok(success.includes(') : stalled ? ('), 'the spinner has a branch in front of it now');
  assert.ok(success.includes('t().gmailScanFailed'), 'reusing existing copy, no new i18n');
  assert.ok(success.includes('onPress={() => void doImport()}'), 'and a retry');
});

test('[W/14] the screen renders the diagnostics, selectable', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  assert.ok(screen.includes('diagnosticsLines(diagnostics).map('));
  assert.ok(screen.includes('style={styles.loginDetail} selectable'));
  const app = read('App.tsx');
  assert.ok(app.includes('getImportDiagnostics={()=>importDiagnosticsRef.current}'));
  assert.ok(app.includes('importDiagnosticsRef.current = null;'), 'cleared per run, so counts are never stale');
});
