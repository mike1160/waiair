/**
 * Remote Expo push for tracked flights. Tokens live in Postgres (push_tokens) so they survive
 * Railway restarts. The poller re-checks those flights and POSTs to the Expo Push API when
 * gate, delay (>10 min), boarding, or landing change. DeviceNotRegistered receipts drop the token.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const TICK_MS = 5 * 60 * 1000;
const DELAY_PUSH_MIN = 10;
const TOKEN_RETENTION_DAYS = 7;
const FINAL_STATUSES = ['landed', 'cancelled', 'diverted'];

const MIGRATION_SQL = [
  `CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    expo_token TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    platform TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (expo_token, flight_number)
  )`,
  'CREATE INDEX IF NOT EXISTS push_tokens_flight_idx ON push_tokens (flight_number)',
  `CREATE TABLE IF NOT EXISTS push_flight_state (
    flight_number TEXT PRIMARY KEY,
    last_gate TEXT,
    last_delay_min INTEGER NOT NULL DEFAULT 0,
    last_status TEXT,
    last_dest TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS push_tickets (
    ticket_id TEXT PRIMARY KEY,
    expo_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
];

function slugFlight(number) {
  return String(number || '').replace(/[\s/-]+/g, '').toUpperCase();
}

function isExpoToken(token) {
  return /^ExponentPushToken\[.+\]$/.test(String(token || '').trim());
}

function mapStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('land') || s === 'arrived') return 'landed';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('divert')) return 'diverted';
  if (s.includes('board') || s.includes('gate closed') || s.includes('final call') || s.includes('last call')) {
    return 'boarding';
  }
  if (s.includes('air') || s.includes('route') || s.includes('enroute') || s.includes('departed') || s.includes('airborne')) {
    return 'en-route';
  }
  if (s.includes('delay')) return 'delayed';
  return 'scheduled';
}

function delayMinutes(side) {
  if (!side) return 0;
  const sched = side.scheduledTime && (side.scheduledTime.utc || side.scheduledTime.local);
  const later = side.revisedTime || side.predictedTime;
  const rev = later && (later.utc || later.local);
  const a = Date.parse(String(sched || '').replace(' ', 'T'));
  const b = Date.parse(String(rev || '').replace(' ', 'T'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}

function pickAdbTime(side) {
  if (!side) return '';
  for (const k of ['runwayTime', 'actualTime', 'revisedTime', 'predictedTime', 'scheduledTime']) {
    const t = side[k];
    if (t && (t.utc || t.local)) return t.utc || t.local;
  }
  return '';
}

/** Closest-to-now leg from a /flights/number lookup. */
function pickLeg(lookup, now = Date.now()) {
  if (!lookup || !(lookup.status >= 200 && lookup.status < 300) || !lookup.text) return null;
  let body;
  try { body = JSON.parse(lookup.text); } catch { return null; }
  const items = Array.isArray(body) ? body : (body ? [body] : []);
  if (!items.length) return null;
  const ranked = items.slice().sort((a, b) => {
    const ta = Date.parse(String(pickAdbTime(a && a.departure) || '').replace(' ', 'T')) || 0;
    const tb = Date.parse(String(pickAdbTime(b && b.departure) || '').replace(' ', 'T')) || 0;
    return Math.abs(ta - now) - Math.abs(tb - now);
  });
  return ranked[0] || null;
}

function snapshotFromLeg(raw, number) {
  const dep = (raw && raw.departure) || {};
  const arr = (raw && raw.arrival) || {};
  const dest = String((arr.airport && (arr.airport.iata || arr.airport.municipalityName)) || '');
  return {
    flightNumber: slugFlight(number || (raw && raw.number)),
    gate: String(dep.gate || '').trim(),
    delayMin: delayMinutes(dep),
    status: mapStatus(raw && raw.status),
    dest: dest.trim(),
  };
}

function snapshotFromLookup(lookup, number, now) {
  const leg = pickLeg(lookup, now);
  return leg ? snapshotFromLeg(leg, number) : null;
}

/**
 * Events to push when live state differs from the last stored snapshot.
 * First snapshot (prev = null) is stored silently — no spam on register.
 */
