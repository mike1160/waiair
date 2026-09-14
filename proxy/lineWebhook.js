/**
 * LINE Messaging API webhook for the WaiAir OA: a flight number in, a Flex status card out.
 * The card is the one the LIFF page shares — liff-core.js is a copy of docs/liff-core.js because the
 * Railway image only contains proxy/ (lineWebhook.test.js fails when the two drift apart).
 * The only state is the chat language per LINE user (userPreferences.js): "EN" / "TH" switch it.
 */

const crypto = require('node:crypto');
const core = require('./liff-core');
const { fetchWithAbort } = require('./upstream');
const { DEFAULT_LANGUAGE } = require('./userPreferences');

const LINE_API = 'https://api.line.me';
const INVALID_FLIGHT_TEXT = {
  th: 'กรุณาพิมพ์หมายเลขเที่ยวบิน เช่น TG403',
  en: 'Please type a flight number, e.g. TG403',
};
/** Chat commands (after trim + uppercase) → language. */
const LANGUAGE_COMMANDS = { EN: 'en', ENGLISH: 'en', TH: 'th', 'ไทย': 'th' };
const LANGUAGE_SET_TEXT = {
  en: 'Language set to English 🇬🇧',
  th: 'ตั้งภาษาเป็นไทยแล้ว 🇹🇭',
};
/** Issued channel access tokens live 30 days; renew a day early. */
const TOKEN_REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

/** x-line-signature = base64(HMAC-SHA256(channel secret, raw request body)). */
function verifySignature(rawBody, signature, channelSecret) {
  if (!channelSecret || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest();
  const given = Buffer.from(String(signature), 'base64');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** "TG 403" → "TG403"; '' unless it is two letters + 1–4 digits. */
function parseFlightInput(text) {
  const s = String(text || '').replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}\d{1,4}$/.test(s) ? s : '';
}

/** "en" / " English " → 'en', "TH" / "ไทย" → 'th'; '' for anything else. */
function parseLanguageCommand(text) {
  return LANGUAGE_COMMANDS[String(text || '').trim().toUpperCase()] || '';
}

function textMessage(text) {
  return { type: 'text', text };
}

/**
 * Reply messages for one lookup: { status, text } from fetchFlightStatus, or { error } when it threw.
 * Mirrors loadFlight in docs/liff.html.
 */
function flightMessages(number, lookup, now, lang = DEFAULT_LANGUAGE) {
  const s = core.STRINGS[lang];
  const fail = (info) => [textMessage(core.format(s[info.key], info.params))];
  if (lookup.error) {
    const e = lookup.error;
    return fail(core.errorInfo(e.status, { retryAfterMin: e.retryAfterMin }));
  }
  let body = null;
  try { body = lookup.text ? JSON.parse(lookup.text) : null; } catch { /* not JSON */ }
  const ok = lookup.status >= 200 && lookup.status < 300;
  const items = Array.isArray(body) ? body : (body && body.departure ? [body] : []);
  const summary = ok ? core.flightSummary(core.pickFlight(items, now)) : null;
  if (!summary) return fail(core.errorInfo(ok ? 404 : lookup.status, body));
  return [core.flightFlexMessage(summary, lang, core.shareLink(summary.number || number), now)];
}

/**
 * Reply API client. Uses LINE_CHANNEL_ACCESS_TOKEN when set, otherwise issues a short-lived
 * token from the channel ID + secret and reuses it until shortly before it expires.
 */
function createLineClient({ channelId, channelSecret, accessToken, fetchFn, now = () => Date.now() }) {
  let issued = null;
  let pending = null;

  async function issueToken() {
    if (!channelId || !channelSecret) throw new Error('line_unconfigured: LINE_CHANNEL_ID / LINE_CHANNEL_SECRET missing');
    const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: channelId, client_secret: channelSecret });
    const r = await fetchWithAbort(`${LINE_API}/v2/oauth/accessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }, undefined, fetchFn);
    if (!r.ok) throw new Error(`line_token_${r.status}: ${r.text.slice(0, 200)}`);
    const json = JSON.parse(r.text);
    issued = { token: json.access_token, expiresAt: now() + Number(json.expires_in || 0) * 1000 };
    return issued.token;
  }

  function token(renew) {
    if (accessToken) return Promise.resolve(accessToken);
    if (!renew && issued && issued.expiresAt - TOKEN_REFRESH_MARGIN_MS > now()) return Promise.resolve(issued.token);
    if (!pending) pending = issueToken().finally(() => { pending = null; });
    return pending;
  }

  async function reply(replyToken, messages) {
    const send = (t) => fetchWithAbort(`${LINE_API}/v2/bot/message/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ replyToken, messages }),
    }, undefined, fetchFn);
    let r = await send(await token(false));
    if (r.status === 401 && !accessToken) r = await send(await token(true));
    if (!r.ok) throw new Error(`line_reply_${r.status}: ${r.text.slice(0, 300)}`);
  }

  return { reply };
}

