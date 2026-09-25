import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALARM_TRIGGERS,
  buildIcal,
  foldIcalLine,
  hasIcalEvents,
  icalEscape,
  icalFileName,
  icalLocation,
  icalSummary,
  icalUtcStamp,
  sentenceLabel,
  type IcalFlight,
  type IcalLabels,
} from './ical.ts';

const LABELS: IcalLabels = {
  flight: 'Vlucht',
  from: 'Van',
  to: 'Naar',
  departs: 'Vertrek',
  arrives: 'Aankomst',
  terminal: 'TERMINAL',
  gate: 'Gate',
  aircraft: 'Toestel',
  localTime: '(lokale tijd)',
  bookedVia: 'Geboekt via WaiAir',
  reminder: 'Herinnering',
};

const OPTS = { labels: LABELS, locale: 'nl', dtstampMs: Date.UTC(2026, 8, 20, 10, 0, 0) };

/** Phuket 13:00 → Bangkok 14:56, both airports on UTC+7. */
const TG208: IcalFlight = {
  flightNumber: 'TG208',
  airline: 'Thai Airways',
  origin: 'HKT',
  destination: 'BKK',
  originName: 'Phuket International Airport',
  destName: 'Suvarnabhumi Airport',
  originCountry: 'TH',
  destCountry: 'TH',
  departureIso: '2026-09-27T13:00',
  arrivalIso: '2026-09-27T14:56',
  terminal: '2',
  gate: 'B4',
  aircraft: 'Airbus A320',
};

function lines(ics: string): string[] {
  // Unfold first: a folded line continues with CRLF + one space.
  return ics.replace(/\r\n /g, '').split('\r\n');
}

test('the airport clock becomes a UTC instant', () => {
  const ics = buildIcal([TG208], OPTS);
  // 13:00 in Phuket (UTC+7) is 06:00 UTC; 14:56 is 07:56 UTC.
  assert.ok(lines(ics).includes('DTSTART:20260927T060000Z'), ics);
  assert.ok(lines(ics).includes('DTEND:20260927T075600Z'), ics);
  assert.ok(lines(ics).includes('DTSTAMP:20260920T100000Z'));
});

test('a flight that crosses midnight and timezones keeps both ends right', () => {
  // BKK 23:30 (UTC+7) → AMS 06:40 next morning (UTC+2 in September).
  const night: IcalFlight = {
    flightNumber: 'KL876',
    airline: 'KLM',
    origin: 'BKK',
    destination: 'AMS',
    originCountry: 'TH',
    destCountry: 'NL',
    departureIso: '2026-09-27T23:30',
    arrivalIso: '2026-09-28T06:40',
  };
  const out = lines(buildIcal([night], OPTS));
  assert.ok(out.includes('DTSTART:20260927T163000Z'), out.join('\n'));
  assert.ok(out.includes('DTEND:20260928T044000Z'), out.join('\n'));
});

test('the calendar wrapper and both alarms are there, once per flight', () => {
  const out = lines(buildIcal([TG208], OPTS));
  assert.equal(out[0], 'BEGIN:VCALENDAR');
  assert.ok(out.includes('VERSION:2.0'));
  assert.ok(out.includes('PRODID:-//WaiAir//WaiAir//EN'));
  assert.equal(out.at(-2), 'END:VCALENDAR');
  assert.equal(out.filter(l => l === 'BEGIN:VALARM').length, 2);
  assert.equal(out.filter(l => l === 'END:VALARM').length, 2);
  assert.ok(out.includes('TRIGGER:-PT3H'));
  assert.ok(out.includes('TRIGGER:-P1D'));
  assert.deepEqual([...ALARM_TRIGGERS], ['-PT3H', '-P1D']);
  assert.equal(out.filter(l => l.startsWith('DESCRIPTION:Herinnering')).length, 2);
  // Every line ends CRLF, including the last one.
  assert.ok(buildIcal([TG208], OPTS).endsWith('END:VCALENDAR\r\n'));
});

test('title and location read the way the trip does', () => {
  assert.equal(icalSummary(TG208), 'Thai Airways TG208 · HKT → BKK');
  assert.equal(icalLocation(TG208), 'Phuket International Airport (HKT)');
  // A flight with no airline name, and an airport with no name on file.
  assert.equal(icalSummary({ flightNumber: 'VZ2302', origin: 'BKK', destination: 'HKT' }), 'VZ2302 · BKK → HKT');
  assert.equal(icalLocation({ flightNumber: 'VZ2302', origin: 'BKK' }), 'BKK');
  assert.equal(icalSummary({ flightNumber: 'TG208', airline: '—', origin: 'HKT' }), 'TG208 · HKT');
});

