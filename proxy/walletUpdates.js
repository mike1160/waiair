/**
 * Apple Wallet pass updates. Every pass the proxy hands out (flight or pickup) is kept in wallet_passes with the content
 * it shows; iPhones register through the Wallet web service (walletWebService.js) into wallet_registrations. The updater
 * re-checks flights that have registered passes, stores changed content and sends an empty APNs push to every device of
 * that flight. Wallet then downloads the pass again (built from wallet_passes, no AeroDataBox call) and shows the new
 * "Latest update" text as a notification.
 */
const crypto = require('node:crypto');
const http2 = require('node:http2');
const { flightPassContent } = require('./flightPass');

const WALLET_TICK_MS = 5 * 60 * 1000;
/** Pickup pass: "time to leave" once the flight is this close to landing. */
const PICKUP_LEAVE_MIN = 45;
/** After landing, keep checking for the baggage belt this long. */
const BAGGAGE_WAIT_MS = 90 * 60 * 1000;
/** Stop checking a pass whose departure is this far in the past, whatever its status. */
const STALE_AFTER_DEPARTURE_MS = 36 * 60 * 60 * 1000;
/** Passes (with their sealed boarding-pass barcode) and registrations are deleted this long after their last update. */
const PASS_RETENTION_DAYS = 7;
const APNS_HOST = 'https://api.push.apple.com';
const FINAL_STATUSES = ['landed', 'cancelled', 'diverted'];
/**
 * updated_at as whole epoch milliseconds: Wallet's passesUpdatedSince tag. Compared in the same integer form — through
 * to_timestamp(ms / 1000.0) the float rounding lands microseconds early and a pass would stay "updated" forever.
 */
const UPDATED_MS_SQL = 'floor(EXTRACT(EPOCH FROM updated_at) * 1000)::bigint';

const MIGRATION_SQL = [
  `CREATE TABLE IF NOT EXISTS wallet_passes (
    serial_number TEXT PRIMARY KEY,
    pass_kind TEXT NOT NULL CHECK (pass_kind IN ('flight', 'pickup')),
    flight_number TEXT NOT NULL,
    content JSONB NOT NULL,
    barcode_sealed TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('milliseconds', NOW())
  )`,
  'CREATE INDEX IF NOT EXISTS wallet_passes_flight_idx ON wallet_passes (flight_number)',
  `CREATE TABLE IF NOT EXISTS wallet_registrations (
    id BIGSERIAL PRIMARY KEY,
    flight_number TEXT NOT NULL,
    serial_number TEXT NOT NULL REFERENCES wallet_passes (serial_number) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    device_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_pushed_at TIMESTAMPTZ,
    UNIQUE (device_id, serial_number)
  )`,
  'CREATE INDEX IF NOT EXISTS wallet_registrations_flight_idx ON wallet_registrations (flight_number)',
];

