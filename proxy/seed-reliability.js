#!/usr/bin/env node
/**
 * One-time seed: fetch FIDS for major SEA airports → flight_stats.
 *
 * Uses its own pg Pool (same config as test-db.js) — does NOT call reliability.initDb().
 *
 *   DATABASE_URL=... RAPIDAPI_KEY=... node seed-reliability.js
 */
const { Pool } = require('pg');
const fetch = require('node-fetch');
// Pure parsing only — no DB init on this path
const { extractStatsFromFids } = require('./reliability');

const AIRPORTS = ['BKK', 'HKT', 'SIN', 'KUL', 'CGK', 'MNL', 'SGN', 'HAN', 'DPS', 'DMK'];

const IATA_TO_ICAO = {
  BKK: 'VTBS',
  HKT: 'VTSP',
  SIN: 'WSSS',
  KUL: 'WMKK',
  CGK: 'WIII',
  MNL: 'RPLL',
  SGN: 'VVTS',
  HAN: 'VVNB',
  DPS: 'WADD',
  DMK: 'VTBD',
};

const RATE_GAP_MS = Number(process.env.RATE_GAP_MS) || 1500;
const FETCH_TIMEOUT_MS = 8000;
const INSERT_TIMEOUT_MS = 5000;
const PROXY_URL = (process.env.PROXY_URL || '').replace(/\/$/, '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
pool.on('error', (err) => console.error('[seed] Pool error:', err.message));

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fidsWindow() {
  const thaiOffset = 7 * 3600000;
  const localNow = Date.now() + thaiOffset;
  const from = new Date(localNow - 1 * 3600000).toISOString().slice(0, 16).replace('T', '%20');
  const to = new Date(localNow + 11 * 3600000).toISOString().slice(0, 16).replace('T', '%20');
  return { from, to };
}

async function fetchWithTimeout(url, options = {}, label = '') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const tag = label || url;
  console.log(`[fetch:start] ${tag}`);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal, timeout: FETCH_TIMEOUT_MS });
    const text = await r.text();
    console.log(`[fetch:done]  ${tag} → HTTP ${r.status} (${text.length} bytes)`);
    return { ok: r.ok, status: r.status, text };
  } catch (e) {
    const msg = e.name === 'AbortError' ? `timeout after ${FETCH_TIMEOUT_MS}ms` : e.message;
    console.log(`[fetch:fail]  ${tag} → ${msg}`);
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFidsDirect(iata, type) {
  const key = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY;
  if (!key) throw new Error('RAPIDAPI_KEY env var is required (or set PROXY_URL)');

  const icao = IATA_TO_ICAO[iata] || iata;
  const dir = type === 'arrival' ? 'Arrival' : 'Departure';
  const { from, to } = fidsWindow();
  const url =
    `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${icao}/${from}/${to}` +
    `?direction=${dir}&withCodeshared=true&withCargo=false&withPrivate=false&withLocation=false`;

  const { ok, status, text } = await fetchWithTimeout(
    url,
    {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
      },
    },
    `AeroDataBox ${iata}/${type} (${icao})`,
  );
  if (!ok) throw new Error(`AeroDataBox ${status}: ${text.slice(0, 200)}`);
  return text;
}

async function fetchFidsViaProxy(iata, type) {
  const url = `${PROXY_URL}/fids/${iata}/${type}`;
  const { ok, status, text } = await fetchWithTimeout(url, {}, `Proxy FIDS ${iata}/${type}`);
  if (!ok) throw new Error(`Proxy FIDS ${status}: ${text.slice(0, 200)}`);
  return text;
}

async function fetchFids(iata, type) {
  if (PROXY_URL) return fetchFidsViaProxy(iata, type);
  return fetchFidsDirect(iata, type);
}

async function migrate() {
  console.log('[seed] Running CREATE TABLE IF NOT EXISTS flight_stats…');
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
  console.log('[seed] CREATE TABLE done');
}

function queryTimeout(label, ms = INSERT_TIMEOUT_MS) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`DB timeout (${ms}ms): ${label}`)), ms),
  );
}

