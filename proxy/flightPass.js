/**
 * Apple Wallet passes for a flight: the boarding-pass style flight pass (not a real boarding pass; the QR code links to
 * WaiAir for live updates) and the lighter pickup pass for someone collecting a passenger. Signed with the Pass Type ID
 * certificate from PASSKIT_P12_BASE64 / PASSKIT_P12_PASSWORD plus Apple's WWDR intermediate: PASSKIT_WWDR_PEM when set,
 * else the WWDR certificate inside the .p12 chain, else Apple WWDR G4 fetched once from apple.com.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const forge = require('node-forge');
const { PKPass } = require('passkit-generator');
const core = require('./liff-core');
const { bcbpPassengerFields } = require('./passTokens');

const MODEL_DIR = path.join(__dirname, 'passes', 'flight.pass');
const PICKUP_MODEL_DIR = path.join(__dirname, 'passes', 'pickup.pass');
const WWDR_G4_URL = 'https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer';
const MIME_TYPE = 'application/vnd.apple.pkpass';
const FLIGHT_LINK = 'https://waiair.app/flight/';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Back-of-pass field that carries push update texts; Wallet shows its value as the notification ("%@"). */
const UPDATE_FIELD_KEY = 'update';
const NO_UPDATES_TEXT = 'No changes yet';

/** Pass configuration from the environment; null when a required variable is missing (the route answers 501). */
function passkitConfig(env) {
  const p12Base64 = env.PASSKIT_P12_BASE64;
  const password = env.PASSKIT_P12_PASSWORD;
  const passTypeId = env.PASS_TYPE_ID;
  const teamId = env.TEAM_ID;
  if (!p12Base64 || password == null || !passTypeId || !teamId) return null;
  return { p12Base64, password, passTypeId, teamId, wwdrPem: env.PASSKIT_WWDR_PEM || '' };
}

function bagsOf(p12, type) {
  return p12.getBags({ bagType: type })[type] || [];
}

function isWwdr(cert) {
  const cn = cert.subject.getField('CN');
  return !!(cn && /Worldwide Developer Relations/i.test(String(cn.value)));
}

/**
 * .p12 (base64) → { signerCert, signerKey, wwdr } as PEM. The signer certificate is the one matching the private key;
 * `wwdr` is set only when the chain contains Apple's WWDR intermediate. Throws on a wrong password or a .p12 without both.
 */
function certificatesFromP12(p12Base64, password) {
  const der = forge.util.decode64(String(p12Base64).replace(/\s+/g, ''));
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), password);
  const keyBag = bagsOf(p12, forge.pki.oids.pkcs8ShroudedKeyBag)[0] || bagsOf(p12, forge.pki.oids.keyBag)[0];
  const certs = bagsOf(p12, forge.pki.oids.certBag).map(b => b.cert).filter(Boolean);
  if (!keyBag || !keyBag.key || !certs.length) throw new Error('passkit_p12_incomplete');
  const keyPublicPem = forge.pki.publicKeyToPem(forge.pki.setRsaPublicKey(keyBag.key.n, keyBag.key.e));
  const signer = certs.find(c => forge.pki.publicKeyToPem(c.publicKey) === keyPublicPem) || certs.find(c => !isWwdr(c));
  if (!signer) throw new Error('passkit_p12_incomplete');
  const wwdr = certs.find(isWwdr);
  return {
    signerCert: forge.pki.certificateToPem(signer),
    signerKey: forge.pki.privateKeyToPem(keyBag.key),
    wwdr: wwdr ? forge.pki.certificateToPem(wwdr) : '',
  };
}