test('the description carries the local clocks, and only the facts the flight has', () => {
  const ics = buildIcal([TG208], OPTS);
  const description = lines(ics).find(l => l.startsWith('DESCRIPTION:Vlucht'));
  assert.ok(description, ics);
  const text = description!.replace(/^DESCRIPTION:/, '').split('\\n');
  assert.equal(text[0], 'Vlucht: TG208');
  assert.equal(text[1], 'Van: Phuket International Airport (HKT)');
  assert.equal(text[2], 'Naar: Suvarnabhumi Airport (BKK)');
  assert.match(text[3], /^Vertrek: .*13[:.]00.*\(lokale tijd\)$/);
  assert.match(text[4], /^Aankomst: .*14[:.]56.*\(lokale tijd\)$/);
  // The board shouts TERMINAL; a calendar entry does not.
  assert.equal(text[5], 'Terminal: 2');
  assert.equal(text[6], 'Gate: B4');
  assert.equal(text[7], 'Toestel: Airbus A320');
  assert.equal(text.at(-1), 'Geboekt via WaiAir');

  // Unknown gate, terminal and aircraft: those lines are absent, not empty.
  const bare = buildIcal([{ ...TG208, terminal: '', gate: undefined, aircraft: '  ' }], OPTS);
  const bareText = lines(bare).find(l => l.startsWith('DESCRIPTION:Vlucht'))!.split('\\n');
  assert.ok(!bareText.some(l => l.startsWith('Gate')), bareText.join(' | '));
  assert.ok(!bareText.some(l => l.startsWith('Terminal')));
  assert.ok(!bareText.some(l => l.startsWith('Toestel')));
  assert.equal(bareText.at(-1), 'Geboekt via WaiAir');
});

test('the local clocks follow each airport, not the device', () => {
  const night: IcalFlight = {
    ...TG208,
    destination: 'AMS',
    destName: 'Amsterdam Airport Schiphol',
    destCountry: 'NL',
    departureIso: '2026-09-27T23:30',
    arrivalIso: '2026-09-28T06:40',
  };
  const text = lines(buildIcal([night], OPTS))
    .find(l => l.startsWith('DESCRIPTION:Vlucht'))!.split('\\n');
  // Bangkok's evening and Amsterdam's morning, each in its own zone — 16:30Z and 04:40Z would be neither.
  assert.match(text[3], /23[:.]30/);
  assert.match(text[4], /0?6[:.]40/);
});

test('special characters cannot break the file open', () => {
  assert.equal(icalEscape('a,b;c\\d'), 'a\\,b\\;c\\\\d');
  assert.equal(icalEscape('line1\nline2'), 'line1\\nline2');
  assert.equal(icalEscape('line1\r\nline2'), 'line1\\nline2');
  // The backslash is escaped first, so an escaped comma is not double-escaped.
  assert.equal(icalEscape('\\,'), '\\\\\\,');
  assert.equal(icalEscape(undefined as unknown as string), '');

  const tricky = lines(buildIcal([{
    ...TG208,
    airline: 'Air; Comma, Co\\',
    originName: 'Terminal 1, Gate; Zone\\A',
  }], OPTS));
  // Every semicolon, comma and backslash the airline and the airport carry arrives escaped.
  assert.equal(
    tricky.find(l => l.startsWith('SUMMARY:')),
    'SUMMARY:Air\\; Comma\\, Co\\\\ TG208 · HKT → BKK',
  );
  assert.equal(
    tricky.find(l => l.startsWith('LOCATION:')),
    'LOCATION:Terminal 1\\, Gate\\; Zone\\\\A (HKT)',
  );
  // The description carries the same airport name, escaped the same way.
  const desc = tricky.find(l => l.startsWith('DESCRIPTION:Vlucht'))!;
  assert.ok(desc.includes('Van: Terminal 1\\, Gate\\; Zone\\\\A (HKT)'), desc);
});

test('long lines are folded, and multi-byte characters are never cut in half', () => {
  const folded = foldIcalLine(`DESCRIPTION:${'a'.repeat(200)}`);
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p, i) => new TextEncoder().encode(i === 0 ? p : p.slice(1)).length <= 75));
  assert.ok(parts.slice(1).every(p => p.startsWith(' ')));
  assert.equal(folded.replace(/\r\n /g, ''), `DESCRIPTION:${'a'.repeat(200)}`);

  // Thai is three octets a letter: unfolding must give back exactly what went in.
  const thai = `LOCATION:${'ท่าอากาศยานภูเก็ต'.repeat(6)}`;
  const foldedThai = foldIcalLine(thai);
  assert.equal(foldedThai.replace(/\r\n /g, ''), thai);
  assert.ok(foldedThai.split('\r\n').every((p, i) => new TextEncoder().encode(i === 0 ? p : p.slice(1)).length <= 75));

  const short = 'BEGIN:VEVENT';
  assert.equal(foldIcalLine(short), short);
});

