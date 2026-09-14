const test = require('node:test');
const assert = require('node:assert/strict');
const { PRO_CACHE_TTL_MS, createProEntitlements } = require('./proEntitlement');

const quiet = { log() {}, warn() {}, error() {} };
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function setup({ customers = {}, entitlementsStatus = 200, entitlementId } = {}) {
  let t = 1_000_000;
  const calls = [];
  const pro = createProEntitlements({
    secretKey: 'sk_test',
    projectId: 'proj1',
    entitlementId,
    now: () => t,
    log: quiet,
    fetchImpl: async (url, init) => {
      calls.push(url);
      assert.equal(init.headers.Authorization, 'Bearer sk_test');
      if (url.endsWith('/projects/proj1/entitlements?limit=100')) {
        return json(entitlementsStatus, { items: [
          { object: 'entitlement', id: 'entl_other', lookup_key: 'Lounge' },
          { object: 'entitlement', id: 'entl_pro', lookup_key: 'WaiAir Pro' },
        ] });
      }
      const m = url.match(/\/customers\/([^/]+)\/active_entitlements/);
      const customer = m && customers[decodeURIComponent(m[1])];
      if (!customer) return json(404, {});
      if (customer === 'error') return json(500, {});
      return json(200, { items: customer.map(entitlement_id => ({ object: 'customer.active_entitlement', entitlement_id })) });
    },
  });
  return { pro, calls, advance: (ms) => { t += ms; } };
}

test('isPro: active "WaiAir Pro" entitlement (looked up by key once); other entitlements, unknown customers → false', async () => {
  const { pro, calls } = setup({ customers: { 'apple:001': ['entl_pro'], '$RCAnonymousID:abc': ['entl_other'] } });
  assert.equal(await pro.isPro('apple:001'), true);
  assert.equal(await pro.isPro('$RCAnonymousID:abc'), false);
  assert.equal(await pro.isPro('line:unknown'), false);
  assert.equal(calls.filter(u => u.endsWith('/entitlements?limit=100')).length, 1);
  assert.ok(calls.includes('https://api.revenuecat.com/v2/projects/proj1/customers/%24RCAnonymousID%3Aabc/active_entitlements?limit=100'));
});

test('isPro: cached per user for 10 minutes; failures are not Pro and not cached', async () => {
  const customers = { 'apple:001': ['entl_pro'], 'apple:002': 'error' };
  const { pro, calls, advance } = setup({ customers, entitlementId: 'entl_pro' });
  assert.equal(await pro.isPro('apple:001'), true);
  customers['apple:001'] = [];
  assert.equal(await pro.isPro('apple:001'), true);
  advance(PRO_CACHE_TTL_MS);
  assert.equal(await pro.isPro('apple:001'), false);
  assert.equal(calls.some(u => u.includes('/entitlements?')), false);

  assert.equal(await pro.isPro('apple:002'), false);
  customers['apple:002'] = ['entl_pro'];
  assert.equal(await pro.isPro('apple:002'), true);
});

test('isPro: false without configuration, without an ID or with a malformed one; entitlement lookup errors → false', async () => {
  const unconfigured = createProEntitlements({ fetchImpl: async () => { throw new Error('not expected'); }, log: quiet });
  assert.equal(unconfigured.configured, false);
  assert.equal(await unconfigured.isPro('apple:001'), false);

  const { pro, calls } = setup({ customers: { 'apple:001': ['entl_pro'] }, entitlementsStatus: 403 });
  assert.equal(await pro.isPro(''), false);
  assert.equal(await pro.isPro('bad id/../x'), false);
  assert.equal(calls.length, 0);
  assert.equal(await pro.isPro('apple:001'), false);
});
