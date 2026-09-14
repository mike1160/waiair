/**
 * Flight tracking credits on the proxy: Apple/Google ID token checks, proxy session tokens,
 * per-flight charge decisions and RevenueCat virtual-currency calls (secret key stays here).
 * Pure / injectable so it can be tested without network or a database.
 */
const crypto = require('node:crypto');

const FREE_FLIGHT_ALLOWANCE = 3;
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const RC_API_BASE = 'https://api.revenuecat.com/v2';

const PROVIDERS = {
  apple: { jwksUrl: 'https://appleid.apple.com/auth/keys', issuers: ['https://appleid.apple.com'] },
  google: { jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs', issuers: ['https://accounts.google.com', 'accounts.google.com'] },
};

function b64urlDecode(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function b64urlEncode(value) {
  return Buffer.from(value).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function httpError(code, status) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  return err;
}

/** RS256 ID token (Sign in with Apple / Google) against the provider's JWKS. Returns the payload or throws 401. */
function verifyIdToken(token, { keys, issuers, audiences, now = Date.now() }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw httpError('malformed_token', 401);
  let header;
  let payload;
  try {
    header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
    payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  } catch {
    throw httpError('malformed_token', 401);
  }
  if (header.alg !== 'RS256') throw httpError('unsupported_alg', 401);
  const jwk = (keys || []).find((k) => k && k.kid === header.kid);
  if (!jwk) throw httpError('unknown_key', 401);
  const publicKey = crypto.createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });
  const valid = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, b64urlDecode(parts[2]));
  if (!valid) throw httpError('bad_signature', 401);
  if (!issuers.includes(payload.iss)) throw httpError('bad_issuer', 401);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.some((a) => audiences.includes(a))) throw httpError('bad_audience', 401);
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < now - 60_000) throw httpError('token_expired', 401);
  if (!payload.sub) throw httpError('missing_subject', 401);
  return payload;
}

/** RevenueCat app_user_id for a signed-in user — stable across reinstalls and devices. */
function appUserIdFor(provider, sub) {
  return `${provider}:${sub}`;
}

function sessionSignature(payload, secret) {
  return b64urlEncode(crypto.createHmac('sha256', secret).update(`v1.${payload}`).digest());
}

/** Long-lived proxy session, so the short-lived provider ID token is only needed at sign-in. */
function signSession(userId, secret, now = Date.now(), ttlMs = SESSION_TTL_MS) {
  const expiresAt = now + ttlMs;
  const payload = b64urlEncode(JSON.stringify({ sub: userId, exp: expiresAt }));
  return { token: `v1.${payload}.${sessionSignature(payload, secret)}`, expiresAt };
}

/** Returns the session's app_user_id or throws 401. */
function verifySession(token, secret, now = Date.now()) {
  const [version, payload, signature] = String(token || '').split('.');
  if (version !== 'v1' || !payload || !signature) throw httpError('bad_session', 401);
  const given = Buffer.from(signature);
  const expected = Buffer.from(sessionSignature(payload, secret));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw httpError('bad_session', 401);
  let data;
  try {
    data = JSON.parse(b64urlDecode(payload).toString('utf8'));
  } catch {
    throw httpError('bad_session', 401);
  }
  if (!data.sub || typeof data.exp !== 'number') throw httpError('bad_session', 401);
  if (data.exp < now) throw httpError('session_expired', 401);
  return data.sub;
}

/** A flight's first live update: nothing (already charged), one of the free flights, or a credit. */
function decideCharge({ alreadyCharged, freeUsed, freeAllowance = FREE_FLIGHT_ALLOWANCE }) {
  if (alreadyCharged) return 'none';
  return freeUsed < freeAllowance ? 'free' : 'credit';
}

/** Same user + flight → same key, so a retried deduction is applied at most once by RevenueCat. */
function deductionIdempotencyKey(userId, flightKey) {
  return crypto.createHash('sha256').update(`waiair-credit|${userId}|${flightKey}`).digest('hex');
}

/** RevenueCat REST API v2 virtual currency for one currency code. `fetchImpl` returns a fetch Response. */
function createRevenueCatCredits({ secretKey, projectId, currencyCode, fetchImpl }) {
  const customers = `${RC_API_BASE}/projects/${encodeURIComponent(projectId)}/customers`;
  const headers = { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };

  const balanceFrom = (json) => {
    const items = Array.isArray(json && json.items) ? json.items : [];
    const hit = items.find((item) => item && item.currency_code === currencyCode);
    return hit ? Math.max(0, Number(hit.balance) || 0) : 0;
  };

  async function getBalance(userId) {
    const res = await fetchImpl(`${customers}/${encodeURIComponent(userId)}/virtual_currencies`, { headers });
    // No RevenueCat customer yet (never purchased) → no credits.
    if (res.status === 404) return 0;
    if (!res.ok) throw httpError('revenuecat_balance_failed', 502);
    return balanceFrom(await res.json());
  }

  /** Spend 1 unit. RevenueCat answers 422 when the balance is too low (balances never go negative). */
  async function deductOne(userId, flightKey) {
    const res = await fetchImpl(`${customers}/${encodeURIComponent(userId)}/virtual_currencies/transactions`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': deductionIdempotencyKey(userId, flightKey) },
      body: JSON.stringify({ adjustments: { [currencyCode]: -1 } }),
    });
    if (res.status === 422 || res.status === 404) return { ok: false, insufficient: true };
    if (!res.ok) throw httpError('revenuecat_deduct_failed', 502);
    let json = null;
    try {
      json = await res.json();
    } catch { /* body is optional */ }
    const balance = json && Array.isArray(json.items) ? balanceFrom(json) : await getBalance(userId);
    return { ok: true, balance };
  }

  return { getBalance, deductOne };
}

module.exports = {
  FREE_FLIGHT_ALLOWANCE,
  PROVIDERS,
  SESSION_TTL_MS,
  appUserIdFor,
  createRevenueCatCredits,
  decideCharge,
  deductionIdempotencyKey,
  signSession,
  verifyIdToken,
  verifySession,
};
