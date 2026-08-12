/**
 * Flight reliability stats — Railway PostgreSQL (DATABASE_URL).
 * Upserts one row per scheduled flight instance on each FIDS poll.
 */
const { Pool } = require('pg');

/** @type {import('pg').Pool | null} */
let pool = null;
let ready = false;

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

async function initDb() {
  if (!hasDatabase()) {
    console.warn('[reliability] DATABASE_URL not set — flight_stats disabled');
    return false;
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    max: 5,
  });
  pool.on('error', (err) => console.error('[reliability] Pool error:', err.message));

  // Auto-migration: create flight_stats if missing (Railway Postgres)
  console.log('[reliability] Running flight_stats auto-migration…');
  try {
    await Promise.race([
      pool.query(`
        CREATE TABLE IF NOT EXISTS flight_stats (
          id SERIAL PRIMARY KEY,
          flight_key TEXT NOT NULL,
          airline_iata TEXT NOT NULL,
          flight_number TEXT NOT NULL,
          departure_airport TEXT NOT NULL,
          arrival_airport TEXT NOT NULL,
          scheduled_departure_time TIMESTAMPTZ,
          status TEXT NOT NULL,
          delay_minutes INTEGER NOT NULL DEFAULT 0,
          baggage_belt TEXT,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Migration timeout after 10000ms')), 10000),
      ),
    ]);
  } catch (err) {
    console.error('[reliability] Migration CREATE TABLE failed:', err.message);
    throw err;
  }

  try {
    // Upserts need a unique key; safe on existing tables
    await Promise.race([
      (async () => {
        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS flight_stats_flight_key_uidx
          ON flight_stats (flight_key);
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS flight_stats_airline_idx
          ON flight_stats (airline_iata);
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS flight_stats_number_idx
          ON flight_stats (flight_number);
        `);
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Index migration timeout after 10000ms')), 10000),
      ),
    ]);
  } catch (err) {
    console.error('[reliability] Migration indexes failed:', err.message);
    throw err;
  }

  ready = true;
  console.log('[reliability] flight_stats table ready');
  return true;
}

function pickIso(t) {
  if (!t) return null;
  if (typeof t === 'string') return t;
  return t.utc || t.local || null;
}

function pickAirportCode(ap) {
  if (!ap) return '';
  return String(ap.iata || ap.icao || '').trim().toUpperCase();
}

/** On Time = delay < 15 min and not cancelled */
function reliabilityStatus(rawStatus, delayMin) {
  const st = String(rawStatus || '').toLowerCase();
  if (st === 'canceled' || st === 'cancelled') return 'Cancelled';
  if (delayMin >= 15) return 'Delayed';
  return 'On Time';
}

function makeFlightKey(r) {
  const sched = r.scheduled_departure_time || 'none';
  return [
    r.airline_iata,
    r.flight_number,
    r.departure_airport,
    r.arrival_airport,
    sched,
  ].join('|');
}

/**
 * @param {any} json
 * @param {string} localIata
 * @param {string} type
 */
