/**
 * Phase C: the moment rules. node:test, no jest.
 * Every case here is about whether a moment fires at all — the copy is deliberately not asserted word for word.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONNECTION_RISK_MIN,
  MOMENT_AUDIENCE,
  computeMoments,
  momentPriority,
  upcomingMoments,
} from './tripMoments.ts';
import { groupTrips, type TripFlight } from './tripOrchestrator.ts';

const NOW = Date.parse('2027-03-13T09:00:00Z');
const OPTS = { locale: 'en', homeAirportCode: 'AMS' };

type LegInput = {
  key: string;
  number?: string;
  origin: string;
  destination: string;
  destCity?: string;
  dep: string;
  schedArr: string;
  estArr?: string;
  actualArr?: string;
  gate?: string;
  belt?: string;
  extras?: TripFlight['tripExtras'];
};

function leg(l: LegInput): TripFlight {
  return {
    key: l.key,
    flightNumber: l.number || l.key.toUpperCase(),
    scheduledTime: l.dep,
    lastGate: l.gate,
    lastBaggage: l.belt,
    tripExtras: l.extras,
    flight: {
      origin: l.origin,
      destination: l.destination,
      destCity: l.destCity,
      originCountry: 'NL',
      destCountry: 'TH',
      scheduledDeparture: l.dep,
      scheduledArrival: l.schedArr,
      estimatedArrival: l.estArr,
      actualArrival: l.actualArr,
      scheduledTime: l.dep,
    },
  };
}

const HOTEL = {
  hotel: {
    name: 'Riva Surya',
    address: '23 Phra Athit Road, Bangkok',
    checkIn: '2027-03-14T15:00:00Z',
  },
};

/** The traveller-facing 'time to leave' title in one locale — used to prove the 13 tables are distinct. */
function copyTitleFor(locale: string): string {
  const f = leg({
    key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
  });
  return computeMoments(groupTrips([f])[0], NOW, { locale })
    .filter(m => m.kind === 'depart_now')[0].title;
}

function only(kind: string, moments: ReturnType<typeof computeMoments>) {
  return moments.filter(m => m.kind === kind);
}

// ── evening before ───────────────────────────────────────────────────────────

test('evening before: a trip with a hotel gets one, at 20:00 the day before departure', () => {
  const withHotel = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z', extras: HOTEL,
  });
  const moments = computeMoments(groupTrips([withHotel])[0], NOW, OPTS);
  const evening = only('evening_before', moments);
  assert.equal(evening.length, 1);

  // 20:00 Amsterdam time on 13 March is 19:00 UTC (CET, before the clocks go forward).
  const fired = new Date(evening[0].triggerMs);
  assert.equal(fired.toISOString(), '2027-03-13T19:00:00.000Z');
  assert.match(evening[0].title, /Bangkok/);
  assert.match(evening[0].body, /Riva Surya/);
  assert.equal(evening[0].urgent, false);
});

test('evening before: no hotel, no moment', () => {
  const bare = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
  });
  assert.equal(only('evening_before', computeMoments(groupTrips([bare])[0], NOW, OPTS)).length, 0);
});

test('evening before: the car pick-up and the first activity are listed when the trip has them', () => {
  const rich = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    extras: {
      ...HOTEL,
      carRental: { company: 'Sixt', pickupTime: '2027-03-15T09:00:00Z' },
      excursion: { name: 'Grand Palace tour', dateTime: '2027-03-16T09:00:00Z' },
    },
  });
  const body = only('evening_before', computeMoments(groupTrips([rich])[0], NOW, OPTS))[0].body;
  assert.match(body, /Sixt/);
  assert.match(body, /Grand Palace tour/);
});

// ── delay impact ─────────────────────────────────────────────────────────────

const DELAY_HOTEL_1H = {
  hotel: { name: 'Riva Surya', address: '23 Phra Athit Road, Bangkok', checkIn: '2027-03-15T07:20:00Z' },
};
const DELAY_HOTEL_6H = {
  hotel: { name: 'Riva Surya', address: '23 Phra Athit Road, Bangkok', checkIn: '2027-03-15T12:20:00Z' },
};

test('delay impact: 2h late and check-in an hour after the scheduled arrival is a real clash', () => {
  const late = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z',
    schedArr: '2027-03-15T06:20:00Z',
    estArr: '2027-03-15T08:20:00Z',
    extras: DELAY_HOTEL_1H,
  });
  const hit = only('delay_impact', computeMoments(groupTrips([late])[0], NOW, OPTS));
  assert.equal(hit.length, 1);
  assert.match(hit[0].title, /120/, 'the delay is stated in minutes');
  assert.match(hit[0].body, /Riva Surya/);
  assert.ok(hit[0].actionUrl?.startsWith('https://'), 'the action opens the hotel on a map');
  assert.ok(hit[0].actionLabel);
});

