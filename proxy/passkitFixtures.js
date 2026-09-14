/** Test fixtures for the Wallet pass tests: self-signed signing certificates, Passkit env, an AeroDataBox leg, zip reader. */
const assert = require('node:assert/strict');
const forge = require('node-forge');

/** Self-signed test certificate + key (not an Apple certificate — only to exercise signing, packaging and TLS). */
function selfSigned(commonName, keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 }), altNames = []) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  if (altNames.length) cert.setExtensions([{ name: 'subjectAltName', altNames: altNames.map(value => ({ type: 2, value })) }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, keys };
}

const signer = selfSigned('Pass Type ID: pass.test.waiair');
const wwdr = selfSigned('Apple Worldwide Developer Relations Certification Authority');
const P12_PASSWORD = 'test-password';

function p12Base64(certs, password = P12_PASSWORD) {
  const asn1 = forge.pkcs12.toPkcs12Asn1(signer.keys.privateKey, certs, password, { algorithm: '3des' });
  return forge.util.encode64(forge.asn1.toDer(asn1).getBytes());
}

const ENV = {
  PASSKIT_P12_BASE64: p12Base64([signer.cert]),
  PASSKIT_P12_PASSWORD: P12_PASSWORD,
  PASS_TYPE_ID: 'pass.test.waiair',
  TEAM_ID: 'TEAMID1234',
  PASSKIT_WWDR_PEM: forge.pki.certificateToPem(wwdr.cert),
};

/** Files of a stored (uncompressed) zip, as passkit-generator writes it: name → Buffer, from the local file headers. */
function zipEntries(buffer) {
  const entries = {};
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const dataStart = offset + 30 + nameLength + extraLength;
    assert.equal(method, 0, `${name} stored uncompressed`);
    entries[name] = buffer.subarray(dataStart, dataStart + size);
    offset = dataStart + size;
  }
  return entries;
}

function passJsonOf(buffer) {
  return JSON.parse(zipEntries(buffer)['pass.json'].toString('utf8'));
}

/** BR75 BKK → AMS as AeroDataBox returns the leg. */
const BR75_BKK_AMS = {
  number: 'BR 75',
  status: 'Expected',
  airline: { name: 'EVA Air' },
  aircraft: { reg: 'B-16735', model: 'Boeing 777-300ER' },
  departure: {
    airport: { iata: 'BKK', municipalityName: 'Bangkok' },
    scheduledTime: { utc: '2026-09-15 05:15Z', local: '2026-09-15 12:15+07:00' },
    terminal: '1',
    gate: 'E4',
  },
  arrival: {
    airport: { iata: 'AMS', municipalityName: 'Amsterdam' },
    scheduledTime: { utc: '2026-09-15 17:20Z', local: '2026-09-15 19:20+02:00' },
  },
};

/** 60-character single-leg IATA BCBP for TG403 BKK → SIN (fictional passenger). */
const BCBP_TG403 = `M1${'DOE/JOHN'.padEnd(20, ' ')}EABC123 BKKSINTG 0403 258Y012A0045 100`;

module.exports = { selfSigned, signer, wwdr, P12_PASSWORD, p12Base64, ENV, zipEntries, passJsonOf, BR75_BKK_AMS, BCBP_TG403 };
