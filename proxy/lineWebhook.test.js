const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  INVALID_FLIGHT_TEXT,
  verifySignature,
  parseFlightInput,
  flightMessages,
  createLineWebhook,
} = require('./lineWebhook');

const SECRET = 'test-channel-secret';
const NOW = Date.parse('2026-09-14T03:00:00Z'); // 10:00 in Bangkok

const TG403 = JSON.stringify([{
  number: 'TG 403',
  status: 'Expected',
  airline: { name: 'Thai Airways' },
  departure: {
    airport: { iata: 'BKK', municipalityName: 'Bangkok' },
    scheduledTime: { utc: '2026-09-14 04:05Z', local: '2026-09-14 11:05+07:00' },
    revisedTime: { utc: '2026-09-14 04:35Z', local: '2026-09-14 11:35+07:00' },
    gate: 'D2',
  },
  arrival: {
    airport: { iata: 'SIN', municipalityName: 'Singapore' },
    scheduledTime: { utc: '2026-09-14 07:30Z', local: '2026-09-14 15:30+08:00' },
  },
}]);

function sign(raw) {
  return crypto.createHmac('sha256', SECRET).update(raw).digest('base64');
}

function response(status, json) {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(json) };
}

/** Fake api.line.me: issues tok-N tokens, records replies; replyStatus lets a test force e.g. a 401. */
function fakeLine({ replyStatuses = [] } = {}) {
  const calls = [];
  let tokens = 0;
  const fetchFn = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/v2/oauth/accessToken')) {
      tokens += 1;
      return response(200, { access_token: `tok-${tokens}`, expires_in: 2592000, token_type: 'Bearer' });
    }
    return response(replyStatuses.shift() || 200, {});
  };
  const replies = () => calls
    .filter(c => c.url.endsWith('/v2/bot/message/reply'))
    .map(c => ({ auth: c.opts.headers.Authorization, ...JSON.parse(c.opts.body) }));
  return { calls, fetchFn, replies, tokenCalls: () => tokens };
}

function webhookRequest(events, signature) {
  const raw = Buffer.from(JSON.stringify({ destination: 'U0', events }));
  return {
    body: raw,
    get: (h) => (h.toLowerCase() === 'x-line-signature' ? (signature === undefined ? sign(raw) : signature) : undefined),
  };
}

function fakeRes() {
  return { statusCode: 0, sendStatus(code) { this.statusCode = code; return this; } };
}

function textEvent(text, source = { type: 'user', userId: 'U123' }) {
  return { type: 'message', replyToken: `rt-${text}`, source, message: { id: '1', type: 'text', text } };
}

function setup(overrides = {}) {
  const line = fakeLine(overrides.line);
  const lookups = [];
  const webhook = createLineWebhook({
    channelSecret: SECRET,
    channelId: '2000000000',
    fetchFn: line.fetchFn,
    now: () => NOW,
    log: { warn() {}, error() {} },
    runAsCaller: (caller, fn) => { lookups.push({ caller }); return fn(); },
    fetchFlightStatus: async (number) => {
      lookups[lookups.length - 1].number = number;
      return overrides.lookup ? overrides.lookup(number) : { status: 200, text: TG403 };
    },
  });
  return { webhook, line, lookups };
}

test('verifySignature checks HMAC-SHA256 of the raw body', () => {
  const raw = Buffer.from('{"events":[]}');
  assert.equal(verifySignature(raw, sign(raw), SECRET), true);
  assert.equal(verifySignature(Buffer.from('{"events":[1]}'), sign(raw), SECRET), false);
  assert.equal(verifySignature(raw, sign(raw), 'other-secret'), false);
  assert.equal(verifySignature(raw, 'not-base64!!', SECRET), false);
  assert.equal(verifySignature(raw, undefined, SECRET), false);
  assert.equal(verifySignature(null, sign(raw), SECRET), false);
});

test('parseFlightInput strips spaces, uppercases and accepts two letters + 1–4 digits', () => {
  assert.equal(parseFlightInput('TG 403'), 'TG403');
  assert.equal(parseFlightInput(' tg  403\n'), 'TG403');
  assert.equal(parseFlightInput('FD3001'), 'FD3001');
  assert.equal(parseFlightInput('hallo'), '');
  assert.equal(parseFlightInput('TG12345'), '');
  assert.equal(parseFlightInput('TG'), '');
  assert.equal(parseFlightInput(''), '');
});

