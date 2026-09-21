/**
 * Family Safety Mode — fan a trip moment out to the people following a shared flight.
 *
 * The traveller's own notifications stay on their device; only follower moments come through here. The
 * record holds no location data: a follower learns what the flight status and the traveller's own bookings
 * already said, nothing more.
 *
 * Shares live in Postgres, on the same pool as the rest of the proxy, so a Railway redeploy no longer drops
 * every share and follower registration part-way through an eight-day window. Without DATABASE_URL there is
 * no store and the endpoints answer 503 rather than pretending to work.
 *
 * One thing a reviewer should still know: holding the token is the whole of the authorisation. Anyone the
 * link is forwarded to can register as a follower and the traveller is not shown who they are — they can
 * only see how many, and revoke the link (long-press the people icon).
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Same window the app uses (lib/familyShare.ts SHARE_TTL_MS). */
const SHARE_TTL_MS = 8 * 24 * 3600 * 1000;
const MAX_FOLLOWERS = 25;
/** A moment is released when its trigger falls inside this much of now — a buffer over the 5-minute poll. */
const MOMENT_DUE_WINDOW_MS = 6 * 60 * 1000;
/** How long a "we already sent this" marker is kept before it is forgotten. */
const SENT_RETENTION_MS = 24 * 3600 * 1000;
/** No share may queue more than this; a runaway device cannot exhaust the proxy's memory. */
const MAX_QUEUED_MOMENTS = 200;

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

const MIGRATION_SQL = [
  `CREATE TABLE IF NOT EXISTS family_shares (
    token TEXT PRIMARY KEY,
    flight_key TEXT NOT NULL,
    traveler_name TEXT,
    created_ms BIGINT NOT NULL,
    expires_ms BIGINT NOT NULL,
    followers JSONB NOT NULL DEFAULT '[]',
    moments JSONB NOT NULL DEFAULT '[]',
    sent_keys JSONB NOT NULL DEFAULT '[]'
  )`,
  'CREATE INDEX IF NOT EXISTS family_shares_expiry_idx ON family_shares (expires_ms)',
];

/** BIGINT comes back from pg as a string. */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rowToShare(row) {
  if (!row) return null;
  return {
    token: row.token,
    flightKey: row.flight_key || '',
    travelerName: row.traveler_name || null,
    createdMs: num(row.created_ms),
    expiresMs: num(row.expires_ms),
    followers: Array.isArray(row.followers) ? row.followers : [],
    moments: Array.isArray(row.moments) ? row.moments : [],
    sentKeys: Array.isArray(row.sent_keys) ? row.sent_keys : [],
  };
}

/**
 * Shares in Postgres, on the same pool as the rest of the proxy. They used to live in a Map, which meant
 * every Railway redeploy silently dropped every share and every follower registration part-way through an
 * eight-day window, with nobody told. A row survives the restart.
 *
 * @param {{ query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }} pool
 */
