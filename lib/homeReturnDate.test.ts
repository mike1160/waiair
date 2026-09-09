import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyHomeDateChoice,
  labelReturnDateChip,
  outboundArrivalYmd,
  returnChipAnchorYmd,
  returnDateChipYmds,
} from './homeReturnDate.ts';
import { homeSearchCanFetch, parseSmartQuery } from './smartQuery.ts';

const COPY = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  homeRelativeInDays: (n: number) => `In ${n} days`,
};

test('outbound arrival YMD uses destination timezone, not origin', () => {
  const ymd = outboundArrivalYmd({
    origin: 'BKK',
    destination: 'NRT',
    originCountry: 'TH',
    destCountry: 'JP',
    scheduledTime: '2026-09-09T23:40:00+07:00',
    scheduledArrival: '2026-09-10T07:10:00+09:00',
    boardSide: 'departure',
  });
  assert.equal(ymd, '2026-09-10');
});

test('return chips are arrival+1/+2/+3 and stay unselected until a choice', () => {
  const now = new Date('2026-09-09T20:00:00+07:00');
  const nowYmd = '2026-09-09';
  const anchor = returnChipAnchorYmd({ arrivalDayYmd: '2026-09-10', travelDayYmd: '2026-09-09' }, nowYmd);
  assert.equal(anchor, '2026-09-10');
  assert.deepEqual(returnDateChipYmds(anchor), ['2026-09-11', '2026-09-12', '2026-09-13']);

  const parsed = parseSmartQuery('NRT BKK', { now, homeIata: 'BKK' });
  const unset = applyHomeDateChoice(parsed, { kind: 'unset' }, now, true);
  assert.equal(unset.needsDate, true);
  assert.equal(unset.dateKind, undefined);
  assert.equal(homeSearchCanFetch(unset), false);

  const picked = applyHomeDateChoice(parsed, { kind: 'ymd', date: '2026-09-11' }, now, true);
  assert.equal(picked.needsDate, false);
  assert.equal(picked.date, '2026-09-11');
  assert.equal(homeSearchCanFetch(picked), true);
});

test('chip labels are vs today: Tomorrow only when the YMD is calendar-tomorrow', () => {
  // Arrival today (9 Sep) → chips 10/11/12.
  assert.equal(labelReturnDateChip('2026-09-10', '2026-09-09', COPY), 'Tomorrow');
  assert.equal(labelReturnDateChip('2026-09-11', '2026-09-09', COPY), 'In 2 days');
  assert.equal(labelReturnDateChip('2026-09-12', '2026-09-09', COPY), 'In 3 days');
  // Arrival tomorrow (10 Sep) → chips 11/12/13, none labelled Tomorrow.
  assert.equal(labelReturnDateChip('2026-09-11', '2026-09-09', COPY), 'In 2 days');
  assert.equal(labelReturnDateChip('2026-09-12', '2026-09-09', COPY), 'In 3 days');
  assert.equal(labelReturnDateChip('2026-09-13', '2026-09-09', COPY), 'In 4 days');
});

test('missing arrival YMD falls back to outbound travel day', () => {
  assert.equal(
    returnChipAnchorYmd({ travelDayYmd: '2026-09-09' }, '2026-09-09'),
    '2026-09-09',
  );
});
