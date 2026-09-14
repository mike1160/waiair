const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { MIME_TYPE, createFlightPasses, flightPassContent } = require('./flightPass');
const { createWallet } = require('./walletWebService');
const { ENV, BR75_BKK_AMS, BCBP_TG403, passJsonOf } = require('./passkitFixtures');

const quiet = { log() {}, warn() {}, error() {} };
const values = list => Object.fromEntries(list.map(f => [f.key, f.value]));
const PUSH_TOKEN = 'ab'.repeat(32);
const PRO_USER = 'apple:pro-user';

/** RevenueCat stand-in: the IDs in `ids` have an active "WaiAir Pro" entitlement. */
function proUsers(...ids) {
  const set = new Set(ids);
  const checked = [];
  return { set, checked, isPro: async (id) => { checked.push(id); return set.has(id); } };
}

/** In-memory stand-in for createWalletStore (same return shapes). */
function memoryStore() {
  const passes = new Map();
  const regs = [];
  let clock = Date.parse('2026-09-15T01:00:00.000Z');
  return {
    passes,
    regs,
    async savePass({ serial, kind, flightNumber, content, barcodeSealed, revenueCatUserId }) {
      const old = passes.get(serial);
      const next = JSON.parse(JSON.stringify(content));
      if (old && old.content.statusMessage) next.statusMessage = old.content.statusMessage;
      if (old && old.content.sent) next.sent = old.content.sent;
      clock += 1000;
      passes.set(serial, {
        serial_number: serial,
        pass_kind: kind,
        flight_number: flightNumber,
        content: next,
        barcode_sealed: barcodeSealed || (old && old.barcode_sealed) || null,
        revenuecat_user_id: revenueCatUserId || (old && old.revenuecat_user_id) || null,
        updated_ms: clock,
      });
      return next;
    },
    async getPass(serial) { return passes.has(serial) ? { ...passes.get(serial) } : null; },
    async register({ deviceId, serial, pushToken, flightNumber }) {
      const known = regs.find(r => r.device_id === deviceId && r.serial_number === serial);
      if (known) {
        known.push_token = pushToken;
        return false;
      }
      regs.push({ device_id: deviceId, serial_number: serial, push_token: pushToken, flight_number: flightNumber });
      return true;
    },
    async unregister(deviceId, serial) {
      const i = regs.findIndex(r => r.device_id === deviceId && r.serial_number === serial);
      if (i >= 0) regs.splice(i, 1);
    },
    async updatedSerials(deviceId, since) {
      return regs.filter(r => r.device_id === deviceId)
        .map(r => passes.get(r.serial_number))
        .filter(p => p && (since == null || p.updated_ms > since))
        .map(p => ({ serial_number: p.serial_number, updated_ms: p.updated_ms }));
    },
  };
}