function extractStatsFromFids(json, localIata, type) {
  const local = String(localIata || '').toUpperCase();
  const isArrival = String(type || '').toLowerCase().startsWith('arr');
  const items = isArrival
    ? (json && json.arrivals) || []
    : (json && (json.departures || json.arrivals)) || [];
  if (!Array.isArray(items)) return [];

  const rows = [];
  for (const raw of items) {
    try {
      const airline = String(raw?.airline?.iata || '').trim().toUpperCase();
      const flightNumber = String(raw?.number || '').replace(/\s+/g, '').toUpperCase();
      if (!airline || !flightNumber) continue;

      const mov = raw.movement || {};
      const remote = pickAirportCode(mov.airport);
      const departureAirport = isArrival ? (remote || 'UNK') : local;
      const arrivalAirport = isArrival ? local : (remote || 'UNK');

      const schedIso = pickIso(mov.scheduledTime);
      const revisedIso = pickIso(mov.revisedTime) || schedIso;
      const schedMs = schedIso ? Date.parse(schedIso) : NaN;
      const revisedMs = revisedIso ? Date.parse(revisedIso) : NaN;
      let delayMin = 0;
      if (Number.isFinite(schedMs) && Number.isFinite(revisedMs)) {
        delayMin = Math.max(0, Math.round((revisedMs - schedMs) / 60000));
      }

      // True departure schedule when present; else departure-FIDS movement time
      const depSched =
        pickIso(raw?.departure?.scheduledTime) ||
        (!isArrival ? schedIso : null);

      const status = reliabilityStatus(raw.status, delayMin);
      const belt = String(mov.baggageBelt || mov.baggage || raw.baggageBelt || raw.baggage || '')
        .trim() || null;

      const row = {
        airline_iata: airline,
        flight_number: flightNumber,
        departure_airport: departureAirport,
        arrival_airport: arrivalAirport,
        scheduled_departure_time: depSched && Number.isFinite(Date.parse(depSched))
          ? new Date(depSched).toISOString()
          : null,
        status,
        delay_minutes: delayMin,
        baggage_belt: belt,
      };
      row.flight_key = makeFlightKey(row);
      rows.push(row);
    } catch {
      /* skip */
    }
  }
  return rows;
}

async function upsertFlightStats(rows) {
  if (!ready || !pool || !rows.length) return { inserted: 0 };
  const client = await pool.connect();
  let n = 0;
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        `INSERT INTO flight_stats (
           flight_key, airline_iata, flight_number, departure_airport, arrival_airport,
           scheduled_departure_time, status, delay_minutes, baggage_belt, recorded_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
         ON CONFLICT (flight_key) DO UPDATE SET
           status = EXCLUDED.status,
           delay_minutes = EXCLUDED.delay_minutes,
           baggage_belt = COALESCE(NULLIF(EXCLUDED.baggage_belt, ''), flight_stats.baggage_belt),
           recorded_at = NOW()`,
        [
          r.flight_key,
          r.airline_iata,
          r.flight_number,
          r.departure_airport,
          r.arrival_airport,
          r.scheduled_departure_time,
          r.status,
          r.delay_minutes,
          r.baggage_belt,
        ],
      );
      n++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { inserted: n };
}

function recordFidsStatsAsync(text, localIata, type) {
  if (!ready || !pool) return;
  setImmediate(async () => {
    try {
      const json = JSON.parse(text);
      const rows = extractStatsFromFids(json, localIata, type);
      if (!rows.length) return;
      const { inserted } = await upsertFlightStats(rows);
      console.log(`[reliability] upserted ${inserted} flights for ${localIata}/${type}`);
    } catch (e) {
      console.warn('[reliability] record failed:', e.message);
    }
  });
}

async function getAirlineReliability(airlineCode) {
  if (!ready || !pool) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const code = String(airlineCode || '').trim().toUpperCase();
  if (!code) {
    const err = new Error('airlineCode required');
    err.status = 400;
    throw err;
  }

  const summary = await pool.query(
    `SELECT
       COUNT(*)::int AS total_flights,
       COUNT(*) FILTER (
         WHERE status <> 'Cancelled' AND delay_minutes < 15
       )::int AS on_time_count,
       ROUND(AVG(delay_minutes)::numeric, 1) AS avg_delay_minutes
     FROM flight_stats
     WHERE airline_iata = $1`,
    [code],
  );
  const s = summary.rows[0] || {};
  const total = s.total_flights || 0;
  const onTime = s.on_time_count || 0;
  const pct = total > 0 ? Math.round((onTime / total) * 1000) / 10 : 0;

  const routes = await pool.query(
    `SELECT
       departure_airport,
       arrival_airport,
       COUNT(*)::int AS flights,
       ROUND(AVG(delay_minutes)::numeric, 1) AS avg_delay_minutes,
       COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled
     FROM flight_stats
     WHERE airline_iata = $1
     GROUP BY departure_airport, arrival_airport
     ORDER BY AVG(delay_minutes) DESC, COUNT(*) DESC
     LIMIT 10`,
    [code],
  );

  const flights = await pool.query(
    `SELECT
       airline_iata,
       flight_number,
       departure_airport,
       arrival_airport,
       scheduled_departure_time,
       status,
       delay_minutes,
       baggage_belt,
       recorded_at
     FROM flight_stats
     WHERE airline_iata = $1
     ORDER BY recorded_at DESC
     LIMIT 50`,
    [code],
  );

  return {
    airline: code,
    totalFlights: total,
    onTimePercent: pct,
    averageDelayMinutes: s.avg_delay_minutes != null ? Number(s.avg_delay_minutes) : 0,
    worstRoutes: routes.rows.map(r => ({
      from: r.departure_airport,
      to: r.arrival_airport,
      flights: r.flights,
      averageDelayMinutes: Number(r.avg_delay_minutes) || 0,
      cancelled: r.cancelled,
    })),
    flights: flights.rows.map(mapFlightDetail),
  };
}

