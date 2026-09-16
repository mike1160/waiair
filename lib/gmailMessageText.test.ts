import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectBody, decodeB64Url, htmlToText, joinSplitFlightNumbers } from './gmailMessageText.ts';

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
