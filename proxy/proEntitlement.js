/**
 * "WaiAir Pro" check for Wallet push updates. The app sends its RevenueCat app user ID; the proxy asks RevenueCat (REST API
 * v2, active entitlements of that customer) before issuing an updatable pass or registering a device for pushes. Answers
 * are cached per user; any failure counts as not Pro — the pass still works, just without updates.
 */
const RC_API_BASE = 'https://api.revenuecat.com/v2';
/** Entitlement identifier in the RevenueCat dashboard (lib/purchases.ts PRO_ENTITLEMENT_ID). */
const PRO_LOOKUP_KEY = 'WaiAir Pro';
const PRO_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED_USERS = 1000;
const APP_USER_ID_PATTERN = /^[A-Za-z0-9$:._@+-]{1,128}$/;

/**
 * @param {{ secretKey?: string, projectId?: string, entitlementId?: string, fetchImpl: Function, now?: () => number,
 *   ttlMs?: number, log?: Console }} opts `entitlementId` (REVENUECAT_PRO_ENTITLEMENT_ID) skips the lookup by key
 */
function createProEntitlements({
  secretKey,
  projectId,
  entitlementId = '',
  fetchImpl,
  now = () => Date.now(),
  ttlMs = PRO_CACHE_TTL_MS,
  log = console,
}) {
  const configured = !!(secretKey && projectId);
  const base = `${RC_API_BASE}/projects/${encodeURIComponent(projectId || '')}`;
  const headers = { Authorization: `Bearer ${secretKey}` };
  /** @type {Map<string, { pro: boolean, at: number }>} */
  const cache = new Map();
  let proEntitlementId = entitlementId ? Promise.resolve(entitlementId) : null;

  function resolveEntitlementId() {
    if (!proEntitlementId) {
      proEntitlementId = (async () => {
        const res = await fetchImpl(`${base}/entitlements?limit=100`, { headers });
        if (!res.ok) throw new Error(`revenuecat_entitlements_http_${res.status}`);
        const json = await res.json();
        const items = Array.isArray(json && json.items) ? json.items : [];
        const hit = items.find(e => e && (e.lookup_key === PRO_LOOKUP_KEY || e.display_name === PRO_LOOKUP_KEY));
        if (!hit) throw new Error('revenuecat_pro_entitlement_missing');
        return hit.id;
      })().catch((e) => {
        proEntitlementId = null;
        throw e;
      });
    }
    return proEntitlementId;
  }

  async function isPro(appUserId) {
    const id = String(appUserId || '');
    if (!configured || !APP_USER_ID_PATTERN.test(id)) return false;
    const t = now();
    const cached = cache.get(id);
    if (cached && t - cached.at < ttlMs) return cached.pro;
    try {
      const wanted = await resolveEntitlementId();
      const res = await fetchImpl(`${base}/customers/${encodeURIComponent(id)}/active_entitlements?limit=100`, { headers });
      let pro = false;
      if (res.ok) {
        const json = await res.json();
        pro = (Array.isArray(json && json.items) ? json.items : []).some(e => e && e.entitlement_id === wanted);
      } else if (res.status !== 404) {
        throw new Error(`revenuecat_active_entitlements_http_${res.status}`);
      }
      cache.delete(id);
      cache.set(id, { pro, at: t });
      while (cache.size > MAX_CACHED_USERS) cache.delete(cache.keys().next().value);
      return pro;
    } catch (e) {
      log.error('[pro] RevenueCat entitlement check failed:', e && e.message);
      return false;
    }
  }

  return { configured, isPro };
}

module.exports = { PRO_LOOKUP_KEY, PRO_CACHE_TTL_MS, createProEntitlements };