/** @param {{ query: (sql: string, params?: any[]) => Promise<{ rows: any[], rowCount?: number }> }} pool */
function createWalletStore(pool) {
  async function migrate() {
    for (const sql of MIGRATION_SQL) await pool.query(sql);
  }

  /**
   * Stores (or refreshes) a pass that is being handed out. A re-download keeps the last update text and sent pickup
   * messages, so nothing is announced twice. Returns the stored content.
   */
  async function savePass({ serial, kind, flightNumber, content, barcodeSealed = null }) {
    const { rows } = await pool.query(
      `INSERT INTO wallet_passes (serial_number, pass_kind, flight_number, content, barcode_sealed, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, date_trunc('milliseconds', NOW()))
       ON CONFLICT (serial_number) DO UPDATE
       SET content = EXCLUDED.content || jsonb_strip_nulls(jsonb_build_object(
             'statusMessage', wallet_passes.content->'statusMessage',
             'sent', wallet_passes.content->'sent')),
           barcode_sealed = COALESCE(EXCLUDED.barcode_sealed, wallet_passes.barcode_sealed),
           updated_at = EXCLUDED.updated_at
       RETURNING content`,
      [serial, kind, flightNumber, JSON.stringify(content), barcodeSealed],
    );
    return rows[0] ? rows[0].content : content;
  }

  async function getPass(serial) {
    const { rows } = await pool.query(
      `SELECT serial_number, pass_kind, flight_number, content, barcode_sealed, ${UPDATED_MS_SQL} AS updated_ms
       FROM wallet_passes WHERE serial_number = $1`,
      [serial],
    );
    return rows[0] ? { ...rows[0], updated_ms: Number(rows[0].updated_ms) } : null;
  }

  /** true when this device registered the pass for the first time (201), false when it refreshed its push token. */
  async function register({ deviceId, serial, pushToken, flightNumber }) {
    const { rows } = await pool.query(
      `INSERT INTO wallet_registrations (flight_number, serial_number, push_token, device_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id, serial_number) DO UPDATE SET push_token = EXCLUDED.push_token
       RETURNING (xmax = 0) AS created`,
      [flightNumber, serial, pushToken, deviceId],
    );
    return !!(rows[0] && rows[0].created);
  }

  async function unregister(deviceId, serial) {
    await pool.query('DELETE FROM wallet_registrations WHERE device_id = $1 AND serial_number = $2', [deviceId, serial]);
  }

  /** Serials registered on the device, changed after `sinceMs` (all when null), with their update time in ms. */
  async function updatedSerials(deviceId, sinceMs) {
    const { rows } = await pool.query(
      `SELECT p.serial_number, p.updated_ms FROM wallet_registrations r
       JOIN (SELECT serial_number, ${UPDATED_MS_SQL} AS updated_ms FROM wallet_passes) p ON p.serial_number = r.serial_number
       WHERE r.device_id = $1 AND ($2::bigint IS NULL OR p.updated_ms > $2::bigint)
       ORDER BY p.serial_number`,
      [deviceId, sinceMs],
    );
    return rows.map(r => ({ serial_number: r.serial_number, updated_ms: Number(r.updated_ms) }));
  }

  /** Passes on at least one device. */
  async function registeredPasses() {
    const { rows } = await pool.query(
      `SELECT p.serial_number, p.pass_kind, p.flight_number, p.content FROM wallet_passes p
       WHERE EXISTS (SELECT 1 FROM wallet_registrations r WHERE r.serial_number = p.serial_number)
       ORDER BY p.serial_number`,
    );
    return rows;
  }

  async function updateContent(serial, content) {
    await pool.query(
      "UPDATE wallet_passes SET content = $2::jsonb, updated_at = date_trunc('milliseconds', NOW()) WHERE serial_number = $1",
      [serial, JSON.stringify(content)],
    );
  }

  async function pushTokens(flightNumber) {
    const { rows } = await pool.query(
      'SELECT DISTINCT push_token FROM wallet_registrations WHERE flight_number = $1 ORDER BY push_token',
      [flightNumber],
    );
    return rows.map(r => r.push_token);
  }

  async function markPushed(flightNumber, tokens) {
    await pool.query(
      'UPDATE wallet_registrations SET last_pushed_at = NOW() WHERE flight_number = $1 AND push_token = ANY($2::text[])',
      [flightNumber, tokens],
    );
  }

  /** APNs said the token is gone (pass deleted / device reset). */
  async function removePushToken(pushToken) {
    await pool.query('DELETE FROM wallet_registrations WHERE push_token = $1', [pushToken]);
  }

  async function prune(days = PASS_RETENTION_DAYS) {
    await pool.query('DELETE FROM wallet_passes WHERE updated_at < NOW() - make_interval(days => $1)', [days]);
  }

  return {
    migrate,
    savePass,
    getPass,
    register,
    unregister,
    updatedSerials,
    registeredPasses,
    updateContent,
    pushTokens,
    markPushed,
    removePushToken,
    prune,
  };
}

/** Wallet authenticationToken for a serial: HMAC, so nothing has to be stored to check it. */
function authenticationToken(key, serial) {
  return crypto.createHmac('sha256', key).update(`auth:${serial}`).digest('base64url');
}

function sameToken(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Scanned boarding-pass barcode (name, booking reference) → AES-256-GCM "iv.tag.data" for wallet_passes. */
function sealBarcode(key, barcode) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(barcode), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}

