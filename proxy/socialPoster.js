/**
 * Daily post on X (@waiairapp) at 09:00 Bangkok time (02:00 UTC), one theme per weekday:
 *   Mon flight of the day (AeroDataBox) · Tue busiest airport (AeroDataBox) · Wed aviation headline (NewsAPI)
 *   Thu destination tip (the app's neighbourhood list) · Fri aviation fact · Sat weekend getaway from Bangkok
 *   Sun week recap.
 *
 * Every data source has a fallback, a failed post is retried once after 5 minutes, and nothing here ever throws
 * into the proxy. Each Bangkok day is claimed in Postgres before posting, so a deploy that overlaps 02:00 UTC
 * (two containers) or a restart can never post twice.
 *
 * Needs X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (OAuth 1.0a, app with Read and Write).
 * Optional: NEWS_API_KEY (else Wednesday posts the weekend getaway), SOCIAL_POSTER_ENABLED=false to pause.
 *
 * CLI (with the Railway variables, e.g. `railway run node socialPoster.js …`):
 *   node socialPoster.js --dry-run            all seven posts, composed with live data, nothing posted
 *   node socialPoster.js --post-now [--day=fri] compose and post one now (claims today like the cron does)
 */
'use strict';

const TIME_ZONE = 'Asia/Bangkok';
/** 09:00 in Bangkok (UTC+7, no DST). */
const CRON_UTC = '0 2 * * *';
const MAX_TWEET = 280;
/** X counts every link, bare domains included, as 23 characters (t.co). */
const LINK_WEIGHT = 23;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const SITE = 'waiair.app';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const FACTS = [
  'The world\'s shortest commercial flight is 1.7 minutes between Westray and Papa Westray in Scotland 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Qantas QF9 Perth → London is the world\'s longest non-stop flight at 17h 20min ✈️',
  'Lightning strikes a commercial aircraft approximately once per year on average ⚡',
  'A Boeing 747 has about 6 million parts 🔧',
  'Suvarnabhumi Airport (BKK) handles over 65 million passengers per year 🇹🇭',
  'The cruising altitude of most commercial flights is 35,000 feet (10,668 meters) ☁️',
  'Jet fuel weighs about 0.8 kg per liter — a full 747 carries 200,000 liters ⛽',
  'The fastest commercial flight ever was a BA 747 from New York to London in 5h 13min thanks to a jet stream 💨',
  'There are approximately 100,000 flights per day worldwide on average 🌍',
  'The \'black box\' flight recorder is actually bright orange 🟠',
];

/** Saturday: short hops from Bangkok, with typical non-stop block times. */
const WEEKEND_FROM_BKK = [
  { city: 'Phuket', time: '1h 25m' },
  { city: 'Chiang Mai', time: '1h 15m' },
  { city: 'Koh Samui', time: '1h 5m' },
  { city: 'Krabi', time: '1h 20m' },
  { city: 'Singapore', time: '2h 25m' },
  { city: 'Kuala Lumpur', time: '2h 10m' },
  { city: 'Hanoi', time: '1h 55m' },
  { city: 'Ho Chi Minh City', time: '1h 35m' },
  { city: 'Siem Reap', time: '1h 10m' },
  { city: 'Luang Prabang', time: '1h 35m' },
  { city: 'Hong Kong', time: '2h 50m' },
  { city: 'Bali', time: '4h 20m' },
];

/** Monday when AeroDataBox is down: famous non-stop routes. */
const LONG_HAUL_FALLBACK = [
  { airline: 'Qantas', flight: 'QF9', from: 'Perth (PER)', to: 'London (LHR)', duration: '17h 20m', km: 14499 },
  { airline: 'Singapore Airlines', flight: 'SQ24', from: 'Singapore (SIN)', to: 'New York (JFK)', duration: '18h 40m', km: 15349 },
  { airline: 'Qatar Airways', flight: 'QR920', from: 'Auckland (AKL)', to: 'Doha (DOH)', duration: '17h 30m', km: 14535 },
  { airline: 'Thai Airways', flight: 'TG910', from: 'Bangkok (BKK)', to: 'London (LHR)', duration: '13h 10m', km: 9540 },
];

/** Tuesday: the airports with the most flights (aircraft movements); the day's schedule picks the winner. */
const BUSIEST_CANDIDATES = [
  { iata: 'ATL', name: 'Hartsfield–Jackson Atlanta' },
  { iata: 'DFW', name: 'Dallas Fort Worth' },
  { iata: 'DEN', name: 'Denver International' },
  { iata: 'ORD', name: 'Chicago O\'Hare' },
  { iata: 'CLT', name: 'Charlotte Douglas' },
];

