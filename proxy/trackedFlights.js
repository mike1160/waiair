/**
 * "TRACK TG403" in the WaiAir OA → a row in tracked_flights (Railway Postgres). Every 5 minutes the tracker re-checks
 * the active rows through fetchFlightStatus (same cache as /flight/:number, global AeroDataBox budget only) and pushes
 * a LINE message when the status changes. Push uses the Messaging API (/v2/bot/message/push) — LINE Notify was shut
 * down on 31 March 2025, so no per-user notify token is needed: the user only has to be a friend of the OA.
 */

const core = require('./liff-core');
const { DEFAULT_LANGUAGE } = require('./userPreferences');

const TRACK_INTERVAL_MS = 5 * 60 * 1000;
/** Rows stop being checked this long after TRACK, even without a final status. */
const TRACK_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_ACTIVE_PER_USER = 5;
/** Share of the 500/hour AeroDataBox budget (costGuard.js) kept free for app and chat lookups. */
const RESERVED_HOURLY_CALLS = 100;
/** After these the flight is done: push the change, then stop tracking. */
const FINAL_STATUSES = ['landed', 'cancelled', 'diverted'];

const STATUS_CHANGED_TEXT = {
  en: '✈️ {flight} — status changed: {from} → {to}',
  th: '✈️ {flight} — สถานะเปลี่ยน: {from} → {to}',
};
const TRACK_TEXT = {
  en: {
    added: '🔔 Tracking {flight}. I\'ll message you here when the status changes.',
    limit: 'You can track up to {n} flights at a time.',
    final: '{flight}: {status} — nothing left to track.',
  },
  th: {
    added: '🔔 ติดตาม {flight} แล้ว จะแจ้งเตือนที่นี่เมื่อสถานะเปลี่ยน',
    limit: 'ติดตามได้สูงสุด {n} เที่ยวบินพร้อมกัน',
    final: '{flight}: {status} — ไม่ต้องติดตามต่อแล้ว',
  },
};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS tracked_flights (
    id BIGSERIAL PRIMARY KEY,
    line_user_id TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    last_status TEXT,
    last_checked TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (line_user_id, flight_number)
  )
