import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DISCOVERY_COPY_KEYS,
  landingDiscovery,
  landingPushCopy,
  parseShownDiscoveryIds,
  withShownDiscoveryId,
} from './landingDiscovery.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Klook hubs map by IATA (both airports of a city), everything else falls back to Tiqets', () => {
  assert.deepEqual(landingDiscovery('BKK'), { provider: 'klook', copy: 'Bangkok' });
  assert.deepEqual(landingDiscovery('dmk'), { provider: 'klook', copy: 'Bangkok' });
  assert.deepEqual(landingDiscovery(' HND '), { provider: 'klook', copy: 'Tokyo' });
  assert.deepEqual(landingDiscovery('ORY'), { provider: 'klook', copy: 'Paris' });
  assert.deepEqual(landingDiscovery('BER'), { provider: 'tiqets', copy: 'Fallback' });
  assert.deepEqual(landingDiscovery(undefined), { provider: 'tiqets', copy: 'Fallback' });
});

test('shown ids: parse defensively, dedupe, cap', () => {
  assert.deepEqual(parseShownDiscoveryIds(null), []);
  assert.deepEqual(parseShownDiscoveryIds('not json'), []);
  assert.deepEqual(parseShownDiscoveryIds('{"a":1}'), []);
  assert.deepEqual(parseShownDiscoveryIds('["TG205:2026-09-14",2,""]'), ['TG205:2026-09-14']);

  const list = ['a'];
  assert.equal(withShownDiscoveryId(list, 'a'), list);
  assert.deepEqual(withShownDiscoveryId(list, 'b'), ['a', 'b']);

  const full = Array.from({ length: 200 }, (_, i) => `f${i}`);
  const next = withShownDiscoveryId(full, 'new');
  assert.equal(next.length, 200);
  assert.equal(next[0], 'f1');
  assert.equal(next[199], 'new');
});

test('landed push copy uses the city when known', () => {
  const copy = {
    landed: 'Landed',
    landedDotNum: (num: string) => `Landed · ${num}`,
    landedInPush: (city: string) => `You've landed in ${city} 🛬`,
    landedThingsNearby: 'Things to do nearby — tap to explore.',
  };
  assert.deepEqual(landingPushCopy(copy, 'Bangkok', 'TG205'), {
    title: "You've landed in Bangkok 🛬",
    body: 'Things to do nearby — tap to explore.',
  });
  assert.deepEqual(landingPushCopy(copy, '  ', 'TG205'), { title: 'Landed', body: 'Landed · TG205' });
});

test('every shipped locale has the discovery + landed push strings', () => {
  const files = [
    'i18n/locales/en.json', 'i18n/locales/nl.json', 'zh_translations.json', 'i18n/locales/th.json',
    'i18n/locales/de.json', 'i18n/locales/ru.json', 'i18n/locales/ja.json', 'i18n/locales/ko.json',
    'i18n/locales/vi.json', 'i18n/locales/id.json', 'i18n/locales/es.json',
  ];
  const keys = [
    ...DISCOVERY_COPY_KEYS.flatMap(k => [`discovery${k}Title`, `discovery${k}Body`]),
    'discoveryExplore',
    'partnerLink',
    'landedInPush',
    'landedThingsNearby',
  ];
  const fnParams = JSON.parse(readFileSync(join(ROOT, 'lib/en_fn_params.json'), 'utf8'));
  assert.deepEqual(fnParams.discoveryExplore, ['city']);
  assert.deepEqual(fnParams.landedInPush, ['city']);
  for (const file of files) {
    const json = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as Record<string, unknown>;
    for (const key of keys) {
      assert.ok(typeof json[key] === 'string' && (json[key] as string).trim(), `${file} missing ${key}`);
    }
    assert.ok(String(json.discoveryExplore).includes('{city}'), `${file} discoveryExplore needs {city}`);
    assert.ok(String(json.landedInPush).includes('{city}'), `${file} landedInPush needs {city}`);
  }
});
