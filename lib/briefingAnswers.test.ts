import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHECKIN_HOURS_DOMESTIC,
  CHECKIN_HOURS_INTERNATIONAL,
  PEAK_EXTRA_MIN,
  answerCompensation,
  answerHowEarly,
  answerOnSchedule,
  answerWeather,
  formatLead,
  isDomestic,
  isPeakHour,
  leaveLeadMinutes,
  type BriefingAnswerCopy,
} from './briefingAnswers.ts';

const COPY: BriefingAnswerCopy = {
  briefingWeatherAt: (city, temp, condition) => `In ${city} it is ${temp} and ${condition}.`,
  briefingEarlyAirport: (clock, hours) => `Be at the airport around ${clock} — about ${hours} before departure.`,
  briefingFlightOnTime: 'Your flight is on schedule.',
  briefingFlightDelayed: (min) => `Your flight is ${min} minutes late.`,
  briefingEu261Yes: (amount) => `Yes, you are owed ${amount} compensation`,
  briefingEu261No: 'No compensation for this delay',
};

test('domestic is the same country at both ends', () => {
  assert.equal(isDomestic('TH', 'TH'), true);
  assert.equal(isDomestic('th', 'TH'), true);
  assert.equal(isDomestic('TH', 'NL'), false);
  assert.equal(isDomestic('', 'TH'), false, 'unknown is not domestic');
  assert.equal(isDomestic(undefined, undefined), false);
});

test('peak is the morning and the evening rush, and nothing else', () => {
  for (const h of [7, 8, 16, 17, 18]) assert.equal(isPeakHour(h), true, `${h} is peak`);
  for (const h of [6, 9, 12, 15, 19, 22, 0]) assert.equal(isPeakHour(h), false, `${h} is not peak`);
});

test('three hours international, two domestic', () => {
  assert.equal(leaveLeadMinutes({ originCountry: 'TH', destCountry: 'NL', departureHour: 12 }),
    CHECKIN_HOURS_INTERNATIONAL * 60);
  assert.equal(leaveLeadMinutes({ originCountry: 'TH', destCountry: 'TH', departureHour: 12 }),
    CHECKIN_HOURS_DOMESTIC * 60);
});

test('rush hour costs another half hour', () => {
  assert.equal(leaveLeadMinutes({ originCountry: 'TH', destCountry: 'TH', departureHour: 8 }),
    CHECKIN_HOURS_DOMESTIC * 60 + PEAK_EXTRA_MIN);
  assert.equal(leaveLeadMinutes({ originCountry: 'TH', destCountry: 'NL', departureHour: 17 }),
    CHECKIN_HOURS_INTERNATIONAL * 60 + PEAK_EXTRA_MIN);
});

test('an unknown departure hour is not treated as midnight', () => {
  assert.equal(leaveLeadMinutes({ originCountry: 'TH', destCountry: 'NL', departureHour: null }),
    CHECKIN_HOURS_INTERNATIONAL * 60);
  assert.equal(leaveLeadMinutes({ originCountry: 'TH', destCountry: 'NL' }),
    CHECKIN_HOURS_INTERNATIONAL * 60);
});

test('lead times read like a person wrote them', () => {
  assert.equal(formatLead(180), '3h');
  assert.equal(formatLead(150), '2h 30m');
  assert.equal(formatLead(45), '45m');
  assert.equal(formatLead(0), '0m');
  assert.equal(formatLead(-10), '0m');
});

test('how early says both the clock time and the lead', () => {
  assert.equal(answerHowEarly(COPY, { clock: '10:00', leadMinutes: 180 }),
    'Be at the airport around 10:00 — about 3h before departure.');
});

test('without a time there is no advice, rather than made-up advice', () => {
  assert.equal(answerHowEarly(COPY, { clock: '', leadMinutes: 180 }), null);
});

test('the weather answer names the city and the numbers', () => {
  assert.equal(answerWeather(COPY, { city: 'Bangkok', temp: 26.4, condition: 'Rain' }),
    'In Bangkok it is 26° and Rain.');
  assert.equal(answerWeather(COPY, { city: 'Bangkok', temp: 0, condition: 'Snow' }),
    'In Bangkok it is 0° and Snow.', 'zero is a temperature, not a missing one');
});

test('no weather, no sentence', () => {
  assert.equal(answerWeather(COPY, { city: 'Bangkok' }), null);
  assert.equal(answerWeather(COPY, { city: '', temp: 20, condition: 'Sun' }), null);
  assert.equal(answerWeather(COPY, {}), null);
});

test('on schedule, or exactly how late', () => {
  assert.equal(answerOnSchedule(COPY, { delayMinutes: 0 }), 'Your flight is on schedule.');
  assert.equal(answerOnSchedule(COPY, {}), 'Your flight is on schedule.');
  assert.equal(answerOnSchedule(COPY, { delayMinutes: 45 }), 'Your flight is 45 minutes late.');
  // Early is not late.
  assert.equal(answerOnSchedule(COPY, { delayMinutes: -10 }), 'Your flight is on schedule.');
});

test('compensation says the amount when there is one', () => {
  assert.equal(answerCompensation(COPY, { eligible: true, amount: 400 }),
    'Yes, you are owed €400 compensation');
});

test('no entitlement is said plainly, and never with an amount', () => {
  assert.equal(answerCompensation(COPY, { eligible: false, amount: 400 }), 'No compensation for this delay');
  assert.equal(answerCompensation(COPY, { eligible: true, amount: 0 }), 'No compensation for this delay');
  assert.equal(answerCompensation(COPY, null), 'No compensation for this delay');
  assert.equal(answerCompensation(COPY, undefined), 'No compensation for this delay');
});
