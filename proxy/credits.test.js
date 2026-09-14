const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const {
  FREE_FLIGHT_ALLOWANCE,
  LINE_LOGIN_CHANNEL_ID,
  appUserIdFor,
  createRevenueCatCredits,
  decideCharge,
  deductionIdempotencyKey,
  signSession,
  verifyIdToken,
  verifyLineLogin,
  verifySession,
} = require('./credits.js');

const b64 = (value) => Buffer.from(value).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function keyPair(kid) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
}

function idToken(privateKey, kid, payload, alg = 'RS256') {
  const head = b64(JSON.stringify({ alg, kid, typ: 'JWT' }));
  const body = b64(JSON.stringify(payload));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey);
  return `${head}.${body}.${b64(sig)}`;
}

const NOW = Date.UTC(2026, 8, 14, 12, 0);
const apple = { issuers: ['https://appleid.apple.com'], audiences: ['com.waiair.WaiAir'] };
const validPayload = { iss: 'https://appleid.apple.com', aud: 'com.waiair.WaiAir', sub: '001234.abcd', exp: NOW / 1000 + 600 };

test('verifyIdToken accepts a correctly signed Apple token and rejects anything off', () => {
  const { privateKey, jwk } = keyPair('k1');
  const other = keyPair('k1');
  const keys = [jwk];
  const ok = verifyIdToken(idToken(privateKey, 'k1', validPayload), { ...apple, keys, now: NOW });
  assert.equal(ok.sub, '001234.abcd');

  const rejects = (token, code) => assert.throws(
    () => verifyIdToken(token, { ...apple, keys, now: NOW }),
    (err) => err.status === 401 && err.code === code,
  );
  rejects(idToken(other.privateKey, 'k1', validPayload), 'bad_signature');
  rejects(idToken(privateKey, 'nope', validPayload), 'unknown_key');
  rejects(idToken(privateKey, 'k1', { ...validPayload, aud: 'com.someone.else' }), 'bad_audience');
  rejects(idToken(privateKey, 'k1', { ...validPayload, iss: 'https://evil.example' }), 'bad_issuer');
  rejects(idToken(privateKey, 'k1', { ...validPayload, exp: NOW / 1000 - 120 }), 'token_expired');
  rejects(idToken(privateKey, 'k1', validPayload, 'HS256'), 'unsupported_alg');
  rejects('not.a.jwt.at.all', 'malformed_token');
});

test('sessions: signed, bound to the user, tamper-proof and expiring', () => {
  const secret = 'test-secret';
  const userId = appUserIdFor('apple', '001234.abcd');
  assert.equal(userId, 'apple:001234.abcd');
  const { token, expiresAt } = signSession(userId, secret, NOW, 1000);
  assert.equal(expiresAt, NOW + 1000);
  assert.equal(verifySession(token, secret, NOW), userId);

  assert.throws(() => verifySession(token, 'other-secret', NOW), (e) => e.code === 'bad_session');
  const [v, , sig] = token.split('.');
  const forged = `${v}.${b64(JSON.stringify({ sub: 'google:someone', exp: NOW + 1000 }))}.${sig}`;
  assert.throws(() => verifySession(forged, secret, NOW), (e) => e.code === 'bad_session');
  assert.throws(() => verifySession(token, secret, NOW + 2000), (e) => e.code === 'session_expired');
  assert.throws(() => verifySession('', secret, NOW), (e) => e.status === 401);
});

test('decideCharge: once per flight, 3 free flights, then credits', () => {
  assert.equal(FREE_FLIGHT_ALLOWANCE, 3);
  assert.equal(decideCharge({ alreadyCharged: true, freeUsed: 0 }), 'none');
  assert.equal(decideCharge({ alreadyCharged: false, freeUsed: 2 }), 'free');
  assert.equal(decideCharge({ alreadyCharged: false, freeUsed: 3 }), 'credit');
  assert.equal(deductionIdempotencyKey('apple:a', 'KL1:2026-09-14'), deductionIdempotencyKey('apple:a', 'KL1:2026-09-14'));
  assert.notEqual(deductionIdempotencyKey('apple:a', 'KL1:2026-09-14'), deductionIdempotencyKey('apple:b', 'KL1:2026-09-14'));
});

function stubFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const route = routes.shift();
    return { status: route.status, ok: route.status >= 200 && route.status < 300, json: async () => route.body };
  };
  return { calls, fetchImpl };
}

test('RevenueCat client: reads the balance for the configured currency', async () => {
  const { calls, fetchImpl } = stubFetch([
    { status: 200, body: { items: [{ currency_code: 'GEMS', balance: 99 }, { currency_code: 'CREDITS', balance: 12 }] } },
    { status: 404, body: {} },
  ]);
  const rc = createRevenueCatCredits({ secretKey: 'sk_test', projectId: 'proj1', currencyCode: 'CREDITS', fetchImpl });
  assert.equal(await rc.getBalance('apple:001234.abcd'), 12);
  assert.equal(calls[0].url, 'https://api.revenuecat.com/v2/projects/proj1/customers/apple%3A001234.abcd/virtual_currencies');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk_test');
  assert.equal(await rc.getBalance('google:new'), 0);
});

