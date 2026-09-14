/**
 * Apple Wallet pass for a flight (boarding-pass style, no barcode — not a real boarding pass).
 * Signed with the Pass Type ID certificate from PASSKIT_P12_BASE64 / PASSKIT_P12_PASSWORD plus Apple's WWDR intermediate:
 * PASSKIT_WWDR_PEM when set, else the WWDR certificate inside the .p12 chain, else Apple WWDR G4 fetched once from apple.com.
 */
const fs = require('node:fs');
const path = require('node:path');
const forge = require('node-forge');
const { PKPass } = require('passkit-generator');

const MODEL_DIR = path.join(__dirname, 'passes', 'flight.pass');
const WWDR_G4_URL = 'https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer';
const MIME_TYPE = 'application/vnd.apple.pkpass';

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
  for (const k of ['revisedTime', 'scheduledTime']) {
    const t = side[k];
    if (t && (t.local || t.utc)) return t;
  }
  return null;
}

/**
 * Raw AeroDataBox leg → pass content: number, airline, from/to (IATA + city), departure as local airport clock and date,
 * gate/terminal when known. null without both airports or a departure time.
 */
function flightPassContent(raw, requestedNumber) {
  if (!raw) return null;
  const dep = raw.departure || {};
  const arr = raw.arrival || {};
  const depAp = dep.airport || {};
  const arrAp = arr.airport || {};
  const from = String(depAp.iata || depAp.icao || '').toUpperCase();
  const to = String(arrAp.iata || arrAp.icao || '').toUpperCase();
  const time = sideTime(dep);
  if (!from || !to || !time) return null;
  const local = String(time.local || '');
  const utcMs = Date.parse(String(time.utc || time.local || '').replace(' ', 'T'));
  const clock = local.match(/(\d{2}:\d{2})/);
  const date = local.match(/^(\d{4}-\d{2}-\d{2})/) || String(time.utc || '').match(/^(\d{4}-\d{2}-\d{2})/);
  const number = String(raw.number || requestedNumber || '').replace(/\s+/g, '').toUpperCase();
  return {
    number,
    airline: String((raw.airline && raw.airline.name) || ''),
    from,
    fromCity: String(depAp.municipalityName || depAp.name || from),
    to,
    toCity: String(arrAp.municipalityName || arrAp.name || to),
    departureClock: clock ? clock[1] : '',
    departureDate: date ? date[1] : '',
    departureAt: Number.isFinite(utcMs) ? new Date(utcMs) : null,
    gate: String(dep.gate || ''),
    terminal: String(dep.terminal || ''),
  };
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
 * @param {{ env?: object, fetchImpl?: Function, modelDir?: string }} [opts]
 */
function createFlightPasses({ env = process.env, fetchImpl = fetch, modelDir = MODEL_DIR } = {}) {
  const config = passkitConfig(env);
  let model = null;
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

  /** .pkpass buffer for flightPassContent(); rejects when not configured or signing fails. */
  async function build(content) {
    if (!config) throw new Error('passkit_not_configured');
    if (!model) model = readModel(modelDir);
    const serial = [content.number, content.departureDate, content.from].filter(Boolean).join('-');
    const pass = new PKPass({ ...model }, await loadCertificates(), {
      serialNumber: serial,
      description: `WaiAir flight ${content.number}`,
      organizationName: 'WaiAir',
      passTypeIdentifier: config.passTypeId,
      teamIdentifier: config.teamId,
    });
    pass.transitType = 'PKTransitTypeAir';
    pass.headerFields.push({ key: 'flight', label: 'FLIGHT', value: content.number });
    pass.primaryFields.push(
      { key: 'from', label: content.fromCity, value: content.from },
      { key: 'to', label: content.toCity, value: content.to },
    );
    if (content.departureClock) pass.secondaryFields.push({ key: 'departs', label: 'DEPARTS', value: content.departureClock });
    if (content.departureDate) pass.secondaryFields.push({ key: 'date', label: 'DATE', value: content.departureDate });
    if (content.gate) pass.auxiliaryFields.push({ key: 'gate', label: 'GATE', value: content.gate });
    if (content.terminal) pass.auxiliaryFields.push({ key: 'terminal', label: 'TERMINAL', value: content.terminal });
    if (content.airline) pass.auxiliaryFields.push({ key: 'airline', label: 'AIRLINE', value: content.airline });
    pass.backFields.push({
      key: 'note',
      label: 'WaiAir',
      value: 'Flight details from WaiAir. Departure time is local airport time. This is not a boarding pass.',
    });
    if (content.departureAt) pass.setRelevantDate(content.departureAt);
    return pass.getAsBuffer();
  }

  return { configured: !!config, build };
}

module.exports = {
  MIME_TYPE,
  WWDR_G4_URL,
  passkitConfig,
  certificatesFromP12,
  flightPassContent,
  createFlightPasses,
};
