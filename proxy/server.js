const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const axios = require('axios');
const { Pool: PgPool } = require('pg');
try { require('dotenv').config(); } catch { /* optional locally */ }
const {
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
} = require('./reliability');

const app = express();
// Railway sits behind a reverse proxy; trust X-Forwarded-* for correct proto/IP.
// Node's app.listen uses http.createServer → HTTP/1.1 (no HTTP/2).
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '32kb' }));

/** @type {Set<string>} */
const pushTokens = new Set();

const RAPIDAPI_KEY =
  process.env.RAPIDAPI_KEY ||
  'd55444508amshfe589145463437ep1c7ea4jsn67f0e0ed8e2d';

const RAPID_HEADERS = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
};

const AIRPORTS_CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

/** @type {{ iata:string, name:string, municipality:string, country:string, lat:number, lon:number, icao:string }[]} */
let airports = [];
/** @type {Map<string, typeof airports[0]>} */
const airportsByIata = new Map();

// Max 1 upstream request per 1.5s per endpoint (serial queue)
const RATE_GAP_MS = 1500;
const rateQueues = {};
const rateLastAt = {};

/** Short in-memory FIDS cache — never longer than 30s (live board freshness). */
const FIDS_CACHE_TTL_MS = 30_000;
/** @type {Map<string, { at:number, status:number, text:string }>} */
const fidsResponseCache = new Map();

const extrasMem = new Map();
/** @type {Map<string, { id:string, code:string, groupName?:string, createdAt:string, expiresAt:string, participants:object[] }>} */
const togetherRooms = new Map();

function normalizeTogetherCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function genTogetherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function purgeExpiredTogether() {
  const now = Date.now();
  for (const [code, room] of togetherRooms.entries()) {
    if (new Date(room.expiresAt).getTime() <= now) togetherRooms.delete(code);
  }
}

function togetherParticipantRow(deviceId, displayName, flight) {
  return {
    id: `${deviceId}-${Date.now()}`,
    device_id: deviceId,
    display_name: String(displayName || 'Traveler').trim() || 'Traveler',
    flight_number: String(flight.flightNumber || '').replace(/\s+/g, '').toUpperCase(),
    origin_iata: flight.originIata || '',
    dest_iata: flight.destIata || '',
    origin_lat: flight.originLat ?? null,
    origin_lon: flight.originLon ?? null,
    dest_lat: flight.destLat ?? null,
    dest_lon: flight.destLon ?? null,
    scheduled_time: flight.scheduledTime ?? null,
    status: flight.status || 'scheduled',
    eta_iso: flight.etaIso ?? null,
    landed_at_iso: flight.landedAtIso ?? null,
    lat: flight.lat ?? null,
    lon: flight.lon ?? null,
    delay_min: flight.delayMin ?? 0,
    progress_pct: flight.progressPct ?? 0,
    joined_at: new Date().toISOString(),
  };
}

function publicTogetherRoom(room) {
  return {
    id: room.id,
    code: room.code,
    groupName: room.groupName || null,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    participants: room.participants,
  };
}

/** @type {Map<string, { shareCode:string, flightNumber:string, senderName?:string, customMessage?:string, originIata?:string, destIata?:string, originCity?:string, destCity?:string, airline?:string, createdAt:string, expiresAt:string }>} */
const liveShares = new Map();

const LIVE_UNAVAILABLE = 'Flight data temporarily unavailable — try again';
/** @type {import('pg').Pool | null} */
let liveSharePg = null;

function supabaseRestConfig() {
  const base = String(
    process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  ).replace(/\/$/, '');
  const key = String(
    process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  ).trim();
  if (!base || !key) return null;
  return { base, key };
}

function sessionFromDbRow(row) {
  if (!row) return null;
  const shareCode = normalizeTogetherCode(row.shareCode || row.share_code);
  const flightNumber = String(row.flightNumber || row.flight_number || '')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!shareCode || !flightNumber) return null;
  return {
    shareCode,
    flightNumber,
    senderName: row.senderName ?? row.sender_name ?? null,
    customMessage: row.customMessage ?? row.custom_message ?? null,
    originIata: row.originIata ?? row.origin_iata ?? null,
    destIata: row.destIata ?? row.dest_iata ?? null,
    originCity: row.originCity ?? row.origin_city ?? null,
    destCity: row.destCity ?? row.dest_city ?? null,
    airline: row.airline ?? null,
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    expiresAt: row.expiresAt || row.expires_at,
  };
}

