const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../docs/liff-core.js');

const NOW = Date.parse('2026-09-14T03:00:00Z'); // 10:00 in Bangkok

function boardItem(number, schedLocal, schedUtc, extra = {}) {
  return {
    number,
    status: 'Expected',
    airline: { name: 'Thai Airways' },
    movement: {
      airport: { iata: 'HKT', municipalityName: 'Phuket' },
      scheduledTime: { local: schedLocal, utc: schedUtc },
      ...extra.movement,
    },
    ...extra.item,
  };
}

function flexParts(msg) {
  const texts = [];
  const buttons = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text') texts.push(node);
    if (node.type === 'button') buttons.push(node.action);
    Object.values(node).forEach(walk);
  })(msg.contents);
  return { texts, buttons };
}

test('normalizeFlightNumber accepts real flight numbers only', () => {
  assert.equal(core.normalizeFlightNumber('tg 202'), 'TG202');
  assert.equal(core.normalizeFlightNumber('3k-531'), '3K531');
  assert.equal(core.normalizeFlightNumber('U2123'), 'U2123');
  assert.equal(core.normalizeFlightNumber('1234'), '');
  assert.equal(core.normalizeFlightNumber('TG'), '');
  assert.equal(core.normalizeFlightNumber('<script>'), '');
});

test('parseQuery reads ?flight=, legacy ?f= and LIFF liff.state deep links', () => {
  assert.deepEqual(core.parseQuery('?flight=tg403'), { flight: 'TG403', airport: '', dir: 'departure' });
  assert.deepEqual(core.parseQuery('?f=tg202'), { flight: 'TG202', airport: '', dir: 'departure' });
  assert.deepEqual(core.parseQuery('?liff.state=%3Fflight%3DTG403'), { flight: 'TG403', airport: '', dir: 'departure' });
  assert.deepEqual(core.parseQuery('?a=bkk&d=arrivals'), { flight: '', airport: 'BKK', dir: 'arrival' });
  assert.deepEqual(core.parseQuery(''), { flight: '', airport: '', dir: 'departure' });
});

test('clock keeps airport-local time', () => {
  assert.equal(core.clock('2026-09-14 10:25+07:00'), '10:25');
  assert.equal(core.clock('2026-09-14T23:05Z'), '23:05');
  assert.equal(core.clock(''), '');
});

test('statusKey mirrors the app status mapping', () => {
  assert.equal(core.statusKey('Arrived', 0), 'landed');
  assert.equal(core.statusKey('Canceled', 0), 'cancelled');
  assert.equal(core.statusKey('EnRoute', 0), 'enRoute');
  assert.equal(core.statusKey('Approaching', 0), 'enRoute');
  assert.equal(core.statusKey('GateClosed', 0), 'boarding');
  assert.equal(core.statusKey('Expected', 20), 'delayed');
  assert.equal(core.statusKey('Expected', 3), 'scheduled');
  assert.equal(core.statusKey('CanceledUncertain', 0), 'scheduled');
  assert.equal(core.statusKey('Diverted', 0), 'diverted');
});

test('flightSummary picks the leg nearest now and computes the delay', () => {
  const items = [
    {
      number: 'TG 202', status: 'Expected', airline: { name: 'Thai Airways' },
      departure: { airport: { iata: 'BKK', municipalityName: 'Bangkok' }, scheduledTime: { utc: '2026-09-15 03:00Z', local: '2026-09-15 10:00+07:00' } },
      arrival: { airport: { iata: 'HKT' } },
    },
    {
      number: 'TG 202', status: 'Expected', airline: { name: 'Thai Airways' },
      departure: {
        airport: { iata: 'BKK', municipalityName: 'Bangkok' },
        scheduledTime: { utc: '2026-09-14 03:30Z', local: '2026-09-14 10:30+07:00' },
        revisedTime: { utc: '2026-09-14 03:55Z', local: '2026-09-14 10:55+07:00' },
        gate: 'C4', terminal: '1',
      },
      arrival: { airport: { iata: 'HKT', municipalityName: 'Phuket' }, scheduledTime: { utc: '2026-09-14 04:50Z', local: '2026-09-14 11:50+07:00' } },
    },
  ];
  const f = core.flightSummary(core.pickFlight(items, NOW));
  assert.equal(f.number, 'TG202');
  assert.equal(f.depTime, '10:55');
  assert.equal(f.arrTime, '11:50');
  assert.equal(f.depDate, '1409');
  assert.equal(f.delayMin, 25);
  assert.equal(f.status, 'delayed');
  assert.equal(f.gate, 'C4');
  assert.equal(core.statusLine(f, 'en'), 'Delayed · 25 min');
  assert.equal(core.statusLine(f, 'th-TH'), 'ล่าช้า · 25 นาที');
});