function detectPushEvents(prev, next) {
  if (!next || !next.flightNumber) return [];
  if (!prev) return [];
  const nr = next.flightNumber;
  const events = [];
  const prevGate = String(prev.last_gate || prev.gate || '');
  const prevDelay = Number(prev.last_delay_min ?? prev.delayMin ?? 0) || 0;
  const prevStatus = String(prev.last_status || prev.status || '');
  if (next.gate && next.gate !== prevGate) {
    events.push({
      kind: 'gate',
      title: 'Gate changed',
      body: `Flight ${nr}: gate changed to ${next.gate}`,
      detail: next.gate,
    });
  }
  if (next.delayMin > DELAY_PUSH_MIN && (prevDelay <= DELAY_PUSH_MIN || next.delayMin >= prevDelay + DELAY_PUSH_MIN)) {
    events.push({
      kind: 'delay',
      title: 'Flight delayed',
      body: `Flight ${nr} delayed by ${next.delayMin} minutes`,
      detail: String(next.delayMin),
    });
  }
  if (next.status === 'boarding' && prevStatus !== 'boarding') {
    events.push({
      kind: 'boarding',
      title: 'Now boarding',
      body: `Flight ${nr} is now boarding at gate ${next.gate || '—'}`,
    });
  }
  if (next.status === 'landed' && prevStatus !== 'landed') {
    events.push({
      kind: 'landed',
      title: 'Landed!',
      body: `Flight ${nr} has landed at ${next.dest || 'its destination'}`,
    });
  }
  return events;
}

function expoMessage(token, event, flightNumber) {
  return {
    to: token,
    title: event.title,
    body: event.body,
    sound: 'default',
    priority: 'high',
    data: {
      flightNumber,
      kind: event.kind,
      source: 'remote',
      dedupeDetail: event.detail || '',
    },
  };
}

/** @param {{ query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }} pool */
function createExpoPushStore(pool) {
  async function migrate() {
    for (const sql of MIGRATION_SQL) await pool.query(sql);
  }

  async function register({ token, flightNumber, platform = null }) {
    const expoToken = String(token || '').trim();
    const flight = slugFlight(flightNumber);
    if (!isExpoToken(expoToken)) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });
    if (!flight) throw Object.assign(new Error('missing_flight'), { code: 'missing_flight' });
    await pool.query(
      `INSERT INTO push_tokens (expo_token, flight_number, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (expo_token, flight_number)
       DO UPDATE SET platform = COALESCE(EXCLUDED.platform, push_tokens.platform), updated_at = NOW()`,
      [expoToken, flight, platform ? String(platform) : null],
    );
    return { token: expoToken, flightNumber: flight };
  }

  async function unregister({ token, flightNumber }) {
    const expoToken = String(token || '').trim();
    const flight = slugFlight(flightNumber);
    if (!isExpoToken(expoToken)) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });
    if (flight) {
      await pool.query('DELETE FROM push_tokens WHERE expo_token = $1 AND flight_number = $2', [expoToken, flight]);
    } else {
      await pool.query('DELETE FROM push_tokens WHERE expo_token = $1', [expoToken]);
    }
  }

  async function tokensForFlight(flightNumber) {
    const { rows } = await pool.query(
      'SELECT DISTINCT expo_token FROM push_tokens WHERE flight_number = $1 ORDER BY expo_token',
      [slugFlight(flightNumber)],
    );
    return rows.map(r => r.expo_token);
  }

  async function listFlights() {
    const { rows } = await pool.query(
      'SELECT DISTINCT flight_number FROM push_tokens ORDER BY flight_number',
    );
    return rows.map(r => r.flight_number);
  }

  async function getState(flightNumber) {
    const { rows } = await pool.query(
      'SELECT flight_number, last_gate, last_delay_min, last_status, last_dest FROM push_flight_state WHERE flight_number = $1',
      [slugFlight(flightNumber)],
    );
    return rows[0] || null;
  }

  async function saveState(snap) {
    const flight = slugFlight(snap.flightNumber);
    await pool.query(
      `INSERT INTO push_flight_state (flight_number, last_gate, last_delay_min, last_status, last_dest, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (flight_number)
       DO UPDATE SET last_gate = EXCLUDED.last_gate, last_delay_min = EXCLUDED.last_delay_min,
         last_status = EXCLUDED.last_status, last_dest = EXCLUDED.last_dest, updated_at = NOW()`,
      [flight, snap.gate || '', snap.delayMin || 0, snap.status || '', snap.dest || ''],
    );
  }

  async function removeToken(expoToken) {
    await pool.query('DELETE FROM push_tokens WHERE expo_token = $1', [String(expoToken || '').trim()]);
  }

  async function saveTickets(pairs) {
    for (const { ticketId, token } of pairs) {
      if (!ticketId || !token) continue;
      await pool.query(
        `INSERT INTO push_tickets (ticket_id, expo_token) VALUES ($1, $2)
         ON CONFLICT (ticket_id) DO NOTHING`,
        [ticketId, token],
      );
    }
  }

  async function listTickets() {
    const { rows } = await pool.query('SELECT ticket_id, expo_token FROM push_tickets ORDER BY created_at');
    return rows.map(r => ({ ticketId: r.ticket_id, token: r.expo_token }));
  }

  async function dropTickets(ids) {
    if (!ids.length) return;
    await pool.query('DELETE FROM push_tickets WHERE ticket_id = ANY($1::text[])', [ids]);
  }

  async function prune(days = TOKEN_RETENTION_DAYS) {
    await pool.query('DELETE FROM push_tokens WHERE updated_at < NOW() - make_interval(days => $1)', [days]);
    await pool.query('DELETE FROM push_tickets WHERE created_at < NOW() - make_interval(days => $1)', [days]);
  }

  return {
    migrate,
    register,
    unregister,
    tokensForFlight,
    listFlights,
    getState,
    saveState,
    removeToken,
    saveTickets,
    listTickets,
    dropTickets,
    prune,
  };
}