async function initLiveSharesDb() {
  if (!process.env.DATABASE_URL) return;
  liveSharePg = new PgPool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  await liveSharePg.query(`
    CREATE TABLE IF NOT EXISTS live_share_sessions (
      share_code TEXT PRIMARY KEY,
      flight_number TEXT NOT NULL,
      sender_name TEXT,
      custom_message TEXT,
      origin_iata TEXT,
      dest_iata TEXT,
      origin_city TEXT,
      dest_city TEXT,
      airline TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
}

async function persistLiveSession(row) {
  liveShares.set(row.shareCode, row);
  if (liveSharePg) {
    try {
      await liveSharePg.query(
        `INSERT INTO live_share_sessions (
           share_code, flight_number, sender_name, custom_message,
           origin_iata, dest_iata, origin_city, dest_city, airline, created_at, expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (share_code) DO UPDATE SET
           flight_number = EXCLUDED.flight_number,
           sender_name = EXCLUDED.sender_name,
           custom_message = EXCLUDED.custom_message,
           origin_iata = EXCLUDED.origin_iata,
           dest_iata = EXCLUDED.dest_iata,
           origin_city = EXCLUDED.origin_city,
           dest_city = EXCLUDED.dest_city,
           airline = EXCLUDED.airline,
           expires_at = EXCLUDED.expires_at`,
        [
          row.shareCode,
          row.flightNumber,
          row.senderName || null,
          row.customMessage || null,
          row.originIata || null,
          row.destIata || null,
          row.originCity || null,
          row.destCity || null,
          row.airline || null,
          row.createdAt,
          row.expiresAt,
        ],
      );
    } catch (e) {
      console.warn('[live] persist pg failed:', e.message);
    }
  }
  const sb = supabaseRestConfig();
  if (sb) {
    try {
      await fetch(`${sb.base}/rest/v1/live_shares`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          share_code: row.shareCode,
          flight_number: row.flightNumber,
          sender_name: row.senderName || null,
          custom_message: row.customMessage || null,
          origin_iata: row.originIata || null,
          dest_iata: row.destIata || null,
          origin_city: row.originCity || null,
          dest_city: row.destCity || null,
          airline: row.airline || null,
          expires_at: row.expiresAt,
        }),
      });
    } catch (e) {
      console.warn('[live] persist supabase failed:', e.message);
    }
  }
}

async function loadLiveSession(code) {
  const cached = liveShares.get(code);
  if (cached) {
    if (new Date(cached.expiresAt).getTime() <= Date.now()) {
      liveShares.delete(code);
    } else {
      return cached;
    }
  }
  if (liveSharePg) {
    try {
      const { rows } = await liveSharePg.query(
        `SELECT * FROM live_share_sessions
         WHERE share_code = $1 AND expires_at > NOW()
         LIMIT 1`,
        [code],
      );
      const session = sessionFromDbRow(rows[0]);
      if (session) {
        liveShares.set(code, session);
        return session;
      }
    } catch (e) {
      console.warn('[live] pg lookup failed:', e.message);
    }
  }
  const sb = supabaseRestConfig();
  if (sb) {
    try {
      const res = await fetch(
        `${sb.base}/rest/v1/live_shares?share_code=eq.${encodeURIComponent(code)}&select=*`,
        {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
          },
        },
      );
      if (res.ok) {
        const rows = await res.json();
        const session = sessionFromDbRow(Array.isArray(rows) ? rows[0] : null);
        if (session && new Date(session.expiresAt).getTime() > Date.now()) {
          liveShares.set(code, session);
          return session;
        }
      }
    } catch (e) {
      console.warn('[live] supabase lookup failed:', e.message);
    }
  }
  return null;
}

function purgeExpiredLive() {
  const now = Date.now();
  for (const [code, row] of liveShares.entries()) {
    if (new Date(row.expiresAt).getTime() <= now) liveShares.delete(code);
  }
}

function looksLikeFlightNumber(code) {
  return /^[A-Z]{1,3}\d{1,4}[A-Z]?$/i.test(String(code || '').replace(/\s+/g, ''));
}

function pickAdbTime(side) {
  if (!side) return '';
  for (const k of ['runwayTime', 'actualTime', 'revisedTime', 'predictedTime', 'scheduledTime']) {
    const t = side[k];
    if (t && (t.local || t.utc)) return t.local || t.utc;
  }
  return '';
}

function toRad(d) { return (d * Math.PI) / 180; }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function airportCoords(ap) {
  const lat = Number(ap?.location?.lat ?? ap?.location?.latitude ?? ap?.lat);
  const lon = Number(ap?.location?.lon ?? ap?.location?.lng ?? ap?.location?.longitude ?? ap?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function mapLiveStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('land')) return 'landed';
  if (s.includes('air') || s.includes('route') || s.includes('enroute')) return 'en-route';
  if (s.includes('board')) return 'boarding';
  if (s.includes('delay')) return 'delayed';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('depart') || s.includes('departed')) return 'en-route';
  return 'scheduled';
}

function parseLiveFlight(raw, session) {
  const dep = raw?.departure || {};
  const arr = raw?.arrival || {};
  const depAp = dep.airport || {};
  const arrAp = arr.airport || {};
  const loc = raw?.location || raw?.lastKnownPosition || {};
  const lat = Number(loc.lat ?? loc.latitude);
  const lon = Number(loc.lon ?? loc.lng ?? loc.longitude);
  const depCoord = airportCoords(depAp);
  const arrCoord = airportCoords(arrAp);
  const depTime = pickAdbTime(dep);
  const arrTime = pickAdbTime(arr);
  const schedDep = pickAdbTime({ scheduledTime: dep.scheduledTime });
  const schedArr = pickAdbTime({ scheduledTime: arr.scheduledTime });
  const delayMin = (() => {
    if (!schedDep || !depTime) return 0;
    const a = new Date(schedDep).getTime();
    const b = new Date(depTime).getTime();
    if (!a || !b) return 0;
    return Math.max(0, Math.round((b - a) / 60000));
  })();
  const status = mapLiveStatus(raw?.status);
  let progress = 0;
  if (status === 'landed') progress = 100;
  else if (depCoord && arrCoord && Number.isFinite(lat) && Number.isFinite(lon)) {
    const total = haversineKm(depCoord.lat, depCoord.lon, arrCoord.lat, arrCoord.lon);
    const done = haversineKm(depCoord.lat, depCoord.lon, lat, lon);
    if (total > 1) progress = Math.min(99, Math.max(0, Math.round((done / total) * 100)));
  } else if (depTime && arrTime) {
    const a = new Date(depTime).getTime();
    const b = new Date(arrTime).getTime();
    const now = Date.now();
    if (b > a && now >= a) progress = Math.min(99, Math.max(0, Math.round(((now - a) / (b - a)) * 100)));
  }
  const distanceKm = depCoord && arrCoord
    ? Math.round(haversineKm(depCoord.lat, depCoord.lon, arrCoord.lat, arrCoord.lon))
    : null;
  return {
    flightNumber: String(raw?.number || session?.flightNumber || '').replace(/\s+/g, '').toUpperCase(),
    airline: raw?.airline?.name || session?.airline || '',
    originIata: depAp.iata || session?.originIata || '',
    destIata: arrAp.iata || session?.destIata || '',
    originCity: depAp.municipalityName || depAp.name || session?.originCity || '',
    destCity: arrAp.municipalityName || arrAp.name || session?.destCity || '',
    status,
    progress,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    depTime,
    arrTime,
    schedDep,
    schedArr,
    gate: dep.gate || '',
    terminal: dep.terminal || arr.terminal || '',
    arrTerminal: arr.terminal || '',
    delayMin,
    distanceKm,
    depLat: depCoord?.lat ?? null,
    depLon: depCoord?.lon ?? null,
    destLat: arrCoord?.lat ?? null,
    destLon: arrCoord?.lon ?? null,
  };
}

async function fetchFlightRaw(number) {
  const url =
    `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}` +
    '?withAircraftImage=false&withLocation=true&withFlightPlan=false';
  const { status, text } = await withRateLimit('flight', () => upstreamFetch(url));
  if (status < 200 || status >= 300) return null;
  try {
    const data = JSON.parse(text);
    const items = Array.isArray(data) ? data : (data ? [data] : []);
    if (!items.length) return null;
    const now = Date.now();
    items.sort((a, b) => {
      const ta = new Date(pickAdbTime(a?.departure) || 0).getTime() || 0;
      const tb = new Date(pickAdbTime(b?.departure) || 0).getTime() || 0;
      return Math.abs(ta - now) - Math.abs(tb - now);
    });
    return items[0];
  } catch {
    return null;
  }
}

function publicLiveSession(row) {
  return {
    shareCode: row.shareCode,
    flightNumber: row.flightNumber,
    senderName: row.senderName || null,
    customMessage: row.customMessage || null,
    originIata: row.originIata || null,
    destIata: row.destIata || null,
    originCity: row.originCity || null,
    destCity: row.destCity || null,
    airline: row.airline || null,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    url: `https://waiair.app/live/${row.shareCode}`,
  };
}

/** @type {Map<string, { id:string, code:string, createdAt:string, expiresAt:string, participants:object[] }>} */
const raceRooms = new Map();

function normalizeRaceCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

function genRaceCode() {
  return `SKY-${1000 + Math.floor(Math.random() * 9000)}`;
}

function purgeExpiredRaces() {
  const now = Date.now();
  for (const [code, room] of raceRooms.entries()) {
    if (new Date(room.expiresAt).getTime() <= now) raceRooms.delete(code);
  }
}

function raceParticipantRow(deviceId, displayName, flight) {
  return {
    id: `${deviceId}-${Date.now()}`,
    device_id: deviceId,
    display_name: String(displayName || 'Pilot').trim() || 'Pilot',
    flight_number: String(flight.flightNumber || '').replace(/\s+/g, '').toUpperCase(),
    origin_iata: flight.originIata || '',
    dest_iata: flight.destIata || '',
    origin_lat: flight.originLat ?? null,
    origin_lon: flight.originLon ?? null,
    dest_lat: flight.destLat ?? null,
    dest_lon: flight.destLon ?? null,
    scheduled_time: flight.scheduledTime ?? null,
    status: flight.status || 'scheduled',
    eta_iso: flight.etaIso ?? null,
    landed_at_iso: flight.landedAtIso ?? null,
    lat: flight.lat ?? null,
    lon: flight.lon ?? null,
    delay_min: flight.delayMin ?? 0,
    progress_pct: flight.progressPct ?? 0,
    joined_at: new Date().toISOString(),
  };
}

function publicRaceRoom(room) {
  return {
    id: room.id,
    code: room.code,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    participants: room.participants,
  };
}
function extrasCached(key, ttlMs, fn) {
  const hit = extrasMem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.data);
  return fn().then((data) => {
    if (data) extrasMem.set(key, { at: Date.now(), data });
    return data;
  });
}

const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY || process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || '';
const EXCHANGE_KEY = process.env.EXCHANGE_API_KEY || process.env.EXPO_PUBLIC_EXCHANGE_API_KEY || '';

function withRateLimit(endpoint, fn) {
  const prev = rateQueues[endpoint] || Promise.resolve();
  const next = prev.then(async () => {
    const wait = Math.max(0, RATE_GAP_MS - (Date.now() - (rateLastAt[endpoint] || 0)));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    rateLastAt[endpoint] = Date.now();
    return fn();
  }, async () => {
    const wait = Math.max(0, RATE_GAP_MS - (Date.now() - (rateLastAt[endpoint] || 0)));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    rateLastAt[endpoint] = Date.now();
    return fn();
  });
  rateQueues[endpoint] = next.catch(() => {});
  return next;
}

