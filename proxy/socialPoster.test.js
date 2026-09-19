const test = require('node:test');
const assert = require('node:assert/strict');
const sp = require('./socialPoster');

const cities = sp.loadCities();
const quietLog = { log() {}, warn() {} };

test('bangkokDay: 02:00 UTC is 09:00 in Bangkok, on the Bangkok calendar day', () => {
  assert.deepEqual(sp.bangkokDay(new Date('2026-09-19T02:00:00Z')), { ymd: '2026-09-19', day: 'sat' });
  // 20:00 UTC Sunday is already Monday in Bangkok.
  assert.deepEqual(sp.bangkokDay(new Date('2026-09-20T20:00:00Z')), { ymd: '2026-09-21', day: 'mon' });
  assert.equal(sp.CRON_UTC, '0 2 * * *');
});

test('tweetLength: links (bare waiair.app too) count 23, emoji 2, CJK 2 per character, Thai 1', () => {
  assert.equal(sp.tweetLength('abc'), 3);
  assert.equal(sp.tweetLength('waiair.app'), 23);
  assert.equal(sp.tweetLength('https://example.com/a/very/long/path?x=1'), 23);
  assert.equal(sp.tweetLength('✈️'), 2);
  assert.equal(sp.tweetLength('🏴󠁧󠁢󠁳󠁣󠁴󠁿'), 2);
  assert.equal(sp.tweetLength('ไทย'), 3);
  assert.equal(sp.tweetLength('日本'), 4);
});

test('fitTweet: shortens only the variable part, a whole word at a time, and keeps waiair.app', () => {
  const headline = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
  const text = sp.wednesdayPost({ title: headline, url: 'https://news.example.com/story' });
  assert.ok(sp.tweetLength(text) <= 280, `too long: ${sp.tweetLength(text)}`);
  assert.match(text, /waiair\.app/);
  assert.match(text, /https:\/\/news\.example\.com\/story$/);
  const firstLine = text.split('\n')[0];
  assert.match(firstLine, /^🚨 word0 .*word\d+…$/);
  assert.doesNotMatch(firstLine, /wor…$/);
});

test('hashtag and durations', () => {
  assert.equal(sp.hashtag('Thai Airways'), '#ThaiAirways');
  assert.equal(sp.hashtag('Ho Chi Minh City'), '#HoChiMinhCity');
  assert.equal(sp.hashtag('São Paulo'), '#SaoPaulo');
  assert.equal(sp.hashtag(''), '');
  assert.equal(sp.formatDuration(785), '13h 5m');
  assert.equal(sp.formatDuration(45), '45m');
});

test('every template, every city and every fact fits 280 and carries waiair.app', () => {
  const posts = [
    ...sp.LONG_HAUL_FALLBACK.map(sp.mondayPost),
    sp.tuesdayPost({ name: 'Hartsfield–Jackson Atlanta', iata: 'ATL', count: 2345 }),
    sp.tuesdayFallbackPost(),
    sp.wednesdayPost({ title: 'Short headline', url: 'https://example.com/x' }),
    ...cities.map(c => sp.thursdayPost({ city: c.name, areas: c.areas, iata: c.iatas[0] })),
    ...sp.FACTS.map(sp.fridayPost),
    ...sp.WEEKEND_FROM_BKK.map(sp.saturdayPost),
    sp.sundayPost(),
  ];
  assert.ok(cities.length >= 134);
  for (const p of posts) {
    assert.ok(sp.tweetLength(p) <= 280, `${sp.tweetLength(p)}: ${p}`);
    assert.match(p, /waiair\.app/);
  }
  // The facts are posted whole, never cut.
  for (const fact of sp.FACTS) assert.ok(sp.fridayPost(fact).includes(fact));
});

