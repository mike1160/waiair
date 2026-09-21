import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectBody, decodeB64Url, extractJsonLd, htmlToText, joinSplitFlightNumbers } from './gmailMessageText.ts';
import { parseImportText, parseJsonLdFlight } from './flightImport.ts';

// Gmail integration tests — Gmail API returns base64url bodies, mostly HTML, often multipart.

function b64url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

test('decodeB64Url keeps UTF-8 (Dutch, Thai)', () => {
  assert.equal(decodeB64Url(b64url('Geïmporteerd uit Gmail · โรงแรม')), 'Geïmporteerd uit Gmail · โรงแรม');
});

test('htmlToText strips markup and style blocks but keeps cell text apart', () => {
  const html = '<html><head><style>td{color:red}</style></head><body><table><tr><td>Flight</td><td>TG922</td></tr>'
    + '<tr><td>Date</td><td>18&nbsp;Sep&nbsp;2026</td></tr></table><p>BKK&ndash;HKT</p></body></html>';
  const text = htmlToText(html);
  assert.ok(!text.includes('<'));
  assert.ok(!text.includes('color:red'));
  assert.match(text, /Flight TG922/);
  assert.match(text, /18 Sep 2026/);
});

test('htmlToText leaves plain text untouched', () => {
  assert.equal(htmlToText('EK373 DXB-BKK 20 Sep 2026'), 'EK373 DXB-BKK 20 Sep 2026');
});

test('collectBody walks multipart payloads (TG922, EK373, SQ731 confirmations)', () => {
  const payload = {
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: b64url('Thai Airways e-ticket TG922 BKK-FRA 18 Sep 2026') } },
          { mimeType: 'text/html', body: { data: b64url('<div>Emirates <b>EK373</b></div><div>DXB–BKK · 20 Sep 2026</div>') } },
        ],
      },
      { mimeType: 'text/html', body: { data: b64url('<table><tr><td>SQ731</td><td>SIN - BKK</td><td>22 Sep 2026</td></tr></table>') } },
    ],
  };
  const text = collectBody(payload);
  for (const needle of ['TG922', 'EK373', 'SQ731', 'BKK-FRA', '20 Sep 2026', 'SIN - BKK']) {
    assert.ok(text.includes(needle), `missing ${needle}`);
  }
  assert.ok(!text.includes('<b>'));
});

test('collectBody tolerates empty payloads', () => {
  assert.equal(collectBody(null), '');
  assert.equal(collectBody({ mimeType: 'text/plain' }), '');
});

test('joinSplitFlightNumbers joins "EK 373" but leaves words and dates alone', () => {
  assert.equal(joinSplitFlightNumbers('EK 373 DXB → BKK, SQ 731'), 'EK373 DXB → BKK, SQ731');
  assert.equal(joinSplitFlightNumbers('Sun 20 Sep 2026 · Room 1204 · to 1500'), 'Sun 20 Sep 2026 · Room 1204 · to 1500');
});

// ── JSON-LD: the itinerary lives in a PDF, but the markup is in the HTML part ─────────────────────────────

const TG_RESERVATION = {
  '@context': 'http://schema.org',
  '@type': 'FlightReservation',
  reservationNumber: 'ABC123',
  reservationFor: {
    '@type': 'Flight',
    flightNumber: 'TG 502',
    departureTime: '2026-09-27T10:30:00+07:00',
    departureAirport: { '@type': 'Airport', iataCode: 'BKK' },
    arrivalAirport: { '@type': 'Airport', iataCode: 'AMS' },
    airline: { '@type': 'Airline', name: 'Thai Airways' },
  },
};

function htmlPart(inner: string) {
  return { mimeType: 'text/html', body: { data: b64url(`<html><body><p>See attached PDF.</p>${inner}</body></html>`) } };
}