async function upstreamFetch(url) {
  const r = await fetch(url, { headers: RAPID_HEADERS });
  const text = await r.text();
  return { status: r.status, text };
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function publicAirport(a) {
  return {
    iata: a.iata,
    name: a.name,
    municipality: a.municipality,
    country: a.country,
    lat: a.lat,
    lon: a.lon,
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function lerpN(a, b, t) {
  return a + (b - a) * t;
}

function routeSamplePoints(lat1, lon1, lat2, lon2, segments = 6) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = segments === 1 ? 0.5 : i / (segments - 1);
    pts.push({
      lat: lerpN(lat1, lat2, t),
      lon: lerpN(lon1, lon2, t),
      frac: t,
    });
  }
  return pts;
}

function windVectorKt(speed, dirDeg) {
  const rad = (Number(dirDeg) || 0) * Math.PI / 180;
  const s = Number(speed) || 0;
  return { u: s * Math.sin(rad), v: s * Math.cos(rad) };
}

function shearKt(s850, d850, s500, d500) {
  const a = windVectorKt(s850, d850);
  const b = windVectorKt(s500, d500);
  return Math.hypot(a.u - b.u, a.v - b.v);
}

function turbulenceIndex(ws700, shear) {
  return (Number(ws700) || 0) * 0.35 + (Number(shear) || 0) * 0.65;
}

function severityFromIndex(idx) {
  if (idx < 12) return 'smooth';
  if (idx < 22) return 'light';
  if (idx < 35) return 'moderate';
  return 'severe';
}

const SEV_RANK = { smooth: 0, light: 1, moderate: 2, severe: 3 };

function maxSeverity(a, b) {
  return (SEV_RANK[a] ?? 0) >= (SEV_RANK[b] ?? 0) ? a : b;
}

function barLevelForSeverity(s) {
  switch (s) {
    case 'light': return 4;
    case 'moderate': return 7;
    case 'severe': return 10;
    default: return 2;
  }
}

function formatHm(iso, tz) {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz || 'UTC',
    }).format(d);
  } catch {
    return '';
  }
}

async function fetchPointWind(lat, lon, timeIso) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=wind_speed_850hPa,wind_speed_700hPa,wind_speed_500hPa,' +
    'wind_direction_850hPa,wind_direction_700hPa,wind_direction_500hPa' +
    '&wind_speed_unit=kn&timezone=auto&forecast_days=2';
  const r = await fetch(url);
  if (!r.ok) return null;
  const json = await r.json();
  const hourly = json.hourly;
  if (!hourly?.time?.length) return null;
  const target = new Date(timeIso).getTime();
  if (!Number.isFinite(target)) return null;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < hourly.time.length; i++) {
    const diff = Math.abs(new Date(hourly.time[i]).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  const ws700 = hourly.wind_speed_700hPa?.[best];
  const ws850 = hourly.wind_speed_850hPa?.[best];
  const ws500 = hourly.wind_speed_500hPa?.[best];
  if (ws700 == null && ws850 == null && ws500 == null) return null;
  return {
    ws850: ws850 ?? 0,
    ws700: ws700 ?? 0,
    ws500: ws500 ?? 0,
    d850: hourly.wind_direction_850hPa?.[best] ?? 0,
    d500: hourly.wind_direction_500hPa?.[best] ?? 0,
    timezone: json.timezone || 'UTC',
  };
}

async function reverseRegionName(lat, lon) {
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`,
    );
    if (!r.ok) return '';
    const json = await r.json();
    const hit = json?.results?.[0];
    if (!hit) return '';
    return String(hit.name || hit.admin1 || hit.country || '').trim();
  } catch {
    return '';
  }
}

async function computeTurbulenceForecast(origin, dest, date, departureIso, durationMin) {
  const oAp = airportsByIata.get(origin);
  const dAp = airportsByIata.get(dest);
  if (!oAp || !dAp) return null;

  let depMs = departureIso ? new Date(departureIso).getTime() : NaN;
  if (!Number.isFinite(depMs)) {
    depMs = new Date(`${date}T12:00:00Z`).getTime();
  }
  const durationMs = Math.max(30, durationMin) * 60 * 1000;
  const points = routeSamplePoints(oAp.lat, oAp.lon, dAp.lat, dAp.lon, 6);
  const segments = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const frac = (p.frac + points[i + 1].frac) / 2;
    const segTime = new Date(depMs + frac * durationMs).toISOString();
    const wind = await fetchPointWind(p.lat, p.lon, segTime);
    if (!wind) continue;
    const shear = shearKt(wind.ws850, wind.d850, wind.ws500, wind.d500);
    const idx = turbulenceIndex(wind.ws700, shear);
    const severity = severityFromIndex(idx);
    segments.push({
      severity,
      idx,
      frac,
      lat: p.lat,
      lon: p.lon,
      segTime,
      timezone: wind.timezone,
    });
  }

  if (!segments.length) return null;

  let overall = 'smooth';
  let peak = 'smooth';
  let worst = segments[0];
  for (const seg of segments) {
    overall = maxSeverity(overall, seg.severity);
    if ((SEV_RANK[seg.severity] ?? 0) >= (SEV_RANK[worst.severity] ?? 0)) worst = seg;
    peak = maxSeverity(peak, seg.severity);
  }

  const region = await reverseRegionName(worst.lat, worst.lon) || 'route';
  const tz = worst.timezone || 'UTC';
  const halfSegMs = (durationMs / (points.length - 1)) / 2;
  const winStart = formatHm(new Date(new Date(worst.segTime).getTime() - halfSegMs).toISOString(), tz);
  const winEnd = formatHm(new Date(new Date(worst.segTime).getTime() + halfSegMs).toISOString(), tz);
  const segMin = durationMin / Math.max(1, points.length - 1);
  const bumpMinutes = Math.round(segments.filter(s => s.severity !== 'smooth').length * segMin);
  const cruiseAltitudeFt = durationMin < 80 ? 25000 : durationMin < 150 ? 33000 : durationMin < 280 ? 35000 : 38000;
  const zones = points.map((p, i) => ({
    lat: p.lat,
    lon: p.lon,
    frac: p.frac,
    severity: (segments[Math.min(i, segments.length - 1)] || segments[0] || { severity: 'smooth' }).severity,
    time: i === 0 ? formatHm(new Date(depMs).toISOString(), tz) : formatHm(segments[Math.min(i - 1, segments.length - 1)]?.segTime, tz),
  }));

  return {
    overall,
    peak,
    region,
    windowStart: winStart,
    windowEnd: winEnd,
    barLevel: barLevelForSeverity(peak),
    bumpMinutes,
    cruiseAltitudeFt,
    peakTime: winStart,
    zones,
  };
}

async function loadAirports() {
  console.log('Loading airports database…');
  const r = await fetch(AIRPORTS_CSV_URL);
  if (!r.ok) throw new Error(`Airports CSV fetch failed: ${r.status}`);
  const text = await r.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('Airports CSV is empty');

  const header = parseCsvLine(lines[0]).map(h => h.trim());
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const need = ['type', 'name', 'latitude_deg', 'longitude_deg', 'iso_country', 'municipality', 'iata_code', 'icao_code', 'gps_code'];
  for (const k of need) {
    if (col[k] === undefined) throw new Error(`Airports CSV missing column: ${k}`);
  }

  const next = [];
  const byIata = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const type = (row[col.type] || '').trim();
    if (type !== 'large_airport' && type !== 'medium_airport') continue;
    const iata = (row[col.iata_code] || '').trim().toUpperCase();
    if (!iata) continue;
    const lat = Number(row[col.latitude_deg]);
    const lon = Number(row[col.longitude_deg]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const icao = ((row[col.icao_code] || row[col.gps_code] || '') + '').trim().toUpperCase();
    const entry = {
      iata,
      name: (row[col.name] || '').trim(),
      municipality: (row[col.municipality] || '').trim(),
      country: (row[col.iso_country] || '').trim().toUpperCase(),
      lat,
      lon,
      icao,
    };
    // Prefer large over medium if duplicate IATA
    const prev = byIata.get(iata);
    if (prev && type !== 'large_airport') continue;
    byIata.set(iata, entry);
  }
  for (const a of byIata.values()) next.push(a);
  airports = next;
  airportsByIata.clear();
  for (const a of airports) airportsByIata.set(a.iata, a);
  console.log(`Loaded ${airports.length} airports (large/medium with IATA)`);
}

function resolveIcao(iata) {
  const a = airportsByIata.get(String(iata || '').toUpperCase());
  return (a && a.icao) || String(iata || '').toUpperCase();
}

/** Approximate IANA timezone for FIDS local window (AeroDataBox expects airport-local times). */
const IATA_TZ = {
  BKK: 'Asia/Bangkok', DMK: 'Asia/Bangkok', HKT: 'Asia/Bangkok', CNX: 'Asia/Bangkok',
  HDY: 'Asia/Bangkok', USM: 'Asia/Bangkok', KBV: 'Asia/Bangkok', UTP: 'Asia/Bangkok',
  SIN: 'Asia/Singapore', KUL: 'Asia/Kuala_Lumpur', PEN: 'Asia/Kuala_Lumpur',
  CGK: 'Asia/Jakarta', DPS: 'Asia/Makassar',
  SGN: 'Asia/Ho_Chi_Minh', HAN: 'Asia/Ho_Chi_Minh',
  MNL: 'Asia/Manila',
  AMS: 'Europe/Amsterdam',
  LHR: 'Europe/London', CDG: 'Europe/Paris', FRA: 'Europe/Berlin',
  DXB: 'Asia/Dubai', DOH: 'Asia/Qatar', AUH: 'Asia/Dubai',
  HKG: 'Asia/Hong_Kong', NRT: 'Asia/Tokyo', ICN: 'Asia/Seoul',
  SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne',
  JFK: 'America/New_York', LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles',
};

function formatAirportLocal(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function fidsLocalWindow(iata, offsetDays = 0) {
  const tz = IATA_TZ[String(iata || '').toUpperCase()] || 'UTC';
  const now = Date.now() + Number(offsetDays || 0) * 24 * 3600000;
  const nowLocal = formatAirportLocal(new Date(now), tz);
  const today = nowLocal.slice(0, 10);
  if (offsetDays) {
    return {
      from: `${today} 00:00`.replace(' ', '%20'),
      to: `${today} 23:59`.replace(' ', '%20'),
      tz,
      date: today,
    };
  }
  const toLocal = formatAirportLocal(new Date(Date.now() + 6 * 3600000), tz);
  const fromMidnight = `${today} 00:00`;
  const from12h = formatAirportLocal(new Date(Date.now() + 6 * 3600000 - 12 * 3600000), tz);
  const from = fromMidnight > from12h ? fromMidnight : from12h;
  return { from: from.replace(' ', '%20'), to: toLocal.replace(' ', '%20'), tz, date: today };
}

/** AeroDataBox allows at most 12h between fromLocal and toLocal. */
function fidsDaySlices(dateKey) {
  return [
    { from: `${dateKey} 00:00`.replace(' ', '%20'), to: `${dateKey} 11:59`.replace(' ', '%20') },
    { from: `${dateKey} 12:00`.replace(' ', '%20'), to: `${dateKey} 23:59`.replace(' ', '%20') },
  ];
}

function mergeFidsBodies(texts, dir) {
  const key = dir === 'Arrival' ? 'arrivals' : 'departures';
  const seen = new Set();
  const merged = [];
  let template = null;
  for (const text of texts) {
    let json;
    try { json = JSON.parse(text); } catch { continue; }
    if (!template) template = json;
    const list = Array.isArray(json?.[key]) ? json[key]
      : Array.isArray(json) ? json
      : [];
    for (const item of list) {
      const t = item?.movement?.scheduledTime;
      const ts = (t && (t.utc || t.local)) || item?.number || '';
      const id = `${item?.number || ''}|${ts}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
    }
  }
  if (!template) return JSON.stringify({ [key]: merged });
  if (Array.isArray(template)) return JSON.stringify(merged);
  return JSON.stringify({ ...template, [key]: merged });
}