test('boardRows skips codeshares and duplicates, sorts by scheduled time', () => {
  const body = {
    departures: [
      boardItem('TG 204', '2026-09-14 11:00+07:00', '2026-09-14 04:00Z'),
      boardItem('TG 202', '2026-09-14 10:30+07:00', '2026-09-14 03:30Z', {
        movement: { revisedTime: { local: '2026-09-14 10:50+07:00', utc: '2026-09-14 03:50Z' }, gate: 'C4' },
      }),
      boardItem('LH 5000', '2026-09-14 10:30+07:00', '2026-09-14 03:30Z', { item: { codeshareStatus: 'IsCodeshared' } }),
      boardItem('TG 204', '2026-09-14 11:00+07:00', '2026-09-14 04:00Z'),
    ],
  };
  const rows = core.boardRows(body, 'departure');
  assert.deepEqual(rows.map((r) => r.number), ['TG202', 'TG204']);
  assert.equal(rows[0].time, '10:30');
  assert.equal(rows[0].expected, '10:50');
  assert.equal(rows[0].status, 'delayed');
  assert.equal(rows[0].remoteCity, 'Phuket');
  assert.deepEqual(core.boardRows({ arrivals: [] }, 'departure'), []);
});

test('upcomingRows drops long-gone flights but keeps late ones', () => {
  const rows = core.boardRows({
    departures: [
      boardItem('TG 100', '2026-09-14 08:00+07:00', '2026-09-14 01:00Z'),
      boardItem('TG 101', '2026-09-14 08:30+07:00', '2026-09-14 01:30Z', {
        movement: { revisedTime: { utc: '2026-09-14 02:40Z' } },
      }),
      boardItem('TG 102', '2026-09-14 09:30+07:00', '2026-09-14 02:30Z'),
    ],
  }, 'departure');
  assert.deepEqual(core.upcomingRows(rows, NOW).map((r) => r.number), ['TG101', 'TG102']);
});

test('errorInfo maps proxy limits and misses to messages', () => {
  assert.deepEqual(core.errorInfo(429, { error: 'rate_limited', retryAfterMin: 7 }), { key: 'rateLimited', params: { n: 7 } });
  assert.deepEqual(core.errorInfo(503, { error: 'cost_guard', retryAfterMin: 2 }), { key: 'rateLimited', params: { n: 2 } });
  assert.deepEqual(core.errorInfo(404, null), { key: 'notFound' });
  assert.deepEqual(core.errorInfo(400, null, 'boardEmpty'), { key: 'boardEmpty' });
  assert.deepEqual(core.errorInfo(502, { error: 'upstream_failed' }), { key: 'unavailable' });
  assert.equal(core.format(core.STRINGS.en.rateLimited, { n: 7 }), 'Too many searches. Try again in 7 min.');
});

test('shareLink opens the LIFF page with the flight preloaded', () => {
  assert.equal(core.shareLink('tg403'), 'https://waiair.app/liff?flight=TG403');
  assert.equal(core.shareLink('<bad>'), 'https://waiair.app/liff');
  assert.equal(core.parseQuery(new URL(core.shareLink('TG403')).search).flight, 'TG403');
});