test('delay impact: the same 2h delay with check-in six hours later is not a clash', () => {
  const late = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z',
    schedArr: '2027-03-15T06:20:00Z',
    estArr: '2027-03-15T08:20:00Z',
    extras: DELAY_HOTEL_6H,
  });
  assert.equal(only('delay_impact', computeMoments(groupTrips([late])[0], NOW, OPTS)).length, 0);
});

test('delay impact: no delay means no moment, whatever the bookings say', () => {
  const onTime = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    extras: DELAY_HOTEL_1H,
  });
  assert.equal(only('delay_impact', computeMoments(groupTrips([onTime])[0], NOW, OPTS)).length, 0);
});

test('delay impact: a car pick-up that now falls before you land also counts', () => {
  const late = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z',
    schedArr: '2027-03-15T06:20:00Z',
    estArr: '2027-03-15T08:20:00Z',
    extras: { carRental: { company: 'Sixt', pickupTime: '2027-03-15T07:00:00Z' } },
  });
  const hit = only('delay_impact', computeMoments(groupTrips([late])[0], NOW, OPTS));
  assert.equal(hit.length, 1);
  assert.match(hit[0].body, /Sixt/);
});

// ── connection risk ──────────────────────────────────────────────────────────

function connectionPair(estArrOfFirst?: string): TripFlight[] {
  return [
    leg({
      key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
      dep: '2027-03-14T14:05:00Z',
      schedArr: '2027-03-15T06:20:00Z',
      estArr: estArrOfFirst,
    }),
    leg({
      key: 'tg102', number: 'TG102', origin: 'BKK', destination: 'CNX', destCity: 'Chiang Mai',
      dep: '2027-03-15T07:00:00Z',
      schedArr: '2027-03-15T08:20:00Z',
    }),
  ];
}

test('connection risk: 40 minutes on paper, 30 minutes late, is urgent', () => {
  const group = groupTrips(connectionPair('2027-03-15T06:50:00Z'))[0];
  assert.equal(group.flights.length, 2, 'the two legs are one trip');
  const risk = only('connection_risk', computeMoments(group, NOW, OPTS));
  assert.equal(risk.length, 1);
  assert.equal(risk[0].urgent, true);
  assert.equal(momentPriority(risk[0].kind), 'max');
  assert.match(risk[0].body, /KL875/);
  assert.match(risk[0].body, /TG102/);
  assert.match(risk[0].body, /10/, '10 minutes left after a 30 minute delay');
});

test('connection risk: 40 minutes on paper and on time is already under the limit, so it fires', () => {
  const risk = only('connection_risk', computeMoments(groupTrips(connectionPair())[0], NOW, OPTS));
  assert.equal(risk.length, 1, `40 min is below the ${CONNECTION_RISK_MIN} min limit`);
  assert.match(risk[0].body, /40/);
});

test('connection risk: a comfortable connection produces nothing', () => {
  const roomy = [
    leg({
      key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
      dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    }),
    leg({
      key: 'tg102', number: 'TG102', origin: 'BKK', destination: 'CNX', destCity: 'Chiang Mai',
      dep: '2027-03-15T10:00:00Z', schedArr: '2027-03-15T11:20:00Z',
    }),
  ];
  assert.equal(only('connection_risk', computeMoments(groupTrips(roomy)[0], NOW, OPTS)).length, 0);
});

test('connection risk: two legs a week apart are not a connection', () => {
  const returnTrip = [
    leg({
      key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
      dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    }),
    leg({
      key: 'kl876', number: 'KL876', origin: 'BKK', destination: 'AMS', destCity: 'Amsterdam',
      dep: '2027-03-21T23:30:00Z', schedArr: '2027-03-22T07:10:00Z',
    }),
  ];
  assert.equal(only('connection_risk', computeMoments(groupTrips(returnTrip)[0], NOW, OPTS)).length, 0);
});

// ── the rest of the kinds ────────────────────────────────────────────────────

