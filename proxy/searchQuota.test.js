const test = require('node:test');
const assert = require('node:assert/strict');
const { LIMITS, MIGRATION_SQL, quotaDay, deviceKey, createSearchQuotaStore, createTierVerifier, createSearchQuota } = require('./searchQuota');

const quiet = { log() {}, warn() {}, error() {} };
const NOW = Date.parse('2026-09-15T02:00:00Z');
const DEVICE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

/** Minimal Postgres stand-in for the three quota statements. */
function fakePool() {
  const rows = [];
  return {
    rows,
    async query(sql, params = []) {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('CREATE')) return { rows: [] };
      if (s.startsWith('SELECT 1')) {
        return { rows: rows.filter(r => r.device_id === params[0] && r.period === params[1] && r.flight_number === params[2]) };
      }
      if (s.startsWith('SELECT COUNT')) {
        return { rows: [{ n: rows.filter(r => r.device_id === params[0] && r.period === params[1]).length }] };
      }
      if (s.startsWith('INSERT')) {
        if (!rows.some(r => r.device_id === params[0] && r.period === params[1] && r.flight_number === params[2])) {
          rows.push({ device_id: params[0], period: params[1], flight_number: params[2], tier: params[3] });
        }
        return { rows: [] };
      }
      throw new Error(`unexpected SQL: ${s}`);
    },
  };
}

/** Express-like request with headers. */
function req(headers = {}, ip = '203.0.113.9') {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { ip, headers: lower, get: (name) => lower[String(name).toLowerCase()] };
}
const search = (extra = {}) => req({ 'X-WaiAir-Search': '1', 'X-WaiAir-Device': DEVICE, 'X-WaiAir-Day': '2026-09-15', ...extra });

function setup({ proUsers = [], balances = {}, sessions = {} } = {}) {
  const pool = fakePool();
  const verifyTier = createTierVerifier({
    isPro: async (id) => proUsers.includes(id),
    creditsUserId: (r) => sessions[String(r.get('authorization') || '')] || null,
    creditBalance: async (userId) => balances[userId] || 0,
    now: () => NOW,
    log: quiet,
  });
  const quota = createSearchQuota({ store: createSearchQuotaStore(pool), verifyTier, now: () => NOW, log: quiet });
  return { pool, quota };
}

test('limits and helpers: free 10 lifetime, credits 50/day, Pro 100/day; client day within ±1 day; device or IP key', () => {
  assert.deepEqual(LIMITS, { free: { period: 'lifetime', max: 10 }, credits: { period: 'day', max: 50 }, pro: { period: 'day', max: 100 } });
  assert.ok(MIGRATION_SQL[0].includes('PRIMARY KEY (device_id, period, flight_number)'));
  assert.equal(quotaDay('2026-09-15', NOW), '2026-09-15');
  assert.equal(quotaDay('2026-09-14', NOW), '2026-09-14');
  assert.equal(quotaDay('2026-09-10', NOW), '2026-09-15');
  assert.equal(quotaDay('garbage', NOW), '2026-09-15');
  assert.equal(deviceKey(DEVICE, '1.2.3.4'), `d:${DEVICE}`);
  assert.equal(deviceKey('short', '1.2.3.4'), 'ip:1.2.3.4');
});

test('free: 10 distinct flight searches per device, the 11th gets 402-worthy refusal; repeats and unmarked requests are free', async () => {
  const { quota, pool } = setup();
  for (let i = 1; i <= 10; i++) {
    const r = await quota.check(search(), `TG${400 + i}`);
    assert.deepEqual([r.allowed, r.tier, r.limit, r.used], [true, 'free', 10, i], `search ${i}`);
  }
  assert.deepEqual(await quota.check(search(), 'BR75'), { allowed: false, counted: false, used: 10, tier: 'free', limit: 10 });
  assert.equal((await quota.check(search(), 'TG403')).allowed, true);
  // Board loads / tracked polling (no X-WaiAir-Search) never count or get refused.
  assert.deepEqual(await quota.check(req({ 'X-WaiAir-Device': DEVICE }), 'BR75'), { allowed: true, counted: false });
  // Another device has its own count; lifetime rows for free.
  assert.equal((await quota.check(search({ 'X-WaiAir-Device': 'ffffffffffffffffffffffffffffffff' }), 'BR75')).allowed, true);
  assert.ok(pool.rows.every(r => r.period === 'lifetime'));
});

test('claimed tiers are verified: Pro needs RevenueCat, credits need a session with balance; otherwise free', async () => {
  const { quota } = setup({ proUsers: ['apple:pro'], balances: { 'line:c1': 5, 'line:c0': 0 }, sessions: { 'Bearer s1': 'line:c1', 'Bearer s0': 'line:c0' } });
  assert.equal((await quota.check(search({ 'X-WaiAir-Tier': 'pro', 'X-WaiAir-RC-User': 'apple:pro' }), 'TG1')).tier, 'pro');
  assert.equal((await quota.check(search({ 'X-WaiAir-Tier': 'pro', 'X-WaiAir-RC-User': 'apple:fake' }), 'TG2')).tier, 'free');
  assert.equal((await quota.check(search({ 'X-WaiAir-Tier': 'credits', Authorization: 'Bearer s1' }), 'TG3')).tier, 'credits');
  assert.equal((await quota.check(search({ 'X-WaiAir-Tier': 'credits', Authorization: 'Bearer s0' }), 'TG4')).tier, 'free');
  assert.equal((await quota.check(search({ 'X-WaiAir-Tier': 'credits' }), 'TG5')).tier, 'free');
  assert.equal((await quota.check(search(), 'TG6')).tier, 'free');
});

test('Pro: 100 a day, resets the next day; database failure never blocks a search', async () => {
  const { quota } = setup({ proUsers: ['apple:pro'] });
  const pro = (day) => search({ 'X-WaiAir-Tier': 'pro', 'X-WaiAir-RC-User': 'apple:pro', 'X-WaiAir-Day': day });
  for (let i = 0; i < 100; i++) assert.equal((await quota.check(pro('2026-09-15'), `XX${i}`)).allowed, true);
  const refused = await quota.check(pro('2026-09-15'), 'BR75');
  assert.deepEqual([refused.allowed, refused.limit, refused.used], [false, 100, 100]);
  assert.equal((await quota.check(pro('2026-09-16'), 'BR75')).allowed, true);

  const broken = createSearchQuota({
    store: { async hit() { throw new Error('db down'); } },
    verifyTier: async () => 'free',
    now: () => NOW,
    log: quiet,
  });
  assert.equal((await broken.check(search(), 'BR75')).allowed, true);
});
