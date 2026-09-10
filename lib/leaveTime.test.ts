import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homeRelativeDayOffset } from './homeNow.ts';
import {
  countersOpenUtcMs,
  datePushIdsToCancel,
  eveningPushFireUtcMs,
  leaveAtUtcMs,
  leavePushFireUtcMs,
  shouldRescheduleDatePushes,
  shouldScheduleEveningPush,
  shouldScheduleLeavePush,
} from './leaveTime.ts';
import {
  hasImmediatePassengerPush,
  planPassengerDatePushes,
  type DatePushCopy,
} from './scheduledFlightPushes.ts';

/** Wednesday 9 Sep 2026, 12:00 in Bangkok. */
const NOW = Date.parse('2026-09-09T12:00:00+07:00');
const DEP_TOMORROW = Date.parse('2026-09-10T16:50:00+07:00');
const DEP_TODAY = Date.parse('2026-09-09T16:50:00+07:00');
const EVENING_20 = Date.parse('2026-09-09T20:00:00+07:00');
const SAME_DAY_07 = Date.parse('2026-09-09T07:00:00+07:00');

const COPY: DatePushCopy = {
  pushTomorrowTitle: (num, city) => `${num} · Tomorrow to ${city}`,
  pushTomorrowBody: (dep, from, checkin, gateTime) =>
    `${dep} from ${from} · check-in opens ${checkin}, gate at ${gateTime}`,
  pushTomorrowBodyPass: (dep, from, gateTime) => `${dep} from ${from} · gate at ${gateTime}`,
  pushLeaveTitle: (num, city, leave) => `${num} · Leave for ${city} at ${leave}`,
  pushLeaveBody: (dep, from, travel) => `${dep} from ${from} · ${travel} min to the airport`,
};

const BKK = {
  flightNumber: 'KL897',
  originIata: 'BKK',
  originCountry: 'TH',
  destCountry: 'NL',
  destCity: 'Amsterdam',
  fromCity: 'Bangkok',
  travelMin: 45 as number | null,
  copy: COPY,
};

test('leave intl / domestic / tight / no-estimate', () => {
  const dep = DEP_TOMORROW;
  const intl = leaveAtUtcMs(dep, { international: true });
  assert.equal(intl.around, true);
  assert.equal(intl.leadMin, 180);
  assert.equal(intl.travelMin, 45);
  assert.equal(intl.leaveAt, Date.parse('2026-09-10T13:05:00+07:00'));

  const domestic = leaveAtUtcMs(dep, { international: false });
  assert.equal(domestic.leadMin, 90);
  assert.equal(domestic.leaveAt, Date.parse('2026-09-10T14:35:00+07:00'));

  const tightIntl = leaveAtUtcMs(dep, { international: true, tight: true });
  assert.equal(tightIntl.leadMin, 120);
  assert.equal(tightIntl.leaveAt, Date.parse('2026-09-10T14:05:00+07:00'));

  const tightDom = leaveAtUtcMs(dep, { international: false, tight: true });
  assert.equal(tightDom.leadMin, 60);
  assert.equal(tightDom.leaveAt, Date.parse('2026-09-10T15:05:00+07:00'));

  const known = leaveAtUtcMs(dep, { international: true, travelMin: 30 });
  assert.equal(known.around, false);
  assert.equal(known.leaveAt, Date.parse('2026-09-10T13:20:00+07:00'));

  const pass = leaveAtUtcMs(dep, { international: true, boardingPass: true });
  assert.equal(pass.leadMin, 150);
  assert.equal(pass.leaveAt, Date.parse('2026-09-10T13:35:00+07:00'));
});

test('evening DATE fires at 20:00 origin TZ the calendar day before departure', () => {
  const fire = eveningPushFireUtcMs(DEP_TOMORROW, 'BKK', 'TH');
  assert.equal(fire, EVENING_20);
  const offset = homeRelativeDayOffset(DEP_TOMORROW, NOW, 'BKK', 'TH');
  assert.equal(shouldScheduleEveningPush(fire, NOW, offset), true);
  const plan = planPassengerDatePushes(DEP_TOMORROW, NOW, BKK);
  assert.ok(plan.evening);
  assert.equal(plan.evening.fireAt, EVENING_20);
  assert.equal(plan.evening.title, 'KL897 · Tomorrow to Amsterdam');
  assert.match(plan.evening.body, /16:50 from Bangkok/);
  assert.match(plan.evening.body, /check-in opens 13:50/);
  assert.match(plan.evening.body, /gate at 16:20/);
  assert.equal(hasImmediatePassengerPush(plan, NOW), false);
});

test('flight today in origin TZ → no evening push', () => {
  const fire = eveningPushFireUtcMs(DEP_TODAY, 'BKK', 'TH');
  const offset = homeRelativeDayOffset(DEP_TODAY, NOW, 'BKK', 'TH');
  assert.equal(offset, 0);
  assert.equal(shouldScheduleEveningPush(fire, NOW, offset), false);
  const plan = planPassengerDatePushes(DEP_TODAY, NOW, BKK);
  assert.equal(plan.evening, null);
});