test('depart now: one per leg you travel to the airport for, not for a connection', () => {
  const group = groupTrips(connectionPair())[0];
  const depart = only('depart_now', computeMoments(group, NOW, OPTS));
  assert.equal(depart.length, 1, 'the connecting leg is not something you leave home for');
  assert.equal(depart[0].flightKey, 'kl875');
  assert.match(depart[0].title, /leave/i);

  // The return leg a week later is its own trip out of the door.
  const returnTrip = groupTrips([
    leg({
      key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
      dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    }),
    leg({
      key: 'kl876', origin: 'BKK', destination: 'AMS', destCity: 'Amsterdam',
      dep: '2027-03-21T23:30:00Z', schedArr: '2027-03-22T07:10:00Z',
    }),
  ])[0];
  assert.equal(only('depart_now', computeMoments(returnTrip, NOW, OPTS)).length, 2);
});

test('depart now: the gate is named when it is known, and said to be unknown when it is not', () => {
  const withGate = leg({
    key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z', gate: 'D7',
  });
  assert.match(only('depart_now', computeMoments(groupTrips([withGate])[0], NOW, OPTS))[0].body, /D7/);

  const noGate = leg({
    key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
  });
  assert.match(only('depart_now', computeMoments(groupTrips([noGate])[0], NOW, OPTS))[0].body, /announced/i);
});

test('landed: only once the flight really landed, with the belt and a way into town', () => {
  const inAir = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
  });
  assert.equal(only('landed', computeMoments(groupTrips([inAir])[0], NOW, OPTS)).length, 0);

  const down = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    actualArr: '2027-03-15T06:35:00Z', belt: '12', extras: HOTEL,
  });
  const landed = only('landed', computeMoments(groupTrips([down])[0], NOW, OPTS));
  assert.equal(landed.length, 1);
  assert.match(landed[0].body, /12/, 'the baggage belt');
  assert.match(landed[0].body, /Grab|BTS|MRT/, 'a way into town from getIntoTown');
  assert.match(landed[0].body, /Riva Surya/);
  assert.ok(landed[0].triggerMs > Date.parse('2027-03-15T06:35:00Z'), 'after the walk to the belt');
});

test('activity reminder: two hours ahead, and only with a pickup location', () => {
  const at = '2027-03-16T09:00:00Z';
  const withPickup = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    extras: { excursion: { name: 'Grand Palace tour', dateTime: at, pickupLocation: 'hotel lobby' } },
  });
  const hit = only('activity_reminder', computeMoments(groupTrips([withPickup])[0], NOW, OPTS));
  assert.equal(hit.length, 1);
  assert.equal(hit[0].triggerMs, Date.parse(at) - 120 * 60_000);
  assert.match(hit[0].body, /hotel lobby/);

  const noPickup = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    extras: { excursion: { name: 'Grand Palace tour', dateTime: at } },
  });
  assert.equal(only('activity_reminder', computeMoments(groupTrips([noPickup])[0], NOW, OPTS)).length, 0);
});

test('car return: 18:00 the day before the car is due back', () => {
  const withCar = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    extras: {
      carRental: {
        company: 'Sixt',
        pickupTime: '2027-03-15T09:00:00Z',
        dropoffTime: '2027-03-20T10:00:00Z',
        dropoffLocation: 'BKK Airport',
      },
    },
  });
  const hit = only('car_return', computeMoments(groupTrips([withCar])[0], NOW, OPTS));
  assert.equal(hit.length, 1);
  assert.equal(new Date(hit[0].triggerMs).toISOString(), '2027-03-19T18:00:00.000Z');
  assert.match(hit[0].body, /Sixt/);
  assert.match(hit[0].body, /BKK Airport/);
});

test('gate_change is in the type but no rule was specified, so nothing produces one', () => {
  const group = groupTrips(connectionPair('2027-03-15T06:50:00Z'))[0];
  assert.equal(only('gate_change', computeMoments(group, NOW, OPTS)).length, 0);
});

test('every shipped locale gets its own copy, anything else falls back to English', () => {
  const f = leg({
    key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
  });
  const group = groupTrips([f])[0];
  assert.match(only('depart_now', computeMoments(group, NOW, { locale: 'nl' }))[0].title, /Vertrek nu/);
  assert.match(only('depart_now', computeMoments(group, NOW, { locale: 'de' }))[0].title, /Zeit aufzubrechen/);
  // Swedish is not shipped, so it reads English; a region tag still finds its language.
  assert.match(only('depart_now', computeMoments(group, NOW, { locale: 'sv' }))[0].title, /Time to leave/);
  assert.match(only('depart_now', computeMoments(group, NOW, { locale: 'pt-BR' }))[0].title, /Hora de sair/);
});