function filterFidsByRemote(text, dir, arrIata, depIata) {
  const want = String(dir === 'Arrival' ? depIata : arrIata || '').toUpperCase();
  if (!want || want.length !== 3) return text;
  try {
    const json = JSON.parse(text);
    const key = dir === 'Arrival' ? 'arrivals' : 'departures';
    const list = Array.isArray(json?.[key]) ? json[key] : Array.isArray(json) ? json : [];
    const filtered = list.filter((item) => {
      const code = String(
        item?.movement?.airport?.iata
        || item?.arrival?.airport?.iata
        || item?.departure?.airport?.iata
        || '',
      ).toUpperCase();
      return code === want;
    });
    if (Array.isArray(json)) return JSON.stringify(filtered);
    return JSON.stringify({ ...json, [key]: filtered });
  } catch {
    return text;
  }
}

function registerRoutes() {
  app.get('/fids/:iata/:type', async (req, res) => {
    try {
      const { iata, type } = req.params;
      const iataUp = String(iata || '').toUpperCase();
      const kind = String(type || '').toLowerCase();
      const dir = (kind === 'arrival' || kind === 'arrivals')
        ? 'Arrival'
        : 'Departure';
      const offsetDays = Number(req.query.offsetDays || 0) || 0;
      const arrIata = String(req.query.arr_iata || '').toUpperCase();
      const depIata = String(req.query.dep_iata || '').toUpperCase();
      const dateParam = String(req.query.date || '').trim();
      const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : (offsetDays ? fidsLocalWindow(iataUp, offsetDays).date : null);
      const cacheKey = `${iataUp}:${dir}:${dateKey || offsetDays || 0}`;
      const cached = fidsResponseCache.get(cacheKey);
      const sendFids = (status, body, cacheHdr) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-WaiAir-Cache', cacheHdr);
        return res.status(status).send(filterFidsByRemote(body, dir, arrIata, depIata));
      };
      if (cached && Date.now() - cached.at < FIDS_CACHE_TTL_MS) {
        console.log('[AeroDataBox FIDS] cache hit', cacheKey, '| ageMs', Date.now() - cached.at);
        return sendFids(cached.status, cached.text, 'HIT');
      }

      const icao = resolveIcao(iata);

      // Calendar day (yesterday/tomorrow): two 12h slices — ADB rejects a 24h window.
      if (dateKey) {
        const slices = fidsDaySlices(dateKey);
        const parts = [];
        let lastStatus = 502;
        for (const slice of slices) {
          const endpoint = `/flights/airports/icao/${icao}/${slice.from}/${slice.to}`;
          const url = `https://aerodatabox.p.rapidapi.com${endpoint}?direction=${dir}&withCodeshared=true&withCargo=false&withPrivate=false&withLocation=false`;
          console.log('[AeroDataBox FIDS] endpoint:', endpoint, '| date:', dateKey, '| dir:', dir);
          const { status, text } = await withRateLimit('fids', () => upstreamFetch(url));
          console.log('[AeroDataBox FIDS] HTTP', status, '| bytes', text.length, '|', iataUp, dir, dateKey);
          lastStatus = status;
          if (status >= 200 && status < 300) parts.push(text);
        }
        if (!parts.length) {
          return sendFids(lastStatus >= 400 ? lastStatus : 502, '{}', 'MISS');
        }
        const text = mergeFidsBodies(parts, dir);
        fidsResponseCache.set(cacheKey, { at: Date.now(), status: 200, text });
        recordFidsStatsAsync(text, iata, type);
        return sendFids(200, text, 'MISS');
      }

      const { from, to, tz } = fidsLocalWindow(iataUp, offsetDays);
      const endpoint = `/flights/airports/icao/${icao}/${from}/${to}`;
      const url = `https://aerodatabox.p.rapidapi.com${endpoint}?direction=${dir}&withCodeshared=true&withCargo=false&withPrivate=false&withLocation=false`;

      console.log('[AeroDataBox FIDS] endpoint:', endpoint, '| tz:', tz, '| dir:', dir, '| window: -6h..+6h');

      const { status, text } = await withRateLimit('fids', () => upstreamFetch(url));
      console.log('[AeroDataBox FIDS] HTTP', status, '| bytes', text.length, '|', iataUp, dir);

      if (status >= 200 && status < 300) {
        fidsResponseCache.set(cacheKey, { at: Date.now(), status, text });
        recordFidsStatsAsync(text, iata, type);
      }
      return sendFids(status, text, 'MISS');
    } catch (e) {
      console.error('Error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Airline reliability (PostgreSQL flight_stats) ─────────────────────────────
  // Static paths before /:airlineCode
  app.get('/reliability/health', async (_req, res) => {
    try {
      const data = await getReliabilityHealth();
      res.json(data);
    } catch (e) {
      res.status(500).json({
        table_exists: false,
        total_records: 0,
        last_record: null,
        endpoints: {
          reliability_all: '/reliability/all',
          reliability_airline: '/reliability/:airline',
          reliability_flight: '/reliability/flight/:number',
        },
        error: e.message || 'health check failed',
      });
    }
  });

  app.get('/reliability/all', async (_req, res) => {
    try {
      const data = await getAllAirlinesReliability();
      res.json(data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Reliability query failed' });
    }
  });

  app.get('/reliability/flight/:number', async (req, res) => {
    try {
      const data = await getFlightDetail(req.params.number);
      res.json(data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Flight detail failed' });
    }
  });

  app.get('/reliability/:airlineCode', async (req, res) => {
    try {
      const data = await getAirlineReliability(req.params.airlineCode);
      res.json(data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Reliability query failed' });
    }
  });

  // Live flight status by IATA/ICAO number (AeroDataBox /flights/number — withLocation for ADS-B).
  // Note: AeroDataBox has no /flights/iata/{n}; the live tracker path is /flights/number/{n}.
  app.get('/flight/:number', async (req, res) => {
    try {
      const number = String(req.params.number || '').replace(/\s+/g, '').toUpperCase();
      if (!number) return res.status(400).json({ error: 'Missing flight number' });
      // withLocation=true → real-time position when airborne (fresher status for En Route)
      const url =
        `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}` +
        `?withAircraftImage=false&withLocation=true&withFlightPlan=false`;
      console.log('[AeroDataBox LIVE] Fetching flight:', url);
      const { status, text } = await withRateLimit('flight', () => upstreamFetch(url));
      console.log('[AeroDataBox LIVE] Flight status:', status, '| Response:', text.slice(0, 180));
      res.setHeader('Content-Type', 'application/json');
      res.status(status).send(text);
    } catch (e) {
      console.error('Error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  const SCHIPHOL_APP_ID = process.env.SCHIPHOL_APP_ID || process.env.EXPO_PUBLIC_SCHIPHOL_APP_ID || '';
  const SCHIPHOL_APP_KEY = process.env.SCHIPHOL_APP_KEY || process.env.EXPO_PUBLIC_SCHIPHOL_APP_KEY || '';
  const SCHIPHOL_TTL_MS = 45_000;
  /** @type {Map<string, { at:number, status:number, body:string }>} */
  const schipholMem = new Map();

  app.get('/schiphol/flights', async (req, res) => {
    try {
      const qs = new URLSearchParams();
      for (const key of ['flightName', 'flightDirection', 'scheduleDate', 'page', 'sort', 'includedelays', 'fromScheduleDate', 'toScheduleDate']) {
        const v = req.query[key];
        if (v != null && String(v).trim()) qs.set(key, String(v).trim());
      }
      const memKey = qs.toString() || 'default';
      const cached = schipholMem.get(memKey);
      if (cached && Date.now() - cached.at < SCHIPHOL_TTL_MS) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Schiphol-Cache', 'HIT');
        return res.status(cached.status).send(cached.body);
      }
      if (!SCHIPHOL_APP_ID || !SCHIPHOL_APP_KEY) {
        return res.status(503).json({ error: 'Schiphol API keys not configured' });
      }
      const url = `https://api.schiphol.nl/public-flights/flights${qs.toString() ? `?${qs}` : ''}`;
      const r = await fetch(url, {
        timeout: 8000,
        headers: {
          Accept: 'application/json',
          ResourceVersion: 'v4',
          app_id: SCHIPHOL_APP_ID,
          app_key: SCHIPHOL_APP_KEY,
          'User-Agent': 'WaiAirProxy/1.1 (schiphol-flights)',
        },
      });
      const text = await r.text();
      schipholMem.set(memKey, { at: Date.now(), status: r.status, body: text });
      res.setHeader('Content-Type', 'application/json');
      res.status(r.status).send(text);
    } catch (e) {
      console.error('[schiphol]', e.message);
      res.status(502).json({ error: e.message || 'Schiphol fetch failed' });
    }
  });

  // Autocomplete: GET /flights/number/{term}/autocomplete
  app.get('/flights/number/:term/autocomplete', async (req, res) => {
    try {
      const term = String(req.params.term || '').trim();
      const hits = await searchFlightAutocomplete(term, 5);
      res.json(hits);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Autocomplete failed' });
    }
  });

  // Delay history: GET /flights/number/{number}/stats
  app.get('/flights/number/:number/stats', async (req, res) => {
    try {
      const data = await getFlightDelayStats(req.params.number);
      res.json(data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Stats failed' });
    }
  });

  // Aircraft by registration
  app.get('/aircraft/reg/:registration', async (req, res) => {
    try {
      const reg = String(req.params.registration || '').replace(/\s+/g, '').toUpperCase();
      if (!reg) return res.status(400).json({ error: 'Missing registration' });
      const url = `https://aerodatabox.p.rapidapi.com/aircrafts/reg/${encodeURIComponent(reg)}?withImage=true`;
      const { status, text } = await withRateLimit('aircraft', () => upstreamFetch(url));
      res.setHeader('Content-Type', 'application/json');
      res.status(status).send(text);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Aircraft lookup failed' });
    }
  });

  app.get('/weather', async (req, res) => {
    try {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      const landing = Number(req.query.landing);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ error: 'lat and lon required' });
      }
      const key = `wx:${lat.toFixed(2)},${lon.toFixed(2)}`;
      const data = await extrasCached(key, 50 * 60 * 1000, async () => {
        if (OPENWEATHER_KEY) {
          const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`);
          if (!r.ok) return null;
          const now = await r.json();
          let landingTemp = null;
          let landingLabel = '';
          if (Number.isFinite(landing)) {
            const fr = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`);
            if (fr.ok) {
              const fc = await fr.json();
              const list = Array.isArray(fc.list) ? fc.list : [];
              let best = list[0];
              let bestDiff = Infinity;
              for (const item of list) {
                const t = Number(item.dt || 0) * 1000;
                const diff = Math.abs(t - landing);
                if (diff < bestDiff) { best = item; bestDiff = diff; }
              }
              if (best?.main?.temp != null) {
                landingTemp = Math.round(best.main.temp);
                landingLabel = (best.weather && best.weather[0] && best.weather[0].description) || '';
              }
            }
          }
          return {
            city: now.name || '',
            temp: now.main?.temp,
            feelsLike: now.main?.feels_like,
            humidity: now.main?.humidity,
            description: (now.weather && now.weather[0] && now.weather[0].description) || '',
            iconMain: (now.weather && now.weather[0] && now.weather[0].main) || '',
            landingTemp,
            landingLabel,
          };
        }
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weathercode&timezone=auto`
        );
        if (!r.ok) return null;
        const json = await r.json();
        const cur = json.current || {};
        const code = Number(cur.weathercode ?? -1);
        let description = 'Cloudy';
        let iconMain = 'Clouds';
        if (code === 0) { description = 'Clear'; iconMain = 'Clear'; }
        else if (code >= 51 && code <= 82) { description = 'Rain'; iconMain = 'Rain'; }
        else if (code >= 95) { description = 'Thunderstorm'; iconMain = 'Thunderstorm'; }
        else if (code >= 71) { description = 'Snow'; iconMain = 'Snow'; }
        else if (code >= 45 && code <= 48) { description = 'Fog'; iconMain = 'Mist'; }
        return {
          city: '',
          temp: cur.temperature_2m,
          feelsLike: cur.apparent_temperature,
          humidity: cur.relative_humidity_2m,
          description,
          iconMain,
        };
      });
      if (!data) return res.status(502).json({ error: 'Weather unavailable' });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Weather failed' });
    }
  });

  app.get('/fx', async (req, res) => {
    try {
      const base = String(req.query.base || 'EUR').toUpperCase();
      const data = await extrasCached(`fx:${base}`, 20 * 60 * 60 * 1000, async () => {
        if (EXCHANGE_KEY) {
          const r = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_KEY}/latest/${encodeURIComponent(base)}`);
          if (r.ok) {
            const json = await r.json();
            if (json.conversion_rates) return { base, rates: json.conversion_rates };
          }
        }
        const r = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
        if (!r.ok) return null;
        const json = await r.json();
        return { base, rates: json.rates || {} };
      });
      if (!data) return res.status(502).json({ error: 'FX unavailable' });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message || 'FX failed' });
    }
  });

  app.get('/turbulence', async (req, res) => {
    try {
      const origin = String(req.query.origin || '').trim().toUpperCase();
      const dest = String(req.query.dest || req.query.destination || '').trim().toUpperCase();
      const date = String(req.query.date || '').trim();
      const departure = String(req.query.departure || '').trim();
      const durationMin = Math.max(30, Math.min(960, Number(req.query.durationMin) || 120));
      if (!origin || !dest || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'origin, dest, and date (YYYY-MM-DD) required' });
      }
      const cacheKey = `turb:${origin}:${dest}:${date}:${departure}:${durationMin}`;
      const data = await extrasCached(cacheKey, 30 * 60 * 1000, async () => {
        return computeTurbulenceForecast(origin, dest, date, departure, durationMin);
      });
      if (!data) return res.json({ unavailable: true });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Turbulence forecast failed' });
    }
  });

  app.post('/together', (req, res) => {
    try {
      purgeExpiredTogether();
      const { deviceId, displayName, flight, groupName } = req.body || {};
      if (!deviceId || !flight?.flightNumber) {
        return res.status(400).json({ error: 'deviceId and flight required' });
      }
      let code = genTogetherCode();
      while (togetherRooms.has(code)) code = genTogetherCode();
      const now = new Date();
      const room = {
        id: `together-${now.getTime()}`,
        code,
        groupName: groupName ? String(groupName).trim() : null,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        participants: [togetherParticipantRow(deviceId, displayName, flight)],
      };
      togetherRooms.set(code, room);
      res.json(publicTogetherRoom(room));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Create group failed' });
    }
  });

  app.get('/together/:code', (req, res) => {
    purgeExpiredTogether();
    const code = normalizeTogetherCode(req.params.code);
    const room = togetherRooms.get(code);
    if (!room || new Date(room.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(publicTogetherRoom(room));
  });

  app.post('/together/:code/join', (req, res) => {
    try {
      purgeExpiredTogether();
      const code = normalizeTogetherCode(req.params.code);
      const room = togetherRooms.get(code);
      if (!room || new Date(room.expiresAt).getTime() <= Date.now()) {
        return res.status(404).json({ error: 'Group not found' });
      }
      const { deviceId, displayName, flight } = req.body || {};
      if (!deviceId || !flight?.flightNumber) {
        return res.status(400).json({ error: 'deviceId and flight required' });
      }
      const idx = room.participants.findIndex(p => p.device_id === deviceId);
      const row = togetherParticipantRow(deviceId, displayName, flight);
      if (idx >= 0) room.participants[idx] = { ...room.participants[idx], ...row, id: room.participants[idx].id };
      else {
        if (room.participants.length >= 8) return res.status(409).json({ error: 'Group full' });
        room.participants.push(row);
      }
      res.json(publicTogetherRoom(room));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Join group failed' });
    }
  });

  app.patch('/together/:code/participant', (req, res) => {
    try {
      purgeExpiredTogether();
      const code = normalizeTogetherCode(req.params.code);
      const room = togetherRooms.get(code);
      if (!room) return res.status(404).json({ error: 'Group not found' });
      const { deviceId, patch } = req.body || {};
      const p = room.participants.find(x => x.device_id === deviceId);
      if (!p) return res.status(404).json({ error: 'Participant not found' });
      if (patch?.status != null) p.status = patch.status;
      if (patch?.etaIso != null) p.eta_iso = patch.etaIso;
      if (patch?.landedAtIso != null) p.landed_at_iso = patch.landedAtIso;
      if (patch?.lat != null) p.lat = patch.lat;
      if (patch?.lon != null) p.lon = patch.lon;
      if (patch?.delayMin != null) p.delay_min = patch.delayMin;
      if (patch?.progressPct != null) p.progress_pct = patch.progressPct;
      res.json(publicTogetherRoom(room));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Update participant failed' });
    }
  });

  app.post('/live', async (req, res) => {
    try {
      purgeExpiredLive();
      const {
        flightNumber,
        senderName,
        customMessage,
        originIata,
        destIata,
        originCity,
        destCity,
        airline,
      } = req.body || {};
      const num = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
      if (!num) return res.status(400).json({ error: 'flightNumber required' });
      let shareCode = genTogetherCode();
      while (liveShares.has(shareCode)) shareCode = genTogetherCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const row = {
        shareCode,
        flightNumber: num,
        senderName: senderName ? String(senderName).trim() : null,
        customMessage: customMessage ? String(customMessage).trim() : null,
        originIata: originIata ? String(originIata).toUpperCase() : null,
        destIata: destIata ? String(destIata).toUpperCase() : null,
        originCity: originCity ? String(originCity).trim() : null,
        destCity: destCity ? String(destCity).trim() : null,
        airline: airline ? String(airline).trim() : null,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      await persistLiveSession(row);
      res.json({ ...publicLiveSession(row), shareCode });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Create live share failed' });
    }
  });

  app.get('/live/:code', async (req, res) => {
    try {
      purgeExpiredLive();
      const code = normalizeTogetherCode(req.params.code);
      const session = await loadLiveSession(code);
      const flightNumber = session?.flightNumber || (looksLikeFlightNumber(code) ? code : null);
      if (!flightNumber) {
        return res.status(404).json({ error: LIVE_UNAVAILABLE });
      }
      let raw = null;
      try {
        raw = await fetchFlightRaw(flightNumber);
      } catch (e) {
        console.warn('[live] flight fetch failed:', e.message);
      }
      if (!raw && !session) {
        return res.status(503).json({ error: LIVE_UNAVAILABLE });
      }
      const flight = parseLiveFlight(raw || {}, session || { flightNumber });
      if (!flight.flightNumber) flight.flightNumber = flightNumber;
      res.json({
        session: session ? publicLiveSession(session) : null,
        flight,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      res.status(503).json({ error: LIVE_UNAVAILABLE });
    }
  });

  app.post('/race', (req, res) => {
    try {
      purgeExpiredRaces();
      const { deviceId, displayName, flight } = req.body || {};
      if (!deviceId || !flight?.flightNumber) {
        return res.status(400).json({ error: 'deviceId and flight required' });
      }
      let code = genRaceCode();
      while (raceRooms.has(code)) code = genRaceCode();
      const now = new Date();
      const room = {
        id: `race-${now.getTime()}`,
        code,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        participants: [raceParticipantRow(deviceId, displayName, flight)],
      };
      raceRooms.set(code, room);
      res.json(publicRaceRoom(room));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Create race failed' });
    }
  });

  app.get('/race/:code', (req, res) => {
    purgeExpiredRaces();
    const code = normalizeRaceCode(req.params.code);
    const room = raceRooms.get(code);
    if (!room || new Date(room.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ error: 'Race not found' });
    }
    res.json(publicRaceRoom(room));
  });

  app.post('/race/:code/join', (req, res) => {
    try {
      purgeExpiredRaces();
      const code = normalizeRaceCode(req.params.code);
      const room = raceRooms.get(code);
      if (!room || new Date(room.expiresAt).getTime() <= Date.now()) {
        return res.status(404).json({ error: 'Race not found' });
      }
      const { deviceId, displayName, flight } = req.body || {};
      if (!deviceId || !flight?.flightNumber) {
        return res.status(400).json({ error: 'deviceId and flight required' });
      }
      const idx = room.participants.findIndex(p => p.device_id === deviceId);
      const row = raceParticipantRow(deviceId, displayName, flight);
      if (idx >= 0) room.participants[idx] = { ...room.participants[idx], ...row, id: room.participants[idx].id };
      else {
        if (room.participants.length >= 8) return res.status(409).json({ error: 'Race full' });
        room.participants.push(row);
      }
      res.json(publicRaceRoom(room));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Join race failed' });
    }
  });

  app.patch('/race/:code/participant', (req, res) => {
    try {
      purgeExpiredRaces();
      const code = normalizeRaceCode(req.params.code);
      const room = raceRooms.get(code);
      if (!room) return res.status(404).json({ error: 'Race not found' });
      const { deviceId, patch } = req.body || {};
      const p = room.participants.find(x => x.device_id === deviceId);
      if (!p) return res.status(404).json({ error: 'Participant not found' });
      if (patch?.status != null) p.status = patch.status;
      if (patch?.etaIso != null) p.eta_iso = patch.etaIso;
      if (patch?.landedAtIso != null) p.landed_at_iso = patch.landedAtIso;
      if (patch?.lat != null) p.lat = patch.lat;
      if (patch?.lon != null) p.lon = patch.lon;
      if (patch?.delayMin != null) p.delay_min = patch.delayMin;
      if (patch?.progressPct != null) p.progress_pct = patch.progressPct;
      res.json(publicRaceRoom(room));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Update failed' });
    }
  });

  app.get('/country/:code', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) return res.status(400).json({ error: 'ISO country code required' });
      const data = await extrasCached(`cc:${code}`, 7 * 24 * 60 * 60 * 1000, async () => {
        const r = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=name,capital,languages,currencies,idd,cca2,flag,flags`);
        if (!r.ok) return null;
        const json = await r.json();
        return Array.isArray(json) ? json[0] : json;
      });
      if (!data) return res.status(404).json({ error: 'Country not found' });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Country lookup failed' });
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/airports/search', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);

    const scored = [];
    for (const a of airports) {
      const iata = a.iata.toLowerCase();
      const name = a.name.toLowerCase();
      const city = a.municipality.toLowerCase();
      let score = 0;
      if (iata === q) score = 100;
      else if (iata.startsWith(q)) score = 80;
      else if (iata.includes(q)) score = 60;
      else if (city.startsWith(q)) score = 50;
      else if (name.startsWith(q)) score = 40;
      else if (city.includes(q) || name.includes(q)) score = 20;
      else continue;
      scored.push({ score, a });
    }
    scored.sort((x, y) => y.score - x.score || x.a.iata.localeCompare(y.a.iata));
    res.json(scored.slice(0, 15).map(s => publicAirport(s.a)));
  });

  app.get('/airports/nearest', (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required numbers' });
    }
    const ranked = airports
      .map(a => ({ a, d: haversineKm(lat, lon, a.lat, a.lon) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, 3)
      .map(x => ({ ...publicAirport(x.a), distanceKm: Math.round(x.d * 10) / 10 }));
    res.json(ranked);
  });

  // Near-me alias: GET /airports/search/term/{lat},{lon}
  app.get('/airports/search/term/:coords', (req, res) => {
    const parts = String(req.params.coords || '').split(',');
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'Expected /airports/search/term/{lat},{lon}' });
    }
    const ranked = airports
      .map(a => ({ a, d: haversineKm(lat, lon, a.lat, a.lon) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, 3)
      .map(x => ({ ...publicAirport(x.a), distanceKm: Math.round(x.d * 10) / 10 }));
    res.json(ranked);
  });

  // Airport delays: GET /airports/:code/delays (IATA or ICAO) — after static /airports/search
  app.get('/airports/:code/delays', async (req, res) => {
    try {
      const raw = String(req.params.code || '').toUpperCase();
      let code = raw;
      if (raw.length === 4) {
        const match = airports.find(a => a.icao === raw);
        if (match) code = match.iata;
      }
      const data = await getAirportDelayStats(code);
      res.json(data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Airport delays failed' });
    }
  });

  app.get('/airports/:code/runways', async (req, res) => {
    try {
      const raw = String(req.params.code || '').toUpperCase();
      const icao = raw.length === 3 ? resolveIcao(raw) : raw;
      if (!icao) return res.status(400).json({ error: 'Missing airport code' });
      const url = `https://aerodatabox.p.rapidapi.com/airports/icao/${encodeURIComponent(icao)}`;
      const { status, text } = await withRateLimit('airport', () => upstreamFetch(url));
      if (status < 200 || status >= 300) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(status).send(text);
      }
      let json;
      try { json = JSON.parse(text); } catch {
        return res.status(502).json({ error: 'Invalid upstream JSON' });
      }
      const runways = Array.isArray(json.runways) ? json.runways : [];
      res.json({
        icao,
        iata: json.iata || '',
        name: json.name || '',
        runways: runways.map(r => ({
          ident: r.ident || r.name || [r.leIdent, r.heIdent].filter(Boolean).join('/') || '',
          lengthM: r.lengthM ?? r.length ?? null,
          surface: r.surface || '',
          lighted: !!r.lighted,
          closed: !!r.closed,
        })).filter(r => r.ident),
        wind: json.wind || null,
      });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Runways failed' });
    }
  });

  /** Register an Expo push token (best-effort in-memory store). */
  app.post('/push/register', (req, res) => {
    const token = String((req.body && req.body.token) || '').trim();
    if (!token || !token.startsWith('ExponentPushToken')) {
      return res.status(400).json({ error: 'Valid Expo push token required' });
    }
    pushTokens.add(token);
    res.json({ ok: true, registered: pushTokens.size });
  });

  /**
   * Forward a notification to Expo Push API.
   * Body: { to, title, body, data?, sound?, priority? }
   * No Expo secret required for basic send — the device push token is the target.
   */
  app.post('/push/send', async (req, res) => {
    try {
      const body = req.body || {};
      const to = String(body.to || '').trim();
      const title = String(body.title || '').trim();
      const message = String(body.body || '').trim();
      if (!to || !title || !message) {
        return res.status(400).json({ error: 'to, title, and body are required' });
      }
      if (to.startsWith('ExponentPushToken')) pushTokens.add(to);

      const payload = {
        to,
        title,
        body: message,
        sound: body.sound || 'default',
        priority: body.priority || 'default',
        data: body.data && typeof body.data === 'object' ? body.data : {},
      };

      const r = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      res.status(r.status).json(json);
    } catch (e) {
      console.error('Push send error:', e.message);
      res.status(502).json({ error: e.message || 'Push send failed' });
    }
  });

  const RADAR_TTL_MS = 12_000;
  /** @type {Map<string, { at:number, payload:any }>} */
  const radarMem = new Map();
  const RADAR_HUBS = [
    [13.6900, 100.7501], [8.1132, 98.3017], [1.3644, 103.9915],
    [2.7456, 101.7099], [-8.75, 115.17], [18.77, 98.96],
  ];

  function radarNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function fetchJsonTimed(url, timeoutMs) {
    const r = await fetch(url, {
      timeout: timeoutMs,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'WaiAirProxy/1.1 (live-radar)',
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function fromOpenSkyStates(states) {
    const out = [];
    for (const s of states || []) {
      if (!Array.isArray(s)) continue;
      const lon = radarNum(s[5]);
      const lat = radarNum(s[6]);
      if (lat == null || lon == null) continue;
      const id = String(s[0] || '').trim();
      if (!id) continue;
      out.push({
        id,
        cs: String(s[1] || id).trim() || id,
        country: String(s[2] || '').trim(),
        lon, lat,
        altM: radarNum(s[7]),
        spdMs: radarNum(s[9]),
        hdg: radarNum(s[10]),
        vr: radarNum(s[11]),
        reg: '',
      });
    }
    return out;
  }

  function fromAdsbAc(list) {
    const out = [];
    for (const a of list || []) {
      if (!a || typeof a !== 'object') continue;
      const lat = radarNum(a.lat);
      const lon = radarNum(a.lon);
      if (lat == null || lon == null) continue;
      const id = String(a.hex || '').trim();
      if (!id) continue;
      const altFt = a.alt_baro === 'ground' ? 0 : radarNum(a.alt_baro);
      const gsKt = radarNum(a.gs);
      const vrFpm = radarNum(a.baro_rate);
      out.push({
        id,
        cs: String(a.flight || id).trim() || id,
        country: '',
        lon, lat,
        altM: altFt == null ? null : altFt / 3.281,
        spdMs: gsKt == null ? null : gsKt / 1.944,
        hdg: radarNum(a.track) != null ? radarNum(a.track) : radarNum(a.true_heading),
        vr: vrFpm == null ? null : vrFpm / 3.281 / 60,
        reg: String(a.r || '').trim(),
      });
    }
    return out;
  }

  async function fetchOpenSkyRadar(bbox) {
    const url = `https://opensky-network.org/api/states/all?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
    const data = await fetchJsonTimed(url, 8000);
    const list = fromOpenSkyStates(data && data.states);
    if (!list.length) throw new Error('OpenSky empty');
    return { aircraft: list, source: 'opensky' };
  }

  async function fetchAdsbAround(lat, lon, distNm = 250) {
    const nm = Math.max(1, Math.min(250, Math.round(distNm)));
    const data = await fetchJsonTimed(
      `https://api.adsb.lol/v2/point/${lat}/${lon}/${nm}`,
      8000,
    );
    const aircraft = fromAdsbAc(data && data.ac);
    if (!aircraft.length) throw new Error('adsb.lol empty');
    return { aircraft, source: 'adsb' };
  }

  async function fetchAdsbRadar() {
    const results = await Promise.allSettled(
      RADAR_HUBS.map(([lat, lon]) =>
        fetchJsonTimed(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`, 8000),
      ),
    );
    const byId = new Map();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const ac of fromAdsbAc(r.value && r.value.ac)) {
        if (!byId.has(ac.id)) byId.set(ac.id, ac);
      }
    }
    const aircraft = [...byId.values()];
    if (!aircraft.length) throw new Error('adsb.lol empty');
    return { aircraft, source: 'adsb' };
  }

  app.get('/fa/flights/:ident', async (req, res) => {
    try {
      if (process.env.EXPO_PUBLIC_FA_ENABLED === 'false') {
        return res.status(503).json({ error: 'disabled' });
      }
      const key = process.env.FLIGHTAWARE_API_KEY || process.env.EXPO_PUBLIC_FLIGHTAWARE_KEY || '';
      if (!key) return res.status(503).json({ error: 'unavailable' });
      const ident = String(req.params.ident || '').replace(/\s+/g, '').toUpperCase();
      if (!ident) return res.status(400).json({ error: 'Missing ident' });
      const today = new Date().toDateString();
      if (!app.locals.faDate || app.locals.faDate !== today) {
        app.locals.faDate = today;
        app.locals.faCalls = 0;
      }
      if ((app.locals.faCalls || 0) >= 200) {
        return res.status(429).json({ error: 'budget' });
      }
      app.locals.faCalls = (app.locals.faCalls || 0) + 1;
      const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(ident)}`;
      const r = await fetch(url, {
        timeout: 8000,
        headers: { 'x-apikey': key, Accept: 'application/json' },
      });
      const text = await r.text();
      res.setHeader('Content-Type', 'application/json');
      res.status(r.status).send(text);
    } catch (e) {
      res.status(502).json({ error: e.message || 'upstream failed' });
    }
  });

  app.get('/radar', async (req, res) => {
    try {
      const bbox = {
        lamin: radarNum(req.query.lamin) ?? 0,
        lomin: radarNum(req.query.lomin) ?? 92,
        lamax: radarNum(req.query.lamax) ?? 28,
        lomax: radarNum(req.query.lomax) ?? 140,
      };
      const lat = radarNum(req.query.lat) ?? (bbox.lamin + bbox.lamax) / 2;
      const lon = radarNum(req.query.lon) ?? (bbox.lomin + bbox.lomax) / 2;
      const memKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      const cached = radarMem.get(memKey);
      if (cached && Date.now() - cached.at < RADAR_TTL_MS) {
        return res.json({ ...cached.payload, cached: true });
      }
      let payload;
      try {
        payload = await fetchOpenSkyRadar(bbox);
      } catch (e) {
        console.warn('[radar] OpenSky failed:', e.message);
        try {
          payload = await fetchAdsbAround(lat, lon, 250);
        } catch (e2) {
          console.warn('[radar] adsb point failed:', e2.message);
          payload = await fetchAdsbRadar();
        }
      }
      if (payload.aircraft.length > 500) {
        payload.aircraft = payload.aircraft
          .map(a => ({ a, d: (a.lat - lat) ** 2 + (a.lon - lon) ** 2 }))
          .sort((x, y) => x.d - y.d)
          .slice(0, 500)
          .map(x => x.a);
      }
      radarMem.set(memKey, { at: Date.now(), payload });
      res.json({ ...payload, cached: false, at: Date.now() });
    } catch (e) {
      console.error('[radar]', e.message);
      const lat = radarNum(req.query.lat);
      const lon = radarNum(req.query.lon);
      const fallback = (lat != null && lon != null) ? radarMem.get(`${lat.toFixed(2)},${lon.toFixed(2)}`) : null;
      if (fallback) return res.json({ ...fallback.payload, cached: true });
      res.status(502).json({ error: e.message || 'Radar fetch failed' });
    }
  });

  app.get('/', (req, res) => {
    res.json({
      status: 'WaiAir proxy running',
      airports: airports.length,
      reliabilityDb: hasDatabase(),
      endpoints: [
        'GET /fids/:iata/:type',
        'GET /flight/:number',
        'GET /schiphol/flights',
        'GET /fa/flights/:ident',
        'GET /radar',
        'GET /health',
        'GET /flights/number/:term/autocomplete',
        'GET /flights/number/:number/stats',
        'GET /airports/:code/delays',
        'GET /airports/:code/runways',
        'GET /aircraft/reg/:registration',
        'GET /airports/search/term/:lat,lon',
        'GET /airports/search',
        'GET /airports/nearest',
        'GET /reliability/health',
        'GET /reliability/all',
        'GET /reliability/flight/:number',
        'GET /reliability/:airlineCode',
        'GET /weather',
        'GET /fx',
        'GET /country/:code',
        'POST /push/register',
        'POST /push/send',
        'POST /live',
        'GET /live/:code',
      ],
    });
  });
}

const PORT = process.env.PORT || 3001;

async function start() {
  // 1) Auto-migrate flight_stats on Railway Postgres BEFORE routes
  try {
    await initDb();
  } catch (err) {
    console.error('[reliability] DB migration failed (continuing without stats):', err.message);
  }
  try {
    await initLiveSharesDb();
  } catch (err) {
    console.error('[live] DB migration failed (continuing with memory/supabase):', err.message);
    liveSharePg = null;
  }

  // 2) Register HTTP routes only after migration attempt
  registerRoutes();

  // 3) Load airports, then listen
  try {
    await loadAirports();
  } catch (err) {
    console.error('Failed to load airports:', err.message);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`✅ WaiAir proxy running on port ${PORT}`));
}

start();
