const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
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

// ─── OpenSky OAuth2 (client credentials) ─────────────────────────────────────
const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OPENSKY_SEA_URL =
  'https://opensky-network.org/api/states/all?lamin=0&lomin=92&lamax=28&lomax=140';

let openskyToken = null;
let openskyTokenExpiry = 0;

async function getOpenskyToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID || '';
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    console.warn('[OpenSky] OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET not set — unauthenticated requests');
    return null;
  }
  if (openskyToken && Date.now() < openskyTokenExpiry) return openskyToken;

  try {
    const response = await fetch(OPENSKY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!response.ok || !data.access_token) {
      console.error('[OpenSky] token error', response.status, text.slice(0, 200));
      return null;
    }
    openskyToken = data.access_token;
    const expiresIn = Number(data.expires_in) || 1800;
    openskyTokenExpiry = Date.now() + expiresIn * 1000 - 60_000;
    console.log('[OpenSky] token refreshed, expires in', expiresIn, 's');
    return openskyToken;
  } catch (e) {
    console.error('[OpenSky] token error:', e.message);
    return null;
  }
}

async function openskyFetch(url) {
  const token = await getOpenskyToken();
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'WaiAir/1.0',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, timeout: 12000 });
  const remaining = response.headers.get('X-Rate-Limit-Remaining');
  if (remaining) console.log('[OpenSky] credits remaining:', remaining);
  if (response.status === 401) {
    // force refresh once
    openskyToken = null;
    openskyTokenExpiry = 0;
    const retryToken = await getOpenskyToken();
    if (retryToken) {
      headers.Authorization = `Bearer ${retryToken}`;
      return fetch(url, { headers, timeout: 12000 });
    }
  }
  return response;
}

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

function fidsLocalWindow(iata) {
  const tz = IATA_TZ[String(iata || '').toUpperCase()] || 'UTC';
  const now = Date.now();
  // AeroDataBox max window = 12h. Look back 6h so recently departed/landed
  // flights stay on the board (was -1h, which dropped SQ731 within ~1h of takeoff).
  const from = formatAirportLocal(new Date(now - 6 * 3600000), tz).replace(' ', '%20');
  const to = formatAirportLocal(new Date(now + 6 * 3600000), tz).replace(' ', '%20');
  return { from, to, tz };
}

