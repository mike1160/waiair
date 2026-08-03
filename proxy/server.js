const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
app.use(cors());

const RAPID_HEADERS = {
  'x-rapidapi-key': 'd55444508amshfe589145463437ep1c7ea4jsn67f0e0ed8e2d',
  'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
};

// IATA -> ICAO mapping voor SEA luchthavens
const ICAO = {
  BKK:'VTBS', DMK:'VTBD', HKT:'VTSP', CNX:'VTCC', HDY:'VTSS',
  USM:'VTSM', KBV:'VTSG', UTP:'VTBU', SIN:'WSSS', KUL:'WMKK',
  PEN:'WMKP', BKI:'WBKK', SGN:'VVTS', HAN:'VVNB', DAD:'VVDN',
  PQC:'VVPQ', CGK:'WIII', DPS:'WADD', SUB:'WARR', MNL:'RPLL',
  CEB:'RPVM', PNH:'VDPP', REP:'VDSR', RGN:'VYYY', VTE:'VLVT', BWN:'WBSB'
};

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

app.get('/fids/:iata/:type', async (req, res) => {
  try {
    const { iata, type } = req.params;
    const icao = ICAO[iata.toUpperCase()] || iata;
    const dir = type === 'arrival' ? 'Arrival' : 'Departure';
    // Local airport time (UTC+7 Thailand) — most airports in the app are Thai
    const thaiOffset = 7 * 3600000;
    const localNow = Date.now() + thaiOffset;
    const from = new Date(localNow - 1*3600000).toISOString().slice(0,16).replace('T','%20');
    // AeroDataBox max window is 12h; -1h..+11h stays within limit
    const to   = new Date(localNow + 11*3600000).toISOString().slice(0,16).replace('T','%20');
    const url  = `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${icao}/${from}/${to}?direction=${dir}&withCodeshared=true&withCargo=false&withPrivate=false&withLocation=false`;

    console.log('Fetching:', url);
    const { status, text } = await withRateLimit('fids', () => upstreamFetch(url));
    console.log('Status:', status, '| Response:', text.slice(0,150));
    res.setHeader('Content-Type','application/json');
    res.status(status).send(text);
  } catch(e) {
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
    console.log('Flight status:', status, '| Response:', text.slice(0,150));
    res.setHeader('Content-Type','application/json');
    res.status(status).send(text);
  } catch(e) {
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
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'WaiAir proxy running' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ WaiAir proxy running on port ${PORT}`));
