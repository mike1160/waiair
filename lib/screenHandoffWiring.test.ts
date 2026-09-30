import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/** The three handoff fixes, in the files they have to exist in [W/7]. Text-based: all import react-native. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/7] the opening screen can no longer be stranded by a lost callback', () => {
  const screen = read('screens/OpeningScreen.tsx');
  assert.ok(screen.includes('exitTimer.current = setTimeout(once, exitFallbackMs(EXIT_MS));'), 'a fallback exists');
  assert.ok(screen.includes('.start(once);'), 'and the animation hands over through the same latch');
  assert.ok(screen.includes('if (handedOver) return;'), 'so only one of them ever hands over');
  assert.ok(
    screen.includes('useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);'),
    'and the timer is cleared on unmount',
  );
});

test('[W/7] the Gmail screen no longer consults app state at all', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  // The word still appears in the comment that explains why the listener went; the constructs must not.
  assert.ok(!screen.includes('AppState.addEventListener'), 'no listener');
  assert.ok(!/^\s*AppState,$/m.test(screen), 'and AppState is no longer imported');
  assert.ok(!screen.includes('OAUTH_RECOVERY_MS'), 'and so is the two-second timer');
});

test('[W/7] nothing dismisses the Gmail screen while a sign-in is in flight', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  const watchdog = screen.slice(screen.indexOf('A sign-in that never answers'));
  const body = watchdog.slice(0, watchdog.indexOf('}, [visible]);'));
  assert.ok(!body.includes('onClose()'), 'the stall recovery must never dismiss the presenting modal');
  assert.ok(body.includes("setPhase('error')"), 'it shows the error phase instead');
  assert.ok(body.includes('signInWatchdogAction({'), 'using the tested rule');
  assert.ok(body.includes("detail: 'stalled · no answer from Google'"), 'and says what happened');
});

test('[W/7] the fresh-install Google button routes to Gmail connect', () => {
  const app = read('App.tsx');
  assert.ok(app.includes('const openGmailFromOpening=useCallback('), 'the handler exists');
  assert.ok(app.includes('onGoogle={()=>{ void openGmailFromOpening(); }}'), 'and is wired to the button');
  assert.ok(app.includes('setShowGmailImport(true);'), 'it opens the import screen');
  assert.ok(!app.includes('startGmailDiscovery'), 'the old no-op path is gone');
});

test('[W/7] the two full-screen modals are handed over with a gap', () => {
  const app = read('App.tsx');
  const handler = app.slice(app.indexOf('const openGmailFromOpening=useCallback('));
  const body = handler.slice(0, handler.indexOf('},[closeOpening]);'));
  assert.ok(body.indexOf('await closeOpening();') < body.indexOf('MODAL_HANDOFF_MS'), 'dismiss first');
  assert.ok(body.indexOf('MODAL_HANDOFF_MS') < body.indexOf('setShowGmailImport(true)'), 'then wait, then present');
});
