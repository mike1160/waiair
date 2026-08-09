const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const {
  initDb,
  hasDatabase,
  recordFidsStatsAsync,
  getAirlineReliability,
  getAllAirlinesReliability,
  getFlightDetail,
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

const RAPID_HEADERS = {
  'x-rapidapi-key': 'd55444508amshfe589145463437ep1c7ea4jsn67f0e0ed8e2d',
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

app.get('/fids/:iata/:type', async (req, res) => {
  try {
    const { iata, type } = req.params;
    const icao = resolveIcao(iata);
    const dir = type === 'arrival' ? 'Arrival' : 'Departure';
    // Local airport time (UTC+7 Thailand) — most airports in the app are Thai
    const thaiOffset = 7 * 3600000;
    const localNow = Date.now() + thaiOffset;
    const from = new Date(localNow - 1 * 3600000).toISOString().slice(0, 16).replace('T', '%20');
    // AeroDataBox max window is 12h; -1h..+11h stays within limit
    const to = new Date(localNow + 11 * 3600000).toISOString().slice(0, 16).replace('T', '%20');
    const url = `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${icao}/${from}/${to}?direction=${dir}&withCodeshared=true&withCargo=false&withPrivate=false&withLocation=false`;

    console.log('Fetching:', url);
    const { status, text } = await withRateLimit('fids', () => upstreamFetch(url));
    console.log('Status:', status, '| Response:', text.slice(0, 150));
    // Persist reliability stats without blocking the client response
    if (status >= 200 && status < 300) {
      recordFidsStatsAsync(text, iata, type);
    }
    res.setHeader('Content-Type', 'application/json');
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

// Global flight-number search (any airport)
app.get('/flight/:number', async (req, res) => {
  try {
    const number = String(req.params.number || '').replace(/\s+/g, '').toUpperCase();
    if (!number) return res.status(400).json({ error: 'Missing flight number' });
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}?withAircraftImage=false&withLocation=false&withFlightPlan=false`;
    console.log('Fetching flight:', url);
    const { status, text } = await withRateLimit('flight', () => upstreamFetch(url));
    console.log('Flight status:', status, '| Response:', text.slice(0, 150));
    res.setHeader('Content-Type', 'application/json');
    res.status(status).send(text);
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// SE Asia bbox — shared by /radar and /api/aircraft
const OPENSKY_URL = 'https://opensky-network.org/api/states/all?lamin=0&lomin=92&lamax=28&lomax=140';
const OPENSKY_TIMEOUT_MS = 12000;
const OPENSKY_CACHE_MS = 15000;
/** @type {{ at:number, data:any } | null} */
let openskyCache = null;

async function fetchOpenSkyStates() {
  if (openskyCache && Date.now() - openskyCache.at < OPENSKY_CACHE_MS) {
    return openskyCache.data;
  }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, OPENSKY_TIMEOUT_MS);
  try {
    const opts = {
      headers: { Accept: 'application/json', 'User-Agent': 'WaiAir/1.0' },
      timeout: OPENSKY_TIMEOUT_MS, // node-fetch v2
    };
    if (ctrl) opts.signal = ctrl.signal;
    const r = await fetch(OPENSKY_URL, opts);
    if (!r.ok) throw new Error(`OpenSky ${r.status}`);
    const data = await r.json();
    openskyCache = { at: Date.now(), data };
    return data;
  } finally {
    clearTimeout(timer);
  }
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

// OpenSky radar proxy (avoids browser CORS)
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
    .map(x => publicAirport(x.a));
  res.json(ranked);
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
      'GET /radar',
      'GET /api/aircraft',
      'GET /airports/search',
      'GET /airports/nearest',
      'GET /reliability/health',
      'GET /reliability/all',
      'GET /reliability/flight/:number',
      'GET /reliability/:airlineCode',
      'POST /push/register',
      'POST /push/send',
    ],
  });
});

const PORT = process.env.PORT || 3001;

loadAirports()
  .then(() => initDb().catch(err => {
    console.error('[reliability] DB init failed (continuing without stats):', err.message);
    return false;
  }))
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`✅ WaiAir proxy running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to load airports:', err.message);
    process.exit(1);
  });