test('templates: Monday and Thursday read as briefed', () => {
  assert.equal(
    sp.mondayPost({ airline: 'Thai Airways', flight: 'TG910', from: 'Bangkok (BKK)', to: 'London (LHR)', duration: '13h 10m', km: 9540 }),
    '✈️ Flight of the day:\nThai Airways TG910 Bangkok (BKK) → London (LHR)\n13h 10m · 9,540km\nTrack it live in WaiAir 👇\nwaiair.app\n#aviation #flight #ThaiAirways',
  );
  const thu = sp.thursdayPost({ city: 'Chiang Mai', areas: ['Nimman', 'Old City', 'Santitham', 'Night Bazaar'], iata: 'CNX' });
  assert.match(thu, /^🌍 Flying to Chiang Mai\?\n\nTop neighbourhoods:\nNimman\nOld City\nSantitham\n\n/);
  assert.match(thu, /#ChiangMai #travel #CNX$/);
});

function adbFake(routes) {
  const calls = [];
  const get = async (path) => {
    calls.push(path);
    for (const [re, reply] of routes) {
      if (re.test(path)) return typeof reply === 'function' ? reply(path) : reply;
    }
    return { status: 404, text: '' };
  };
  return { get, calls };
}

test('flightOfTheDay: the farthest departure from BKK, with its own distance and block time', async () => {
  const board = {
    departures: [
      { number: 'TG 103', airline: { name: 'Thai Airways' }, movement: { airport: { iata: 'CNX' } } },
      { number: 'TG 910', airline: { name: 'Thai Airways' }, movement: { airport: { iata: 'LHR' } } },
      { number: 'TG 600', airline: { name: 'Thai Airways' }, movement: { airport: { iata: 'HKG' } } },
      { number: 'XX 1', airline: { name: 'Unknown' }, movement: { airport: { iata: 'ZZZ' } } },
    ],
  };
  const leg = [{
    number: 'TG 910',
    airline: { name: 'Thai Airways' },
    greatCircleDistance: { km: 9541.2 },
    departure: { airport: { iata: 'BKK', municipalityName: 'Bangkok' }, scheduledTime: { utc: '2026-09-21 05:25Z' } },
    arrival: { airport: { iata: 'LHR', municipalityName: 'London' }, scheduledTime: { utc: '2026-09-21 18:35Z' } },
  }];
  const adb = adbFake([
    [/^\/flights\/airports\/iata\/BKK\//, { status: 200, text: JSON.stringify(board) }],
    [/^\/flights\/number\/TG910\//, { status: 200, text: JSON.stringify(leg) }],
  ]);
  const where = { CNX: { lat: 18.77, lon: 98.96 }, LHR: { lat: 51.47, lon: -0.45 }, HKG: { lat: 22.3, lon: 113.9 } };
  const f = await sp.flightOfTheDay({ adbGet: adb.get, ymd: '2026-09-21', airportLocation: iata => where[iata] || null });
  assert.deepEqual(f, { airline: 'Thai Airways', flight: 'TG910', from: 'Bangkok (BKK)', to: 'London (LHR)', duration: '13h 10m', km: 9541.2 });
  assert.equal(adb.calls.length, 2);
  assert.match(adb.calls[0], /withCodeshared=false/);
});

test('busiestAirport: sums both 12h windows, arrivals and departures, and takes the most', async () => {
  const counts = { ATL: 700, DFW: 800, DEN: 500, ORD: 600, CLT: 400 };
  const adb = adbFake([[/^\/flights\/airports\/iata\/([A-Z]{3})\//, (path) => {
    const iata = path.match(/iata\/([A-Z]{3})/)[1];
    const n = counts[iata];
    return { status: 200, text: JSON.stringify({ departures: new Array(n).fill({}), arrivals: new Array(n).fill({}) }) };
  }]]);
  const best = await sp.busiestAirport({ adbGet: adb.get, ymd: '2026-09-22' });
  assert.equal(best.iata, 'DFW');
  assert.equal(best.count, 3200);
  assert.equal(adb.calls.length, 10);
});

test('topHeadline: skips "[Removed]" articles; needs a key', async () => {
  const fetchFn = async (url, opts) => {
    assert.match(url, /q=aviation\+OR\+airline\+OR\+airport/);
    assert.match(url, /language=en/);
    assert.match(url, /sortBy=publishedAt/);
    assert.equal(opts.headers['X-Api-Key'], 'k');
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', articles: [{ title: '[Removed]', url: 'https://removed.com' }, { title: 'Airline orders jets', url: 'https://n.example.com/a' }] }),
    };
  };
  assert.deepEqual(await sp.topHeadline({ fetchFn, apiKey: 'k' }), { title: 'Airline orders jets', url: 'https://n.example.com/a' });
  await assert.rejects(sp.topHeadline({ fetchFn, apiKey: '' }), /NEWS_API_KEY/);
});

test('composePost: every day produces a post, with fallbacks when the sources fail', async () => {
  const deps = {
    adbGet: async () => { throw new Error('AeroDataBox down'); },
    fetchFn: async () => { throw new Error('offline'); },
    newsApiKey: 'k',
    cities,
    rng: () => 0,
    log: quietLog,
  };
  const results = {};
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    results[day] = await sp.composePost({ day, ymd: '2026-09-21', deps });
    assert.ok(sp.tweetLength(results[day].text) <= 280);
    assert.match(results[day].text, /waiair\.app/);
  }
  assert.equal(results.mon.source, 'fallback');
  assert.equal(results.tue.source, 'fallback');
  assert.equal(results.wed.kind, 'weekend_getaway');
  assert.equal(results.thu.kind, 'destination_tip');
  assert.equal(results.fri.kind, 'aviation_fact');
  assert.equal(results.sun.kind, 'week_recap');
});

