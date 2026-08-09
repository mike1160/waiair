#!/usr/bin/env node
/**
 * One-time seed: fetch FIDS (arrivals + departures) for major SEA airports
 * and upsert into flight_stats via the reliability module.
 *
 * Usage (from proxy/):
 *   DATABASE_URL=... RAPIDAPI_KEY=... node seed-reliability.js
 *
 * Optional:
 *   PROXY_URL=https://waiair-production.up.railway.app  # use live proxy /fids instead of AeroDataBox direct
 *   RATE_GAP_MS=1500
 */
const fetch = require('node-fetch');
const {
  initDb,
  extractStatsFromFids,
  upsertFlightStats,
} = require('./reliability');

const AIRPORTS = ['BKK', 'HKT', 'SIN', 'KUL', 'CGK', 'MNL', 'SGN', 'HAN', 'DPS', 'DMK'];

/** IATA → ICAO (same mapping the proxy needs for AeroDataBox) */
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
const PROXY_URL = (process.env.PROXY_URL || '').replace(/\/$/, '');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fidsWindow() {
  // Match proxy/server.js: Thai local clock, −1h … +11h
  const thaiOffset = 7 * 3600000;
  const localNow = Date.now() + thaiOffset;
  const from = new Date(localNow - 1 * 3600000).toISOString().slice(0, 16).replace('T', '%20');
  const to = new Date(localNow + 11 * 3600000).toISOString().slice(0, 16).replace('T', '%20');
  return { from, to };
}

/** fetch with 8s AbortController timeout + before/after logs */
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
  return JSON.parse(text);
}

/** Hit the existing proxy FIDS endpoint (same path the app uses). */
async function fetchFidsViaProxy(iata, type) {
  const url = `${PROXY_URL}/fids/${iata}/${type}`;
  const { ok, status, text } = await fetchWithTimeout(
    url,
    {},
    `Proxy FIDS ${iata}/${type}`,
  );
  if (!ok) throw new Error(`Proxy FIDS ${status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function fetchFids(iata, type) {
  if (PROXY_URL) return fetchFidsViaProxy(iata, type);
  return fetchFidsDirect(iata, type);
}

async function seedAirport(iata) {
  let saved = 0;
  for (const type of ['arrival', 'departure']) {
    try {
      console.log(`  → ${iata} ${type}`);
      const json = await fetchFids(iata, type);
      const rows = extractStatsFromFids(json, iata, type);
      const { inserted } = await upsertFlightStats(rows);
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

  console.log('Seeding flight_stats for', AIRPORTS.join(', '));
  console.log(`Fetch timeout: ${FETCH_TIMEOUT_MS}ms`);
  console.log(PROXY_URL ? `Source: proxy ${PROXY_URL}/fids/…` : 'Source: AeroDataBox (same as FIDS endpoint)');

  const ok = await initDb();
  if (!ok) {
    console.error('DB init failed');
    process.exit(1);
  }

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
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