function mapFlightDetail(r) {
  return {
    flightNumber: r.flight_number,
    airline: r.airline_iata,
    from: r.departure_airport,
    to: r.arrival_airport,
    scheduledDeparture: r.scheduled_departure_time,
    status: r.status,
    delayMinutes: r.delay_minutes,
    baggageBelt: r.baggage_belt || null,
    recordedAt: r.recorded_at,
  };
}

/** Latest stored stats for a flight number (detail view). */
async function getFlightDetail(flightNumber) {
  if (!ready || !pool) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const number = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  if (!number) {
    const err = new Error('flight number required');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT
       airline_iata,
       flight_number,
       departure_airport,
       arrival_airport,
       scheduled_departure_time,
       status,
       delay_minutes,
       baggage_belt,
       recorded_at
     FROM flight_stats
     WHERE flight_number = $1
        OR flight_number = $2
     ORDER BY recorded_at DESC
     LIMIT 10`,
    [number, number.replace(/[^A-Z0-9]/g, '')],
  );

  if (!rows.length) {
    const err = new Error('Flight not found in stats');
    err.status = 404;
    throw err;
  }

  const latest = mapFlightDetail(rows[0]);
  return {
    ...latest,
    history: rows.map(mapFlightDetail),
  };
}

/** Autocomplete flight numbers from stored FIDS history. */
async function searchFlightAutocomplete(term, limit = 5) {
  if (!ready || !pool) return [];
  const q = String(term || '').replace(/\s+/g, '').toUpperCase();
  if (q.length < 2) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (flight_number)
       flight_number,
       airline_iata,
       departure_airport,
       arrival_airport
     FROM flight_stats
     WHERE REPLACE(flight_number, ' ', '') LIKE $1
     ORDER BY flight_number, recorded_at DESC
     LIMIT $2`,
    [`${q}%`, Math.min(Math.max(limit, 1), 10)],
  );
  return rows.map(r => ({
    flightNumber: r.flight_number,
    airline: r.airline_iata,
    from: r.departure_airport,
    to: r.arrival_airport,
  }));
}

