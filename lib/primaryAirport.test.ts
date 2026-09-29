import assert from 'node:assert/strict';
import { test } from 'node:test';
import { airportRecByIata } from './airportsDb.ts';
import {
  homeAirportCorrection,
  isSecondaryAirport,
  needsPrimaryCorrection,
  preferredHomeAirport,
  primaryAirportFor,
} from './primaryAirport.ts';

/**
 * What the proxy actually returns for each city centre, computed from the OurAirports dataset the proxy loads,
 * with the [W/4] scheduled-service filter applied. Closest first — real data, not invented orderings.
 */
const CITIES: { city: string; nearest: string[]; home: string }[] = [
  { city: 'Bangkok', nearest: ['DMK', 'BKK', 'UTP'], home: 'BKK' },
  { city: 'London', nearest: ['LCY', 'LHR', 'LGW'], home: 'LHR' },
  { city: 'Paris', nearest: ['ORY', 'CDG', 'BVA'], home: 'CDG' },
  { city: 'Tokyo', nearest: ['HND', 'NRT', 'IBR'], home: 'HND' },
  { city: 'New York', nearest: ['LGA', 'EWR', 'TEB'], home: 'JFK' },
  { city: 'Milan', nearest: ['LIN', 'MXP', 'BGY'], home: 'MXP' },
  { city: 'Rome', nearest: ['CIA', 'FCO', 'PEG'], home: 'FCO' },
  { city: 'Seoul', nearest: ['GMP', 'ICN', 'WJU'], home: 'ICN' },
  { city: 'Osaka', nearest: ['ITM', 'UKB', 'KIX'], home: 'KIX' },
  { city: 'Taipei', nearest: ['TSA', 'TPE', 'HUN'], home: 'TPE' },
  { city: 'Kuala Lumpur', nearest: ['SZB', 'KUL', 'MKZ'], home: 'KUL' },
  { city: 'Jakarta', nearest: ['HLP', 'CGK', 'BDO'], home: 'CGK' },
  { city: 'Shanghai', nearest: ['SHA', 'PVG', 'JNH'], home: 'PVG' },
  { city: 'Chicago', nearest: ['MDW', 'ORD', 'GYY'], home: 'ORD' },
  { city: 'Sao Paulo', nearest: ['CGH', 'GRU', 'VCP'], home: 'GRU' },
  { city: 'Toronto', nearest: ['YTZ', 'YYZ', 'YCM'], home: 'YYZ' },
  { city: 'Stockholm', nearest: ['BMA', 'ARN', 'VST'], home: 'ARN' },
  { city: 'Singapore', nearest: ['XSP', 'SIN', 'JHB'], home: 'SIN' },
  { city: 'Amsterdam', nearest: ['AMS', 'RTM', 'EIN'], home: 'AMS' },
  { city: 'Barcelona', nearest: ['BCN', 'GRO', 'REU'], home: 'BCN' },
  { city: 'Delhi', nearest: ['DEL', 'DXN', 'HSS'], home: 'DEL' },
  { city: 'Dubai', nearest: ['DXB', 'SHJ', 'DWC'], home: 'DXB' },
  { city: 'Berlin', nearest: ['BER', 'LEJ', 'SZZ'], home: 'BER' },
  // Deliberately not in the table: DCA is many Washington residents' own airport.
  { city: 'Washington DC', nearest: ['DCA', 'IAD', 'BWI'], home: 'DCA' },
];

const rows = (list: string[]) => list.map(iata => ({ iata }));

test('[W/4] every city centre resolves to its principal gateway', () => {
  const wrong: string[] = [];
  for (const c of CITIES) {
    const got = preferredHomeAirport(rows(c.nearest));
    if (got !== c.home) wrong.push(`${c.city}: nearest ${c.nearest[0]} → ${got}, wanted ${c.home}`);
  }
  assert.deepEqual(wrong, [], `still wrong:\n${wrong.join('\n')}`);
});

test('[W/4] Bangkok is the case this was built for', () => {
  // Don Mueang is genuinely 0.9 km nearer from Asoke, so distance can never get this right.
  assert.equal(preferredHomeAirport(rows(['DMK', 'BKK', 'UTP'])), 'BKK');
  assert.equal(primaryAirportFor('DMK'), 'BKK');
  assert.equal(primaryAirportFor('dmk '), 'BKK', 'case and whitespace are not the traveller\'s problem');
});