/** Apple WWDR G4 (DER from apple.com) → PEM. */
async function fetchWwdrPem(fetchImpl) {
  const res = await fetchImpl(WWDR_G4_URL);
  if (!res.ok) throw new Error(`passkit_wwdr_http_${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  return forge.pki.certificateToPem(forge.pki.certificateFromAsn1(forge.asn1.fromDer(bytes.toString('binary'))));
}

function sideTime(side) {
  if (!side) return null;
  for (const k of ['revisedTime', 'predictedTime', 'scheduledTime']) {
    const t = side[k];
    if (t && (t.local || t.utc)) return t;
  }
  return null;
}

/** AeroDataBox time → { clock: 'HH:MM' local, ymd: 'YYYY-MM-DD' local, ms: UTC epoch or null }. */
function parseSideTime(time) {
  if (!time) return { clock: '', ymd: '', ms: null };
  const local = String(time.local || '');
  const clock = local.match(/(\d{2}:\d{2})/);
  const ymd = local.match(/^(\d{4}-\d{2}-\d{2})/) || String(time.utc || '').match(/^(\d{4}-\d{2}-\d{2})/);
  const ms = Date.parse(String(time.utc || time.local || '').replace(' ', 'T'));
  return { clock: clock ? clock[1] : '', ymd: ymd ? ymd[1] : '', ms: Number.isFinite(ms) ? ms : null };
}

/** '2026-09-15' → '15 Sep 2026'; '' when not a date. */
function formatPassDate(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || !MONTHS[Number(m[2]) - 1]) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Minutes → '7h 05m' / '55m'; '' when unknown or not positive. */
function formatDuration(min) {
  if (!(min > 0)) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Whole local calendar days between two 'YYYY-MM-DD' strings (arrival "+1"). */
function dayDiff(fromYmd, toYmd) {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
}

/** AeroDataBox baggage belt → '7'; '' for placeholders such as "TBA" (same rules as lib/baggageBelt.ts). */
function cleanBaggageBelt(raw) {
  const s = String(raw || '').trim();
  if (!s || /^(—|-|–|n\/?a|tba|tbd|unknown|null|undefined)$/i.test(s)) return '';
  return s.replace(/^belt\s*/i, '').trim();
}

/** Date, ISO string (content read back from Postgres) or epoch → Date; null when unknown. */
function toDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Raw AeroDataBox leg → pass content: number, airline, from/to (IATA + city), departure and arrival as local airport
 * clocks, date as "15 Sep 2026", duration, terminal/gate and aircraft when known, plus the live parts the Wallet updater
 * compares (status, delay, arrival terminal, baggage belt). null without both airports or a departure time.
 */
function flightPassContent(raw, requestedNumber) {
  if (!raw) return null;
  const dep = raw.departure || {};
  const arr = raw.arrival || {};
  const depAp = dep.airport || {};
  const arrAp = arr.airport || {};
  const from = String(depAp.iata || depAp.icao || '').toUpperCase();
  const to = String(arrAp.iata || arrAp.icao || '').toUpperCase();
  const depTime = sideTime(dep);
  if (!from || !to || !depTime) return null;
  const departure = parseSideTime(depTime);
  const arrival = parseSideTime(sideTime(arr));
  const durationMin = departure.ms != null && arrival.ms != null ? Math.round((arrival.ms - departure.ms) / 60_000) : 0;
  const plusDays = departure.ymd && arrival.ymd ? dayDiff(departure.ymd, arrival.ymd) : 0;
  const number = String(raw.number || requestedNumber || '').replace(/\s+/g, '').toUpperCase();
  const summary = core.flightSummary(raw);
  return {
    number,
    airline: String((raw.airline && raw.airline.name) || ''),
    from,
    fromCity: String(depAp.municipalityName || depAp.name || from),
    to,
    toCity: String(arrAp.municipalityName || arrAp.name || to),
    departureClock: departure.clock,
    departureDate: departure.ymd,
    departureDateLabel: formatPassDate(departure.ymd),
    departureAt: departure.ms != null ? new Date(departure.ms) : null,
    arrivalClock: arrival.clock ? `${arrival.clock}${plusDays > 0 ? ` +${plusDays}` : ''}` : '',
    arrivalTime: arrival.clock,
    arrivalDateLabel: formatPassDate(arrival.ymd),
    arrivalAt: arrival.ms != null ? new Date(arrival.ms) : null,
    duration: formatDuration(durationMin),
    gate: String(dep.gate || ''),
    terminal: String(dep.terminal || ''),
    arrivalTerminal: String(arr.terminal || ''),
    baggageBelt: cleanBaggageBelt(arr.baggageBelt || arr.baggage),
    aircraft: String((raw.aircraft && raw.aircraft.model) || ''),
    status: summary ? summary.status : 'scheduled',
    delayMin: summary ? summary.delayMin : 0,
    link: `${FLIGHT_LINK}${encodeURIComponent(number)}`,
  };
}

/**
 * Wallet serial number: "BR75-2026-09-15-BKK" for the flight pass, "-{hash}" per scanned boarding pass (two passengers on
 * one flight must not replace each other), "PICKUP-BR75-2026-09-15-BKK" for the pickup pass.
 */
function passSerial(content, { kind = 'flight', barcode = '' } = {}) {
  const passenger = barcode ? crypto.createHash('sha256').update(barcode).digest('hex').slice(0, 10) : '';
  const parts = [kind === 'pickup' ? 'PICKUP' : '', content.number, content.departureDate, content.from, passenger];
  return parts.filter(Boolean).join('-');
}

function readModel(modelDir) {
  const buffers = {};
  for (const name of fs.readdirSync(modelDir)) {
    const file = path.join(modelDir, name);
    if (fs.statSync(file).isFile()) buffers[name] = fs.readFileSync(file);
  }
  return buffers;
}

/**
 * @param {{ env?: object, fetchImpl?: Function, modelDir?: string, pickupModelDir?: string }} [opts]
 */
function createFlightPasses({
  env = process.env,
  fetchImpl = fetch,
  modelDir = MODEL_DIR,
  pickupModelDir = PICKUP_MODEL_DIR,
} = {}) {
  const config = passkitConfig(env);
  const models = new Map();
  let certificates = null;

  function loadCertificates() {
    if (!certificates) {
      certificates = (async () => {
        const fromP12 = certificatesFromP12(config.p12Base64, config.password);
        const wwdr = config.wwdrPem || fromP12.wwdr || await fetchWwdrPem(fetchImpl);
        return { wwdr, signerCert: fromP12.signerCert, signerKey: fromP12.signerKey };
      })().catch((e) => {
        certificates = null;
        throw e;
      });
    }
    return certificates;
  }

  function model(dir) {
    if (!models.has(dir)) models.set(dir, readModel(dir));
    return models.get(dir);
  }

  /** `webService`: { url, authenticationToken } makes the pass updatable through the Wallet web service. */
  async function newPass(dir, serialNumber, description, webService) {
    if (!config) throw new Error('passkit_not_configured');
    const props = {
      serialNumber,
      description,
      organizationName: 'WaiAir',
      passTypeIdentifier: config.passTypeId,
      teamIdentifier: config.teamId,
    };
    if (webService) {
      props.webServiceURL = webService.url;
      props.authenticationToken = webService.authenticationToken;
    }
    return new PKPass({ ...model(dir) }, await loadCertificates(), props);
  }

  /** "Latest update" on the back: only on updatable passes, always present so a changed value raises a notification. */
  function updateField(content, webService) {
    return webService
      ? [{ key: UPDATE_FIELD_KEY, label: 'Latest update', value: content.statusMessage || NO_UPDATES_TEXT, changeMessage: '%@' }]
      : [];
  }

  /**
   * .pkpass buffer for flightPassContent(); rejects when not configured or signing fails. `barcode`: scanned boarding-pass
   * data (IATA BCBP), shown unchanged as PDF417 for the gate scanner instead of the live-updates QR code.
   */
  async function build(content, { barcode = '', webService = null } = {}) {
    const pass = await newPass(modelDir, passSerial(content, { barcode }), `WaiAir flight ${content.number}`, webService);
    pass.transitType = 'PKTransitTypeAir';
    const field = (list, key, label, value) => { if (value) list.push({ key, label, value }); };

    field(pass.headerFields, 'flight', 'FLIGHT', content.number);
    pass.primaryFields.push(
      { key: 'from', label: content.fromCity, value: content.from },
      { key: 'to', label: content.toCity, value: content.to },
    );
    field(pass.secondaryFields, 'departs', 'DEPARTS', content.departureClock);
    field(pass.secondaryFields, 'arrives', 'ARRIVES', content.arrivalClock);
    field(pass.secondaryFields, 'duration', 'DURATION', content.duration);
    field(pass.secondaryFields, 'date', 'DATE', content.departureDateLabel);
    field(pass.auxiliaryFields, 'terminal', 'TERMINAL', content.terminal);
    field(pass.auxiliaryFields, 'gate', 'GATE', content.gate);
    field(pass.auxiliaryFields, 'aircraft', 'AIRCRAFT', content.aircraft);
    field(pass.auxiliaryFields, 'airline', 'AIRLINE', content.airline);
    if (barcode) {
      const { seat, pnr } = bcbpPassengerFields(barcode);
      field(pass.auxiliaryFields, 'seat', 'SEAT', seat);
      field(pass.auxiliaryFields, 'pnr', 'BOOKING REF', pnr);
    }
    pass.backFields.push(...updateField(content, webService));
    field(pass.backFields, 'arrivalTerminal', 'Arrival terminal', content.arrivalTerminal);
    field(pass.backFields, 'baggageBelt', 'Baggage belt', content.baggageBelt);

    if (barcode) {
      // The scanned boarding pass as PDF417 (IATA boarding-pass standard) for the gate scanner. No altText: the data
      // holds the passenger name and booking reference.
      pass.setBarcodes({ message: barcode, format: 'PKBarcodeFormatPDF417', messageEncoding: 'iso-8859-1' });
      pass.backFields.push(
        { key: 'scanAtGate', label: 'Boarding pass', value: 'Scan at gate. Barcode from your scanned boarding pass.' },
        { key: 'live', label: 'Live flight updates', value: content.link },
        { key: 'notice', label: 'Please note', value: 'Times are local airport times.' },
      );
    } else {
      // Wallet shows barcodes on the front; the back explains the code and that this is not a boarding pass.
      pass.setBarcodes({
        message: content.link,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: 'Scan for live flight updates',
      });
      pass.backFields.push(
        { key: 'live', label: 'Live flight updates', value: `Scan for live flight updates: ${content.link}` },
        { key: 'notice', label: 'Please note', value: 'Not a boarding pass — for tracking only. Times are local airport times.' },
      );
    }
    const departureAt = toDate(content.departureAt);
    if (departureAt) pass.setRelevantDate(departureAt);
    return pass.getAsBuffer();
  }

  /** Pickup pass (generic style, light colours) for someone collecting the passenger: arrival time and terminal. */
  async function buildPickup(content, { webService = null } = {}) {
    const pass = await newPass(pickupModelDir, passSerial(content, { kind: 'pickup' }), `WaiAir pickup ${content.number}`, webService);
    const statusLabels = core.STRINGS.en.status;
    pass.headerFields.push({ key: 'flight', label: 'FLIGHT', value: content.number });
    pass.primaryFields.push({ key: 'arrives', label: `ARRIVES ${content.toCity}`.toUpperCase(), value: content.arrivalTime || 'TBA' });
    pass.secondaryFields.push(
      { key: 'from', label: 'FROM', value: `${content.fromCity} (${content.from})` },
      { key: 'terminal', label: 'TERMINAL', value: content.arrivalTerminal || 'TBA' },
    );
    pass.auxiliaryFields.push(
      { key: 'date', label: 'DATE', value: content.arrivalDateLabel || content.departureDateLabel },
      { key: 'status', label: 'STATUS', value: statusLabels[content.status] || statusLabels.scheduled },
    );
    if (content.baggageBelt) pass.auxiliaryFields.push({ key: 'belt', label: 'BAGGAGE BELT', value: content.baggageBelt });
    pass.backFields.push(
      ...updateField(content, webService),
      { key: 'live', label: 'Live flight updates', value: `Scan for live flight updates: ${content.link}` },
      { key: 'notice', label: 'Please note', value: `For picking someone up at ${content.toCity}. Times are local airport times.` },
    );
    pass.setBarcodes({
      message: content.link,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: 'Scan for live flight updates',
    });
    const arrivalAt = toDate(content.arrivalAt) || toDate(content.departureAt);
    if (arrivalAt) pass.setRelevantDate(arrivalAt);
    return pass.getAsBuffer();
  }

  /** 32-byte key for one purpose (Wallet auth tokens, sealed barcodes), derived from the pass signing key. */
  async function secret(purpose) {
    const { signerKey } = await loadCertificates();
    return crypto.createHmac('sha256', signerKey).update(`waiair-wallet:${purpose}`).digest();
  }

  /** TLS client certificate for APNs: Wallet pass pushes authenticate with the Pass Type ID certificate. */
  async function apnsCredentials() {
    const { signerCert, signerKey } = await loadCertificates();
    return { cert: signerCert, key: signerKey };
  }

  return {
    configured: !!config,
    passTypeId: config ? config.passTypeId : '',
    build,
    buildPickup,
    secret,
    apnsCredentials,
  };
}

module.exports = {
  MIME_TYPE,
  WWDR_G4_URL,
  UPDATE_FIELD_KEY,
  NO_UPDATES_TEXT,
  passkitConfig,
  certificatesFromP12,
  formatPassDate,
  formatDuration,
  cleanBaggageBelt,
  flightPassContent,
  passSerial,
  createFlightPasses,
};
