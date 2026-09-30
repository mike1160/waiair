import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { BRIEFING_TIMEOUT_MS } from './briefingClient.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/12] the answer is no longer clipped at four lines', () => {
  const panel = read('components/BriefingPanel.tsx');
  assert.ok(!panel.includes('numberOfLines={4}'), 'the clip that hid complete answers is gone');
  assert.ok(panel.includes('maxHeight: ANSWER_MAX_LINES * ANSWER_LINE_HEIGHT'), 'capped by height instead');
  assert.ok(panel.includes('nestedScrollEnabled'), 'and scrollable inside the hub, which is itself a scroll view');
  assert.ok(panel.includes('const ANSWER_MAX_LINES = 10;'));
});

test('[W/12] a long wait says so instead of looking stuck', () => {
  const panel = read('components/BriefingPanel.tsx');
  assert.ok(panel.includes('const SLOW_ANSWER_MS = 5000;'));
  assert.ok(panel.includes('slow ? copy.briefingLoadingSlow : copy.briefingLoading'));
  assert.ok(panel.includes('setSlow(false);'), 'and resets, so the next question starts from the short line');
});

test('[W/12] client and proxy give up at the same moment', () => {
  assert.equal(BRIEFING_TIMEOUT_MS, 15000);
  const proxy = read('proxy/briefing.js');
  assert.ok(proxy.includes('const TIMEOUT_MS = 15000;'), 'a client that waits longer than the proxy learns nothing');
  assert.ok(proxy.includes('const MAX_TOKENS_DEFAULT = 400;'));
  assert.ok(proxy.includes('const MAX_TOKENS_LIMIT = 500;'));
});

test('[W/12] every temperature reader goes through the one check', () => {
  for (const f of ['lib/briefingClient.ts', 'lib/briefingAnswers.ts', 'lib/destinationServices.ts']) {
    const src = read(f);
    assert.ok(src.includes('knownTemperature('), `${f} must use the shared check`);
  }
  // The three spellings of the bug, each gone from its own file.
  assert.ok(!read('lib/briefingClient.ts').includes('Number(facts.temp)'));
  assert.ok(!read('lib/briefingAnswers.ts').includes('Number(opts.temp)'));
  assert.ok(!read('lib/destinationServices.ts').includes('Number(cur.temperature_2m ?? 0)'));
});

test('[W/12] a snapshot with no temperature is no snapshot', () => {
  const src = read('lib/destinationServices.ts');
  assert.ok(src.includes('if (nowTemp === null) return null;'), 'rather than a fabricated 0°C');
});