/** '' when the value is missing, tampered with or sealed with another key. */
function openBarcode(key, sealed) {
  const parts = String(sealed || '').split('.');
  if (parts.length !== 3) return '';
  try {
    const [iv, tag, data] = parts.map(p => Buffer.from(p, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function toMs(value) {
  if (value == null || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** The leg a stored pass is for (same departure date and airport) from a /flight lookup; null when it is not in there. */
function legFromLookup(lookup, stored, number) {
  if (!lookup || !(lookup.status >= 200 && lookup.status < 300) || !lookup.text) return null;
  let body;
  try { body = JSON.parse(lookup.text); } catch { return null; }
  const items = Array.isArray(body) ? body : (body ? [body] : []);
  for (const item of items) {
    const content = flightPassContent(item, number);
    if (content && content.departureDate === stored.departureDate && content.from === stored.from) return content;
  }
  return null;
}

/** Update texts for the flight pass: gate, delay, boarding, arrival terminal, landing (with belt), belt after landing. */
function flightUpdateTexts(prev, next) {
  const texts = [];
  if (next.gate && next.gate !== prev.gate) texts.push(prev.gate ? `Gate changed to ${next.gate}` : `Gate ${next.gate} assigned`);
  if (next.departureClock && prev.departureClock && next.departureClock !== prev.departureClock
    && !['enRoute', ...FINAL_STATUSES].includes(next.status)) {
    texts.push(next.delayMin > 0 ? `Delayed — now departs ${next.departureClock}` : `Departure time changed to ${next.departureClock}`);
  }
  if (next.status === 'boarding' && prev.status !== 'boarding') texts.push('Boarding has started');
  if (next.arrivalTerminal && next.arrivalTerminal !== prev.arrivalTerminal) texts.push(`Arrival terminal: ${next.arrivalTerminal}`);
  if (next.status === 'landed' && prev.status !== 'landed') {
    texts.push(next.baggageBelt ? `Landed — baggage belt ${next.baggageBelt}` : 'Landed');
  } else if (next.status === 'landed' && next.baggageBelt && next.baggageBelt !== prev.baggageBelt) {
    texts.push(`Baggage belt: ${next.baggageBelt}`);
  }
  return texts;
}

/** Update texts for the pickup pass; marks next.sent.leave once "time to leave" went out. */
function pickupUpdateTexts(prev, next, now) {
  const texts = [];
  const arrivalMs = toMs(next.arrivalAt);
  if (!next.sent.leave && arrivalMs != null && !FINAL_STATUSES.includes(next.status)) {
    const min = Math.ceil((arrivalMs - now) / 60_000);
    if (min > 0 && min <= PICKUP_LEAVE_MIN) {
      texts.push(`Flight lands in ${min} min — time to leave`);
      next.sent.leave = true;
    }
  }
  const landedNow = next.status === 'landed' && prev.status !== 'landed';
  if (landedNow) texts.push('Flight landed — walk to arrivals hall');
  if (next.status === 'landed' && next.baggageBelt && (landedNow || next.baggageBelt !== prev.baggageBelt)) {
    texts.push(`Baggage belt: ${next.baggageBelt} — passenger collecting bags`);
  }
  return texts;
}

/** Fields each pass shows; a change is pushed too (Wallet refreshes silently when no update text changed). */
const VISIBLE_KEYS = {
  flight: ['departureClock', 'arrivalClock', 'duration', 'gate', 'terminal', 'aircraft', 'airline', 'arrivalTerminal', 'baggageBelt'],
  pickup: ['arrivalTime', 'arrivalDateLabel', 'arrivalTerminal', 'baggageBelt', 'status'],
};

/** Stored pass + fresh lookup content → { changed, content, texts }. */
function applyUpdate(row, fresh, now) {
  const prev = row.content || {};
  const next = { ...fresh, statusMessage: prev.statusMessage || '', sent: { ...(prev.sent || {}) } };
  const pickup = row.pass_kind === 'pickup';
  const texts = pickup ? pickupUpdateTexts(prev, next, now) : flightUpdateTexts(prev, next);
  if (texts.length) next.statusMessage = texts.join(' · ');
  const visibleChanged = VISIBLE_KEYS[pickup ? 'pickup' : 'flight'].some(k => String(prev[k] ?? '') !== String(next[k] ?? ''));
  return { changed: texts.length > 0 || visibleChanged, content: next, texts };
}

/** Nothing left to announce: cancelled/diverted, landed with a belt (or long enough ago), or long past departure. */
function isFinished(content, now) {
  const departure = toMs(content.departureAt);
  if (departure != null && now - departure > STALE_AFTER_DEPARTURE_MS) return true;
  if (content.status === 'cancelled' || content.status === 'diverted') return true;
  if (content.status !== 'landed') return false;
  const arrival = toMs(content.arrivalAt);
  return !!content.baggageBelt || arrival == null || now - arrival > BAGGAGE_WAIT_MS;
}

/** How often a pass needs a lookup: hourly while far off, every 15 min in the last hours or cruising, else every tick. */
function checkIntervalMs(content, kind, now) {
  const departure = toMs(content.departureAt);
  const arrival = toMs(content.arrivalAt);
  const reference = kind === 'pickup' ? (arrival ?? departure) : departure;
  if (reference == null) return 15 * 60 * 1000;
  const ahead = reference - now;
  if (ahead > 12 * 60 * 60 * 1000) return 60 * 60 * 1000;
  if (ahead > 3 * 60 * 60 * 1000) return 15 * 60 * 1000;
  if (kind === 'flight' && content.status === 'enRoute' && arrival != null && arrival - now > 60 * 60 * 1000) {
    return 15 * 60 * 1000;
  }
  return WALLET_TICK_MS;
}

/**
 * APNs sender for Wallet passes: HTTP/2 with the Pass Type ID certificate as TLS client certificate, topic = pass type
 * identifier, empty JSON body. One session is kept open and replaced when it closes.
 * @param {{ credentials: () => Promise<{ cert: string, key: string }>, topic: string, host?: string,
 *   connectOptions?: object, timeoutMs?: number }} opts
 */
function createApnsSender({ credentials, topic, host = APNS_HOST, connectOptions = {}, timeoutMs = 10_000 }) {
  let session = null;

  async function getSession() {
    if (session && !session.closed && !session.destroyed) return session;
    const { cert, key } = await credentials();
    const s = http2.connect(host, { ...connectOptions, cert, key });
    const drop = () => { if (session === s) session = null; };
    s.on('error', drop);
    s.on('close', drop);
    s.on('goaway', drop);
    s.setTimeout(60_000, () => s.close());
    s.unref();
    session = s;
    return s;
  }

  /** → { status, reason }: 200 delivered; 410 / 400 BadDeviceToken mean the token is gone. */
  async function send(pushToken) {
    const s = await getSession();
    return new Promise((resolve, reject) => {
      const req = s.request({
        ':method': 'POST',
        ':path': `/3/device/${encodeURIComponent(pushToken)}`,
        'apns-topic': topic,
        'content-type': 'application/json',
      });
      let status = 0;
      let body = '';
      const timer = setTimeout(() => {
        req.close(http2.constants.NGHTTP2_CANCEL);
        reject(new Error('apns_timeout'));
      }, timeoutMs);
      req.setEncoding('utf8');
      req.on('response', (headers) => { status = Number(headers[':status']); });
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        clearTimeout(timer);
        let reason = '';
        try { reason = body ? String(JSON.parse(body).reason || '') : ''; } catch { /* not JSON */ }
        resolve({ status, reason });
      });
      req.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      req.end('{}');
    });
  }

  function close() {
    if (session) session.close();
    session = null;
  }

  return { send, close };
}

/**
 * pushWalletUpdate(flightNumber, changes): APNs push to every device with a pass for this flight. Tokens APNs reports as
 * gone are removed; delivered ones get last_pushed_at.
 * @param {{ store: ReturnType<typeof createWalletStore>, sendPush: (token: string) => Promise<{ status: number, reason: string }> }} opts
 */
function createWalletPush({ store, sendPush, log = console }) {
  return async function pushWalletUpdate(flightNumber, changes = []) {
    const tokens = await store.pushTokens(flightNumber);
    const delivered = [];
    let failed = 0;
    for (const token of tokens) {
      try {
        const { status, reason } = await sendPush(token);
        if (status === 200) {
          delivered.push(token);
          continue;
        }
        failed += 1;
        if (status === 410 || (status === 400 && reason === 'BadDeviceToken')) await store.removePushToken(token);
        else log.error('[wallet] APNs refused:', flightNumber, status, reason);
      } catch (e) {
        failed += 1;
        log.error('[wallet] APNs push failed:', flightNumber, e && e.message);
      }
    }
    if (delivered.length) await store.markPushed(flightNumber, delivered);
    const summary = changes.map(c => (c.texts && c.texts.length ? c.texts.join(' · ') : 'fields')).join(' / ');
    log.log('[wallet] push', flightNumber, '| devices:', tokens.length, '| sent:', delivered.length, '| changes:', summary);
    return { devices: tokens.length, sent: delivered.length, failed };
  };
}

/**
 * @param {object} opts
 * @param {ReturnType<typeof createWalletStore>} opts.store
 * @param {(number: string) => Promise<{ status: number, text: string }>} opts.fetchFlightStatus
 * @param {(flightNumber: string, changes: object[]) => Promise<{ sent: number }>} opts.pushWalletUpdate
 * @param {() => boolean} [opts.canSpend] false when the AeroDataBox hour budget is nearly used up
 */
function createWalletUpdater({
  store,
  fetchFlightStatus,
  pushWalletUpdate,
  canSpend = () => true,
  now = () => Date.now(),
  log = console,
}) {
  /** flight number → last lookup (ms); in memory, so a restart just checks everything once. */
  const lastChecked = new Map();
  let running = false;

  async function checkFlight(number, rows, t) {
    let lookup;
    try {
      lookup = await fetchFlightStatus(number);
    } catch (e) {
      log.error('[wallet] lookup failed:', number, e && e.message);
      return 0;
    }
    const changes = [];
    for (const row of rows) {
      const fresh = legFromLookup(lookup, row.content || {}, number);
      if (!fresh) continue;
      const update = applyUpdate(row, fresh, t);
      if (!update.changed) continue;
      await store.updateContent(row.serial_number, update.content);
      changes.push({ serial: row.serial_number, kind: row.pass_kind, texts: update.texts });
    }
    if (!changes.length) return 0;
    const result = await pushWalletUpdate(number, changes);
    return result.sent;
  }

  async function tick() {
    if (running) return { skipped: 'running' };
    running = true;
    try {
      await store.prune(PASS_RETENTION_DAYS);
      const t = now();
      const byFlight = new Map();
      for (const row of await store.registeredPasses()) {
        if (isFinished(row.content || {}, t)) continue;
        if (!byFlight.has(row.flight_number)) byFlight.set(row.flight_number, []);
        byFlight.get(row.flight_number).push(row);
      }
      for (const number of lastChecked.keys()) if (!byFlight.has(number)) lastChecked.delete(number);

      let checked = 0;
      let pushed = 0;
      for (const [number, rows] of byFlight) {
        const interval = Math.min(...rows.map(r => checkIntervalMs(r.content || {}, r.pass_kind, t)));
        // 30 s slack: ticks and intervals are both 5 min, timers drift.
        if (lastChecked.has(number) && t - lastChecked.get(number) < interval - 30_000) continue;
        if (!canSpend()) {
          log.warn('[wallet] AeroDataBox budget low — remaining flights wait for the next round');
          break;
        }
        lastChecked.set(number, t);
        pushed += await checkFlight(number, rows, t);
        checked += 1;
      }
      if (checked) log.log('[wallet] round | flights:', byFlight.size, '| checked:', checked, '| devices pushed:', pushed);
      return { flights: byFlight.size, checked, pushed };
    } catch (e) {
      log.error('[wallet] round failed:', e && e.message);
      return { error: e };
    } finally {
      running = false;
    }
  }

  function start(intervalMs = WALLET_TICK_MS) {
    const timer = setInterval(() => { tick(); }, intervalMs);
    timer.unref();
    return timer;
  }

  return { tick, start };
}

module.exports = {
  WALLET_TICK_MS,
  PICKUP_LEAVE_MIN,
  BAGGAGE_WAIT_MS,
  PASS_RETENTION_DAYS,
  MIGRATION_SQL,
  UPDATED_MS_SQL,
  createWalletStore,
  authenticationToken,
  sameToken,
  sealBarcode,
  openBarcode,
  legFromLookup,
  flightUpdateTexts,
  pickupUpdateTexts,
  applyUpdate,
  isFinished,
  checkIntervalMs,
  createApnsSender,
  createWalletPush,
  createWalletUpdater,
};
