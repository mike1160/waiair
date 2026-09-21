/**
 * Family Safety Mode — fan a trip moment out to the people following a shared flight.
 *
 * The traveller's own notifications stay on their device; only follower moments come through here. The
 * record holds no location data: a follower learns what the flight status and the traveller's own bookings
 * already said, nothing more.
 *
 * Two things a reviewer should know before this goes near production:
 *
 * 1. The store is in memory, as specified. expoPush.js keeps its tokens in Postgres on purpose, "so they
 *    survive Railway restarts" — this one does not. Every deploy silently drops every share and every
 *    follower registration for the rest of an 8-day window, and nobody is told. Moving `createFamilyShareStore`
 *    onto the pool is the fix; the interface below is already async so that swap is local to this file.
 *
 * 2. Holding the token is the whole of the authorisation. Anyone the link is forwarded to can register as a
 *    follower, the traveller is never shown who is following, and there is no revoke. For a feature called
 *    Family Safety Mode that is the wrong default.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Same window the app uses (lib/familyShare.ts SHARE_TTL_MS). */
const SHARE_TTL_MS = 8 * 24 * 3600 * 1000;
const MAX_FOLLOWERS = 25;

function isExpoToken(token) {
  return /^ExponentPushToken\[.+\]$/.test(String(token || '').trim());
}

function cleanToken(raw) {
  return String(raw || '').trim();
}

/** The record as a follower's device may see it: never any push tokens, never the follower list. */
function publicShare(record) {
  if (!record) return null;
  return {
    flightKey: record.flightKey || '',
    travelerName: record.travelerName || null,
    expiresMs: Number(record.expiresMs) || 0,
  };
}

/**
 * An urgent moment interrupts; everything else arrives quietly. A phone buzzing at 3am because someone's
 * hotel is probably reached is how a family feature gets muted.
 */
function familyMessage(pushToken, moment) {
  const urgent = !!moment.urgent;
  return {
    to: pushToken,
    title: String(moment.title || ''),
    body: String(moment.body || ''),
    priority: urgent ? 'high' : 'normal',
    ...(urgent ? { sound: 'default' } : {}),
    data: {
      kind: String(moment.momentKind || ''),
      source: 'family',
      flightKey: String(moment.flightKey || ''),
    },
  };
}

/** @param {{ now?: () => number }} [opts] */
function createFamilyShareStore(opts = {}) {
  const now = opts.now || (() => Date.now());
  /** @type {Map<string, any>} */
  const shares = new Map();

  function purge() {
    const t = now();
    for (const [token, rec] of shares) {
      if (!rec || t > Number(rec.expiresMs || 0)) shares.delete(token);
    }
  }

  async function put(record) {
    const token = cleanToken(record && record.token);
    if (!token) throw Object.assign(new Error('missing_token'), { code: 'missing_token' });
    purge();
    const created = Number(record.createdMs) || now();
    const existing = shares.get(token);
    shares.set(token, {
      flightKey: String(record.flightKey || ''),
      token,
      createdMs: created,
      // Never let a caller extend its own share past the agreed window.
      expiresMs: Math.min(Number(record.expiresMs) || created + SHARE_TTL_MS, created + SHARE_TTL_MS),
      travelerName: record.travelerName ? String(record.travelerName).trim() : null,
      // Followers live only here; the app never uploads them (lib/familyShare.ts publicShareRecord).
      followers: existing ? existing.followers : [],
    });
    return publicShare(shares.get(token));
  }

  async function get(token) {
    purge();
    return shares.get(cleanToken(token)) || null;
  }

  async function follow(token, pushToken, name) {
    purge();
    const rec = shares.get(cleanToken(token));
    if (!rec) throw Object.assign(new Error('unknown_share'), { code: 'unknown_share' });
    const push = cleanToken(pushToken);
    if (!isExpoToken(push)) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });
    const at = rec.followers.findIndex(f => f.pushToken === push);
    if (at >= 0) {
      if (name) rec.followers[at].name = String(name).trim();
      return rec;
    }
    // A cap, so one leaked link cannot be turned into a broadcast list.
    if (rec.followers.length >= MAX_FOLLOWERS) {
      throw Object.assign(new Error('too_many_followers'), { code: 'too_many_followers' });
    }
    rec.followers.push({
      pushToken: push,
      name: name ? String(name).trim() : null,
      addedMs: now(),
    });
    return rec;
  }

  async function unfollow(token, pushToken) {
    const rec = shares.get(cleanToken(token));
    if (!rec) return null;
    const push = cleanToken(pushToken);
    rec.followers = rec.followers.filter(f => f.pushToken !== push);
    return rec;
  }

  async function remove(token) {
    return shares.delete(cleanToken(token));
  }

  return { put, get, follow, unfollow, remove, purge, size: () => shares.size };
}