test('[W/4] the substitution does not require the primary to be nearby in the list', () => {
  // New York: the three nearest are LGA, EWR and Teterboro — JFK is not among them at all.
  assert.equal(preferredHomeAirport(rows(['LGA', 'EWR', 'TEB'])), 'JFK');
});

test('[W/4] an unknown city falls straight through to the nearest airport', () => {
  assert.equal(preferredHomeAirport(rows(['HKT', 'KBV'])), 'HKT');
  assert.equal(preferredHomeAirport(rows(['AMS'])), 'AMS');
  assert.equal(primaryAirportFor('HKT'), null);
  assert.equal(isSecondaryAirport('HKT'), false);
  assert.equal(isSecondaryAirport('DMK'), true);
});

test('[W/4] nothing to choose from is empty, never a guess', () => {
  assert.equal(preferredHomeAirport([]), '');
  assert.equal(preferredHomeAirport(null), '');
  assert.equal(preferredHomeAirport(undefined), '');
  assert.equal(preferredHomeAirport([{ iata: '' }, { iata: 'DMK' }]), 'BKK', 'blank entries are skipped');
});

test('[W/4] every airport in the table resolves in the app\'s own catalog, with coordinates', () => {
  // A table entry naming a code the app cannot resolve would replace a working guess with nothing.
  for (const c of CITIES) {
    const primary = primaryAirportFor(c.nearest[0]);
    for (const iata of [c.nearest[0], primary].filter(Boolean) as string[]) {
      const rec = airportRecByIata(iata);
      assert.ok(rec, `${iata} is missing from lib/airportsDb.ts`);
      assert.ok(Number.isFinite(rec!.lat) && Number.isFinite(rec!.lon), `${iata} has no coordinates`);
      assert.ok(rec!.lat !== 0 || rec!.lon !== 0, `${iata} has placeholder coordinates`);
    }
  }
});

test('[W/4] no primary is itself a secondary: one substitution, never a chain', () => {
  for (const c of CITIES) {
    const primary = primaryAirportFor(c.nearest[0]);
    if (!primary) continue;
    assert.equal(primaryAirportFor(primary), null, `${primary} must not also be a key`);
  }
});

test('[W/4] the deliberate exclusions stay out', () => {
  // Each is a full gateway in its own right, or the only airport in town. Adding one would make the guess
  // worse for the residents who use it — the reasoning is in the file header.
  for (const iata of ['DCA', 'IAD', 'BWI', 'NRT', 'SAW', 'PKX', 'SFO', 'OAK', 'SJC', 'BER', 'EWR', 'LGW']) {
    assert.equal(primaryAirportFor(iata), null, `${iata} should not be in the table`);
  }
});

test('[W/4] the correction only fires for a known secondary', () => {
  assert.equal(needsPrimaryCorrection('DMK'), 'BKK');
  assert.equal(needsPrimaryCorrection('BKK'), null, 'an already-correct airport is left alone');
  assert.equal(needsPrimaryCorrection('HKT'), null, 'so is one this table knows nothing about');
  assert.equal(needsPrimaryCorrection('DCA'), null, 'and so is a deliberate exclusion');
  assert.equal(needsPrimaryCorrection(''), null);
  assert.equal(needsPrimaryCorrection(null), null);
});

test('[W/4] the one-time correction respects where the airport came from', () => {
  const dmk = { iata: 'DMK' };
  // A legacy install: nothing recorded the source, and the airport is a known secondary.
  assert.equal(homeAirportCorrection({ saved: dmk }), 'BKK');
  assert.equal(homeAirportCorrection({ saved: dmk, source: null }), 'BKK');
  // Chosen by hand: never overwritten, whatever the table says.
  assert.equal(homeAirportCorrection({ saved: dmk, source: 'manual' }), null);
  // Written by this build, which already preferred the primary: nothing left to correct.
  assert.equal(homeAirportCorrection({ saved: dmk, source: 'auto' }), null);
  // Nothing saved, or nothing wrong with what is saved.
  assert.equal(homeAirportCorrection({ saved: null }), null);
  assert.equal(homeAirportCorrection({ saved: { iata: 'BKK' } }), null);
  assert.equal(homeAirportCorrection({ saved: { iata: 'DCA' } }), null, 'a deliberate exclusion is left alone');
  assert.equal(homeAirportCorrection({}), null);
});