async function readJson(fetchImpl, url, body) {
  const r = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const status = r.status;
  const text = typeof r.text === 'function' ? await r.text() : String(r.text || '');
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status, json, text };
}

/**
 * Send Expo messages, then check receipts. DeviceNotRegistered → store.removeToken.
 * @param {{ store: ReturnType<typeof createExpoPushStore>, fetchImpl?: Function, log?: Console }} opts
 */
function createExpoPushSender({ store, fetchImpl = fetch, log = console }) {
  async function applyTicketErrors(tickets, tokens) {
    const receiptIds = [];
    const pairs = [];
    const list = Array.isArray(tickets) ? tickets : tickets ? [tickets] : [];
    for (let i = 0; i < list.length; i += 1) {
      const ticket = list[i] || {};
      const token = tokens[i];
      const err = ticket.details && ticket.details.error;
      if (ticket.status === 'error') {
        log.error('[push] Expo ticket error', err || ticket.message, token);
        if (err === 'DeviceNotRegistered' && token) await store.removeToken(token);
        continue;
      }
      if (ticket.status === 'ok' && ticket.id) {
        receiptIds.push(ticket.id);
        if (token) pairs.push({ ticketId: ticket.id, token });
      }
    }
    if (pairs.length) await store.saveTickets(pairs);
    return receiptIds;
  }

  async function checkReceipts(pending) {
    if (!pending.length) return { checked: 0, dropped: 0 };
    const { status, json } = await readJson(fetchImpl, EXPO_RECEIPTS_URL, {
      ids: pending.map(p => p.ticketId),
    });
    if (status < 200 || status >= 300) {
      log.error('[push] Expo receipts failed', status);
      return { checked: 0, dropped: 0 };
    }
    const receipts = (json && json.data) || {};
    let dropped = 0;
    const done = [];
    for (const row of pending) {
      const receipt = receipts[row.ticketId];
      if (!receipt) continue;
      done.push(row.ticketId);
      if (receipt.status === 'error') {
        const err = receipt.details && receipt.details.error;
        log.error('[push] Expo receipt error', err || receipt.message, row.token);
        if (err === 'DeviceNotRegistered') {
          await store.removeToken(row.token);
          dropped += 1;
        }
      }
    }
    if (done.length) await store.dropTickets(done);
    return { checked: done.length, dropped };
  }

  async function send(flightNumber, events) {
    const tokens = await store.tokensForFlight(flightNumber);
    if (!tokens.length || !events.length) return { devices: tokens.length, sent: 0, failed: 0 };
    const messages = [];
    const messageTokens = [];
    for (const token of tokens) {
      for (const event of events) {
        messages.push(expoMessage(token, event, flightNumber));
        messageTokens.push(token);
      }
    }
    log.log('[push] send', flightNumber, '| devices:', tokens.length, '| events:', events.map(e => e.kind).join(','));
    const { status, json, text } = await readJson(fetchImpl, EXPO_PUSH_URL, messages);
    if (status < 200 || status >= 300) {
      log.error('[push] Expo send failed', flightNumber, status, text);
      return { devices: tokens.length, sent: 0, failed: tokens.length };
    }
    const tickets = json && json.data;
    await applyTicketErrors(tickets, messageTokens);
    const sent = Array.isArray(tickets)
      ? tickets.filter(t => t && t.status === 'ok').length
      : (tickets && tickets.status === 'ok' ? 1 : 0);
    log.log('[push] sent', flightNumber, '| tickets:', sent, '| status:', status);
    return { devices: tokens.length, sent, failed: Math.max(0, messages.length - sent) };
  }

  async function processReceipts() {
    const pending = await store.listTickets();
    if (!pending.length) return { checked: 0, dropped: 0 };
    try {
      return await checkReceipts(pending);
    } catch (e) {
      log.error('[push] receipts failed:', e && e.message);
      return { checked: 0, dropped: 0 };
    }
  }

  return { send, processReceipts };
}