test('16:50 origin-local at 07:00 same day is Today, not Tomorrow', () => {
  assert.equal(homeRelativeDayOffset(DEP_TODAY, SAME_DAY_07, 'BKK', 'TH'), 0);
  const fire = eveningPushFireUtcMs(DEP_TODAY, 'BKK', 'TH');
  assert.equal(shouldScheduleEveningPush(fire, SAME_DAY_07, 0), false);
  const plan = planPassengerDatePushes(DEP_TODAY, SAME_DAY_07, BKK);
  assert.equal(plan.evening, null);
  assert.equal(hasImmediatePassengerPush(plan, SAME_DAY_07), false);
});

test('evening 20:00 already past → no catch-up', () => {
  const after20 = Date.parse('2026-09-09T21:00:00+07:00');
  const fire = eveningPushFireUtcMs(DEP_TOMORROW, 'BKK', 'TH');
  const offset = homeRelativeDayOffset(DEP_TOMORROW, after20, 'BKK', 'TH');
  assert.equal(shouldScheduleEveningPush(fire, after20, offset), false);
  const plan = planPassengerDatePushes(DEP_TOMORROW, after20, BKK);
  assert.equal(plan.evening, null);
  assert.equal(hasImmediatePassengerPush(plan, after20), false);
});

test('add fires nothing — DATE fire times are always in the future', () => {
  const plan = planPassengerDatePushes(DEP_TOMORROW, NOW, BKK);
  assert.equal(hasImmediatePassengerPush(plan, NOW), false);
  assert.ok(plan.evening && plan.evening.fireAt > NOW);
  assert.ok(plan.leave && plan.leave.fireAt > NOW);
});

test('leave push skipped when leaveAt is already past at schedule time', () => {
  const leaveAt = leaveAtUtcMs(DEP_TOMORROW, { international: true, travelMin: 45 }).leaveAt;
  const afterLeave = leaveAt + 60_000;
  assert.equal(shouldScheduleLeavePush(leaveAt, afterLeave), false);
  const plan = planPassengerDatePushes(DEP_TOMORROW, afterLeave, BKK);
  assert.equal(plan.leave, null);
});

test('leave DATE is leaveAt − 10 min and title is flight number + city', () => {
  const leaveAt = leaveAtUtcMs(DEP_TOMORROW, { international: true, travelMin: 45 }).leaveAt;
  assert.equal(leaveAt, Date.parse('2026-09-10T13:05:00+07:00'));
  assert.equal(leavePushFireUtcMs(leaveAt), Date.parse('2026-09-10T12:55:00+07:00'));
  const plan = planPassengerDatePushes(DEP_TOMORROW, NOW, BKK);
  assert.ok(plan.leave);
  assert.equal(plan.leave.leaveAt, leaveAt);
  assert.equal(plan.leave.fireAt, Date.parse('2026-09-10T12:55:00+07:00'));
  assert.equal(plan.leave.title, 'KL897 · Leave for Amsterdam at 13:05');
  assert.equal(plan.leave.body, '16:50 from Bangkok · 45 min to the airport');
});

test('domestic counters open dep − 2 h; intl dep − 3 h', () => {
  assert.equal(countersOpenUtcMs(DEP_TOMORROW, false), Date.parse('2026-09-10T14:50:00+07:00'));
  assert.equal(countersOpenUtcMs(DEP_TOMORROW, true), Date.parse('2026-09-10T13:50:00+07:00'));
});

test('boarding pass drops check-in from evening body', () => {
  const plan = planPassengerDatePushes(DEP_TOMORROW, NOW, { ...BKK, hasBoardingPass: true });
  assert.ok(plan.evening);
  assert.equal(plan.evening.body, '16:50 from Bangkok · gate at 16:20');
  assert.equal(plan.evening.body.includes('check-in'), false);
});

test('DATE pushes cancel on untrack', () => {
  assert.deepEqual(datePushIdsToCancel({ evening: 'e1', leave: 'l1' }), ['e1', 'l1']);
  assert.deepEqual(datePushIdsToCancel({ evening: 'e1' }), ['e1']);
  assert.deepEqual(datePushIdsToCancel(undefined), []);
});

test('reschedule when departure shifts ≥ 10 min', () => {
  assert.equal(shouldRescheduleDatePushes(DEP_TOMORROW, DEP_TOMORROW + 9 * 60_000), false);
  assert.equal(shouldRescheduleDatePushes(DEP_TOMORROW, DEP_TOMORROW + 10 * 60_000), true);
  assert.equal(shouldRescheduleDatePushes(undefined, DEP_TOMORROW), true);
});