test('a whole trip is one file with one VEVENT per flight', () => {
  const back: IcalFlight = {
    ...TG208,
    flightNumber: 'TG209',
    origin: 'BKK',
    destination: 'HKT',
    originName: 'Suvarnabhumi Airport',
    destName: 'Phuket International Airport',
    departureIso: '2026-10-04T09:15',
    arrivalIso: '2026-10-04T10:40',
    gate: '',
  };
  const out = lines(buildIcal([TG208, back], OPTS));
  assert.equal(out.filter(l => l === 'BEGIN:VEVENT').length, 2);
  assert.equal(out.filter(l => l === 'END:VEVENT').length, 2);
  assert.equal(out.filter(l => l === 'BEGIN:VCALENDAR').length, 1);
  assert.equal(out.filter(l => l === 'BEGIN:VALARM').length, 4, 'both alarms on both flights');
  assert.ok(out.includes('DTSTART:20260927T060000Z'));
  assert.ok(out.includes('DTSTART:20261004T021500Z'));
  // Each flight gets its own stable id, so a second import updates rather than duplicates.
  const uids = out.filter(l => l.startsWith('UID:'));
  assert.deepEqual(uids, ['UID:TG208-20260927-HKT@waiair.app', 'UID:TG209-20261004-BKK@waiair.app']);
});

test('a flight with no departure time is left out — it has no place in a calendar', () => {
  const noTime: IcalFlight = { flightNumber: 'TG208', origin: 'HKT', destination: 'BKK' };
  const out = lines(buildIcal([noTime], OPTS));
  assert.equal(out.filter(l => l === 'BEGIN:VEVENT').length, 0);
  assert.equal(hasIcalEvents([noTime], OPTS), false);
  assert.equal(hasIcalEvents([TG208], OPTS), true);
  assert.equal(hasIcalEvents([], OPTS), false);

  // A departure without a known arrival still gets an entry, with no end.
  const openEnd = buildIcal([{ ...TG208, arrivalIso: '' }], OPTS);
  assert.ok(lines(openEnd).includes('DTSTART:20260927T060000Z'));
  assert.ok(!lines(openEnd).some(l => l.startsWith('DTEND:')), openEnd);

  // An arrival before the departure is nonsense and is dropped, not written.
  const backwards = buildIcal([{ ...TG208, arrivalIso: '2026-09-27T11:00' }], OPTS);
  assert.ok(!lines(backwards).some(l => l.startsWith('DTEND:')));

  // Nothing at all still produces a valid, empty calendar.
  const empty = lines(buildIcal([], OPTS));
  assert.deepEqual(empty.filter(l => l.startsWith('BEGIN:')), ['BEGIN:VCALENDAR']);
});

test('the file is named after the flight and its day', () => {
  assert.equal(icalFileName([TG208]), 'TG208-2026-09-27.ics');
  assert.equal(icalFileName([TG208, { ...TG208, flightNumber: 'TG209' }]), 'TG208-2026-09-27-trip.ics');
  assert.equal(icalFileName([{ flightNumber: 'TG 208', origin: 'HKT' }]), 'TG208.ics');
  assert.equal(icalFileName([]), 'flight.ics');
});

test('a board label in capitals becomes a sentence, in every script', () => {
  assert.equal(sentenceLabel('TERMINAL'), 'Terminal');
  assert.equal(sentenceLabel('ТЕРМИНАЛ'), 'Терминал');
  assert.equal(sentenceLabel('NHÀ GA'), 'Nhà ga');
  // Already a sentence, or a script without capitals: untouched.
  assert.equal(sentenceLabel('Gate'), 'Gate');
  assert.equal(sentenceLabel('Toestel'), 'Toestel');
  assert.equal(sentenceLabel('อาคารผู้โดยสาร'), 'อาคารผู้โดยสาร');
  assert.equal(sentenceLabel('ターミナル'), 'ターミナル');
  assert.equal(sentenceLabel('터미널'), '터미널');
  assert.equal(sentenceLabel('航站楼'), '航站楼');
  assert.equal(sentenceLabel(''), '');
});

test('the UTC stamp is exactly sixteen characters of UTC', () => {
  assert.equal(icalUtcStamp(Date.UTC(2026, 0, 2, 3, 4, 5)), '20260102T030405Z');
  assert.equal(icalUtcStamp(Date.UTC(2026, 11, 31, 23, 59, 59)), '20261231T235959Z');
});
