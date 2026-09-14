const test = require('node:test');
const assert = require('node:assert/strict');
const forge = require('node-forge');
const {
  MIME_TYPE,
  WWDR_G4_URL,
  passkitConfig,
  certificatesFromP12,
  formatPassDate,
  formatDuration,
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

test('formatPassDate "15 Sep 2026" and formatDuration "12h 05m"', () => {
  assert.equal(formatPassDate('2026-09-15'), '15 Sep 2026');
  assert.equal(formatPassDate('2026-01-03'), '3 Jan 2026');
  assert.equal(formatPassDate('2026-13-01'), '');
  assert.equal(formatPassDate(''), '');
  assert.equal(formatDuration(725), '12h 05m');
  assert.equal(formatDuration(60), '1h 00m');
  assert.equal(formatDuration(55), '55m');
  assert.equal(formatDuration(0), '');
  assert.equal(formatDuration(-30), '');
});

test('flightPassContent: departure/arrival clocks, "15 Sep 2026", duration, terminal, gate, aircraft and live link', () => {
  const content = flightPassContent(BR75_BKK_AMS, 'br75');
  assert.equal(content.number, 'BR75');
  assert.equal(content.airline, 'EVA Air');
  assert.deepEqual([content.from, content.fromCity, content.to, content.toCity], ['BKK', 'Bangkok', 'AMS', 'Amsterdam']);
  assert.equal(content.departureClock, '12:15');
  assert.equal(content.arrivalClock, '19:20');
  assert.equal(content.duration, '12h 05m');
  assert.equal(content.departureDate, '2026-09-15');
  assert.equal(content.departureDateLabel, '15 Sep 2026');
  assert.equal(content.departureAt.toISOString(), '2026-09-15T05:15:00.000Z');
  assert.deepEqual([content.terminal, content.gate, content.aircraft], ['1', 'E4', 'Boeing 777-300ER']);
  assert.equal(content.link, 'https://waiair.app/flight/BR75');

  // Revised departure, next-day arrival, nothing optional known.
  const overnight = flightPassContent({
    number: 'TG 910',
    departure: {
      airport: { iata: 'BKK' },
      scheduledTime: { utc: '2026-09-15 16:00Z', local: '2026-09-15 23:00+07:00' },
      revisedTime: { utc: '2026-09-15 16:30Z', local: '2026-09-15 23:30+07:00' },
    },
    arrival: { airport: { iata: 'LHR' }, scheduledTime: { utc: '2026-09-16 05:45Z', local: '2026-09-16 06:45+01:00' } },
  }, 'TG910');
  assert.equal(overnight.departureClock, '23:30');
  assert.equal(overnight.arrivalClock, '06:45 +1');
  assert.equal(overnight.duration, '13h 15m');
  assert.deepEqual([overnight.terminal, overnight.gate, overnight.aircraft, overnight.airline], ['', '', '', '']);

  // No arrival time: no arrival clock or duration.
  const noArrival = flightPassContent({ ...BR75_BKK_AMS, arrival: { airport: { iata: 'AMS' } } }, 'BR75');
  assert.deepEqual([noArrival.arrivalClock, noArrival.duration], ['', '']);

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

test('build: signed .pkpass with all flight fields, QR code to WaiAir live updates and the back-of-pass notes', async () => {
  const passes = createFlightPasses({ env: ENV, fetchImpl: async () => { throw new Error('WWDR fetch not expected'); } });
  assert.equal(passes.configured, true);
  const buffer = await passes.build(flightPassContent(BR75_BKK_AMS, 'BR75'));
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK');
  const text = buffer.toString('latin1');
  for (const name of ['pass.json', 'manifest.json', 'signature', 'icon.png', 'icon@2x.png', 'icon@3x.png']) {
    assert.ok(text.includes(name), name);
  }
  const passJson = JSON.parse(zipEntries(buffer)['pass.json'].toString('utf8'));
  const bp = passJson.boardingPass;
  const values = list => Object.fromEntries(list.map(f => [f.key, f.value]));

  assert.equal(passJson.passTypeIdentifier, 'pass.test.waiair');
  assert.equal(passJson.teamIdentifier, 'TEAMID1234');
  assert.equal(passJson.serialNumber, 'BR75-2026-09-15-BKK');
  assert.equal(passJson.backgroundColor, 'rgb(13, 27, 46)');
  assert.equal(passJson.labelColor, 'rgb(201, 168, 76)');
  assert.equal(bp.transitType, 'PKTransitTypeAir');
  assert.deepEqual(values(bp.headerFields), { flight: 'BR75' });
  assert.deepEqual(values(bp.primaryFields), { from: 'BKK', to: 'AMS' });
  assert.deepEqual(values(bp.secondaryFields), { departs: '12:15', arrives: '19:20', duration: '12h 05m', date: '15 Sep 2026' });
  assert.deepEqual(values(bp.auxiliaryFields), { terminal: '1', gate: 'E4', aircraft: 'Boeing 777-300ER', airline: 'EVA Air' });
  assert.deepEqual(passJson.barcodes, [{
    message: 'https://waiair.app/flight/BR75',
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText: 'Scan for live flight updates',
  }]);
  const back = values(bp.backFields);
  assert.match(back.live, /Scan for live flight updates: https:\/\/waiair\.app\/flight\/BR75/);
  assert.match(back.notice, /Not a boarding pass — for tracking only/);
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
