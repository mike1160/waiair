/**
 * Flight-number search quota — the server-side backup of the app's count (lib/searchQuota.ts), per install device in
 * Postgres. Only requests the app marks as a user search (X-WaiAir-Search: 1) on /flight/:number count: FIDS boards,
 * tracked-flight polling and refreshes never do. A number already counted in the period is free.
 * The claimed tier (X-WaiAir-Tier) is only honoured after verification — Pro via RevenueCat, credits via the signed
 * credits session with a balance — anything else (or no header) is free.
 */

const LIMITS = {
  free: { period: 'lifetime', max: 10 },
  credits: { period: 'day', max: 50 },
  pro: { period: 'day', max: 100 },
};
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const BALANCE_TTL_MS = 10 * 60 * 1000;

const MIGRATION_SQL = [
  `CREATE TABLE IF NOT EXISTS search_quota_hits (
    device_id TEXT NOT NULL,
    period TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    tier TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, period, flight_number)
  )`,
  'CREATE INDEX IF NOT EXISTS search_quota_hits_created_idx ON search_quota_hits (created_at)',
];

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The app's local day when within a day of the server's UTC day (quota resets at the user's midnight), else UTC. */
function quotaDay(clientDay, now = Date.now()) {
  const day = String(clientDay || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const ms = Date.parse(`${day}T00:00:00Z`);
    if (Number.isFinite(ms) && Math.abs(ms - Date.parse(`${utcDay(now)}T00:00:00Z`)) <= DAY_MS) return day;
  }
  return utcDay(now);
}

/** Install ID from the app, or the caller IP when it is missing or malformed. */
function deviceKey(deviceId, ip) {
  const id = String(deviceId || '');
  return DEVICE_ID_PATTERN.test(id) ? `d:${id}` : `ip:${String(ip || 'unknown')}`;
}

/** @param {{ query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }} pool */
function createSearchQuotaStore(pool) {
  async function migrate() {
    for (const sql of MIGRATION_SQL) await pool.query(sql);
  }

  /** Counts `flightNumber` for the device and period unless already counted; refuses at `max`. */
  async function hit({ deviceId, period, flightNumber, tier, max }) {
    const known = await pool.query(
      'SELECT 1 FROM search_quota_hits WHERE device_id = $1 AND period = $2 AND flight_number = $3',
      [deviceId, period, flightNumber],
    );
    if (known.rows.length) return { allowed: true, counted: false, used: null };
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM search_quota_hits WHERE device_id = $1 AND period = $2',
      [deviceId, period],
    );
    const used = Number((rows[0] && rows[0].n) || 0);
    if (used >= max) return { allowed: false, counted: false, used };
    await pool.query(
      `INSERT INTO search_quota_hits (device_id, period, flight_number, tier) VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id, period, flight_number) DO NOTHING`,
      [deviceId, period, flightNumber, tier],
    );
    return { allowed: true, counted: true, used: used + 1 };
  }

  /** Daily rows older than a few days are no longer needed (lifetime rows stay). */
  async function prune() {
    await pool.query("DELETE FROM search_quota_hits WHERE period <> 'lifetime' AND created_at < NOW() - INTERVAL '3 days'");
  }

  return { migrate, hit, prune };
}

/**
 * @param {object} opts
 * @param {(appUserId: string) => Promise<boolean>} opts.isPro RevenueCat "WaiAir Pro" check (proEntitlement.js)
 * @param {(req: any) => string | null} opts.creditsUserId signed credits session → user ID, null when absent/invalid
 * @param {(userId: string) => Promise<number>} opts.creditBalance RevenueCat credit balance
 */
function createTierVerifier({ isPro, creditsUserId, creditBalance, now = () => Date.now(), log = console }) {
  const balances = new Map();

  async function cachedBalance(userId) {
    const hit = balances.get(userId);
    if (hit && now() - hit.at < BALANCE_TTL_MS) return hit.balance;
    const balance = Number(await creditBalance(userId)) || 0;
    balances.set(userId, { balance, at: now() });
    if (balances.size > 1000) balances.delete(balances.keys().next().value);
    return balance;
  }

  return async function verifyTier(req) {
    const claimed = String(req.get('x-waiair-tier') || '').toLowerCase();
    try {
      if (claimed === 'pro' && await isPro(String(req.get('x-waiair-rc-user') || ''))) return 'pro';
      if (claimed === 'pro' || claimed === 'credits') {
        const userId = creditsUserId(req);
        if (userId && await cachedBalance(userId) > 0) return 'credits';
      }
    } catch (e) {
      log.error('[quota] tier check failed (free):', e && e.message);
    }
    return 'free';
  };
}

/**
 * @param {{ store: ReturnType<typeof createSearchQuotaStore>, verifyTier: (req: any) => Promise<string>,
 *   now?: () => number, log?: Console }} opts
 */
function createSearchQuota({ store, verifyTier, now = () => Date.now(), log = console }) {
  /** → { allowed, counted, tier, limit, used }. Unmarked requests and database failures are always allowed. */
  async function check(req, flightNumber) {
    if (String(req.get('x-waiair-search') || '') !== '1') return { allowed: true, counted: false };
    const tier = await verifyTier(req);
    const { period: kind, max } = LIMITS[tier] || LIMITS.free;
    const period = kind === 'lifetime' ? 'lifetime' : quotaDay(req.get('x-waiair-day'), now());
    const deviceId = deviceKey(req.get('x-waiair-device'), req.ip);
    try {
      const result = await store.hit({ deviceId, period, flightNumber, tier, max });
      return { ...result, tier, limit: max };
    } catch (e) {
      log.error('[quota] check failed (allowed):', e && e.message);
      return { allowed: true, counted: false, tier, limit: max, used: null };
    }
  }

  return { check };
}

module.exports = {
  LIMITS,
  MIGRATION_SQL,
  quotaDay,
  deviceKey,
  createSearchQuotaStore,
  createTierVerifier,
  createSearchQuota,
};