async function saveRows(rows, iata, type) {
  if (!rows.length) {
    console.log(`[${iata}/${type}] no rows to save`);
    return 0;
  }
  console.log(`[${iata}/${type}] bulk INSERT of ${rows.length} rows…`);

  const values = rows
    .map((_, i) => `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`)
    .join(',');
  const params = rows.flatMap(f => [
    f.flight_key,
    f.airline_iata,
    f.flight_number,
    f.departure_airport,
    f.arrival_airport,
    f.scheduled_departure_time,
    f.status,
    f.delay_minutes,
    f.baggage_belt,
  ]);

  const BULK_TIMEOUT_MS = Math.max(INSERT_TIMEOUT_MS, 60000);
  await Promise.race([
    pool.query(
      `INSERT INTO flight_stats (
         flight_key, airline_iata, flight_number, departure_airport, arrival_airport,
         scheduled_departure_time, status, delay_minutes, baggage_belt
       ) VALUES ${values}
       ON CONFLICT (flight_key) DO NOTHING`,
      params,
    ),
    queryTimeout(`bulk INSERT ${iata}/${type}`, BULK_TIMEOUT_MS),
  ]);

  console.log(`[${iata}/${type}] all ${rows.length} flights saved to DB (bulk)`);
  return rows.length;
}

async function seedAirport(iata) {
  let saved = 0;
  for (const type of ['arrival', 'departure']) {
    try {
      console.log(`  → ${iata} ${type}`);
      const rawText = await fetchFids(iata, type);

      const json = JSON.parse(rawText);
      console.log(`[${iata}/${type}] JSON parsed (keys: ${Object.keys(json || {}).join(', ')})`);

      const isArrival = type === 'arrival';
      const flightsArr = isArrival
        ? (json && json.arrivals) || []
        : (json && (json.departures || json.arrivals)) || [];
      console.log(`[${iata}/${type}] flights array extracted: ${Array.isArray(flightsArr) ? flightsArr.length : 0} items`);

      const rows = extractStatsFromFids(json, iata, type);
      console.log(`[${iata}/${type}] mapped to ${rows.length} flight_stats rows`);

      const inserted = await saveRows(rows, iata, type);
      saved += inserted;
      console.log(`  ← ${iata} ${type}: ${inserted} flights saved`);
    } catch (e) {
      console.warn(`  ✗ ${iata} ${type} failed: ${e.message}`);
    }
    await sleep(RATE_GAP_MS);
  }
  return saved;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  if (!PROXY_URL && !(process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY)) {
    console.error('Set RAPIDAPI_KEY (direct AeroDataBox) or PROXY_URL (existing /fids endpoint)');
    process.exit(1);
  }

  const rapidKey = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY || '';
  const dbUrl = process.env.DATABASE_URL || '';
  console.log('[seed] RAPIDAPI_KEY:', rapidKey ? `${rapidKey.slice(0, 5)}…` : '(not set)');
  console.log('[seed] DATABASE_URL:', dbUrl ? `${dbUrl.slice(0, 20)}…` : '(not set)');
  if (PROXY_URL) console.log('[seed] PROXY_URL:', PROXY_URL);

  console.log('Seeding flight_stats for', AIRPORTS.join(', '));
  console.log(`Fetch timeout: ${FETCH_TIMEOUT_MS}ms`);
  console.log(PROXY_URL ? `Source: proxy ${PROXY_URL}/fids/…` : 'Source: AeroDataBox');

  console.log('[seed] Connecting to DB / running migration…');
  try {
    await migrate();
  } catch (err) {
    console.error('[seed] Migration/DB error:', err.message);
    process.exit(1);
  }
  console.log('[seed] Migration complete — flight_stats ready');
  console.log('[seed] Starting first airport fetch…');

  let total = 0;
  for (const iata of AIRPORTS) {
    console.log(`\n=== ${iata} ===`);
    try {
      const n = await seedAirport(iata);
      console.log(`✓ ${iata}: ${n} flights saved`);
      total += n;
    } catch (e) {
      console.warn(`✗ ${iata} skipped (airport-level error): ${e.message}`);
    }
  }

  console.log(`\nDone. Total upserted: ${total}`);
  await pool.end().catch(() => {});
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