/**
 * @param {object} opts
 * @param {(number: string) => Promise<{ status:number, text:string }>} opts.fetchFlightStatus same cache + budget as /flight/:number
 * @param {(caller: string, fn: () => Promise<any>) => Promise<any>} [opts.runAsCaller] runs fn with the per-user budget key
 * @param {{ getLanguage: Function, setLanguage: Function } | null} [opts.preferences] userPreferences.js; null without a database
 */
function createLineWebhook({
  channelSecret,
  channelId,
  accessToken,
  fetchFlightStatus,
  preferences = null,
  runAsCaller = (_caller, fn) => fn(),
  fetchFn,
  now = () => Date.now(),
  log = console,
}) {
  const client = createLineClient({ channelId, channelSecret, accessToken, fetchFn, now });

  /** Stored language; Thai for new users, without a user ID, or when the database is unavailable. */
  async function languageFor(userId) {
    if (!preferences || !userId) return DEFAULT_LANGUAGE;
    try {
      return await preferences.getLanguage(userId);
    } catch (e) {
      log.error('[line] reading language failed:', e && e.message);
      return DEFAULT_LANGUAGE;
    }
  }

  async function changeLanguage(event, userId, language) {
    let text = LANGUAGE_SET_TEXT[language];
    try {
      if (!preferences) throw new Error('user_preferences_unavailable (no DATABASE_URL)');
      await preferences.setLanguage(userId, language);
    } catch (e) {
      // Don't confirm a switch that wasn't saved.
      log.error('[line] saving language failed:', e && e.message);
      text = core.STRINGS[language].unavailable;
    }
    await client.reply(event.replyToken, [textMessage(text)]);
  }

  async function handleEvent(event) {
    if (!event || event.type !== 'message' || !event.replyToken) return;
    if (!event.message || event.message.type !== 'text') return;
    const source = event.source || {};
    const text = event.message.text;

    const command = parseLanguageCommand(text);
    if (command) {
      if (source.userId) await changeLanguage(event, source.userId, command);
      return;
    }

    const number = parseFlightInput(text);
    if (!number) {
      // Groups and rooms carry normal chatter — only explain the format in a 1:1 chat.
      if (source.type === 'user') {
        await client.reply(event.replyToken, [textMessage(INVALID_FLIGHT_TEXT[await languageFor(source.userId)])]);
      }
      return;
    }
    const lang = await languageFor(source.userId);
    // Per LINE user, not per IP: every webhook call comes from LINE's servers.
    const caller = `line:${source.userId || source.groupId || source.roomId || 'unknown'}`;
    let lookup;
    try {
      lookup = await runAsCaller(caller, () => fetchFlightStatus(number));
    } catch (error) {
      lookup = { error };
    }
    const messages = flightMessages(number, lookup, now(), lang);
    console.log('[line] flight', number, '| caller:', caller, '| lang:', lang, '| reply:', messages[0].type);
    await client.reply(event.replyToken, messages);
  }

  /** Mounted behind express.raw so req.body is the exact signed bytes. Always 200 first, then work. */
  function handler(req, res) {
    res.sendStatus(200);
    if (!channelSecret) {
      log.warn('[line] LINE_CHANNEL_SECRET not set — webhook ignored');
      return Promise.resolve();
    }
    const raw = Buffer.isBuffer(req.body) ? req.body : null;
    if (!verifySignature(raw, req.get('x-line-signature'), channelSecret)) {
      log.warn('[line] invalid signature — webhook ignored');
      return Promise.resolve();
    }
    let events;
    try {
      events = JSON.parse(raw.toString('utf8')).events;
    } catch {
      log.warn('[line] webhook body is not JSON — ignored');
      return Promise.resolve();
    }
    return Promise.all((Array.isArray(events) ? events : []).map(event => (
      handleEvent(event).catch(e => log.error('[line] event failed:', e && e.message))
    )));
  }

  return { handler, handleEvent };
}

module.exports = {
  INVALID_FLIGHT_TEXT,
  LANGUAGE_SET_TEXT,
  verifySignature,
  parseFlightInput,
  parseLanguageCommand,
  flightMessages,
  createLineWebhook,
};
