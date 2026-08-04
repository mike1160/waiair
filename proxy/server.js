const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
app.use(cors());

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
    res.setHeader('Content-Type', 'application/json');
    res.status(status).send(text);
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
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

// OpenSky radar proxy (avoids browser CORS)
app.get('/radar', async (req, res) => {
  try {
    const url = 'https://opensky-network.org/api/states/all?lamin=0&lomin=92&lamax=28&lomax=140';
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
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

app.get('/', (req, res) => {
  res.json({ status: 'WaiAir proxy running', airports: airports.length });
});

const PORT = process.env.PORT || 3001;

loadAirports()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`✅ WaiAir proxy running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to load airports:', err.message);
    process.exit(1);
  });