test('composePost: Wednesday without NEWS_API_KEY posts the weekend getaway', async () => {
  const post = await sp.composePost({ day: 'wed', ymd: '2026-09-23', deps: { cities, rng: () => 0, log: quietLog } });
  assert.equal(post.kind, 'weekend_getaway');
  assert.match(post.text, /^🌴 Weekend getaway from Bangkok:/);
});

const X_ENV = { X_API_KEY: 'a', X_API_SECRET: 'b', X_ACCESS_TOKEN: 'c', X_ACCESS_TOKEN_SECRET: 'd' };

function fakeTwitter(outcomes) {
  const sent = [];
  return {
    sent,
    factory: () => ({
      v2: {
        tweet: async (text) => {
          sent.push(text);
          const next = outcomes.shift();
          if (next instanceof Error) throw next;
          return { data: { id: next || 'id1', text } };
        },
      },
    }),
  };
}

test('poster: without all four X keys it does not post, and says why', async () => {
  const tw = fakeTwitter([]);
  const poster = sp.createSocialPoster({ env: { X_API_KEY: 'a' }, twitterFactory: tw.factory, cities, log: quietLog });
  const r = await poster.run();
  assert.match(r.skipped, /X_API_KEY/);
  assert.equal(tw.sent.length, 0);
  const paused = sp.createSocialPoster({ env: { ...X_ENV, SOCIAL_POSTER_ENABLED: 'false' }, twitterFactory: tw.factory, cities, log: quietLog });
  assert.match((await paused.run()).skipped, /SOCIAL_POSTER_ENABLED/);
});

test('poster: posts once per Bangkok day, even when run twice', async () => {
  const tw = fakeTwitter(['111']);
  const store = sp.createSocialPostStore(null);
  const make = () => sp.createSocialPoster({
    env: X_ENV, twitterFactory: tw.factory, store, cities, log: quietLog,
    now: () => new Date('2026-09-20T02:00:00Z'), // Sunday 09:00 Bangkok
  });
  const first = await make().run();
  const second = await make().run();
  assert.deepEqual(first, { ok: true, id: '111' });
  assert.equal(second.skipped, 'already claimed');
  assert.equal(tw.sent.length, 1);
  assert.match(tw.sent[0], /^✈️ How many flights did you track/);
});

test('poster: an X failure is retried once after 5 minutes, then given up without throwing', async () => {
  const timers = [];
  const setTimeoutFn = (fn, ms) => { timers.push(ms); setImmediate(fn); };
  const ok = fakeTwitter([new Error('503'), '222']);
  const r1 = await sp.createSocialPoster({ env: X_ENV, twitterFactory: ok.factory, cities, log: quietLog, setTimeoutFn,
    now: () => new Date('2026-09-25T02:00:00Z') }).run();
  assert.deepEqual(r1, { ok: true, id: '222' });
  assert.deepEqual(timers, [5 * 60 * 1000]);
  assert.equal(ok.sent.length, 2);

  const bad = fakeTwitter([new Error('403 forbidden'), new Error('403 forbidden')]);
  const r2 = await sp.createSocialPoster({ env: X_ENV, twitterFactory: bad.factory, cities, log: quietLog, setTimeoutFn,
    now: () => new Date('2026-09-26T02:00:00Z') }).run();
  assert.equal(r2.ok, false);
  assert.match(r2.error, /403/);
  assert.equal(bad.sent.length, 2);
});

test('poster: a broken store or data source never throws out of run()', async () => {
  const tw = fakeTwitter([]);
  const store = { claim: async () => { throw new Error('db down'); }, update: async () => {} };
  const r = await sp.createSocialPoster({ env: X_ENV, twitterFactory: tw.factory, store, cities, log: quietLog }).run();
  assert.equal(r.ok, false);
  assert.match(r.error, /db down/);
});
