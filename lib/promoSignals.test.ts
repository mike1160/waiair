import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemFromMetadata, promoSignals } from './gmailInboxScan.ts';

test('[W/16] Gmail\'s own Promotions label is read', () => {
  assert.deepEqual(promoSignals(['INBOX', 'CATEGORY_PROMOTIONS']), { promotions: true, unsubscribe: false });
  assert.deepEqual(promoSignals(['INBOX', 'category_promotions']), { promotions: true, unsubscribe: false });
  assert.deepEqual(promoSignals(['INBOX', 'CATEGORY_PERSONAL']), { promotions: false, unsubscribe: false });
});

test('[W/16] a List-Unsubscribe header is a newsletter tell', () => {
  const hdr = [{ name: 'List-Unsubscribe', value: '<https://x.test/u?a=1>' }];
  assert.equal(promoSignals([], hdr).unsubscribe, true);
  assert.equal(promoSignals([], [{ name: 'list-unsubscribe', value: '<mailto:x@y.test>' }]).unsubscribe, true);
  // Present but empty is not a tell.
  assert.equal(promoSignals([], [{ name: 'List-Unsubscribe', value: '  ' }]).unsubscribe, false);
  assert.equal(promoSignals([], [{ name: 'From', value: 'x@y.test' }]).unsubscribe, false);
});

test('[W/16] missing input is simply no signal, never a crash', () => {
  assert.deepEqual(promoSignals(), { promotions: false, unsubscribe: false });
  assert.deepEqual(promoSignals(null, null), { promotions: false, unsubscribe: false });
});

test('[W/16] an item carries the signals, and a caller without them loses nothing', () => {
  const headers = [
    { name: 'From', value: 'news@airasia.com' },
    { name: 'Subject', value: 'Japan Flight Deals' },
    { name: 'List-Unsubscribe', value: '<https://x.test/u>' },
  ];
  const withLabels = itemFromMetadata('m1', headers, '1', ['CATEGORY_PROMOTIONS']);
  assert.deepEqual(withLabels?.promo, { promotions: true, unsubscribe: true });
  // The old three-argument call still works: that is what keeps this change additive.
  const without = itemFromMetadata('m2', headers, '1');
  assert.deepEqual(without?.promo, { promotions: false, unsubscribe: true });
  assert.equal(without?.kind, 'flight', 'classification is untouched');
});