function ldScript(payload: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

test('extractJsonLd pulls the FlightReservation out of the HTML part', () => {
  const found = extractJsonLd(htmlPart(ldScript(TG_RESERVATION)));
  assert.equal(found.length, 1);
  assert.deepEqual(found[0], TG_RESERVATION);
});

test('extractJsonLd finds it nested inside multipart/alternative', () => {
  const payload = {
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: b64url('Your e-ticket is attached.') } },
          htmlPart(ldScript(TG_RESERVATION)),
        ],
      },
      { mimeType: 'application/pdf', body: { attachmentId: 'x' } },
    ],
  };
  const found = extractJsonLd(payload);
  assert.equal(found.length, 1);
  assert.equal((found[0] as typeof TG_RESERVATION).reservationNumber, 'ABC123');
});

test('extractJsonLd returns [] for a mail without markup, and never throws on a broken block', () => {
  assert.deepEqual(extractJsonLd(htmlPart('')), []);
  assert.deepEqual(extractJsonLd({ mimeType: 'text/plain', body: { data: b64url('TG502 27 Sep') } }), []);
  assert.deepEqual(extractJsonLd(null), []);
  assert.deepEqual(extractJsonLd(htmlPart('<script type="application/ld+json">{ this is not json }</script>')), []);
  // A broken block next to a good one costs only the broken one.
  const mixed = extractJsonLd(htmlPart('<script type="application/ld+json">{oops</script>' + ldScript(TG_RESERVATION)));
  assert.equal(mixed.length, 1);
});

test('parseJsonLdFlight reads a Thai Airways reservation', () => {
  assert.deepEqual(parseJsonLdFlight([TG_RESERVATION]), {
    flightNumber: 'TG502',
    dateIso: '2026-09-27',
    origin: 'BKK',
    destination: 'AMS',
    airline: 'Thai Airways',
    confirmationRef: 'ABC123',
  });
});

test("parseJsonLdFlight handles Google's @type array and a reservationId", () => {
  const google = {
    '@type': ['Reservation', 'FlightReservation'],
    reservationId: 'QF-99XY',
    reservationFor: {
      '@type': ['Flight'],
      flightNumber: 'QF 2',
      departureTime: '2026-11-02T21:05:00+11:00',
      departureAirport: { iataCode: 'syd' },
      arrivalAirport: { iataCode: 'LHR' },
    },
  };
  assert.deepEqual(parseJsonLdFlight([google]), {
    flightNumber: 'QF2',
    dateIso: '2026-11-02',
    origin: 'SYD',
    destination: 'LHR',
    confirmationRef: 'QF-99XY',
  });
});

test('parseJsonLdFlight digs the reservation out of an itinerary wrapper', () => {
  const wrapped = { '@type': 'Trip', itinerary: [{ '@type': 'LodgingReservation' }, TG_RESERVATION] };
  assert.equal(parseJsonLdFlight([wrapped])?.flightNumber, 'TG502');
});

test('parseJsonLdFlight returns null when there is no flight to track', () => {
  assert.equal(parseJsonLdFlight([]), null);
  assert.equal(parseJsonLdFlight([{ '@type': 'LodgingReservation', reservationNumber: 'H1' }]), null);
  // A reservation whose leg has no flight number is not trackable.
  assert.equal(parseJsonLdFlight([{
    '@type': 'FlightReservation',
    reservationNumber: 'ABC123',
    reservationFor: { '@type': 'Flight', departureAirport: { iataCode: 'BKK' } },
  }]), null);
});

test('the JSON-LD fields parse back into a flight candidate', () => {
  // What gmailInboxStore prepends to the body: the parser must recognise it without any other text.
  const ld = parseJsonLdFlight([TG_RESERVATION])!;
  const line = [ld.flightNumber, ld.dateIso, ld.origin, ld.destination, ld.confirmationRef].join(' ');
  const [candidate] = parseImportText(line);
  assert.equal(candidate?.flightNumber, 'TG502');
  assert.equal(candidate?.dateIso, '2026-09-27');
});