function createFamilyShareStore(pool, opts = {}) {
  const now = opts.now || (() => Date.now());

  async function migrate() {
    for (const sql of MIGRATION_SQL) await pool.query(sql);
  }

  /** Expired shares go, and every sent-marker older than a day with them. */
  async function purge() {
    const t = now();
    await pool.query('DELETE FROM family_shares WHERE expires_ms < $1', [t]);
    await pool.query(
      `UPDATE family_shares SET sent_keys = COALESCE((
         SELECT jsonb_agg(k) FROM jsonb_array_elements(sent_keys) k
         WHERE (k->>'sentMs')::bigint > $1
       ), '[]'::jsonb)`,
      [t - SENT_RETENTION_MS],
    );
  }

  async function put(record) {
    const token = cleanToken(record && record.token);
    if (!token) throw Object.assign(new Error('missing_token'), { code: 'missing_token' });
    await purge();
    const t = now();
    const created = num(record.createdMs) || t;
    /*
     * The caller may shorten its own window but not extend it, and a value that is not a sane future
     * timestamp is ignored rather than trusted. Without the floor, an expiry already in the past was stored
     * verbatim: PUT answered ok, GET could never see the row again, and the next purge deleted it.
     */
    const clientExpires = num(record.expiresMs);
    const expires = (clientExpires && clientExpires > t)
      ? Math.min(clientExpires, created + SHARE_TTL_MS)
      : created + SHARE_TTL_MS;
    const name = record.travelerName ? String(record.travelerName).trim() : null;
    // The followers, the queue and the sent markers belong to the row, not to the uploader: a re-upload
    // from the device must never wipe the people already following.
    const { rows } = await pool.query(
      `INSERT INTO family_shares (token, flight_key, traveler_name, created_ms, expires_ms)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token) DO UPDATE
         SET flight_key = EXCLUDED.flight_key,
             traveler_name = EXCLUDED.traveler_name,
             expires_ms = EXCLUDED.expires_ms
       RETURNING *`,
      [token, String(record.flightKey || ''), name, created, expires],
    );
    return publicShare(rowToShare(rows[0]));
  }

  async function get(token) {
    const key = cleanToken(token);
    if (!key) return null;
    const { rows } = await pool.query(
      'SELECT * FROM family_shares WHERE token = $1 AND expires_ms >= $2',
      [key, now()],
    );
    return rowToShare(rows[0]);
  }

  async function follow(token, pushToken, name) {
    const rec = await get(token);
    if (!rec) throw Object.assign(new Error('unknown_share'), { code: 'unknown_share' });
    const push = cleanToken(pushToken);
    if (!isExpoToken(push)) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });

    const at = rec.followers.findIndex(f => f && f.pushToken === push);
    if (at >= 0) {
      if (!name) return rec;
      const next = rec.followers.map(f => (
        f && f.pushToken === push ? { ...f, name: String(name).trim() } : f
      ));
      await pool.query('UPDATE family_shares SET followers = $1 WHERE token = $2', [JSON.stringify(next), rec.token]);
      return { ...rec, followers: next };
    }
    // A cap, so one leaked link cannot be turned into a broadcast list.
    if (rec.followers.length >= MAX_FOLLOWERS) {
      throw Object.assign(new Error('too_many_followers'), { code: 'too_many_followers' });
    }
    const added = { pushToken: push, name: name ? String(name).trim() : null, addedMs: now() };
    // Appended in the database rather than written whole, so two devices following at once cannot
    // overwrite each other. The cap above is still read-then-write and can be raced past by one.
    await pool.query(
      'UPDATE family_shares SET followers = followers || $1::jsonb WHERE token = $2',
      [JSON.stringify([added]), rec.token],
    );
    return { ...rec, followers: [...rec.followers, added] };
  }

  async function unfollow(token, pushToken) {
    const rec = await get(token);
    if (!rec) return null;
    const push = cleanToken(pushToken);
    const next = rec.followers.filter(f => f && f.pushToken !== push);
    if (next.length === rec.followers.length) return rec;
    await pool.query('UPDATE family_shares SET followers = $1 WHERE token = $2', [JSON.stringify(next), rec.token]);
    return { ...rec, followers: next };
  }

  async function remove(token) {
    const { rows } = await pool.query('DELETE FROM family_shares WHERE token = $1 RETURNING token', [cleanToken(token)]);
    return rows.length > 0;
  }

  /**
   * The follower moments the device computed for this share, replacing whatever was queued before. The
   * device is the only place that can work these out: it has the flight legs and the bookings, neither of
   * which is ever uploaded. The proxy's job is purely to hold them until their moment comes round.
   */
  async function putMoments(token, moments) {
    const rec = await get(token);
    if (!rec) throw Object.assign(new Error('unknown_share'), { code: 'unknown_share' });
    const queue = [];
    const seen = new Set();
    for (const m of (Array.isArray(moments) ? moments : []).slice(0, MAX_QUEUED_MOMENTS)) {
      const momentKey = String((m && m.key) || '').trim();
      const triggerMs = Number(m && m.triggerMs);
      if (!momentKey || !Number.isFinite(triggerMs) || seen.has(momentKey)) continue;
      seen.add(momentKey);
      queue.push({
        key: momentKey,
        kind: String((m && m.kind) || ''),
        triggerMs,
        title: String((m && m.title) || ''),
        body: String((m && m.body) || ''),
        urgent: !!(m && m.urgent),
      });
    }
    await pool.query('UPDATE family_shares SET moments = $1 WHERE token = $2', [JSON.stringify(queue), rec.token]);
    return { queued: queue.length };
  }

  async function dueMoments(token, at) {
    const rec = await get(token);
    if (!rec) return [];
    const sent = new Set(rec.sentKeys.map(k => k && k.key));
    return rec.moments
      .filter(m => m && m.triggerMs <= at + MOMENT_DUE_WINDOW_MS && !sent.has(m.key))
      .sort((a, b) => a.triggerMs - b.triggerMs);
  }

  async function markSent(token, momentKey) {
    await pool.query(
      'UPDATE family_shares SET sent_keys = sent_keys || $1::jsonb WHERE token = $2',
      [JSON.stringify([{ key: String(momentKey || ''), sentMs: now() }]), cleanToken(token)],
    );
  }

  async function wasSent(token, momentKey) {
    const rec = await get(token);
    if (!rec) return false;
    return rec.sentKeys.some(k => k && k.key === String(momentKey || ''));
  }

  /** Every share still alive, for the poll round. */
  async function listShares() {
    await purge();
    const { rows } = await pool.query('SELECT * FROM family_shares WHERE expires_ms >= $1', [now()]);
    return rows.map(rowToShare);
  }

  async function size() {
    const { rows } = await pool.query('SELECT * FROM family_shares WHERE expires_ms >= $1', [now()]);
    return rows.length;
  }

  async function sentSize() {
    const { rows } = await pool.query('SELECT * FROM family_shares WHERE expires_ms >= $1', [now()]);
    return rows.reduce((n, r) => n + (Array.isArray(r.sent_keys) ? r.sent_keys.length : 0), 0);
  }

  return {
    migrate, put, get, follow, unfollow, remove, purge,
    putMoments, dueMoments, markSent, wasSent, listShares, size, sentSize,
  };
}


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

  /**
   * One poll round of follower delivery. Every share that is still alive hands over the moments whose
   * trigger has come round; each is fanned out once and marked, so the next round does not repeat it.
   *
   * This is the authoritative clock for followers. The device cannot schedule a remote push, and nothing
   * else in the system ticks, so a moment reaches the people at home here or not at all.
   */
  async function releaseDue(at = Date.now()) {
    const shares = await store.listShares();
    let considered = 0;
    let sent = 0;
    for (const rec of shares) {
      if (!rec || !rec.token) continue;
      if (at > Number(rec.expiresMs || 0)) continue;
      if (!(rec.followers || []).length) continue;
      const due = await store.dueMoments(rec.token, at);
      for (const moment of due) {
        considered += 1;
        // Marked before the send: a push that fails is not repeated every five minutes for a day.
        await store.markSent(rec.token, moment.key);
        const result = await send(rec.token, {
          momentKind: moment.kind,
          title: moment.title,
          body: moment.body,
          urgent: moment.urgent,
        });
        sent += result.sent || 0;
      }
    }
    if (considered) log.log('[family] released', considered, 'moment(s) |', sent, 'push(es)');
    return { shares: shares.length, considered, sent };
  }

  return { send, releaseDue };
}

