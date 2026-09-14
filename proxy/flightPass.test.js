const test = require('node:test');
const assert = require('node:assert/strict');
const forge = require('node-forge');
const {
  MIME_TYPE,
  WWDR_G4_URL,
  passkitConfig,
  certificatesFromP12,
  flightPassContent,
  createFlightPasses,
} = require('./flightPass');

/** Self-signed test certificate + key (not an Apple certificate — only to exercise signing and packaging). */
function selfSigned(commonName, keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 })) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
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

/** BR75 BKK → AMS as AeroDataBox returns the leg. */
const BR75_BKK_AMS = {
  number: 'BR 75',
  status: 'Expected',
  airline: { name: 'EVA Air' },
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

test('passkitConfig: null until all four variables are set (route answers 501)', () => {
  assert.equal(passkitConfig({}), null);
  for (const missing of ['PASSKIT_P12_BASE64', 'PASSKIT_P12_PASSWORD', 'PASS_TYPE_ID', 'TEAM_ID']) {
    const env = { ...ENV };
    delete env[missing];
    assert.equal(passkitConfig(env), null, missing);
  }
  const config = passkitConfig(ENV);
  assert.equal(config.passTypeId, 'pass.test.waiair');
  assert.equal(config.teamId, 'TEAMID1234');
  assert.equal(createFlightPasses({ env: {} }).configured, false);
  assert.equal(MIME_TYPE, 'application/vnd.apple.pkpass');
});

test('flightPassContent: number, airline, from/to with city, local departure clock and date, gate when known', () => {
  const content = flightPassContent(BR75_BKK_AMS, 'br75');
  assert.equal(content.number, 'BR75');
  assert.equal(content.airline, 'EVA Air');
  assert.deepEqual([content.from, content.fromCity, content.to, content.toCity], ['BKK', 'Bangkok', 'AMS', 'Amsterdam']);
  assert.equal(content.departureClock, '12:15');
  assert.equal(content.departureDate, '2026-09-15');
  assert.equal(content.departureAt.toISOString(), '2026-09-15T05:15:00.000Z');
  assert.deepEqual([content.gate, content.terminal], ['E4', '1']);

  const revised = flightPassContent({
    ...BR75_BKK_AMS,
    departure: { ...BR75_BKK_AMS.departure, gate: undefined, revisedTime: { utc: '2026-09-15 05:45Z', local: '2026-09-15 12:45+07:00' } },
  }, 'BR75');
  assert.equal(revised.departureClock, '12:45');
  assert.equal(revised.gate, '');

  assert.equal(flightPassContent(null, 'BR75'), null);
  assert.equal(flightPassContent({ ...BR75_BKK_AMS, arrival: {} }, 'BR75'), null);
  assert.equal(flightPassContent({ ...BR75_BKK_AMS, departure: { airport: { iata: 'BKK' } } }, 'BR75'), null);
});

test('certificatesFromP12: signer certificate matching the key, WWDR only when in the chain; wrong password throws', () => {
  const plain = certificatesFromP12(ENV.PASSKIT_P12_BASE64, P12_PASSWORD);
  assert.match(plain.signerCert, /BEGIN CERTIFICATE/);
  assert.match(plain.signerKey, /BEGIN RSA PRIVATE KEY/);
  assert.equal(plain.wwdr, '');

  const chained = certificatesFromP12(p12Base64([wwdr.cert, signer.cert]), P12_PASSWORD);
  assert.equal(chained.signerCert, forge.pki.certificateToPem(signer.cert));
  assert.equal(chained.wwdr, forge.pki.certificateToPem(wwdr.cert));

  assert.throws(() => certificatesFromP12(ENV.PASSKIT_P12_BASE64, 'wrong'));
});

test('build: a signed .pkpass zip with pass.json, manifest, signature and icons; flight fields and identifiers inside', async () => {
  const passes = createFlightPasses({ env: ENV, fetchImpl: async () => { throw new Error('WWDR fetch not expected'); } });
  assert.equal(passes.configured, true);
  const buffer = await passes.build(flightPassContent(BR75_BKK_AMS, 'BR75'));
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK');
  const text = buffer.toString('latin1');
  for (const name of ['pass.json', 'manifest.json', 'signature', 'icon.png', 'icon@2x.png', 'icon@3x.png']) {
    assert.ok(text.includes(name), name);
  }
  for (const value of ['"passTypeIdentifier":"pass.test.waiair"', '"teamIdentifier":"TEAMID1234"', '"serialNumber":"BR75-2026-09-15-BKK"',
    '"transitType":"PKTransitTypeAir"', '"value":"BR75"', '"value":"BKK"', '"value":"AMS"', '"value":"12:15"', '"value":"E4"', '"value":"EVA Air"']) {
    assert.ok(text.includes(value), value);
  }
});

test('build: WWDR is fetched from Apple once when neither PASSKIT_WWDR_PEM nor the .p12 chain has it; errors reject', async () => {
  const env = { ...ENV };
  delete env.PASSKIT_WWDR_PEM;
  const der = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(wwdr.cert)).getBytes(), 'binary');
  const calls = [];
  const passes = createFlightPasses({
    env,
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, arrayBuffer: async () => der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) };
    },
  });
  const content = flightPassContent(BR75_BKK_AMS, 'BR75');
  await passes.build(content);
  await passes.build(content);
  assert.deepEqual(calls, [WWDR_G4_URL]);

  const wrongPassword = createFlightPasses({ env: { ...ENV, PASSKIT_P12_PASSWORD: 'wrong' } });
  await assert.rejects(wrongPassword.build(content));
  await assert.rejects(createFlightPasses({ env: {} }).build(content), /passkit_not_configured/);
});
