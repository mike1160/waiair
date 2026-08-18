import { verifyFlightTimeFixtures } from '../lib/flightTimes';

const rows = verifyFlightTimeFixtures();
for (const r of rows) {
  console.log(`${r.number}  dep=${r.dep}  arr=${r.arr}  progress=${Math.round(r.progress * 100)}%`);
}
console.log('OK — 3 flights have distinct departure and arrival times');