function registerRoutes() {
  app.get('/fids/:iata/:type', async (req, res) => {
    try {
      const { iata, type } = req.params;
      const iataUp = String(iata || '').toUpperCase();
      const dir = type === 'arrival' ? 'Arrival' : 'Departure';
      const cacheKey = `${iataUp}:${dir}`;
      const cached = fidsResponseCache.get(cacheKey);
      if (cached && Date.now() - cached.at < FIDS_CACHE_TTL_MS) {
        console.log('[AeroDataBox FIDS] cache hit', cacheKey, '| ageMs', Date.now() - cached.at);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-WaiAir-Cache', 'HIT');
        return res.status(cached.status).send(cached.text);
      }

      const icao = resolveIcao(iata);
      const { from, to, tz } = fidsLocalWindow(iataUp);
      const endpoint = `/flights/airports/icao/${icao}/${from}/${to}`;
      const url = `https://aerodatabox.p.rapidapi.com${endpoint}?direction=${dir}&withCodeshared=true&withCargo=false&withPrivate=false&withLocation=false`;

      console.log('[AeroDataBox FIDS] endpoint:', endpoint, '| tz:', tz, '| dir:', dir, '| window: -6h..+6h');

      const { status, text } = await withRateLimit('fids', () => upstreamFetch(url));
      console.log('[AeroDataBox FIDS] HTTP', status, '| bytes', text.length, '|', iataUp, dir);

      if (status >= 200 && status < 300) {
        fidsResponseCache.set(cacheKey, { at: Date.now(), status, text });
        recordFidsStatsAsync(text, iata, type);
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-WaiAir-Cache', 'MISS');
      res.status(status).send(text);
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

  // SE Asia bbox — shared by /radar, /api/aircraft, /opensky/*
  const OPENSKY_TIMEOUT_MS = 12000;
  const OPENSKY_CACHE_MS = 15000;
  /** @type {{ at:number, data:any } | null} */
  let openskyCache = null;

  async function fetchOpenSkyStates() {
    if (openskyCache && Date.now() - openskyCache.at < OPENSKY_CACHE_MS) {
      return openskyCache.data;
    }
    const r = await openskyFetch(OPENSKY_SEA_URL);
    if (!r.ok) throw new Error(`OpenSky ${r.status}`);
    const data = await r.json();
    openskyCache = { at: Date.now(), data };
    return data;
  }

  function normalizeCallsign(raw) {
    return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function findStateByCallsign(states, needle) {
    const n = normalizeCallsign(needle);
    if (!n || !Array.isArray(states)) return null;
    return states.find((s) => {
      const cs = normalizeCallsign(s && s[1]);
      if (!cs) return false;
      return cs === n || cs.startsWith(n) || n.startsWith(cs);
    }) || null;
  }

  function simplifyAircraft(data) {
    const states = Array.isArray(data && data.states) ? data.states : [];
    const aircraft = [];
    for (const s of states) {
      const lon = Number(s[5]);
      const lat = Number(s[6]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (s[8] === true) continue; // on ground
      aircraft.push({
        icao24: s[0] || '',
        callsign: String(s[1] || '').trim(),
        lat,
        lon,
        heading: Number.isFinite(Number(s[10])) ? Number(s[10]) : 0,
        altitude: s[7] == null ? null : Number(s[7]),
      });
    }
    return aircraft;
  }

  function openskyErrorMessage(e) {
    if (e.name === 'AbortError' || e.type === 'request-timeout') return 'OpenSky timeout';
    return e.message || 'OpenSky fetch failed';
  }

  // OpenSky: live status by ATC callsign (e.g. SIA735) or flight number prefix
  app.get('/opensky/callsign/:callsign', async (req, res) => {
    try {
      const callsign = normalizeCallsign(req.params.callsign);
      if (!callsign) return res.status(400).json({ found: false, error: 'Missing callsign' });
      const data = await fetchOpenSkyStates();
      if (!data.states) return res.json({ found: false, reason: 'no states' });

      const match = findStateByCallsign(data.states, callsign);
      if (!match) return res.json({ found: false, reason: 'not in SEA airspace' });

      const onGround = !!match[8];
      const altitude = match[7] == null ? null : Number(match[7]);
      res.json({
        found: true,
        icao24: match[0],
        callsign: String(match[1] || '').trim(),
        latitude: match[6],
        longitude: match[5],
        altitude,
        on_ground: onGround,
        velocity: match[9],
        heading: match[10],
        last_contact: match[4],
        live_status: onGround ? 'on_ground' : 'airborne',
      });
    } catch (e) {
      console.error('[OpenSky] callsign error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/opensky/region/sea', async (req, res) => {
    try {
      const data = await fetchOpenSkyStates();
      res.json(data);
    } catch (e) {
      console.error('[OpenSky] radar error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // OpenSky radar proxy (avoids browser CORS) — alias of /opensky/region/sea
  app.get('/radar', async (req, res) => {
    try {
      const data = await fetchOpenSkyStates();
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: openskyErrorMessage(e) });
    }
  });

  /** Simplified live aircraft for the marketing map */
  app.get('/api/aircraft', async (req, res) => {
    try {
      const data = await fetchOpenSkyStates();
      const aircraft = simplifyAircraft(data);
      res.json({ count: aircraft.length, aircraft });
    } catch (e) {
      res.status(502).json({ error: openskyErrorMessage(e) });
    }
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      openskyAuth: !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET),
    });
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

  app.get('/', (req, res) => {
    res.json({
      status: 'WaiAir proxy running',
      airports: airports.length,
      reliabilityDb: hasDatabase(),
      endpoints: [
        'GET /fids/:iata/:type',
        'GET /flight/:number',
        'GET /opensky/callsign/:callsign',
        'GET /opensky/region/sea',
        'GET /radar',
        'GET /api/aircraft',
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
        'POST /push/register',
        'POST /push/send',
      ],
      openskyAuth: !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET),
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