const BKK_LOCATION = { lat: 13.69, lon: 100.75 };

// ---------- Text helpers ----------

/** The Bangkok calendar day and weekday for a moment. */
function bangkokDay(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  return { ymd, day: parts.weekday.toLowerCase().slice(0, 3) };
}

/** Whole weeks since 1970 on the Bangkok calendar: turns the fact list over once a week. */
function weekNumber(ymd) {
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / (7 * 86400000));
}

const LINK_RE = /https?:\/\/\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:app|com|org|net|io|co|news)\b(?:\/\S*)?/gi;
const WEIGHT_ONE = [[0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037]];

/** Length as X counts it (twitter-text v3): links 23, emoji 2, CJK 2 per character, Latin/Thai 1. */
function tweetLength(text) {
  let n = 0;
  const rest = String(text || '').replace(LINK_RE, () => { n += LINK_WEIGHT; return ''; });
  const graphemes = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(rest), s => s.segment)
    : Array.from(rest);
  for (const g of graphemes) {
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g)) { n += 2; continue; }
    for (const ch of g) {
      const cp = ch.codePointAt(0);
      n += WEIGHT_ONE.some(([lo, hi]) => cp >= lo && cp <= hi) ? 1 : 2;
    }
  }
  return n;
}

/**
 * Fits a post into 280: only the variable part (a headline, a list) is shortened, a whole word at a time,
 * so the template — and waiair.app in it — always stays intact.
 */
function fitTweet(build, flex = '') {
  const full = build(flex);
  if (tweetLength(full) <= MAX_TWEET) return full;
  const words = String(flex).split(/\s+/).filter(Boolean);
  while (words.length > 1) {
    words.pop();
    const shorter = `${words.join(' ').replace(/[\s,.;:!?–—-]+$/, '')}…`;
    const text = build(shorter);
    if (tweetLength(text) <= MAX_TWEET) return text;
  }
  return build('');
}

/** "Thai Airways" → "#ThaiAirways", "Ho Chi Minh City" → "#HoChiMinhCity". */
function hashtag(s) {
  const tag = String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  return tag ? `#${tag}` : '';
}