/** Mounts the four endpoints on an Express app. */
function registerFamilyPushRoutes(app, { store, sender, log = console }) {
  // Without DATABASE_URL there is nowhere to keep a share, so the whole feature says so rather than
  // pretending to work and dropping everything on the next restart.
  if (!store || !sender) {
    const unavailable = (_req, res) => res.status(503).json({ error: 'Family share store unavailable' });
    app.put('/family-share', unavailable);
    app.get('/family-share/:token', unavailable);
    app.put('/family-share/:token/moments', unavailable);
    app.post('/family-share/:token/follow', unavailable);
    app.delete('/family-share/:token', unavailable);
    app.post('/family-push', unavailable);
    return;
  }
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

  /**
   * The traveller stops the share. The record and its followers go, so the token stops answering and no
   * further moment can ever be fanned out for it. Idempotent: revoking twice is still ok.
   */
  app.delete('/family-share/:token', async (req, res) => {
    try {
      const removed = await store.remove(req.params.token);
      res.json({ ok: true, removed: !!removed });
    } catch (e) {
      log.error('[family] revoke failed:', e && e.message);
      res.status(500).json({ error: 'revoke_failed' });
    }
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

  /**
   * The device uploads the follower moments it computed, with the time each is due. It is replaced whole
   * each time, so the newest view of the trip wins. computeMoments cannot run here: the proxy has neither
   * the flight legs nor the bookings, and never will — they are not uploaded.
   */
  app.put('/family-share/:token/moments', async (req, res) => {
    try {
      const body = (req && req.body) || {};
      const result = await store.putMoments(req.params.token, body.moments);
      res.json({ ok: true, ...result });
    } catch (e) {
      if (e && e.code === 'unknown_share') return res.status(404).json({ error: 'not_found' });
      log.error('[family] queue moments failed:', e && e.message);
      res.status(500).json({ error: 'queue_failed' });
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
  MIGRATION_SQL,
  SHARE_TTL_MS,
  MAX_FOLLOWERS,
  MOMENT_DUE_WINDOW_MS,
  SENT_RETENTION_MS,
  isExpoToken,
  publicShare,
  familyMessage,
  createFamilyShareStore,
  createFamilyPushSender,
  registerFamilyPushRoutes,
};
