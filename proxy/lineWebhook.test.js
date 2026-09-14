const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  INVALID_FLIGHT_TEXT,
  LANGUAGE_SET_TEXT,
  verifySignature,
  parseFlightInput,
  parseLanguageCommand,
  parseTrackCommand,
  flightMessages,
  createLineWebhook,
} = require('./lineWebhook');
const { createUserPreferences } = require('./userPreferences');
const { MAX_ACTIVE_PER_USER, TRACK_TEXT } = require('./trackedFlights');

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

/** Fake api.line.me: issues tok-N tokens, records replies; replyStatuses lets a test force e.g. a 401. */
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

/** In-memory Postgres stand-in behind the real userPreferences.js queries. */
function memoryPreferences(stored = {}) {
  const pool = {
    async query(sql, params = []) {
      if (/^\s*SELECT/i.test(sql)) return { rows: params[0] in stored ? [{ language: stored[params[0]] }] : [] };
      if (/^\s*INSERT/i.test(sql)) stored[params[0]] = params[1];
      return { rows: [] };
    },
  };
  return { stored, preferences: createUserPreferences(pool) };
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
  const errors = [];
  const webhook = createLineWebhook({
    channelSecret: SECRET,
    channelId: '2000000000',
    fetchFn: line.fetchFn,
    now: () => NOW,
    log: { warn() {}, error: (...a) => errors.push(a.join(' ')) },
    preferences: 'preferences' in overrides ? overrides.preferences : memoryPreferences().preferences,
    trackedFlights: overrides.trackedFlights || null,
    runAsCaller: (caller, fn) => { lookups.push({ caller }); return fn(); },
    fetchFlightStatus: async (number) => {
      lookups[lookups.length - 1].number = number;
      return overrides.lookup ? overrides.lookup(number) : { status: 200, text: TG403 };
    },
  });
  const send = (...events) => webhook.handler(webhookRequest(events), fakeRes());
  return { webhook, line, lookups, errors, send };
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
  assert.equal(parseFlightInput('EN'), '');
  assert.equal(parseFlightInput(''), '');
});

test('parseLanguageCommand: EN/ENGLISH → en, TH/ไทย → th, case and outer spaces ignored', () => {
  assert.equal(parseLanguageCommand('EN'), 'en');
  assert.equal(parseLanguageCommand(' en '), 'en');
  assert.equal(parseLanguageCommand('English'), 'en');
  assert.equal(parseLanguageCommand('ENGLISH'), 'en');
  assert.equal(parseLanguageCommand('TH'), 'th');
  assert.equal(parseLanguageCommand('th'), 'th');
  assert.equal(parseLanguageCommand('ไทย'), 'th');
  assert.equal(parseLanguageCommand(' ไทย\n'), 'th');
  assert.equal(parseLanguageCommand('ENG'), '');
  assert.equal(parseLanguageCommand('E N'), '');
  assert.equal(parseLanguageCommand('TG403'), '');
  assert.equal(parseLanguageCommand(''), '');
});