`;
const CREATE_INDEX_SQL = 'CREATE INDEX IF NOT EXISTS tracked_flights_active_idx ON tracked_flights (id) WHERE active';

/** STRINGS.status key of the leg closest to now, or '' when the lookup has no flight. Mirrors flightMessages. */
function statusFromLookup(lookup, now) {
  if (!lookup || lookup.error || !(lookup.status >= 200 && lookup.status < 300)) return '';
  let body = null;
  try { body = lookup.text ? JSON.parse(lookup.text) : null; } catch { return ''; }
  const items = Array.isArray(body) ? body : (body && body.departure ? [body] : []);
  const summary = core.flightSummary(core.pickFlight(items, now));
  return summary ? summary.status : '';
}

/** "✈️ TG403 — status changed: En Route → Landed" in the user's chat language. */
function statusChangedText(flight, from, to, lang = DEFAULT_LANGUAGE) {
  const labels = core.STRINGS[lang].status;
  return core.format(STATUS_CHANGED_TEXT[lang], { flight, from: labels[from] || from, to: labels[to] || to });
}

/** @param {{ query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }} pool */
function createTrackedFlights(pool) {
  async function migrate() {
    await pool.query(CREATE_TABLE_SQL);
    await pool.query(CREATE_INDEX_SQL);
  }

  /** Active rows for this user, not counting `flightNumber` (tracking it again replaces that row). */
  async function countActive(lineUserId, flightNumber) {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM tracked_flights WHERE line_user_id = $1 AND active AND flight_number <> $2',
      [lineUserId, flightNumber],
    );
    return rows[0] ? Number(rows[0].n) : 0;
  }

  /** Starts (or restarts) tracking; `status` is what the user just saw, so only later changes are pushed. */
  async function track(lineUserId, flightNumber, status) {
    if (!lineUserId) throw new Error('missing_line_user_id');
    await pool.query(
      `INSERT INTO tracked_flights (line_user_id, flight_number, last_status, last_checked, active, created_at)
       VALUES ($1, $2, $3, NOW(), TRUE, NOW())
       ON CONFLICT (line_user_id, flight_number) DO UPDATE
       SET last_status = EXCLUDED.last_status, last_checked = NOW(), active = TRUE, created_at = NOW()`,
      [lineUserId, flightNumber, status],
    );
  }

  /** Deactivates rows tracked before `before` (Date). */
  async function expire(before) {
    await pool.query('UPDATE tracked_flights SET active = FALSE WHERE active AND created_at < $1', [before]);
  }

  async function listActive() {
    const { rows } = await pool.query(
      'SELECT id, line_user_id, flight_number, last_status FROM tracked_flights WHERE active ORDER BY id',
    );
    return rows;
  }

  async function update(id, status, active) {
    await pool.query(
      'UPDATE tracked_flights SET last_status = $2, last_checked = NOW(), active = $3 WHERE id = $1',
      [id, status, active],
    );
  }

  return { migrate, countActive, track, expire, listActive, update };
}

/**
 * @param {object} opts
 * @param {ReturnType<typeof createTrackedFlights>} opts.store
 * @param {(number: string) => Promise<{ status:number, text:string }>} opts.fetchFlightStatus
 * @param {(to: string, messages: object[]) => Promise<void>} opts.push LINE Messaging API push
 * @param {{ getLanguage: Function } | null} [opts.preferences] userPreferences.js
 * @param {() => boolean} [opts.canSpend] false when the AeroDataBox hour budget is nearly used up
 */
function createFlightTracker({
  store,
  fetchFlightStatus,
  push,
  preferences = null,
  canSpend = () => true,
  now = () => Date.now(),
  log = console,
}) {
  let running = false;

  async function languageFor(userId) {
    if (!preferences) return DEFAULT_LANGUAGE;
    try {
      return await preferences.getLanguage(userId);
    } catch (e) {
      log.error('[track] reading language failed:', e && e.message);
      return DEFAULT_LANGUAGE;
    }
  }

  /** One lookup per flight number, shared by every user tracking it. */
  async function checkFlight(number, rows) {
    let lookup;
    try {
      lookup = await fetchFlightStatus(number);
    } catch (e) {
      log.error('[track] lookup failed:', number, e && e.message);
      return 0;
    }
    const status = statusFromLookup(lookup, now());
    if (!status) return 0;
    let pushed = 0;
    for (const row of rows) {
      if (row.last_status && row.last_status !== status) {
        try {
          const text = statusChangedText(row.flight_number, row.last_status, status, await languageFor(row.line_user_id));
          await push(row.line_user_id, [{ type: 'text', text }]);
          pushed += 1;
        } catch (e) {
          // Keep last_status so the next round tries again.
          log.error('[track] push failed:', row.flight_number, e && e.message);
          continue;
        }
      }
      await store.update(row.id, status, !FINAL_STATUSES.includes(status));
    }
    return pushed;
  }

  async function tick() {
    if (running) return { skipped: 'running' };
    running = true;
    try {
      await store.expire(new Date(now() - TRACK_MAX_AGE_MS));
      const byFlight = new Map();
      for (const row of await store.listActive()) {
        if (!byFlight.has(row.flight_number)) byFlight.set(row.flight_number, []);
        byFlight.get(row.flight_number).push(row);
      }
      let checked = 0;
      let pushed = 0;
      for (const [number, rows] of byFlight) {
        if (!canSpend()) {
          log.warn(`[track] AeroDataBox budget low — ${byFlight.size - checked} flights wait for the next round`);
          break;
        }
        pushed += await checkFlight(number, rows);
        checked += 1;
      }
      if (byFlight.size) console.log('[track] round | flights:', byFlight.size, '| checked:', checked, '| pushed:', pushed);
      return { flights: byFlight.size, checked, pushed };
    } catch (e) {
      log.error('[track] round failed:', e && e.message);
      return { error: e };
    } finally {
      running = false;
    }
  }

  function start(intervalMs = TRACK_INTERVAL_MS) {
    const timer = setInterval(() => { tick(); }, intervalMs);
    timer.unref();
    return timer;
  }

  return { tick, start };
}

module.exports = {
  TRACK_INTERVAL_MS,
  TRACK_MAX_AGE_MS,
  MAX_ACTIVE_PER_USER,
  RESERVED_HOURLY_CALLS,
  FINAL_STATUSES,
  STATUS_CHANGED_TEXT,
  TRACK_TEXT,
  CREATE_TABLE_SQL,
  statusFromLookup,
  statusChangedText,
  createTrackedFlights,
  createFlightTracker,
};
