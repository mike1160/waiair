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

function registerRoutes() {
  app.get('/fids/:iata/:type', async (req, res) => {
    try {
      const { iata, type } = req.params;
      const iataUp = String(iata || '').toUpperCase();
      const dir = type === 'arrival' ? 'Arrival' : 'Departure';
      const offsetDays = Number(req.query.offsetDays || 0) || 0;
      const dateParam = String(req.query.date || '').trim();
      const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : (offsetDays ? fidsLocalWindow(iataUp, offsetDays).date : null);
      const cacheKey = `${iataUp}:${dir}:${dateKey || offsetDays || 0}`;
      const cached = fidsResponseCache.get(cacheKey);
      if (cached && Date.now() - cached.at < FIDS_CACHE_TTL_MS) {
        console.log('[AeroDataBox FIDS] cache hit', cacheKey, '| ageMs', Date.now() - cached.at);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-WaiAir-Cache', 'HIT');
        return res.status(cached.status).send(cached.text);
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
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-WaiAir-Cache', 'MISS');
          return res.status(lastStatus >= 400 ? lastStatus : 502).send('{}');
        }
        const text = mergeFidsBodies(parts, dir);
        fidsResponseCache.set(cacheKey, { at: Date.now(), status: 200, text });
        recordFidsStatsAsync(text, iata, type);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-WaiAir-Cache', 'MISS');
        return res.status(200).send(text);
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
  /** @type {{ at:number, payload:any } | null} */
  let radarMem = null;
  const RADAR_HUBS = [
    [13.75, 100.50], [8.11, 98.31], [1.35, 103.82],
    [2.75, 101.71], [-8.75, 115.17], [18.77, 98.96],
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
      if (radarMem && Date.now() - radarMem.at < RADAR_TTL_MS) {
        return res.json({ ...radarMem.payload, cached: true });
      }
      const bbox = {
        lamin: radarNum(req.query.lamin) ?? 0,
        lomin: radarNum(req.query.lomin) ?? 92,
        lamax: radarNum(req.query.lamax) ?? 28,
        lomax: radarNum(req.query.lomax) ?? 140,
      };
      let payload;
      try {
        payload = await fetchOpenSkyRadar(bbox);
      } catch (e) {
        console.warn('[radar] OpenSky failed:', e.message);
        payload = await fetchAdsbRadar();
      }
      if (payload.aircraft.length > 500) {
        const lat = 13.75, lon = 100.5;
        payload.aircraft = payload.aircraft
          .map(a => ({ a, d: (a.lat - lat) ** 2 + (a.lon - lon) ** 2 }))
          .sort((x, y) => x.d - y.d)
          .slice(0, 500)
          .map(x => x.a);
      }
      radarMem = { at: Date.now(), payload };
      res.json({ ...payload, cached: false, at: Date.now() });
    } catch (e) {
      console.error('[radar]', e.message);
      if (radarMem) return res.json({ ...radarMem.payload, cached: true });
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