/**
 * @param {object} opts
 * @param {ReturnType<typeof createExpoPushStore>} opts.store
 * @param {(number: string) => Promise<{ status:number, text:string }>} opts.fetchFlightStatus
 * @param {ReturnType<typeof createExpoPushSender>} opts.sender
 */
function createExpoPushPoller({
  store,
  fetchFlightStatus,
  sender,
  canSpend = () => true,
  now = () => Date.now(),
  log = console,
}) {
  let running = false;

  async function checkFlight(number) {
    const prev = await store.getState(number);
    if (prev && FINAL_STATUSES.includes(prev.last_status)) return 0;
    let lookup;
    try {
      lookup = await fetchFlightStatus(number);
    } catch (e) {
      log.error('[push] lookup failed:', number, e && e.message);
      return 0;
    }
    const next = snapshotFromLookup(lookup, number, now());
    if (!next) return 0;
    const events = detectPushEvents(prev, next);
    await store.saveState(next);
    if (!events.length) return 0;
    const result = await sender.send(number, events);
    return result.sent;
  }

  async function tick() {
    if (running) return { skipped: 'running' };
    running = true;
    try {
      await store.prune(TOKEN_RETENTION_DAYS);
      await sender.processReceipts();
      const flights = await store.listFlights();
      let checked = 0;
      let pushed = 0;
      for (const number of flights) {
        if (!canSpend()) {
          log.warn('[push] AeroDataBox budget low — remaining flights wait for the next round');
          break;
        }
        pushed += await checkFlight(number);
        checked += 1;
      }
      if (checked) log.log('[push] round | flights:', flights.length, '| checked:', checked, '| sent:', pushed);
      return { flights: flights.length, checked, pushed };
    } catch (e) {
      log.error('[push] round failed:', e && e.message);
      return { error: e };
    } finally {
      running = false;
    }
  }

  function start(intervalMs = TICK_MS) {
    const timer = setInterval(() => { tick(); }, intervalMs);
    timer.unref();
    tick();
    return timer;
  }

  return { tick, start, checkFlight };
}

module.exports = {
  EXPO_PUSH_URL,
  EXPO_RECEIPTS_URL,
  TICK_MS,
  DELAY_PUSH_MIN,
  MIGRATION_SQL,
  slugFlight,
  isExpoToken,
  mapStatus,
  snapshotFromLookup,
  snapshotFromLeg,
  detectPushEvents,
  expoMessage,
  createExpoPushStore,
  createExpoPushSender,
  createExpoPushPoller,
};