/**
 * @param {object} opts
 * @param {ReturnType<typeof createFamilyShareStore>} opts.store
 * @param {typeof fetch} [opts.fetchImpl]
 */
function createFamilyPushSender({ store, fetchImpl = fetch, log = console }) {
  async function send(token, moment) {
    const rec = await store.get(token);
    if (!rec) return { followers: 0, sent: 0, failed: 0, reason: 'unknown_share' };
    const followers = (rec.followers || []).filter(f => isExpoToken(f.pushToken));
    if (!followers.length) return { followers: 0, sent: 0, failed: 0 };

    const messages = followers.map(f => familyMessage(f.pushToken, { ...moment, flightKey: rec.flightKey }));
    let status = 0;
    let json = null;
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      status = res.status;
      json = await res.json().catch(() => null);
    } catch (e) {
      log.error('[family] Expo send failed', e && e.message);
      return { followers: followers.length, sent: 0, failed: followers.length };
    }
    if (status < 200 || status >= 300) {
      log.error('[family] Expo send rejected', status);
      return { followers: followers.length, sent: 0, failed: followers.length };
    }
    const tickets = json && json.data;
    const list = Array.isArray(tickets) ? tickets : (tickets ? [tickets] : []);
    // A device that uninstalled stops being a follower rather than failing forever.
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const err = t && t.details && t.details.error;
      if (t && t.status === 'error' && err === 'DeviceNotRegistered') {
        await store.unfollow(token, followers[i] && followers[i].pushToken);
      }
    }
    const sent = list.filter(t => t && t.status === 'ok').length;
    return { followers: followers.length, sent, failed: Math.max(0, messages.length - sent) };
  }

  return { send };
}

/** Mounts the four endpoints on an Express app. */
function registerFamilyPushRoutes(app, { store, sender, log = console }) {
  /** The traveller's device uploads the share (never the push tokens) so the fan-out can find it. */
  app.put('/family-share', async (req, res) => {
    try {
      const body = (req && req.body) || {};
      const record = await store.put(body);
      res.json({ ok: true, ...record });
    } catch (e) {
      if (e && e.code === 'missing_token') return res.status(400).json({ error: 'token required' });
      log.error('[family] put share failed:', e && e.message);
      res.status(500).json({ error: 'share_failed' });
    }
  });

  /** What a follower's device may read before registering. No push tokens, no follower list. */
  app.get('/family-share/:token', async (req, res) => {
    const rec = await store.get(req.params.token);
    if (!rec) return res.status(404).json({ error: 'not_found' });
    res.json(publicShare(rec));
  });

  /** A follower registers itself. Holding the token is the whole of the authorisation — see the file note. */
  app.post('/family-share/:token/follow', async (req, res) => {
    try {
      const body = (req && req.body) || {};
      await store.follow(req.params.token, body.pushToken, body.name);
      res.json({ ok: true });
    } catch (e) {
      const code = e && e.code;
      if (code === 'unknown_share') return res.status(404).json({ error: 'not_found' });
      if (code === 'invalid_token') return res.status(400).json({ error: 'Valid Expo push token required' });
      if (code === 'too_many_followers') return res.status(429).json({ error: 'too_many_followers' });
      log.error('[family] follow failed:', e && e.message);
      res.status(500).json({ error: 'follow_failed' });
    }
  });

  /** Fan one moment out to everyone following that share. */
  app.post('/family-push', async (req, res) => {
    try {
      const body = (req && req.body) || {};
      const token = cleanToken(body.token);
      if (!token) return res.status(400).json({ error: 'token required' });
      const result = await sender.send(token, {
        momentKind: body.momentKind,
        title: body.title,
        body: body.body,
        urgent: !!body.urgent,
      });
      if (result.reason === 'unknown_share') return res.status(404).json({ error: 'not_found' });
      res.json({ ok: true, ...result });
    } catch (e) {
      log.error('[family] push failed:', e && e.message);
      res.status(500).json({ error: 'push_failed' });
    }
  });
}

module.exports = {
  EXPO_PUSH_URL,
  SHARE_TTL_MS,
  MAX_FOLLOWERS,
  isExpoToken,
  publicShare,
  familyMessage,
  createFamilyShareStore,
  createFamilyPushSender,
  registerFamilyPushRoutes,
};