test('RevenueCat client: deducts 1 with an idempotency key; 422 means not enough credits', async () => {
  const { calls, fetchImpl } = stubFetch([
    { status: 201, body: {} },
    { status: 200, body: { items: [{ currency_code: 'CREDITS', balance: 4 }] } },
    { status: 422, body: { type: 'invalid_request' } },
  ]);
  const rc = createRevenueCatCredits({ secretKey: 'sk_test', projectId: 'proj1', currencyCode: 'CREDITS', fetchImpl });
  assert.deepEqual(await rc.deductOne('apple:u', 'KL1:2026-09-14'), { ok: true, balance: 4 });
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].url.endsWith('/customers/apple%3Au/virtual_currencies/transactions'), true);
  assert.deepEqual(JSON.parse(calls[0].init.body), { adjustments: { CREDITS: -1 } });
  assert.equal(calls[0].init.headers['Idempotency-Key'], deductionIdempotencyKey('apple:u', 'KL1:2026-09-14'));
  assert.deepEqual(await rc.deductOne('apple:u', 'LH2:2026-09-14'), { ok: false, insufficient: true });
});

test('RevenueCat client: upstream failures surface as 502', async () => {
  const { fetchImpl } = stubFetch([{ status: 500, body: {} }]);
  const rc = createRevenueCatCredits({ secretKey: 'sk', projectId: 'p', currencyCode: 'CREDITS', fetchImpl });
  await assert.rejects(rc.getBalance('apple:u'), (e) => e.status === 502);
});

test('verifyLineLogin: LINE checks the ID token and access token; same channel, same user', async () => {
  const { calls, fetchImpl } = stubFetch([
    { status: 200, body: { iss: 'https://access.line.me', sub: 'U1', aud: LINE_LOGIN_CHANNEL_ID, exp: NOW / 1000 + 600 } },
    { status: 200, body: { scope: 'profile openid', client_id: LINE_LOGIN_CHANNEL_ID, expires_in: 2592000 } },
    { status: 200, body: { userId: 'U1', displayName: 'Mike' } },
  ]);
  const result = await verifyLineLogin({
    idToken: 'id.jwt', accessToken: 'at 1', nonce: 'n1', channelId: LINE_LOGIN_CHANNEL_ID, fetchImpl, now: NOW,
  });
  assert.equal(LINE_LOGIN_CHANNEL_ID, '2011593172');
  assert.deepEqual(result, { sub: 'U1', expiresAt: NOW + 2592000 * 1000 });
  assert.equal(appUserIdFor('line', result.sub), 'line:U1');
  assert.equal(calls[0].url, 'https://api.line.me/oauth2/v2.1/verify');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[0].init.body)), { id_token: 'id.jwt', client_id: '2011593172', nonce: 'n1' });
  assert.equal(calls[1].url, 'https://api.line.me/oauth2/v2.1/verify?access_token=at%201');
  assert.equal(calls[2].url, 'https://api.line.me/v2/profile');
  assert.equal(calls[2].init.headers.Authorization, 'Bearer at 1');
});

test('verifyLineLogin rejects other channels, other users and invalid tokens; LINE outages are 502', async () => {
  const run = (routes, extra = {}) => verifyLineLogin({
    idToken: 'id', accessToken: 'at', channelId: LINE_LOGIN_CHANNEL_ID, fetchImpl: stubFetch(routes).fetchImpl, now: NOW, ...extra,
  });
  const idOk = { status: 200, body: { sub: 'U1', aud: LINE_LOGIN_CHANNEL_ID } };
  const atOk = { status: 200, body: { client_id: LINE_LOGIN_CHANNEL_ID, expires_in: 100 } };
  const code = (c, status = 401) => (e) => e.code === c && e.status === status;
  await assert.rejects(run([{ status: 400, body: { error: 'invalid_request' } }]), code('bad_line_token'));
  await assert.rejects(run([{ status: 200, body: { sub: 'U1', aud: '1234567890' } }]), code('bad_audience'));
  await assert.rejects(run([idOk, { status: 200, body: { client_id: '1234567890', expires_in: 100 } }]), code('bad_audience'));
  await assert.rejects(run([idOk, { status: 200, body: { client_id: LINE_LOGIN_CHANNEL_ID, expires_in: 0 } }]), code('token_expired'));
  await assert.rejects(run([idOk, atOk, { status: 200, body: { userId: 'U2' } }]), code('token_mismatch'));
  await assert.rejects(run([idOk, atOk, { status: 401, body: {} }]), code('bad_line_token'));
  await assert.rejects(run([{ status: 503, body: {} }]), code('line_verify_failed', 502));
  await assert.rejects(run([], { accessToken: '' }), code('invalid_request', 400));
});
