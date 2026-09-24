import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeFromText } from './placeText.ts';

test('an address gives up its city, whatever sits in front of it', () => {
  assert.deepEqual(placeFromText('123 Sukhumvit Road, Bangkok, 10110'), { city: 'Bangkok', country: 'TH' });
  assert.deepEqual(placeFromText('Patong Beach, Phuket, Thailand'), { city: 'Phuket', country: 'TH' });
  assert.deepEqual(placeFromText('Rue de Rivoli 12, 75001 Paris, France'), { city: 'Paris', country: 'FR' });
});

test('the last place named wins, so a hotel name cannot move the booking abroad', () => {
  // "Grand Hotel Vienna" in Bangkok is in Bangkok. An address runs outwards from the doorstep, so the city
  // sits behind the street and the later match is the better one.
  assert.deepEqual(
    placeFromText('Grand Hotel Vienna, Sukhumvit Road, Bangkok'),
    { city: 'Bangkok', country: 'TH' },
  );
});

test('an airport code counts only when the text says airport', () => {
  assert.deepEqual(placeFromText('BKK Airport arrivals hall'), { airportIata: 'BKK', city: 'Bangkok', country: 'TH' });
  assert.deepEqual(placeFromText('Terminal 3, AMS'), { airportIata: 'AMS', city: 'Amsterdam', country: 'NL' });
  // No airport word: a three-letter code is just three letters, so a street is not read as Seattle.
  assert.equal(placeFromText('123 SEA Road, Springfield').airportIata, undefined);
});

test('an airport by its own name, and a station by its city', () => {
  assert.deepEqual(placeFromText('Suvarnabhumi Airport, Terminal 2'), { city: 'Bangkok', country: 'TH' });
  assert.deepEqual(placeFromText('Amsterdam Airport Schiphol'), { city: 'Amsterdam', country: 'NL' });
  assert.deepEqual(placeFromText('Zürich Hauptbahnhof'), { city: 'Zürich', country: 'CH' });
});

test('nothing recognisable stays nothing — the score treats that differently from a wrong place', () => {
  assert.deepEqual(placeFromText('Hotel Zonnebloem, Dorpsstraat 4'), {});
  assert.deepEqual(placeFromText(''), {});
  assert.deepEqual(placeFromText(undefined), {});
  assert.deepEqual(placeFromText(undefined, ''), {});
});

test('the country alone, when no city is named', () => {
  // Enough for the same-country points, not enough to pretend we know the town.
  assert.deepEqual(placeFromText('Somewhere quiet, Thailand'), { country: 'TH' });
});

test('several fields are read together, in the order the caller gives them', () => {
  assert.deepEqual(
    placeFromText('Pick-up: arrivals hall', 'Suvarnabhumi Airport'),
    { city: 'Bangkok', country: 'TH' },
  );
});