test('flightMessages: the LIFF Flex card for a found flight, localized text otherwise', () => {
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

  const [en] = flightMessages('TG403', { status: 200, text: TG403 }, NOW, 'en');
  assert.equal(en.contents.body.contents[0].contents[1].contents[0].text, 'Delayed');
  assert.equal(en.contents.body.contents[1].contents[0].text, '⚠️ 30 min delay');
  assert.deepEqual(en.contents.footer.contents.map(b => b.action.label), ['Live status', 'Book flight']);
  assert.match(en.contents.footer.contents[1].action.uri, /currency=usd$/);

  const text = (lookup, lang) => flightMessages('TG403', lookup, NOW, lang)[0];
  assert.deepEqual(text({ status: 204, text: '' }), { type: 'text', text: 'ไม่พบเที่ยวบิน ตรวจสอบหมายเลขแล้วลองอีกครั้ง' });
  assert.equal(text({ status: 200, text: '[]' }, 'en').text, 'Flight not found. Check the number and try again.');
  assert.equal(text({ status: 500, text: 'oops' }).text, 'ข้อมูลสดไม่พร้อมใช้งานในขณะนี้ ลองอีกครั้งในอีกสักครู่');
  const limited = Object.assign(new Error('Try again'), { code: 'rate_limited', status: 429, retryAfterMin: 12 });
  assert.equal(text({ error: limited }).text, 'ค้นหาบ่อยเกินไป ลองอีกครั้งใน 12 นาที');
  assert.equal(text({ error: limited }, 'en').text, 'Too many searches. Try again in 12 min.');
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

test('webhook: EN → English confirmation and cards, TH → Thai again (the chat test)', async () => {
  const { stored, preferences } = memoryPreferences();
  const { line, send } = setup({ preferences });
  const badge = (msg) => msg.contents.body.contents[0].contents[1].contents[0].text;

  await send(textEvent('EN'));
  await send(textEvent('TG403'));
  assert.deepEqual(stored, { U123: 'en' });
  await send(textEvent('TH'));
  await send(textEvent('TG403'));
  assert.deepEqual(stored, { U123: 'th' });

  const [enSet, enCard, thSet, thCard] = line.replies().map(r => r.messages[0]);
  assert.deepEqual(enSet, { type: 'text', text: 'Language set to English 🇬🇧' });
  assert.equal(badge(enCard), 'Delayed');
  assert.match(enCard.altText, /Delayed · 30 min$/);
  assert.deepEqual(thSet, { type: 'text', text: 'ตั้งภาษาเป็นไทยแล้ว 🇹🇭' });
  assert.equal(badge(thCard), 'ล่าช้า');
  assert.equal(LANGUAGE_SET_TEXT.en, enSet.text);
});

test('webhook: new users get Thai; ENGLISH and ไทย work too; preference is per LINE user', async () => {
  const { stored, preferences } = memoryPreferences({ Uen: 'en' });
  const { line, lookups, send } = setup({ preferences });
  await send(textEvent('TG403', { type: 'user', userId: 'Unew' }));
  await send(textEvent('TG403', { type: 'user', userId: 'Uen' }));
  await send(textEvent('english', { type: 'user', userId: 'Ua' }));
  await send(textEvent('ไทย', { type: 'user', userId: 'Uen' }));
  assert.deepEqual(stored, { Uen: 'th', Ua: 'en' });
  assert.equal(lookups.length, 2);
  const [newUser, enUser, aSet, thSet] = line.replies().map(r => r.messages[0]);
  assert.match(newUser.altText, /ล่าช้า/);
  assert.match(enUser.altText, /Delayed/);
  assert.equal(aSet.text, 'Language set to English 🇬🇧');
  assert.equal(thSet.text, 'ตั้งภาษาเป็นไทยแล้ว 🇹🇭');
});

test('webhook: other text → hint in the user\'s language, without a flight lookup', async () => {
  const { preferences } = memoryPreferences({ Uen: 'en' });
  const { line, lookups, send } = setup({ preferences });
  await send(textEvent('hallo'));
  await send(textEvent('hello', { type: 'user', userId: 'Uen' }));
  assert.equal(lookups.length, 0);
  assert.deepEqual(line.replies().map(r => r.messages), [
    [{ type: 'text', text: INVALID_FLIGHT_TEXT.th }],
    [{ type: 'text', text: INVALID_FLIGHT_TEXT.en }],
  ]);
});

test('webhook: database trouble → Thai card still sent, a language switch is not confirmed', async () => {
  const broken = {
    getLanguage: async () => { throw new Error('connection refused'); },
    setLanguage: async () => { throw new Error('connection refused'); },
  };
  const { line, errors, send } = setup({ preferences: broken });
  await send(textEvent('TG403'));
  await send(textEvent('EN'));
  const [card, switched] = line.replies().map(r => r.messages[0]);
  assert.equal(card.type, 'flex');
  assert.match(card.altText, /ล่าช้า/);
  assert.deepEqual(switched, { type: 'text', text: 'Live data is unavailable right now. Try again shortly.' });
  assert.equal(errors.length, 2);

  const noDb = setup({ preferences: null });
  await noDb.send(textEvent('TH'));
  await noDb.send(textEvent('TG403'));
  const [thSwitch, thCard] = noDb.line.replies().map(r => r.messages[0]);
  assert.equal(thSwitch.text, 'ข้อมูลสดไม่พร้อมใช้งานในขณะนี้ ลองอีกครั้งในอีกสักครู่');
  assert.match(thCard.altText, /ล่าช้า/);
});

test('webhook: bad signature, stickers, follows, group chatter and user-less commands get no reply', async () => {
  const { webhook, line, lookups } = setup();
  const res = fakeRes();
  await webhook.handler(webhookRequest([textEvent('TG403')], 'bm90LXRoZS1zaWduYXR1cmU='), res);
  assert.equal(res.statusCode, 200);
  await webhook.handler(webhookRequest([], ''), fakeRes());
  await webhook.handler(webhookRequest([
    { type: 'message', replyToken: 'rt-s', source: { type: 'user', userId: 'U1' }, message: { type: 'sticker' } },
    { type: 'follow', replyToken: 'rt-f', source: { type: 'user', userId: 'U1' } },
    textEvent('hallo allemaal', { type: 'group', groupId: 'C1', userId: 'U1' }),
    textEvent('EN', { type: 'room', roomId: 'R1' }),
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
  const { line, send } = setup({ line: { replyStatuses: [200, 200, 401, 200] } });
  await send(textEvent('hallo'));
  await send(textEvent('TG403'));
  assert.equal(line.tokenCalls(), 1);
  await send(textEvent('hoi'));
  assert.equal(line.tokenCalls(), 2);
  assert.deepEqual(line.replies().map(r => r.auth), ['Bearer tok-1', 'Bearer tok-1', 'Bearer tok-1', 'Bearer tok-2']);
});

test('webhook: a failing reply is logged, never thrown', async () => {
  const { errors, send } = setup({ line: { replyStatuses: [400] } });
  await send(textEvent('hallo'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /line_reply_400/);
});

/** In-memory tracked_flights behind the createTrackedFlights interface. */
function memoryTracked(rows = {}) {
  return {
    rows,
    async countActive(userId, number) {
      return Object.keys(rows).filter(k => k.startsWith(`${userId}:`) && k !== `${userId}:${number}`).length;
    },
    async track(userId, number, status) { rows[`${userId}:${number}`] = status; },
  };
}

const withStatus = (status) => JSON.stringify(JSON.parse(TG403).map(f => ({ ...f, status })));

test('parseTrackCommand: TRACK plus a valid flight number, case and spaces ignored', () => {
  assert.equal(parseTrackCommand('TRACK TG403'), 'TG403');
  assert.equal(parseTrackCommand('track tg 403'), 'TG403');
  assert.equal(parseTrackCommand('  Track   FD3001 '), 'FD3001');
  assert.equal(parseTrackCommand('TRACK'), '');
  assert.equal(parseTrackCommand('TRACK hallo'), '');
  assert.equal(parseTrackCommand('TRACKTG403'), '');
  assert.equal(parseTrackCommand('TG403'), '');
  assert.equal(parseTrackCommand(''), '');
});

test('webhook: TRACK TG403 → saved with the current status, confirmation + card in the user\'s language', async () => {
  const tracked = memoryTracked();
  const { preferences } = memoryPreferences({ Uen: 'en' });
  const { line, lookups, send } = setup({ trackedFlights: tracked, preferences });
  await send(textEvent('track tg 403'));
  await send(textEvent('TRACK TG403', { type: 'user', userId: 'Uen' }));
  assert.deepEqual(tracked.rows, { 'U123:TG403': 'delayed', 'Uen:TG403': 'delayed' });
  assert.deepEqual(lookups, [{ caller: 'line:U123', number: 'TG403' }, { caller: 'line:Uen', number: 'TG403' }]);
  const [th, en] = line.replies().map(r => r.messages);
  assert.deepEqual(th[0], { type: 'text', text: '🔔 ติดตาม TG403 แล้ว จะแจ้งเตือนที่นี่เมื่อสถานะเปลี่ยน' });
  assert.equal(th[1].type, 'flex');
  assert.deepEqual(en[0], { type: 'text', text: '🔔 Tracking TG403. I\'ll message you here when the status changes.' });
  assert.match(en[1].altText, /Delayed/);
});

test('webhook: TRACK limit, finished flights and unknown flights are not saved', async () => {
  const full = {};
  for (let i = 0; i < MAX_ACTIVE_PER_USER; i += 1) full[`U123:XX${i}`] = 'scheduled';
  const tracked = memoryTracked(full);
  const { line, send } = setup({ trackedFlights: tracked });
  await send(textEvent('TRACK TG403'));
  assert.equal(line.replies()[0].messages[0].text, `ติดตามได้สูงสุด ${MAX_ACTIVE_PER_USER} เที่ยวบินพร้อมกัน`);
  assert.equal('U123:TG403' in tracked.rows, false);

  const landed = setup({ trackedFlights: memoryTracked(), lookup: () => ({ status: 200, text: withStatus('Arrived') }) });
  await landed.send(textEvent('TRACK TG403'));
  assert.equal(landed.line.replies()[0].messages[0].text, 'TG403: ลงจอดแล้ว — ไม่ต้องติดตามต่อแล้ว');

  const unknown = memoryTracked();
  const missing = setup({ trackedFlights: unknown, lookup: () => ({ status: 204, text: '' }) });
  await missing.send(textEvent('TRACK TG403'));
  assert.deepEqual(unknown.rows, {});
  assert.deepEqual(missing.line.replies()[0].messages, [{ type: 'text', text: 'ไม่พบเที่ยวบิน ตรวจสอบหมายเลขแล้วลองอีกครั้ง' }]);
  assert.equal(TRACK_TEXT.en.limit.includes('{n}'), true);
});

test('webhook: TRACK without a database or with a failing save is never confirmed; rooms without a user are ignored', async () => {
  const noDb = setup();
  await noDb.send(textEvent('TRACK TG403'));
  assert.equal(noDb.lookups.length, 0);
  assert.deepEqual(noDb.line.replies()[0].messages, [{ type: 'text', text: 'ข้อมูลสดไม่พร้อมใช้งานในขณะนี้ ลองอีกครั้งในอีกสักครู่' }]);

  const broken = setup({
    trackedFlights: { countActive: async () => 0, track: async () => { throw new Error('connection refused'); } },
  });
  await broken.send(textEvent('TRACK TG403'));
  const [text, card] = broken.line.replies()[0].messages;
  assert.equal(text.text, 'ข้อมูลสดไม่พร้อมใช้งานในขณะนี้ ลองอีกครั้งในอีกสักครู่');
  assert.equal(card.type, 'flex');
  assert.match(broken.errors[0], /saving tracked flight failed: connection refused/);

  const room = setup({ trackedFlights: memoryTracked() });
  await room.send(textEvent('TRACK TG403', { type: 'room', roomId: 'R1' }));
  assert.equal(room.line.calls.length, 0);
});

test('push sends to /v2/bot/message/push with the user ID and the same token handling', async () => {
  const { webhook, line } = setup({ line: { replyStatuses: [401, 200] } });
  await webhook.push('U123', [{ type: 'text', text: 'hi' }]);
  const pushes = line.calls.filter(c => c.url.endsWith('/v2/bot/message/push'));
  assert.equal(pushes.length, 2);
  assert.deepEqual(JSON.parse(pushes[1].opts.body), { to: 'U123', messages: [{ type: 'text', text: 'hi' }] });
  assert.equal(pushes[1].opts.headers.Authorization, 'Bearer tok-2');
  const failing = setup({ line: { replyStatuses: [400] } });
  await assert.rejects(failing.webhook.push('U1', []), /line_push_400/);
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