test('flightMessages: the LIFF Flex card for a found flight, Thai text otherwise', () => {
  const [card] = flightMessages('TG403', { status: 200, text: TG403 }, NOW);
  assert.equal(card.type, 'flex');
  assert.equal(card.contents.type, 'bubble');
  const body = card.contents.body.contents;
  assert.equal(body[0].contents[0].text, '✈ WaiAir');
  assert.equal(body[0].contents[1].contents[0].text, 'ล่าช้า');
  assert.equal(body[0].contents[1].backgroundColor, '#F59E0B');
  assert.equal(body[1].contents[0].text, '⚠️ ล่าช้า 30 นาที');
  const buttons = card.contents.footer.contents.map(b => b.action);
  assert.equal(buttons[0].uri, 'https://waiair.app/liff?flight=TG403');
  // Departs today → Aviasales searches tomorrow (bookingSearchDay in liff-core.js).
  assert.match(buttons[1].uri, /^https:\/\/www\.aviasales\.com\/search\/BKK1509SIN1\?marker=564311&currency=thb$/);

  const text = (lookup) => flightMessages('TG403', lookup, NOW)[0];
  assert.deepEqual(text({ status: 204, text: '' }), { type: 'text', text: 'ไม่พบเที่ยวบิน ตรวจสอบหมายเลขแล้วลองอีกครั้ง' });
  assert.equal(text({ status: 200, text: '[]' }).text, 'ไม่พบเที่ยวบิน ตรวจสอบหมายเลขแล้วลองอีกครั้ง');
  assert.equal(text({ status: 500, text: 'oops' }).text, 'ข้อมูลสดไม่พร้อมใช้งานในขณะนี้ ลองอีกครั้งในอีกสักครู่');
  const limited = Object.assign(new Error('Try again'), { code: 'rate_limited', status: 429, retryAfterMin: 12 });
  assert.equal(text({ error: limited }).text, 'ค้นหาบ่อยเกินไป ลองอีกครั้งใน 12 นาที');
  const timeout = Object.assign(new Error('upstream_timeout'), { code: 'UPSTREAM_TIMEOUT', status: 504 });
  assert.equal(text({ error: timeout }).text, 'ข้อมูลสดไม่พร้อมใช้งานในขณะนี้ ลองอีกครั้งในอีกสักครู่');
});

test('webhook: 200 straight away, flight number → Flex reply with the reply token, budget per LINE user', async () => {
  const { webhook, line, lookups } = setup();
  const res = fakeRes();
  const done = webhook.handler(webhookRequest([textEvent('tg 403')]), res);
  assert.equal(res.statusCode, 200);
  assert.equal(line.calls.length, 0);
  await done;
  assert.deepEqual(lookups, [{ caller: 'line:U123', number: 'TG403' }]);
  const [reply] = line.replies();
  assert.equal(reply.replyToken, 'rt-tg 403');
  assert.equal(reply.auth, 'Bearer tok-1');
  assert.equal(reply.messages.length, 1);
  assert.equal(reply.messages[0].type, 'flex');
  assert.ok(reply.messages[0].altText.startsWith('TG403 BKK → SIN'));
});

test('webhook: other text → Thai hint without a flight lookup', async () => {
  const { webhook, line, lookups } = setup();
  await webhook.handler(webhookRequest([textEvent('hallo')]), fakeRes());
  assert.equal(lookups.length, 0);
  assert.deepEqual(line.replies().map(r => r.messages), [[{ type: 'text', text: INVALID_FLIGHT_TEXT }]]);
});

test('webhook: bad signature, stickers, follows and group chatter get no reply', async () => {
  const { webhook, line, lookups } = setup();
  const res = fakeRes();
  await webhook.handler(webhookRequest([textEvent('TG403')], 'bm90LXRoZS1zaWduYXR1cmU='), res);
  assert.equal(res.statusCode, 200);
  await webhook.handler(webhookRequest([], ''), fakeRes());
  await webhook.handler(webhookRequest([
    { type: 'message', replyToken: 'rt-s', source: { type: 'user', userId: 'U1' }, message: { type: 'sticker' } },
    { type: 'follow', replyToken: 'rt-f', source: { type: 'user', userId: 'U1' } },
    textEvent('hallo allemaal', { type: 'group', groupId: 'C1', userId: 'U1' }),
  ]), fakeRes());
  assert.equal(lookups.length, 0);
  assert.equal(line.calls.length, 0);
});

test('webhook: LINE console verify (no events) is accepted', async () => {
  const { webhook, line } = setup();
  const res = fakeRes();
  await webhook.handler(webhookRequest([]), res);
  assert.equal(res.statusCode, 200);
  assert.equal(line.calls.length, 0);
});

test('webhook: issued token is reused, and renewed once after a 401', async () => {
  const { webhook, line } = setup({ line: { replyStatuses: [200, 200, 401, 200] } });
  await webhook.handler(webhookRequest([textEvent('hallo')]), fakeRes());
  await webhook.handler(webhookRequest([textEvent('TG403')]), fakeRes());
  assert.equal(line.tokenCalls(), 1);
  await webhook.handler(webhookRequest([textEvent('hoi')]), fakeRes());
  assert.equal(line.tokenCalls(), 2);
  assert.deepEqual(line.replies().map(r => r.auth), ['Bearer tok-1', 'Bearer tok-1', 'Bearer tok-1', 'Bearer tok-2']);
});

test('webhook: a failing reply is logged, never thrown', async () => {
  const errors = [];
  const line = fakeLine({ replyStatuses: [400] });
  const webhook = createLineWebhook({
    channelSecret: SECRET,
    channelId: '2000000000',
    fetchFn: line.fetchFn,
    log: { warn() {}, error: (...a) => errors.push(a.join(' ')) },
    fetchFlightStatus: async () => { throw new Error('should not be called'); },
  });
  await webhook.handler(webhookRequest([textEvent('hallo')]), fakeRes());
  assert.equal(errors.length, 1);
  assert.match(errors[0], /line_reply_400/);
});

test('proxy/liff-core.js is an exact copy of docs/liff-core.js', () => {
  const docs = path.join(__dirname, '..', 'docs', 'liff-core.js');
  if (!fs.existsSync(docs)) return; // Railway image: proxy/ only
  assert.equal(
    fs.readFileSync(path.join(__dirname, 'liff-core.js'), 'utf8'),
    fs.readFileSync(docs, 'utf8'),
    'docs/liff-core.js changed — run: cp docs/liff-core.js proxy/liff-core.js',
  );
});