test('an empty group produces nothing, and moments come back in trigger order', () => {
  assert.deepEqual(
    computeMoments({ key: 'k', name: 'n', startDate: '', endDate: '', flights: [], extras: {} }, NOW, OPTS),
    [],
  );
  const busy = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    extras: {
      ...HOTEL,
      carRental: { company: 'Sixt', pickupTime: '2027-03-15T09:00:00Z', dropoffTime: '2027-03-20T10:00:00Z' },
      excursion: { name: 'Grand Palace tour', dateTime: '2027-03-16T09:00:00Z', pickupLocation: 'hotel lobby' },
    },
  });
  const moments = computeMoments(groupTrips([busy])[0], NOW, OPTS);
  assert.ok(moments.length >= 4);
  const triggers = moments.map(m => m.triggerMs);
  assert.deepEqual(triggers, [...triggers].sort((a, b) => a - b));
});

test('upcomingMoments drops what has already passed', () => {
  const f = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z', extras: HOTEL,
  });
  const moments = computeMoments(groupTrips([f])[0], NOW, OPTS);
  const later = Date.parse('2027-03-14T00:00:00Z');
  assert.ok(upcomingMoments(moments, later).length < moments.length);
  assert.ok(upcomingMoments(moments, later).every(m => m.triggerMs > later));
});

test('priority: the connection is the only one that interrupts', () => {
  assert.equal(momentPriority('connection_risk'), 'max');
  assert.equal(momentPriority('delay_impact'), 'high');
  assert.equal(momentPriority('depart_now'), 'high');
  assert.equal(momentPriority('evening_before'), 'normal');
  assert.equal(momentPriority('landed'), 'normal');
  assert.equal(momentPriority('activity_reminder'), 'normal');
  assert.equal(momentPriority('car_return'), 'normal');
  assert.equal(momentPriority('gate_change'), 'normal');
});

// ── audience ─────────────────────────────────────────────────────────────────

test('every kind declares who it is for, and each moment carries that audience', () => {
  assert.deepEqual(MOMENT_AUDIENCE, {
    evening_before: 'traveler',
    depart_now: 'traveler',
    gate_change: 'both',
    delay_impact: 'both',
    landed: 'both',
    activity_reminder: 'traveler',
    car_return: 'traveler',
    connection_risk: 'both',
    departed: 'follower',
    hotel_arrived: 'follower',
  });
  const busy = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    actualArr: '2027-03-15T06:35:00Z', belt: '12',
    extras: {
      ...HOTEL,
      carRental: { company: 'Sixt', pickupTime: '2027-03-15T09:00:00Z', dropoffTime: '2027-03-20T10:00:00Z' },
      excursion: { name: 'Grand Palace tour', dateTime: '2027-03-16T09:00:00Z', pickupLocation: 'hotel lobby' },
    },
  });
  for (const m of computeMoments(groupTrips([busy])[0], NOW, OPTS)) {
    assert.equal(m.audience, MOMENT_AUDIENCE[m.kind], m.kind);
  }
});

test('a follower moment always carries follower copy; a traveler-only one never does', () => {
  const down = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    actualArr: '2027-03-15T06:35:00Z', belt: '12', extras: HOTEL,
  });
  for (const m of computeMoments(groupTrips([down])[0], NOW, OPTS)) {
    if (m.audience === 'traveler') {
      assert.equal(m.followerBody, undefined, `${m.kind} is traveler-only`);
    } else {
      assert.ok(m.followerTitle && m.followerBody, `${m.kind} needs follower copy`);
    }
  }
});

// ── departed ─────────────────────────────────────────────────────────────────

test('departed: scheduled departure plus 15 minutes when there is no wheels-off time', () => {
  const f = leg({
    key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
  });
  const d = only('departed', computeMoments(groupTrips([f])[0], NOW, { ...OPTS, travelerName: 'Sarah' }));
  assert.equal(d.length, 1);
  assert.equal(d[0].triggerMs, Date.parse('2027-03-14T14:05:00Z') + 15 * 60_000);
  assert.equal(d[0].audience, 'follower');
  assert.equal(d[0].title, 'Sarah has taken off');
  assert.equal(d[0].body, 'KL875 on its way to Bangkok. Arrival: 06:20');
  assert.equal(d[0].urgent, false);
});

test('departed: a real wheels-off time wins over the estimate', () => {
  const f: TripFlight = {
    key: 'kl875',
    flightNumber: 'KL875',
    scheduledTime: '2027-03-14T14:05:00Z',
    flight: {
      origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
      originCountry: 'NL', destCountry: 'TH',
      scheduledDeparture: '2027-03-14T14:05:00Z',
      scheduledArrival: '2027-03-15T06:20:00Z',
      actualDeparture: '2027-03-14T14:32:00Z',
    },
  };
  const d = only('departed', computeMoments(groupTrips([f])[0], NOW, OPTS));
  assert.equal(d[0].triggerMs, Date.parse('2027-03-14T14:32:00Z'));
});