async function serve(wallet) {
  const app = express();
  app.use(express.json());
  app.use('/passes/v1', wallet.router);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return {
    base: `http://127.0.0.1:${server.address().port}/passes/v1`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

const passes = createFlightPasses({ env: ENV });
const content = flightPassContent(BR75_BKK_AMS, 'BR75');

test('Pro user: updatable pass (web service URL, auth token, "Latest update"), stored with the RevenueCat ID; barcode sealed', async () => {
  const store = memoryStore();
  const pro = proUsers(PRO_USER);
  const wallet = createWallet({ store, passes, isPro: pro.isPro, webServiceUrl: 'https://proxy.test/passes/', log: quiet });
  const pass = passJsonOf(await wallet.issuePass('flight', content, { barcode: BCBP_TG403, revenueCatUserId: PRO_USER }));

  assert.equal(pass.webServiceURL, 'https://proxy.test/passes');
  assert.ok(pass.authenticationToken.length >= 16);
  assert.deepEqual(pass.boardingPass.backFields[0], { key: 'update', label: 'Latest update', value: 'No changes yet', changeMessage: '%@' });
  assert.deepEqual(pass.barcodes.map(b => b.format), ['PKBarcodeFormatPDF417']);
  const row = store.passes.get(pass.serialNumber);
  assert.deepEqual([row.pass_kind, row.flight_number, row.revenuecat_user_id], ['flight', 'BR75', PRO_USER]);
  assert.ok(row.barcode_sealed && !row.barcode_sealed.includes('DOE'));
  assert.deepEqual(pro.checked, [PRO_USER]);

  // A re-download keeps the last update text.
  row.content.statusMessage = 'Gate changed to E6';
  const again = passJsonOf(await wallet.issuePass('flight', content, { barcode: BCBP_TG403, revenueCatUserId: PRO_USER }));
  assert.equal(values(again.boardingPass.backFields).update, 'Gate changed to E6');
  assert.equal(again.authenticationToken, pass.authenticationToken);
});

test('free user, no database or a storing failure: working pass without push updates, nothing stored', async () => {
  const store = memoryStore();
  const pro = proUsers(PRO_USER);
  const wallet = createWallet({ store, passes, isPro: pro.isPro, log: quiet });
  for (const revenueCatUserId of ['', '$RCAnonymousID:free']) {
    const free = passJsonOf(await wallet.issuePass('flight', content, { barcode: BCBP_TG403, revenueCatUserId }));
    assert.equal(free.webServiceURL, undefined);
    assert.equal(free.authenticationToken, undefined);
    assert.equal(values(free.boardingPass.backFields).update, undefined);
    assert.deepEqual(free.barcodes.map(b => b.format), ['PKBarcodeFormatPDF417']);
  }
  assert.equal(store.passes.size, 0);
  assert.deepEqual(pro.checked, ['$RCAnonymousID:free']);

  const plain = passJsonOf(await createWallet({ store: null, passes, isPro: pro.isPro, log: quiet }).issuePass('flight', content, { revenueCatUserId: PRO_USER }));
  assert.equal(plain.webServiceURL, undefined);

  const errors = [];
  const failing = { async savePass() { throw new Error('connection refused'); } };
  const log = { ...quiet, error: (...args) => errors.push(args.join(' ')) };
  const fallback = passJsonOf(await createWallet({ store: failing, passes, isPro: pro.isPro, log }).issuePass('pickup', content, { revenueCatUserId: PRO_USER }));
  assert.equal(fallback.webServiceURL, undefined);
  assert.match(errors[0], /storing pass failed/);

  const { base, close } = await serve(createWallet({ store: null, passes, log: quiet }));
  try {
    assert.equal((await fetch(`${base}/devices/d1/registrations/pass.test.waiair`)).status, 503);
  } finally {
    await close();
  }
});

test('web service: register (401 without the token, skipped once Pro lapsed), list changed serials, latest pass (304), unregister', async () => {
  const store = memoryStore();
  const pro = proUsers(PRO_USER);
  const wallet = createWallet({ store, passes, isPro: pro.isPro, webServiceUrl: 'https://proxy.test/passes', log: quiet });
  const issued = passJsonOf(await wallet.issuePass('flight', content, { barcode: BCBP_TG403, revenueCatUserId: PRO_USER }));
  const serial = issued.serialNumber;
  const { base, close } = await serve(wallet);
  const json = { 'Content-Type': 'application/json' };
  const auth = { Authorization: `ApplePass ${issued.authenticationToken}` };
  const body = JSON.stringify({ pushToken: PUSH_TOKEN });
  const regUrl = `${base}/devices/device-1/registrations/pass.test.waiair/${serial}`;
  const listUrl = `${base}/devices/device-1/registrations/pass.test.waiair`;
  const passUrl = `${base}/passes/pass.test.waiair/${serial}`;
  try {
    assert.equal((await fetch(regUrl, { method: 'POST', headers: json, body })).status, 401);
    assert.equal((await fetch(regUrl, { method: 'POST', headers: { ...json, Authorization: 'ApplePass wrong-token-123456789' }, body })).status, 401);
    assert.equal((await fetch(`${base}/devices/device-1/registrations/pass.other/${serial}`, { method: 'POST', headers: { ...json, ...auth }, body })).status, 401);
    assert.equal((await fetch(`${base}/devices/device-1/registrations/pass.test.waiair/PICKUP-X`, { method: 'POST', headers: { ...json, ...auth }, body })).status, 401);
    assert.equal((await fetch(regUrl, { method: 'POST', headers: { ...json, ...auth }, body: JSON.stringify({ pushToken: 'nope' }) })).status, 400);

    // Pro lapsed between download and registration: no push token stored.
    pro.set.delete(PRO_USER);
    assert.equal((await fetch(regUrl, { method: 'POST', headers: { ...json, ...auth }, body })).status, 200);
    assert.deepEqual(store.regs, []);
    pro.set.add(PRO_USER);

    assert.equal((await fetch(regUrl, { method: 'POST', headers: { ...json, ...auth }, body })).status, 201);
    assert.equal((await fetch(regUrl, { method: 'POST', headers: { ...json, ...auth }, body })).status, 200);
    assert.deepEqual(store.regs, [{ device_id: 'device-1', serial_number: serial, push_token: PUSH_TOKEN, flight_number: 'BR75' }]);

    const list = await fetch(listUrl);
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.deepEqual(listed.serialNumbers, [serial]);
    assert.match(listed.lastUpdated, /^\d+$/);
    assert.equal((await fetch(`${listUrl}?passesUpdatedSince=${listed.lastUpdated}`)).status, 204);
    assert.equal((await fetch(`${base}/devices/device-2/registrations/pass.test.waiair`)).status, 204);

    // The updater stored a gate change: listed again, and the new pass shows it with the scanned barcode intact.
    const row = store.passes.get(serial);
    row.content = { ...row.content, gate: 'E6', statusMessage: 'Gate changed to E6' };
    row.updated_ms += 5000;
    const changed = await (await fetch(`${listUrl}?passesUpdatedSince=${listed.lastUpdated}`)).json();
    assert.deepEqual(changed.serialNumbers, [serial]);
    assert.equal(changed.lastUpdated, String(row.updated_ms));

    assert.equal((await fetch(passUrl)).status, 401);
    const latest = await fetch(passUrl, { headers: auth });
    assert.equal(latest.status, 200);
    assert.equal(latest.headers.get('content-type'), MIME_TYPE);
    const latestJson = passJsonOf(Buffer.from(await latest.arrayBuffer()));
    assert.equal(latestJson.serialNumber, serial);
    assert.equal(values(latestJson.boardingPass.auxiliaryFields).gate, 'E6');
    assert.equal(values(latestJson.boardingPass.backFields).update, 'Gate changed to E6');
    assert.deepEqual(latestJson.barcodes, [{ message: BCBP_TG403, format: 'PKBarcodeFormatPDF417', messageEncoding: 'iso-8859-1' }]);
    assert.equal((await fetch(passUrl, { headers: { ...auth, 'If-Modified-Since': latest.headers.get('last-modified') } })).status, 304);

    assert.equal((await fetch(`${base}/log`, { method: 'POST', headers: json, body: JSON.stringify({ logs: ['Web service error'] }) })).status, 200);

    assert.equal((await fetch(regUrl, { method: 'DELETE' })).status, 401);
    assert.equal((await fetch(regUrl, { method: 'DELETE', headers: auth })).status, 200);
    assert.deepEqual(store.regs, []);
    assert.equal((await fetch(listUrl)).status, 204);
  } finally {
    await close();
  }
});

test('pickup pass: light generic design with arrival time, terminal, status; one QR code; own serial; updatable for Pro', async () => {
  const store = memoryStore();
  const wallet = createWallet({ store, passes, isPro: proUsers(PRO_USER).isPro, log: quiet });
  const landed = flightPassContent({
    ...BR75_BKK_AMS,
    status: 'Arrived',
    arrival: { ...BR75_BKK_AMS.arrival, terminal: '3', baggageBelt: '7' },
  }, 'BR75');
  const pass = passJsonOf(await wallet.issuePass('pickup', landed, { revenueCatUserId: PRO_USER }));

  assert.equal(pass.serialNumber, 'PICKUP-BR75-2026-09-15-BKK');
  assert.equal(pass.boardingPass, undefined);
  assert.equal(pass.backgroundColor, 'rgb(246, 241, 229)');
  assert.equal(pass.foregroundColor, 'rgb(13, 27, 46)');
  assert.equal(pass.webServiceURL, 'https://waiair-production.up.railway.app/passes');
  assert.equal(pass.relevantDate.slice(0, 16), '2026-09-15T17:20');
  const g = pass.generic;
  assert.deepEqual(values(g.headerFields), { flight: 'BR75' });
  assert.deepEqual(values(g.primaryFields), { arrives: '19:20' });
  assert.equal(g.primaryFields[0].label, 'ARRIVES AMSTERDAM');
  assert.deepEqual(values(g.secondaryFields), { from: 'Bangkok (BKK)', terminal: '3' });
  assert.deepEqual(values(g.auxiliaryFields), { date: '15 Sep 2026', status: 'Landed', belt: '7' });
  assert.equal(g.backFields[0].changeMessage, '%@');
  assert.deepEqual(pass.barcodes, [{
    message: 'https://waiair.app/flight/BR75',
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText: 'Scan for live flight updates',
  }]);
  const keys = ['headerFields', 'primaryFields', 'secondaryFields', 'auxiliaryFields', 'backFields'].flatMap(k => g[k].map(f => f.key));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(store.passes.get('PICKUP-BR75-2026-09-15-BKK').pass_kind, 'pickup');

  // Before the terminal is known the field is still there (so an update can fill it).
  const early = passJsonOf(await createWallet({ store: null, passes, log: quiet }).issuePass('pickup', content));
  assert.deepEqual(values(early.generic.secondaryFields), { from: 'Bangkok (BKK)', terminal: 'TBA' });
  assert.deepEqual(values(early.generic.auxiliaryFields), { date: '15 Sep 2026', status: 'Scheduled' });
});
