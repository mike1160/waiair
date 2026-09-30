import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/** Where [W/10] had to land in files that import react-native. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/10] the connect no longer discards a consent over an echoed scope list', () => {
  const src = read('lib/gmailTripExtras.ts');
  assert.ok(
    !/!\(added\.data\.scopes \|\| \[\]\)\.includes\(SCOPE\)/.test(src),
    'the stale-cache gate must be gone',
  );
  assert.ok(src.includes("scopeGrantOutcome(added) === 'cancelled'"), 'only an outright non-success cancels');
  assert.ok(src.includes('needsScopePrompt(scopes, SCOPE)'), 'the list may still spare a needless prompt');
});

test('[W/10] validToken still does not gate on echoed scopes either', () => {
  // The lesson this fix came from: it must not regress in the place that already learned it.
  const src = read('lib/gmailTripExtras.ts');
  const fn = src.slice(src.indexOf('async function validToken'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(!body.includes('includes(SCOPE)'), 'validToken takes the token and lets Gmail decide');
});

test('[W/10] an import owes the discovery card, and pays it after the modal closes', () => {
  const app = read('App.tsx');
  assert.ok(app.includes('const discoveryAfterImportRef = useRef(false);'), 'the flag exists');
  assert.ok(app.includes('discoveryAfterImportRef.current = true;'), 'set when an import happens');
  assert.ok(
    app.includes('if(showGmailImport || !discoveryAfterImportRef.current) return undefined;'),
    'and only acted on once the import screen is gone',
  );
  assert.ok(app.includes('const timer=setTimeout(()=>{ void offerDiscovery(); }, 400);'), 'after a beat');
});

test('[W/10] onImported still returns its outcome to the success screen', () => {
  const app = read('App.tsx');
  const handler = app.slice(app.indexOf('onImported={async()=>{'));
  const body = handler.slice(0, handler.indexOf('}}'));
  assert.ok(body.includes('const outcome=await applyGmailImports({ silent:true });'));
  assert.ok(body.includes('return outcome;'), 'the import screen shows this; losing it would blank the screen');
});

test('[W/10] offerDiscovery has an in-session caller again', () => {
  const app = read('App.tsx');
  // [W/7] left it reachable only from the startup effect, with navigate:false.
  // Two call sites: the new after-import one, and the startup one. The `useCallback` definition reads
  // `offerDiscovery=useCallback(` and is deliberately not counted here.
  const calls = app.match(/offerDiscovery\(/g) || [];
  assert.equal(calls.length, 2, `expected two call sites, found ${calls.length}`);
  assert.ok(app.includes('void offerDiscovery();'), 'one of them navigates, as a found-trips screen should');
});
