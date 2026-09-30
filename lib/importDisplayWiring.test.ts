import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/** Where [W/9] had to land in files that import react-native, or that are too large to load under test. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/9] both item builders name the booking through the one rule', () => {
  const scan = read('lib/gmailInboxScan.ts');
  const store = read('lib/gmailInboxStore.ts');
  assert.ok(scan.includes('sender: importDisplayName({ outerFrom: from, subject })'), 'itemFromMetadata');
  assert.ok(
    store.includes('sender: importDisplayName({ outerFrom, subject: outerSubject, recoveredFrom: original.from })'),
    'rescueForwarded, which is the one that has a recovered sender',
  );
  assert.ok(!/sender: senderName\(/.test(scan + store), 'neither may name the raw outer sender any more');
});

test('[W/9] the metadata path also stops storing the Fwd: prefix', () => {
  assert.ok(read('lib/gmailInboxScan.ts').includes('subject: stripForwardPrefix(subject) || subject'));
});

test('[W/9] the baggage line uses the arrival terminal and nothing else', () => {
  const app = read('App.tsx');
  assert.ok(app.includes('const baggageTerm = f.arrTerminal;'), 'no departure-terminal fallback');
  assert.ok(app.includes('terminal: baggageTerm,'), 'and that is what the Now card is given');
  // The other five arrTerm call sites keep their own fallbacks: this change is deliberately surgical.
  assert.ok(app.includes("const arrTerm = f.arrTerminal || (type==='arrival' ? f.terminal : '');"));
});

test('[W/9] the rate button cannot reach requestReview or a dynamic import', () => {
  const src = read('lib/storeReview.ts');
  const open = src.slice(src.indexOf('export async function openStoreListing'));
  assert.ok(!open.includes('requestReview'), 'in-app review is not a button action');
  assert.ok(!open.includes('await import('), 'and Linking comes from the top-level import');
  assert.ok(open.includes('storeListingUrl(Platform.OS)'), 'the URL comes from the tested module');
  assert.ok(src.includes("import { Linking, Platform } from 'react-native';"));
  // requestReview stays where the store may throttle it.
  assert.ok(src.includes('maybeRequestReview') && src.includes('StoreReview.requestReview()'));
});
