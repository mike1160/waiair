/**
 * Pure helpers for the WaiAir LINE (LIFF) page, docs/liff.html.
 * No DOM and no LIFF SDK here — loaded as window.WaiAirLiff in the browser
 * and via require() in scripts/liffCore.test.js.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WaiAirLiff = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PROXY = 'https://waiair-production.up.railway.app';
  var SITE = 'https://waiair.app';
  var APP_STORE_URL = 'https://apps.apple.com/app/waiair/id6798072839';
  var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.waiair.WaiAir';
  /** Aviasales search deeplinks take the Travelpayouts trs as marker (same as lib/aviasales.ts). */
  var AVIASALES_MARKER = '564311';
  /** Our LINE users fly out of Bangkok, so "Book flight" searches always start at one of these. */
  var BANGKOK_AIRPORTS = ['BKK', 'DMK'];
  /** Rows older than this (vs. now) drop off the airport board. */
  var BOARD_GRACE_MIN = 45;
  var BOARD_ROW_CAP = 80;

  var STRINGS = {
    en: {
      title: 'Flight status',
      tabFlight: 'Flight',
      tabAirport: 'Airport',
      flightPlaceholder: 'Flight number, e.g. TG202',
      airportPlaceholder: 'Airport code, e.g. BKK',
      search: 'Search',
      departures: 'Departures',
      arrivals: 'Arrivals',
      departure: 'Departure',
      arrival: 'Arrival',
      gate: 'Gate',
      terminal: 'Terminal',
      delay: 'Delay',
      minutes: '{n} min',
      expected: 'Exp. {t}',
      share: 'Share in LINE',
      shared: 'Sent in LINE',
      updated: 'Updated {t}',
      loading: 'Loading…',
      invalidFlight: 'Enter a flight number like TG202.',
      invalidAirport: 'Enter a 3-letter airport code like BKK.',
      notFound: 'Flight not found. Check the number and try again.',
      boardEmpty: 'No flights found',
      rateLimited: 'Too many searches. Try again in {n} min.',
      unavailable: 'Live data is unavailable right now. Try again shortly.',
      getApp: 'Get the WaiAir app',
      liveStatus: 'Live status',
      bookFlight: 'Book flight',
      delayBadge: '⚠️ {n} min delay',
      status: {
        scheduled: 'Scheduled',
        boarding: 'Boarding',
        delayed: 'Delayed',
        enRoute: 'En Route',
        landed: 'Landed',
        cancelled: 'Cancelled',
        diverted: 'Diverted',
      },
    },
    th: {
      title: 'สถานะเที่ยวบิน',
      tabFlight: 'เที่ยวบิน',
      tabAirport: 'สนามบิน',
      flightPlaceholder: 'หมายเลขเที่ยวบิน เช่น TG202',
      airportPlaceholder: 'รหัสสนามบิน เช่น BKK',
      search: 'ค้นหา',
      departures: 'ขาออก',
      arrivals: 'ขาเข้า',
      departure: 'ขาออก',
      arrival: 'ขาเข้า',
      gate: 'ประตูขึ้นเครื่อง',
      terminal: 'อาคารผู้โดยสาร',
      delay: 'ล่าช้า',
      minutes: '{n} นาที',
      expected: 'คาดว่า {t}',
      share: 'แชร์ใน LINE',
      shared: 'ส่งใน LINE แล้ว',
      updated: 'อัปเดตเมื่อ {t}',
      loading: 'กำลังโหลด…',
      invalidFlight: 'กรอกหมายเลขเที่ยวบิน เช่น TG202',
      invalidAirport: 'กรอกรหัสสนามบิน 3 ตัวอักษร เช่น BKK',
      notFound: 'ไม่พบเที่ยวบิน ตรวจสอบหมายเลขแล้วลองอีกครั้ง',
      boardEmpty: 'ไม่พบเที่ยวบิน',
      rateLimited: 'ค้นหาบ่อยเกินไป ลองอีกครั้งใน {n} นาที',
      unavailable: 'ข้อมูลสดไม่พร้อมใช้งานในขณะนี้ ลองอีกครั้งในอีกสักครู่',
      getApp: 'ดาวน์โหลดแอป WaiAir',
      liveStatus: 'ดูสถานะสด',
      bookFlight: 'จองเที่ยวบิน',
      delayBadge: '⚠️ ล่าช้า {n} นาที',
      status: {
        scheduled: 'ตามกำหนดการ',
        boarding: 'กำลังขึ้นเครื่อง',
        delayed: 'ล่าช้า',
        enRoute: 'กำลังเดินทาง',
        landed: 'ลงจอดแล้ว',
        cancelled: 'ยกเลิกแล้ว',
        diverted: 'เปลี่ยนเส้นทาง',
      },
    },
  };

  /** Thai for any th* locale, English otherwise. */
  function pickLang(code) {
    return String(code || '').toLowerCase().indexOf('th') === 0 ? 'th' : 'en';
  }

  function format(template, params) {
    return String(template == null ? '' : template).replace(/\{(\w+)\}/g, function (m, k) {
      return params && params[k] != null ? String(params[k]) : m;
    });
  }

  /** "tg 202" → "TG202"; '' when it doesn't look like a flight number. */
  function normalizeFlightNumber(input) {
    var s = String(input || '').replace(/[\s-]+/g, '').toUpperCase();
    return /^(?:[A-Z]{2,3}|[A-Z]\d|\d[A-Z])\d{1,4}[A-Z]?$/.test(s) ? s : '';
  }

  function normalizeIata(input) {
    var s = String(input || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(s) ? s : '';
  }

  /**
   * Page params: flight (or f), a=airport, d=departure|arrival.
   * liff.line.me/{id}?flight=TG403 links arrive wrapped in liff.state until liff.init() resolves.
   */
  function parseQuery(search) {
    var params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    var state = params.get('liff.state');
    if (state && state.indexOf('?') >= 0) {
      new URLSearchParams(state.slice(state.indexOf('?') + 1)).forEach(function (v, k) {
        if (!params.has(k)) params.set(k, v);
      });
    }
    var dir = String(params.get('d') || '').toLowerCase();
    return {
      flight: normalizeFlightNumber(params.get('flight') || params.get('f')),
      airport: normalizeIata(params.get('a') || params.get('airport')),
      dir: dir === 'arrival' || dir === 'arrivals' ? 'arrival' : 'departure',
    };
  }

  function timeOf(t) {
    return t ? (t.local || t.utc || '') : '';
  }

  /** Most accurate known time for one side of a flight (actual → revised → predicted → scheduled). */
  function bestTime(side) {
    if (!side) return '';
    var keys = ['runwayTime', 'revisedTime', 'predictedTime', 'scheduledTime'];
    for (var i = 0; i < keys.length; i++) {
      var v = timeOf(side[keys[i]]);
      if (v) return v;
    }
    return '';
  }

  /** "2026-09-14 10:25+07:00" → "10:25" — airport-local, as printed on the board. */
  function clock(value) {
    var m = String(value || '').match(/[T ](\d{2}):(\d{2})/);
    return m ? m[1] + ':' + m[2] : '';
  }

  /** "2026-09-14 10:25+07:00" → { day: '2026-09-14', offsetMin: 420 } — airport-local day and UTC offset. */
  function localDay(value) {
    var m = String(value || '').match(/(\d{4}-\d{2}-\d{2})[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?/);
    if (!m) return null;
    var offsetMin = 0;
    if (m[2] && m[2] !== 'Z') {
      var digits = m[2].slice(1).replace(':', '');
      offsetMin = (m[2][0] === '-' ? -1 : 1) * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
    }
    return { day: m[1], offsetMin: offsetMin };
  }

  function epoch(value) {
    var ms = Date.parse(String(value || '').trim().replace(' ', 'T'));
    return isNaN(ms) ? NaN : ms;
  }

  /** Scheduled vs. revised (or predicted) gate time, in whole minutes; never negative. */
  function delayMinutes(side) {
    if (!side) return 0;
    var sched = side.scheduledTime && (side.scheduledTime.utc || side.scheduledTime.local);
    var later = side.revisedTime || side.predictedTime;
    var rev = later && (later.utc || later.local);
    var a = epoch(sched);
    var b = epoch(rev);
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.max(0, Math.round((b - a) / 60000));
  }

  /** AeroDataBox status label → STRINGS.status key (mirrors mapRawStatus in App.tsx). */
  function statusKey(raw, delayMin) {
    var s = String(raw || '').toLowerCase().trim();
    if (s === 'arrived' || s === 'landed') return 'landed';
    if (s === 'canceled' || s === 'cancelled') return 'cancelled';
    if (s.indexOf('divert') >= 0) return 'diverted';
    if (s === 'departed' || s === 'enroute' || s === 'en-route' || s === 'airborne' || s === 'approaching') {
      return 'enRoute';
    }
    if (s.indexOf('board') >= 0 || s.indexOf('gateclosed') >= 0 || s.indexOf('gate closed') >= 0
      || s.indexOf('final call') >= 0 || s.indexOf('last call') >= 0) {
      return 'boarding';
    }
    if (s === 'delayed') return 'delayed';
    return delayMin > 5 ? 'delayed' : 'scheduled';
  }

  function statusTone(key) {
    if (key === 'cancelled' || key === 'diverted') return 'bad';
    if (key === 'delayed') return 'warn';
    if (key === 'landed') return 'done';
    return 'ok';
  }

  function airportCode(ap) {
    return (ap && (ap.iata || ap.icao)) || '';
  }

  function airportCity(ap) {
    return (ap && (ap.municipalityName || ap.shortName || ap.name)) || '';
  }

  /** From /flight/:number results: the leg closest to now. */
  function pickFlight(items, now) {
    var list = (Array.isArray(items) ? items : []).filter(Boolean);
    if (!list.length) return null;
    function distance(item) {
      var dep = item.departure || {};
      var at = epoch(dep.scheduledTime && (dep.scheduledTime.utc || dep.scheduledTime.local));
      return isNaN(at) ? Infinity : Math.abs(at - now);
    }
    return list.slice().sort(function (a, b) { return distance(a) - distance(b); })[0];
  }

  function flightSummary(item) {
    if (!item) return null;
    var dep = item.departure || {};
    var arr = item.arrival || {};
    var delay = delayMinutes(dep);
    var depLocal = localDay(timeOf(dep.scheduledTime));
    var raw = String(item.number || '').replace(/\s+/g, '').toUpperCase();
    return {
      number: normalizeFlightNumber(raw) || raw,
      airline: (item.airline && item.airline.name) || '',
      from: airportCode(dep.airport),
      fromCity: airportCity(dep.airport),
      to: airportCode(arr.airport),
      toCity: airportCity(arr.airport),
      depTime: clock(bestTime(dep)),
      arrTime: clock(bestTime(arr)),
      depDay: depLocal ? depLocal.day : '',
      depOffsetMin: depLocal ? depLocal.offsetMin : 0,
      gate: dep.gate ? String(dep.gate) : '',
      terminal: dep.terminal ? String(dep.terminal) : '',
      delayMin: delay,
      status: statusKey(item.status, delay),
    };
  }

  /** /fids/:iata/:type body → board rows: operating carrier only, one row per flight, by scheduled time. */
  function boardRows(json, dir) {
    var key = dir === 'arrival' ? 'arrivals' : 'departures';
    var list = Array.isArray(json) ? json : (json && Array.isArray(json[key]) ? json[key] : []);
    var seen = {};
    var rows = [];
    list.forEach(function (item) {
      if (!item || item.codeshareStatus === 'IsCodeshared') return;
      var mov = item.movement || {};
      var number = String(item.number || '').replace(/\s+/g, '').toUpperCase();
      var sched = mov.scheduledTime || {};
      var id = number + '|' + (sched.utc || sched.local || '');
      if (!number || seen[id]) return;
      seen[id] = true;
      var delay = delayMinutes(mov);
      rows.push({
        number: number,
        airline: (item.airline && item.airline.name) || '',
        remote: airportCode(mov.airport),
        remoteCity: airportCity(mov.airport),
        time: clock(timeOf(sched)),
        expected: delay > 0 ? clock(timeOf(mov.revisedTime) || timeOf(mov.predictedTime)) : '',
        gate: mov.gate ? String(mov.gate) : '',
        terminal: mov.terminal ? String(mov.terminal) : '',
        delayMin: delay,
        status: statusKey(item.status, delay),
        at: epoch(sched.utc || sched.local),
      });
    });
    rows.sort(function (a, b) {
      return (isNaN(a.at) ? Infinity : a.at) - (isNaN(b.at) ? Infinity : b.at);
    });
    return rows;
  }

  /** Drop flights that left/landed well before now (their expected time counts, so late flights stay). */
  function upcomingRows(rows, now) {
    var cutoff = now - BOARD_GRACE_MIN * 60000;
    return (rows || []).filter(function (r) {
      return isNaN(r.at) || r.at + r.delayMin * 60000 >= cutoff;
    }).slice(0, BOARD_ROW_CAP);
  }

  /** Proxy error → message key (+ params). */
  function errorInfo(status, body, notFoundKey) {
    if ((status === 429 || status === 503) && body && body.retryAfterMin) {
      return { key: 'rateLimited', params: { n: Math.max(1, Math.ceil(body.retryAfterMin)) } };
    }
    if (status === 400 || status === 404 || status === 204) return { key: notFoundKey || 'notFound' };
    return { key: 'unavailable' };
  }

  /** "Live status" target: the LIFF page with the flight preloaded (waiair.app/liff?flight=TG403). */
  function shareLink(flight) {
    var number = normalizeFlightNumber(flight);
    return SITE + '/liff' + (number ? '?flight=' + number : '');
  }

  /**
   * Aviasales search day (DDMM) at the departure airport: the flight's own day when it is still ahead,
   * otherwise tomorrow — people book a future flight, not the one that just left.
   */
  function bookingSearchDay(f, now) {
    var offsetMs = ((f && f.depOffsetMin) || 0) * 60000;
    var today = new Date(now + offsetMs).toISOString().slice(0, 10);
    var depDay = f && /^\d{4}-\d{2}-\d{2}$/.test(f.depDay || '') ? f.depDay : '';
    var day = depDay > today ? depDay : new Date(now + offsetMs + 86400000).toISOString().slice(0, 10);
    return day.slice(8, 10) + day.slice(5, 7);
  }

  function isBangkok(code) {
    return BANGKOK_AIRPORTS.indexOf(code) >= 0;
  }

  /**
   * Aviasales one-way search from Bangkok, with the WaiAir affiliate marker. Always returns a working link:
   *   BKK/DMK → X   searches as-is
   *   X → BKK/DMK   flips to BKK → X
   *   X → Y         searches BKK → Y (POS → AMS becomes BKK → AMS)
   * No usable destination → the Aviasales search page (still with the marker).
   */
  function bookingUrl(f, lang, now) {
    var from = normalizeIata(f && f.from);
    var to = normalizeIata(f && f.to);
    var origin = isBangkok(from) ? from : 'BKK';
    var dest = !isBangkok(from) && isBangkok(to) ? from : to;
    var qs = '?marker=' + AVIASALES_MARKER + '&currency=' + (pickLang(lang) === 'th' ? 'thb' : 'usd');
    if (!dest || isBangkok(dest)) return 'https://www.aviasales.com/search' + qs;
    var at = typeof now === 'number' ? now : Date.now();
    return 'https://www.aviasales.com/search/' + origin + bookingSearchDay(f, at) + dest + '1' + qs;
  }

  /** A delay still worth flagging (not once the flight has landed or was cancelled). */
  function hasDelay(f) {
    return !!f && f.delayMin > 0 && f.status !== 'cancelled' && f.status !== 'landed';
  }

  function statusLine(f, lang) {
    var s = STRINGS[pickLang(lang)];
    var label = s.status[f.status] || s.status.scheduled;
    return hasDelay(f) ? label + ' · ' + format(s.minutes, { n: f.delayMin }) : label;
  }

  function shareText(f, lang) {
    return (f.number + ' ' + (f.from || '—') + ' → ' + (f.to || '—') + ': ' + statusLine(f, lang)).slice(0, 400);
  }

  /** Flex status badge colours: En Route blue, Landed green, Delayed orange, Cancelled red. */
  var STATUS_COLOR = {
    scheduled: '#64748B',
    boarding: '#A8905A',
    delayed: '#F59E0B',
    enRoute: '#3B82F6',
    landed: '#22C55E',
    cancelled: '#EF4444',
    diverted: '#EF4444',
  };

  function statusColor(key) {
    return STATUS_COLOR[key] || STATUS_COLOR.scheduled;
  }

  /** Orange delay badge, red from an hour late. */
  function delayColor(min) {
    return min >= 60 ? '#EF4444' : '#F59E0B';
  }

  function flexBadge(text, color) {
    return {
      type: 'box',
      layout: 'vertical',
      flex: 0,
      justifyContent: 'center',
      backgroundColor: color,
      cornerRadius: 'xxl',
      paddingStart: '10px',
      paddingEnd: '10px',
      paddingTop: '3px',
      paddingBottom: '3px',
      contents: [{ type: 'text', text: text, size: 'xxs', weight: 'bold', color: '#FFFFFF' }],
    };
  }

  function flexEndpoint(code, city, time, align) {
    return {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      contents: [
        { type: 'text', text: code || '—', size: 'xl', weight: 'bold', color: '#FAF8F4', align: align },
        { type: 'text', text: city || ' ', size: 'xxs', color: '#9AA5B4', align: align },
        { type: 'text', text: time || '—', size: 'sm', color: '#FAF8F4', align: align, margin: 'sm' },
      ],
    };
  }

  /** Flex Message flight card for liff.shareTargetPicker. Every text is non-empty (LINE rejects empty text). */
  function flightFlexMessage(f, lang, link, now) {
    var s = STRINGS[pickLang(lang)];
    var body = [
      {
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        contents: [
          { type: 'text', text: '✈ WaiAir', size: 'sm', weight: 'bold', color: '#A8905A', flex: 1, gravity: 'center' },
          flexBadge(s.status[f.status] || s.status.scheduled, statusColor(f.status)),
        ],
      },
    ];
    if (hasDelay(f)) {
      body.push({
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        cornerRadius: 'md',
        paddingAll: '8px',
        backgroundColor: delayColor(f.delayMin),
        contents: [{ type: 'text', text: format(s.delayBadge, { n: f.delayMin }), size: 'sm', weight: 'bold', color: '#FFFFFF', wrap: true }],
      });
    }
    body.push(
      { type: 'text', text: f.number || '—', size: 'xxl', weight: 'bold', color: '#FAF8F4', margin: 'md' },
      { type: 'separator', margin: 'md', color: '#3A4A5E' },
      {
        type: 'box',
        layout: 'horizontal',
        margin: 'md',
        contents: [
          flexEndpoint(f.from, f.fromCity, f.depTime, 'start'),
          { type: 'text', text: '→', color: '#A8905A', align: 'center', gravity: 'center', flex: 0 },
          flexEndpoint(f.to, f.toCity, f.arrTime, 'end'),
        ],
      }
    );
    if (f.gate) {
      body.push({ type: 'text', text: s.gate + ' ' + f.gate, size: 'sm', color: '#FAF8F4', margin: 'md' });
    }
    var buttons = [{
      type: 'button',
      style: 'primary',
      height: 'sm',
      color: '#A8905A',
      action: { type: 'uri', label: s.liveStatus, uri: link },
    }];
    buttons.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      color: '#E8E1D3',
      action: { type: 'uri', label: s.bookFlight, uri: bookingUrl(f, lang, now) },
    });
    return {
      type: 'flex',
      altText: shareText(f, lang),
      contents: {
        type: 'bubble',
        size: 'kilo',
        body: { type: 'box', layout: 'vertical', paddingAll: '18px', backgroundColor: '#0B1F3A', contents: body },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '12px',
          backgroundColor: '#0B1F3A',
          contents: buttons,
        },
      },
    };
  }

  /** Plain-text LINE share (outside LIFF, or when the share target picker is unavailable). */
  function lineTextShareUrl(f, lang, link) {
    return 'https://line.me/R/share?text=' + encodeURIComponent(shareText(f, lang) + '\n' + link);
  }

  function storeUrl(os) {
    return String(os || '').toLowerCase() === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
  }

  return {
    PROXY: PROXY,
    STRINGS: STRINGS,
    pickLang: pickLang,
    format: format,
    normalizeFlightNumber: normalizeFlightNumber,
    normalizeIata: normalizeIata,
    parseQuery: parseQuery,
    clock: clock,
    delayMinutes: delayMinutes,
    statusKey: statusKey,
    statusTone: statusTone,
    statusColor: statusColor,
    pickFlight: pickFlight,
    flightSummary: flightSummary,
    boardRows: boardRows,
    upcomingRows: upcomingRows,
    errorInfo: errorInfo,
    shareLink: shareLink,
    bookingUrl: bookingUrl,
    statusLine: statusLine,
    flightFlexMessage: flightFlexMessage,
    lineTextShareUrl: lineTextShareUrl,
    storeUrl: storeUrl,
  };
});