function formatDuration(minutes) {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

function formatKm(km) {
  return Math.round(km).toLocaleString('en-US');
}

function haversineKm(a, b) {
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

// ---------- The seven templates ----------

function mondayPost({ airline, flight, from, to, duration, km }) {
  return fitTweet(() => [
    '✈️ Flight of the day:',
    `${airline} ${flight} ${from} → ${to}`,
    `${duration} · ${formatKm(km)}km`,
    'Track it live in WaiAir 👇',
    SITE,
    ['#aviation', '#flight', hashtag(airline)].filter(Boolean).join(' '),
  ].join('\n'));
}

function tuesdayPost({ name, iata, count }) {
  return fitTweet(() => [
    '🏆 Busiest airport today:',
    `${name} (${iata})`,
    `${Number(count).toLocaleString('en-US')} flights scheduled`,
    `Track any flight: ${SITE}`,
    '#airport #aviation #travel',
  ].join('\n'));
}

function tuesdayFallbackPost() {
  return fitTweet(() => [
    '🏆 The world\'s busiest airport by passengers:',
    'Hartsfield–Jackson Atlanta (ATL)',
    `Track any flight: ${SITE}`,
    '#airport #aviation #travel',
  ].join('\n'));
}

function wednesdayPost({ title, url }) {
  return fitTweet(headline => [
    `🚨 ${headline}`,
    '',
    'Stay updated with WaiAir ✈️',
    SITE,
    '',
    '#aviation #airline #travel',
    url,
  ].filter(line => line !== undefined).join('\n'), title);
}

function thursdayPost({ city, areas, iata }) {
  return fitTweet(() => [
    `🌍 Flying to ${city}?`,
    '',
    'Top neighbourhoods:',
    ...areas.slice(0, 3),
    '',
    'Find the best restaurants with',
    'WaiAir Pro ✈️',
    SITE,
    '',
    [hashtag(city), '#travel', iata ? `#${iata}` : ''].filter(Boolean).join(' '),
  ].join('\n'));
}

function fridayPost(fact) {
  return fitTweet(text => [
    '✈️ Did you know?',
    '',
    text,
    '',
    '#aviationfacts #aviation #travel',
    SITE,
  ].join('\n'), fact);
}

function saturdayPost({ city, time }) {
  return fitTweet(() => [
    '🌴 Weekend getaway from Bangkok:',
    '',
    city,
    `${time} away ✈️`,
    '',
    'Find flights in WaiAir 👇',
    SITE,
    '',
    '#Bangkok #travel #weekend',
  ].join('\n'));
}

function sundayPost() {
  return fitTweet(() => [
    '✈️ How many flights did you track',
    'this week?',
    '',
    'WaiAir tracks flights worldwide —',
    'real-time status, hotels & restaurants',
    'at your destination 🏨',
    '',
    `Download free: ${SITE}`,
    '',
    '#aviation #travel #flighttracker',
  ].join('\n'));
}

// ---------- Live data ----------

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function adbTime(t) {
  const raw = t && (t.utc || t.local);
  if (!raw) return NaN;
  return Date.parse(String(raw).replace(' ', 'T').replace(/Z?$/, t.utc ? 'Z' : ''));
}

function cityLabel(airport) {
  const city = airport?.municipalityName || airport?.shortName || airport?.name || '';
  const iata = airport?.iata || '';
  return city && iata ? `${city} (${iata})` : (city || iata);
}

/**
 * Monday: the longest flight leaving Bangkok today (great-circle distance to each destination on the board,
 * from `airportLocation`), then that flight's own record for the exact distance and block time.
 * Two AeroDataBox calls.
 */
async function flightOfTheDay({ adbGet, ymd, airportLocation }) {
  if (typeof airportLocation !== 'function') throw new Error('no airport locations');
  const board = await adbGet(
    `/flights/airports/iata/BKK/${ymd}T08:00/${ymd}T19:59`
    + '?direction=Departure&withLeg=false&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false',
  );
  const deps = (parseJson(board.text)?.departures || [])
    .map(f => ({ f, loc: airportLocation(f?.movement?.airport?.iata) }))
    .filter(x => x.loc && Number.isFinite(x.loc.lat) && Number.isFinite(x.loc.lon) && x.f.number);
  if (board.status < 200 || board.status >= 300 || !deps.length) throw new Error(`no BKK departures (HTTP ${board.status})`);
  deps.sort((a, b) => haversineKm(BKK_LOCATION, b.loc) - haversineKm(BKK_LOCATION, a.loc));
  const longest = deps[0].f;
  const number = String(longest.number).replace(/\s+/g, '');
  const detail = await adbGet(`/flights/number/${encodeURIComponent(number)}/${ymd}?withAircraftImage=false&withLocation=false`);
  const legs = parseJson(detail.text);
  const leg = (Array.isArray(legs) ? legs : []).find(l => l?.departure?.airport?.iata === 'BKK');
  if (!leg) throw new Error(`no record for ${number}`);
  const minutes = (adbTime(leg.arrival?.scheduledTime) - adbTime(leg.departure?.scheduledTime)) / 60000;
  const km = leg.greatCircleDistance?.km;
  if (!(minutes > 0) || !(km > 0)) throw new Error(`incomplete record for ${number}`);
  return {
    airline: leg.airline?.name || longest.airline?.name || '',
    flight: String(leg.number || number).replace(/\s+/g, ''),
    from: cityLabel(leg.departure.airport),
    to: cityLabel(leg.arrival.airport),
    duration: formatDuration(minutes),
    km,
  };
}

/**
 * Tuesday: today's scheduled flights (arrivals + departures, no codeshare duplicates) at the airports with
 * the most aircraft movements; the one with the most wins. Two 12-hour AeroDataBox windows per airport.
 */
async function busiestAirport({ adbGet, ymd }) {
  let best = null;
  for (const ap of BUSIEST_CANDIDATES) {
    let count = 0;
    for (const [from, to] of [['00:00', '11:59'], ['12:00', '23:59']]) {
      const r = await adbGet(
        `/flights/airports/iata/${ap.iata}/${ymd}T${from}/${ymd}T${to}`
        + '?direction=Both&withLeg=false&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false',
      );
      const body = r.status >= 200 && r.status < 300 ? parseJson(r.text) : null;
      if (!body) throw new Error(`${ap.iata} board failed (HTTP ${r.status})`);
      count += (body.departures?.length || 0) + (body.arrivals?.length || 0);
    }
    if (!best || count > best.count) best = { ...ap, count };
  }
  if (!best || !best.count) throw new Error('no flights counted');
  return best;
}

/** Wednesday: the newest English aviation headline (NewsAPI). */
async function topHeadline({ fetchFn, apiKey }) {
  if (!apiKey) throw new Error('NEWS_API_KEY is not set');
  const params = new URLSearchParams({
    q: 'aviation OR airline OR airport',
    language: 'en',
    sortBy: 'publishedAt',
    // A few, not one: NewsAPI marks deleted articles "[Removed]"; the first real one is taken.
    pageSize: '5',
  });
  const res = await fetchFn(`https://newsapi.org/v2/everything?${params}`, { headers: { 'X-Api-Key': apiKey } });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== 'ok') throw new Error(`NewsAPI ${res.status} ${body?.code || ''}`.trim());
  const article = (body.articles || []).find(a => a?.title && a?.url && !/\[removed\]/i.test(a.title));
  if (!article) throw new Error('NewsAPI returned no usable article');
  return { title: String(article.title).trim(), url: article.url };
}

// ---------- Composing a day ----------

/**
 * The post for a weekday, with live data where the day has it and the fallback when that fails.
 * Resolves to { day, kind, text, source } — never rejects.
 */
async function composePost({ day, ymd, deps }) {
  const { adbGet, airportLocation, fetchFn, newsApiKey, cities, rng = Math.random, log = console } = deps;
  const warn = (what, e) => log.warn(`[social] ${what} failed, using the fallback: ${e?.message || e}`);
  switch (day) {
    case 'mon':
      try {
        return { day, kind: 'flight_of_the_day', source: 'aerodatabox', text: mondayPost(await flightOfTheDay({ adbGet, ymd, airportLocation })) };
      } catch (e) {
        warn('flight of the day', e);
        return { day, kind: 'flight_of_the_day', source: 'fallback', text: mondayPost(LONG_HAUL_FALLBACK[weekNumber(ymd) % LONG_HAUL_FALLBACK.length]) };
      }
    case 'tue':
      try {
        return { day, kind: 'busiest_airport', source: 'aerodatabox', text: tuesdayPost(await busiestAirport({ adbGet, ymd })) };
      } catch (e) {
        warn('busiest airport', e);
        return { day, kind: 'busiest_airport', source: 'fallback', text: tuesdayFallbackPost() };
      }
    case 'wed':
      try {
        return { day, kind: 'aviation_news', source: 'newsapi', text: wednesdayPost(await topHeadline({ fetchFn, apiKey: newsApiKey })) };
      } catch (e) {
        // No headline: the weekend getaway instead (the brief: skip the news, use Saturday's template).
        warn('aviation headline', e);
        return { day, kind: 'weekend_getaway', source: 'fallback', text: saturdayPost(pick(WEEKEND_FROM_BKK, rng)) };
      }
    case 'thu': {
      const city = pick(cities.filter(c => c.areas.length >= 3), rng);
      return { day, kind: 'destination_tip', source: 'neighbourhoods', text: thursdayPost({ city: city.name, areas: city.areas, iata: city.iatas[0] }) };
    }
    case 'fri':
      return { day, kind: 'aviation_fact', source: 'facts', text: fridayPost(FACTS[weekNumber(ymd) % FACTS.length]) };
    case 'sat':
      return { day, kind: 'weekend_getaway', source: 'list', text: saturdayPost(pick(WEEKEND_FROM_BKK, rng)) };
    default:
      return { day: 'sun', kind: 'week_recap', source: 'static', text: sundayPost() };
  }
}

// ---------- Posting ----------

function xCredentials(env) {
  const creds = {
    appKey: env.X_API_KEY,
    appSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessSecret: env.X_ACCESS_TOKEN_SECRET,
  };
  return Object.values(creds).every(Boolean) ? creds : null;
}

/** One day = one post: claimed in Postgres when there is a database, in memory otherwise. */
function createSocialPostStore(pool) {
  const mem = new Map();
  return {
    async init() {
      if (!pool) return;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS social_posts (
          day DATE PRIMARY KEY,
          kind TEXT,
          text TEXT,
          tweet_id TEXT,
          status TEXT NOT NULL,
          error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
    },
    /** True only for the first caller of the day. */
    async claim(ymd) {
      if (!pool) {
        if (mem.has(ymd)) return false;
        mem.set(ymd, { status: 'claimed' });
        return true;
      }
      const r = await pool.query(
        `INSERT INTO social_posts (day, status) VALUES ($1, 'claimed') ON CONFLICT (day) DO NOTHING RETURNING day`,
        [ymd],
      );
      return r.rowCount === 1;
    },
    async update(ymd, fields) {
      if (!pool) {
        mem.set(ymd, { ...(mem.get(ymd) || {}), ...fields });
        return;
      }
      await pool.query(
        `UPDATE social_posts SET kind = $2, text = $3, tweet_id = $4, status = $5, error = $6, updated_at = NOW() WHERE day = $1`,
        [ymd, fields.kind ?? null, fields.text ?? null, fields.tweetId ?? null, fields.status, fields.error ?? null],
      );
    },
  };
}

/**
 * The daily job. Every dependency is injectable for the tests; run() and the retry never throw.
 */
function createSocialPoster({
  env = process.env,
  adbGet,
  airportLocation,
  fetchFn = globalThis.fetch,
  cities = [],
  store = createSocialPostStore(null),
  twitterFactory = creds => new (require('twitter-api-v2').TwitterApi)(creds),
  now = () => new Date(),
  rng = Math.random,
  setTimeoutFn = setTimeout,
  retryDelayMs = RETRY_DELAY_MS,
  log = console,
} = {}) {
  const stamp = () => now().toISOString();
  const info = msg => log.log(`[social ${stamp()}] ${msg}`);
  const warn = msg => log.warn(`[social ${stamp()}] ${msg}`);

  function enabled() {
    if (String(env.SOCIAL_POSTER_ENABLED || '').toLowerCase() === 'false') return { ok: false, why: 'SOCIAL_POSTER_ENABLED=false' };
    if (!xCredentials(env)) return { ok: false, why: 'X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET not all set' };
    return { ok: true };
  }

  async function tweet(text) {
    const client = twitterFactory(xCredentials(env));
    const res = await client.v2.tweet(text);
    return res?.data?.id || null;
  }

  /** Posts once, and once more after the retry delay if X fails. Resolves when done; never rejects. */
  function postWithRetry(ymd, post) {
    return new Promise(resolve => {
      const attempt = async (n) => {
        try {
          const id = await tweet(post.text);
          info(`posted ${post.kind} (${post.day}, ${post.source}) id=${id} ${tweetLength(post.text)}/280:\n${post.text}`);
          await store.update(ymd, { ...post, tweetId: id, status: 'posted' }).catch(e => warn(`store update failed: ${e.message}`));
          resolve({ ok: true, id });
        } catch (e) {
          const why = e?.data?.detail || e?.data?.title || e?.message || String(e);
          if (n === 1) {
            warn(`X rejected the ${post.kind} post (${why}); retrying in ${Math.round(retryDelayMs / 60000)} min`);
            setTimeoutFn(() => { attempt(2); }, retryDelayMs);
            return;
          }
          warn(`X rejected the ${post.kind} post again (${why}); giving up for today`);
          await store.update(ymd, { ...post, status: 'failed', error: why.slice(0, 500) }).catch(() => {});
          resolve({ ok: false, error: why });
        }
      };
      attempt(1);
    });
  }

  /** Today's post (or `day` for a manual run). */
  async function run({ day } = {}) {
    try {
      const gate = enabled();
      if (!gate.ok) {
        warn(`not posting: ${gate.why}`);
        return { ok: false, skipped: gate.why };
      }
      const today = bangkokDay(now());
      if (!(await store.claim(today.ymd))) {
        info(`already posted (or posting) for ${today.ymd}; skipping`);
        return { ok: false, skipped: 'already claimed' };
      }
      const post = await composePost({
        day: day || today.day,
        ymd: today.ymd,
        deps: { adbGet, airportLocation, fetchFn, newsApiKey: env.NEWS_API_KEY, cities, rng, log },
      });
      return await postWithRetry(today.ymd, post);
    } catch (e) {
      warn(`run failed: ${e?.message || e}`);
      return { ok: false, error: e?.message || String(e) };
    }
  }

  return { run, enabled };
}

/** Schedules the daily post at 02:00 UTC (09:00 Bangkok). Returns the cron task, or null if not scheduled. */
function scheduleSocialPoster(poster, { cron = require('node-cron'), log = console } = {}) {
  const gate = poster.enabled();
  // Scheduled even when disabled, so adding the X keys on Railway (which redeploys) is all it takes; run()
  // checks again and only logs while the keys are missing.
  const task = cron.schedule(CRON_UTC, () => { poster.run(); }, { timezone: 'Etc/UTC', name: 'social-poster' });
  log.log(`[social] daily X post scheduled: "${CRON_UTC}" UTC (09:00 Bangkok)${gate.ok ? '' : ` — not posting yet: ${gate.why}`}`);
  return task;
}

/** AeroDataBox GET for the CLI (the proxy passes its own budgeted fetch). */
function directAdbGet(env) {
  return async (path) => {
    if (!env.RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY is not set');
    const res = await fetch(`https://aerodatabox.p.rapidapi.com${path}`, {
      headers: { 'x-rapidapi-key': env.RAPIDAPI_KEY, 'x-rapidapi-host': 'aerodatabox.p.rapidapi.com' },
    });
    return { status: res.status, text: await res.text() };
  };
}

/** The CLI's airport coordinates (the proxy passes its own, loaded from the same OurAirports file). */
async function loadAirportLocations(url = 'https://davidmegginson.github.io/ourairports-data/airports.csv') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`airports CSV ${res.status}`);
  const lines = (await res.text()).split(/\r?\n/);
  const splitCsv = line => {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = !quoted;
      } else if (c === ',' && !quoted) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const head = splitCsv(lines[0]);
  const col = name => head.indexOf(name);
  const [iataCol, latCol, lonCol] = [col('iata_code'), col('latitude_deg'), col('longitude_deg')];
  const byIata = new Map();
  for (const line of lines.slice(1)) {
    const row = splitCsv(line);
    const iata = (row[iataCol] || '').trim().toUpperCase();
    const lat = Number(row[latCol]);
    const lon = Number(row[lonCol]);
    if (iata && Number.isFinite(lat) && Number.isFinite(lon) && !byIata.has(iata)) byIata.set(iata, { lat, lon });
  }
  return iata => byIata.get(String(iata || '').toUpperCase()) || null;
}

function loadCities() {
  return require('./data/neighbourhoods.json');
}

module.exports = {
  CRON_UTC,
  DAYS,
  FACTS,
  WEEKEND_FROM_BKK,
  LONG_HAUL_FALLBACK,
  bangkokDay,
  weekNumber,
  tweetLength,
  fitTweet,
  hashtag,
  formatDuration,
  mondayPost,
  tuesdayPost,
  tuesdayFallbackPost,
  wednesdayPost,
  thursdayPost,
  fridayPost,
  saturdayPost,
  sundayPost,
  flightOfTheDay,
  busiestAirport,
  topHeadline,
  composePost,
  createSocialPostStore,
  createSocialPoster,
  scheduleSocialPoster,
  directAdbGet,
  loadAirportLocations,
  loadCities,
};

// ---------- CLI ----------

if (require.main === module) {
  (async () => {
    try { require('dotenv').config(); } catch { /* optional */ }
    const args = process.argv.slice(2);
    const dayArg = (args.find(a => a.startsWith('--day=')) || '').slice(6).toLowerCase() || null;
    const airportLocation = await loadAirportLocations().catch((e) => {
      console.warn(`[social] airport locations unavailable (${e.message}); Monday will use its fallback`);
      return null;
    });
    const deps = {
      adbGet: directAdbGet(process.env),
      airportLocation,
      fetchFn: globalThis.fetch,
      newsApiKey: process.env.NEWS_API_KEY,
      cities: loadCities(),
    };
    const { ymd, day } = bangkokDay(new Date());
    if (args.includes('--dry-run')) {
      const days = dayArg ? [dayArg] : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      for (const d of days) {
        const post = await composePost({ day: d, ymd, deps });
        console.log(`\n━━ ${d.toUpperCase()} · ${post.kind} · ${post.source} · ${tweetLength(post.text)}/280 ━━\n${post.text}`);
      }
      return;
    }
    if (args.includes('--post-now')) {
      let pool = null;
      if (process.env.DATABASE_URL) {
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      }
      const store = createSocialPostStore(pool);
      await store.init();
      const poster = createSocialPoster({ adbGet: deps.adbGet, airportLocation, cities: deps.cities, store });
      const result = await poster.run({ day: dayArg || day });
      console.log(result);
      if (pool) await pool.end();
      return;
    }
    console.log('usage: node socialPoster.js --dry-run [--day=mon] | --post-now [--day=fri]');
  })().catch(e => { console.error(e); process.exitCode = 1; });
}