/** On-time % + avg delay for a flight over the last 30 days. */
async function getFlightDelayStats(flightNumber) {
  if (!ready || !pool) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const number = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  if (!number) {
    const err = new Error('flight number required');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'On Time')::int AS on_time,
       COUNT(*) FILTER (WHERE status = 'Delayed')::int AS delayed,
       COALESCE(AVG(delay_minutes), 0)::float AS avg_delay
     FROM flight_stats
     WHERE (flight_number = $1 OR REPLACE(flight_number, ' ', '') = $1)
       AND recorded_at >= NOW() - INTERVAL '30 days'`,
    [number],
  );
  const s = rows[0] || {};
  const total = s.total || 0;
  if (!total) {
    const err = new Error('No stats');
    err.status = 404;
    throw err;
  }
  const onTimePercent = Math.round(((s.on_time || 0) / total) * 1000) / 10;
  return {
    flightNumber: number,
    totalFlights: total,
    delayedFlights: s.delayed || 0,
    onTimePercent,
    averageDelayMinutes: Math.round(Number(s.avg_delay) || 0),
    windowDays: 30,
  };
}

/** Airport delay snapshot (last 24h) for departures or arrivals at IATA/ICAO. */
async function getAirportDelayStats(airportCode) {
  if (!ready || !pool) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const code = String(airportCode || '').trim().toUpperCase();
  if (!code) {
    const err = new Error('airport code required');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COALESCE(AVG(delay_minutes), 0)::float AS avg_delay,
       COUNT(*) FILTER (WHERE delay_minutes >= 30)::int AS major,
       COUNT(*) FILTER (WHERE delay_minutes >= 15)::int AS delayed
     FROM flight_stats
     WHERE (departure_airport = $1 OR arrival_airport = $1)
       AND recorded_at >= NOW() - INTERVAL '24 hours'`,
    [code],
  );
  const s = rows[0] || {};
  const total = s.total || 0;
  if (!total) {
    const err = new Error('No delay data');
    err.status = 404;
    throw err;
  }
  const avg = Math.round(Number(s.avg_delay) || 0);
  let level = 'smooth';
  if (avg >= 30 || (s.major || 0) / total >= 0.25) level = 'major';
  else if (avg >= 12 || (s.delayed || 0) / total >= 0.35) level = 'moderate';
  return {
    airport: code,
    sampleSize: total,
    averageDelayMinutes: avg,
    level,
    message:
      level === 'smooth'
        ? 'Running smoothly'
        : level === 'moderate'
          ? `Avg ${avg}m delay today`
          : `Major delays · Avg ${avg}m`,
  };
}

async function getAllAirlinesReliability() {
  if (!ready || !pool) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT
       airline_iata AS airline,
       COUNT(*)::int AS total_flights,
       COUNT(*) FILTER (
         WHERE status <> 'Cancelled' AND delay_minutes < 15
       )::int AS on_time_count,
       ROUND(AVG(delay_minutes)::numeric, 1) AS avg_delay_minutes
     FROM flight_stats
     GROUP BY airline_iata
     ORDER BY
       (COUNT(*) FILTER (WHERE status <> 'Cancelled' AND delay_minutes < 15)::float
         / NULLIF(COUNT(*), 0)) DESC NULLS LAST,
       COUNT(*) DESC`,
  );

  return {
    airlines: rows.map(r => {
      const total = r.total_flights || 0;
      const onTime = r.on_time_count || 0;
      return {
        airline: r.airline,
        totalFlights: total,
        onTimePercent: total > 0 ? Math.round((onTime / total) * 1000) / 10 : 0,
        averageDelayMinutes: r.avg_delay_minutes != null ? Number(r.avg_delay_minutes) : 0,
      };
    }),
  };
}

async function getReliabilityHealth() {
  const endpoints = {
    reliability_all: '/reliability/all',
    reliability_airline: '/reliability/:airline',
    reliability_flight: '/reliability/flight/:number',
  };

  if (!hasDatabase() || !pool) {
    return {
      table_exists: false,
      total_records: 0,
      last_record: null,
      endpoints,
    };
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total_records,
         MAX(recorded_at) AS last_record
       FROM flight_stats`,
    );
    const row = rows[0] || {};
    return {
      table_exists: true,
      total_records: row.total_records || 0,
      last_record: row.last_record || null,
      endpoints,
    };
  } catch {
    return {
      table_exists: false,
      total_records: 0,
      last_record: null,
      endpoints,
    };
  }
}

module.exports = {
  initDb,
  hasDatabase,
  recordFidsStatsAsync,
  getAirlineReliability,
  getAllAirlinesReliability,
  getFlightDetail,
  getFlightDelayStats,
  getAirportDelayStats,
  searchFlightAutocomplete,
  getReliabilityHealth,
  extractStatsFromFids,
  upsertFlightStats,
};