test('bookingUrl builds an Aviasales route search with the affiliate marker', () => {
  const f = { from: 'BKK', to: 'HKT', depDate: '1409' };
  assert.equal(core.bookingUrl(f, 'th'), 'https://www.aviasales.com/search/BKK1409HKT1?marker=564311&currency=thb');
  assert.equal(core.bookingUrl(f, 'en'), 'https://www.aviasales.com/search/BKK1409HKT1?marker=564311&currency=usd');
  assert.equal(core.bookingUrl({ ...f, to: '' }, 'en'), '');
  assert.equal(core.bookingUrl({ ...f, depDate: '' }, 'en'), '');
  assert.equal(core.bookingUrl({ ...f, to: 'BKK' }, 'en'), '');
});

test('flightFlexMessage: coloured status badge, delay badge, live + book buttons', () => {
  const f = {
    number: 'TG403', airline: 'Thai Airways', from: 'BKK', fromCity: 'Bangkok', to: 'SIN', toCity: 'Singapore',
    depTime: '11:05', arrTime: '14:30', depDate: '1409', gate: 'D2', terminal: '', delayMin: 70, status: 'delayed',
  };
  const link = core.shareLink(f.number);
  for (const lang of ['en', 'th']) {
    const msg = core.flightFlexMessage(f, lang, link);
    const { texts, buttons } = flexParts(msg);
    assert.equal(msg.type, 'flex');
    assert.equal(msg.contents.type, 'bubble');
    assert.ok(msg.altText.length > 0 && msg.altText.length <= 400);
    assert.ok(texts.every((t) => typeof t.text === 'string' && t.text.length > 0), `empty text in ${lang}`);
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].uri, 'https://waiair.app/liff?flight=TG403');
    assert.equal(buttons[1].uri, core.bookingUrl(f, lang));
    assert.ok(buttons.every((b) => b.label.length <= 20));
    assert.ok(texts[0].text.includes('WaiAir'));
  }
  const en = core.flightFlexMessage(f, 'en', link).contents.body.contents;
  assert.equal(en[0].contents[1].backgroundColor, '#F59E0B');
  assert.equal(en[1].backgroundColor, '#EF4444'); // 70 min → red
  assert.equal(en[1].contents[0].text, '⚠️ 70 min delay');
  assert.equal(core.flightFlexMessage(f, 'th', link).contents.body.contents[1].contents[0].text, '⚠️ ล่าช้า 70 นาที');
});

test('flightFlexMessage: status colours, no delay badge once landed, no book button without a route', () => {
  const base = {
    number: 'TG202', airline: '', from: 'BKK', fromCity: '', to: '', toCity: '',
    depTime: '', arrTime: '', depDate: '', gate: '', terminal: '', delayMin: 0, status: 'enRoute',
  };
  const badgeColor = (f) => core.flightFlexMessage(f, 'en', core.shareLink(f.number)).contents.body.contents[0].contents[1].backgroundColor;
  assert.equal(badgeColor(base), '#3B82F6');
  assert.equal(badgeColor({ ...base, status: 'landed' }), '#22C55E');
  assert.equal(badgeColor({ ...base, status: 'cancelled' }), '#EF4444');

  const landedLate = core.flightFlexMessage({ ...base, status: 'landed', delayMin: 30 }, 'en', core.shareLink('TG202'));
  const { texts, buttons } = flexParts(landedLate);
  assert.ok(!texts.some((t) => t.text.includes('⚠️')));
  assert.ok(texts.every((t) => t.text.length > 0));
  assert.equal(buttons.length, 1);
  assert.match(core.lineTextShareUrl(base, 'en', core.shareLink('TG202')), /^https:\/\/line\.me\/R\/share\?text=TG202%20BKK/);
});

test('Thai and English copy have the same keys', () => {
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(core.STRINGS.th), keys(core.STRINGS.en));
  assert.deepEqual(keys(core.STRINGS.th.status), keys(core.STRINGS.en.status));
  assert.equal(core.pickLang('th-TH'), 'th');
  assert.equal(core.pickLang('en-US'), 'en');
  assert.equal(core.pickLang('nl'), 'en');
});