test('departed: without the name the copy uses a neutral phrase, per locale', () => {
  const f = leg({
    key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
  });
  const g = groupTrips([f])[0];
  assert.match(only('departed', computeMoments(g, NOW, { locale: 'en' }))[0].title, /^Your travel companion/);
  assert.match(only('departed', computeMoments(g, NOW, { locale: 'nl' }))[0].title, /^Je reisgenoot/);
});

// ── hotel_arrived ────────────────────────────────────────────────────────────

test('hotel_arrived: 90 minutes after landing, naming the hotel when it is known', () => {
  const down = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    actualArr: '2027-03-15T06:35:00Z', extras: HOTEL,
  });
  const h = only('hotel_arrived', computeMoments(groupTrips([down])[0], NOW, { ...OPTS, travelerName: 'Sarah' }));
  assert.equal(h.length, 1);
  assert.equal(h[0].triggerMs, Date.parse('2027-03-15T06:35:00Z') + 90 * 60_000);
  assert.equal(h[0].audience, 'follower');
  assert.equal(h[0].title, 'Sarah has arrived');
  assert.match(h[0].body, /Likely checked in at Riva Surya/);
});

test('hotel_arrived: no hotel still says they are probably settled, and never before landing', () => {
  const noHotel = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    actualArr: '2027-03-15T06:35:00Z',
  });
  const h = only('hotel_arrived', computeMoments(groupTrips([noHotel])[0], NOW, OPTS));
  assert.equal(h.length, 1);
  assert.match(h[0].body, /Likely at the hotel/);

  const stillFlying = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z', extras: HOTEL,
  });
  assert.equal(only('hotel_arrived', computeMoments(groupTrips([stillFlying])[0], NOW, OPTS)).length, 0);
});

// ── landed, two voices ───────────────────────────────────────────────────────

test('landed: the traveler gets the belt, the follower gets the local time', () => {
  const down = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    actualArr: '2027-03-15T06:35:00Z', belt: '12', extras: HOTEL,
  });
  const m = only('landed', computeMoments(groupTrips([down])[0], NOW, { ...OPTS, travelerName: 'Sarah' }))[0];
  assert.match(m.body, /12/, 'traveler body keeps the baggage belt');
  assert.equal(m.followerTitle, 'Sarah has landed in Bangkok ✈️');
  assert.match(m.followerBody || '', /Local time: /);
  assert.doesNotMatch(m.followerBody || '', /12/, 'the belt is useless to someone at home');
});

test('follower copy exists in all thirteen shipped locales, and falls back to English', () => {
  const down = leg({
    key: 'kl875', number: 'KL875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', schedArr: '2027-03-15T06:20:00Z',
    actualArr: '2027-03-15T06:35:00Z', extras: HOTEL,
  });
  const g = groupTrips([down])[0];
  const locales = ['nl', 'en', 'th', 'ja', 'zh', 'ko', 'ar', 'id', 'de', 'fr', 'es', 'pt', 'it'];
  // The traveller-facing copy is now translated too, not just the follower copy.
  const departTitles = new Set(locales.map(locale => copyTitleFor(locale)));
  assert.equal(departTitles.size, locales.length, 'no locale silently reuses another\'s traveller copy');
  const departedTitles = new Set<string>();
  for (const locale of locales) {
    const ms = computeMoments(g, NOW, { locale, travelerName: 'Sarah' });
    for (const kind of ['departed', 'hotel_arrived', 'landed']) {
      const hit = only(kind, ms)[0];
      assert.ok(hit, `${locale}: ${kind} missing`);
      const title = kind === 'landed' ? hit.followerTitle : hit.title;
      const body = kind === 'landed' ? hit.followerBody : hit.body;
      assert.ok(title && title.includes('Sarah'), `${locale} ${kind} title must name the traveller`);
      assert.ok(body && body.trim().length > 0, `${locale} ${kind} body empty`);
    }
    departedTitles.add(only('departed', ms)[0].title);
  }
  // Thirteen locales, thirteen distinct headlines — no language silently falling through to another.
  assert.equal(departedTitles.size, locales.length);
  // A language we do not ship reads English, and a region tag still finds its language.
  assert.equal(
    only('departed', computeMoments(g, NOW, { locale: 'sv', travelerName: 'Sarah' }))[0].title,
    'Sarah has taken off',
  );
  assert.equal(
    only('departed', computeMoments(g, NOW, { locale: 'nl-NL', travelerName: 'Sarah' }))[0].title,
    'Sarah is vertrokken',
  );
});
