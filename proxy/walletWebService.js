/**
 * Apple Wallet web service (PassKit): passes carry webServiceURL + authenticationToken, iPhones register for updates here
 * and download changed passes after an APNs push (walletUpdates.js). Mounted at /passes/v1; Apple appends the paths:
 *   POST   /devices/:deviceId/registrations/:passTypeIdentifier/:serial   register (201 new, 200 known)
 *   DELETE /devices/:deviceId/registrations/:passTypeIdentifier/:serial   unregister
 *   GET    /devices/:deviceId/registrations/:passTypeIdentifier           serials changed since ?passesUpdatedSince
 *   GET    /passes/:passTypeIdentifier/:serial                            latest .pkpass (304 when not modified)
 *   POST   /log                                                           device error log
 */
const express = require('express');
const { MIME_TYPE, passSerial } = require('./flightPass');
const { authenticationToken, openBarcode, sameToken, sealBarcode } = require('./walletUpdates');

const DEFAULT_WEB_SERVICE_URL = 'https://waiair-production.up.railway.app/passes';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const PUSH_TOKEN_PATTERN = /^[0-9A-Fa-f]{32,200}$/;

/**
 * @param {object} opts
 * @param {ReturnType<import('./walletUpdates').createWalletStore> | null} opts.store null without a database: passes
 *   are still issued, just without updates
 * @param {ReturnType<import('./flightPass').createFlightPasses>} opts.passes
 * @param {(revenueCatUserId: string) => Promise<boolean>} [opts.isPro] RevenueCat "WaiAir Pro" check (proEntitlement.js):
 *   push updates are Pro only
 */
function createWallet({ store, passes, webServiceUrl = DEFAULT_WEB_SERVICE_URL, isPro = async () => false, log = console }) {
  const url = String(webServiceUrl || DEFAULT_WEB_SERVICE_URL).replace(/\/$/, '');

  async function webServiceFor(serial) {
    return { url, authenticationToken: authenticationToken(await passes.secret('auth'), serial) };
  }

  function buildFor(kind, content, { barcode = '', webService = null } = {}) {
    return kind === 'pickup'
      ? passes.buildPickup(content, { webService })
      : passes.build(content, { barcode, webService });
  }

  /**
   * .pkpass for a download. Pro users (RevenueCat ID sent by the app, entitlement checked here) get an updatable pass
   * stored in wallet_passes; free users — and any database failure — get a working pass without push updates.
   */
  async function issuePass(kind, content, { barcode = '', revenueCatUserId = '' } = {}) {
    if (!store || !revenueCatUserId || !(await isPro(revenueCatUserId))) return buildFor(kind, content, { barcode });
    const serial = passSerial(content, { kind, barcode });
    let stored;
    let webService;
    try {
      const barcodeSealed = barcode ? sealBarcode(await passes.secret('barcode'), barcode) : null;
      stored = await store.savePass({ serial, kind, flightNumber: content.number, content, barcodeSealed, revenueCatUserId });
      webService = await webServiceFor(serial);
    } catch (e) {
      log.error('[wallet] storing pass failed (issued without updates):', serial, e && e.message);
      return buildFor(kind, content, { barcode });
    }
    return buildFor(kind, { ...content, statusMessage: stored.statusMessage || '' }, { barcode, webService });
  }

  const router = express.Router();

  /** Stored pass when the pass type and "Authorization: ApplePass <token>" match; otherwise answers 401 and returns null. */
  async function authorizedPass(req, res) {
    const serial = String(req.params.serial || '');
    const header = String(req.get('authorization') || '');
    const presented = header.startsWith('ApplePass ') ? header.slice('ApplePass '.length).trim() : '';
    if (req.params.passTypeIdentifier !== passes.passTypeId || !serial || !presented
      || !sameToken(presented, authenticationToken(await passes.secret('auth'), serial))) {
      res.sendStatus(401);
      return null;
    }
    const pass = await store.getPass(serial);
    if (!pass) {
      res.sendStatus(401);
      return null;
    }
    return pass;
  }

  function handle(fn) {
    return async (req, res) => {
      if (!store || !passes.configured) return res.sendStatus(503);
      try {
        return await fn(req, res);
      } catch (e) {
        log.error('[wallet]', req.method, req.path, '|', e && e.message);
        return res.headersSent ? undefined : res.sendStatus(500);
      }
    };
  }

  router.post('/devices/:deviceId/registrations/:passTypeIdentifier/:serial', handle(async (req, res) => {
    const pass = await authorizedPass(req, res);
    if (!pass) return undefined;
    const pushToken = String((req.body && req.body.pushToken) || '');
    if (!DEVICE_ID_PATTERN.test(req.params.deviceId) || !PUSH_TOKEN_PATTERN.test(pushToken)) return res.sendStatus(400);
    // Push updates are Pro: re-check the entitlement of whoever downloaded the pass before storing the push token.
    if (!(await isPro(pass.revenuecat_user_id))) {
      log.warn('[wallet] registration skipped, no active Pro:', pass.serial_number);
      return res.sendStatus(200);
    }
    const created = await store.register({
      deviceId: req.params.deviceId,
      serial: pass.serial_number,
      pushToken,
      flightNumber: pass.flight_number,
    });
    return res.sendStatus(created ? 201 : 200);
  }));

  router.delete('/devices/:deviceId/registrations/:passTypeIdentifier/:serial', handle(async (req, res) => {
    const pass = await authorizedPass(req, res);
    if (!pass) return undefined;
    await store.unregister(req.params.deviceId, pass.serial_number);
    return res.sendStatus(200);
  }));

  router.get('/devices/:deviceId/registrations/:passTypeIdentifier', handle(async (req, res) => {
    if (req.params.passTypeIdentifier !== passes.passTypeId || !DEVICE_ID_PATTERN.test(req.params.deviceId)) {
      return res.sendStatus(204);
    }
    const since = /^\d{1,15}$/.test(String(req.query.passesUpdatedSince || '')) ? Number(req.query.passesUpdatedSince) : null;
    const rows = await store.updatedSerials(req.params.deviceId, since);
    if (!rows.length) return res.sendStatus(204);
    return res.json({
      serialNumbers: rows.map(r => r.serial_number),
      lastUpdated: String(Math.max(...rows.map(r => r.updated_ms))),
    });
  }));

  router.get('/passes/:passTypeIdentifier/:serial', handle(async (req, res) => {
    const pass = await authorizedPass(req, res);
    if (!pass) return undefined;
    const modifiedSince = Date.parse(String(req.get('if-modified-since') || ''));
    if (Number.isFinite(modifiedSince) && Math.floor(pass.updated_ms / 1000) * 1000 <= modifiedSince) {
      return res.sendStatus(304);
    }
    const barcode = pass.barcode_sealed ? openBarcode(await passes.secret('barcode'), pass.barcode_sealed) : '';
    const buffer = await buildFor(pass.pass_kind, pass.content, { barcode, webService: await webServiceFor(pass.serial_number) });
    res.setHeader('Content-Type', MIME_TYPE);
    res.setHeader('Last-Modified', new Date(pass.updated_ms).toUTCString());
    return res.send(buffer);
  }));

  router.post('/log', (req, res) => {
    const logs = Array.isArray(req.body && req.body.logs) ? req.body.logs.slice(0, 20) : [];
    for (const line of logs) log.warn('[wallet] device log:', String(line).slice(0, 500));
    res.sendStatus(200);
  });

  return { router, issuePass };
}

module.exports = { DEFAULT_WEB_SERVICE_URL, createWallet };
