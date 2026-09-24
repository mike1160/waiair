import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paywallHost } from './paywallHost.ts';

test('the paywall renders inside whichever sheet is in front', () => {
  // Nothing presented: the root is the only place it can be.
  assert.equal(paywallHost({}), 'root');
  assert.equal(paywallHost({ addFlightSheetOpen: false, detailOpen: false }), 'root');

  // The search that runs out of free searches lives in the add-flight sheet, so that is where it must show.
  assert.equal(paywallHost({ addFlightSheetOpen: true }), 'addFlight');
  // The flight page asks for it for the live map.
  assert.equal(paywallHost({ detailOpen: true }), 'detail');
  // "Add a return flight" opens the sheet on top of the flight page: the sheet is in front and wins.
  assert.equal(paywallHost({ addFlightSheetOpen: true, detailOpen: true }), 'addFlight');
});

test('exactly one host is chosen, so the paywall is never asked to present twice', () => {
  const states = [
    { addFlightSheetOpen: false, detailOpen: false },
    { addFlightSheetOpen: true, detailOpen: false },
    { addFlightSheetOpen: false, detailOpen: true },
    { addFlightSheetOpen: true, detailOpen: true },
  ];
  for (const state of states) {
    const host = paywallHost(state);
    const active = [
      host === 'addFlight',
      host === 'detail',
      host === 'root',
    ].filter(Boolean);
    assert.equal(active.length, 1, JSON.stringify(state));
  }
});
