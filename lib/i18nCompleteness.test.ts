import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.env.I18N_STRICT === '1';
const WRITE_ARTIFACTS = process.env.I18N_WRITE_ARTIFACTS === '1';

const REQUIRED_KEYS = [
  'inboundFlight',
  'revised',
  'inboundAircraftOnTime',
  'inboundAircraftDelayed',
  'landed',
  'scheduled',
  'departs',
  'arrives',
] as const;

const SHIPPED: readonly string[] = [
  'en', 'nl', 'zh', 'th', 'de', 'ru', 'ja', 'ko', 'vi', 'id', 'es',
];

const JSON_PATH: Record<string, string> = {
  en: 'i18n/locales/en.json',
  nl: 'i18n/locales/nl.json',
  zh: 'zh_translations.json',
  th: 'i18n/locales/th.json',
  de: 'i18n/locales/de.json',
  ru: 'i18n/locales/ru.json',
  ja: 'i18n/locales/ja.json',
  ko: 'i18n/locales/ko.json',
  vi: 'i18n/locales/vi.json',
  id: 'i18n/locales/id.json',
  es: 'i18n/locales/es.json',
};

const TODO_PREFIXES = ['【待翻译】', '【แปลภายหลัง】'];

/** Values that are allowed to match English in every locale. */
const IDENTICAL_OK = new Set([
  'WaiAir',
  'WhatsApp',
  'LINE',
  'Pro',
  'LIVE',
  'OK',
  'Wi-Fi',
  'WiFi',
  'AQI',
  'IATA',
  'EU261',
  'Saved Souls Foundation',
  'English',
  'Nederlands',
  '中文',
  'ไทย',
  'Deutsch',
  'Русский',
  '日本語',
  '한국어',
  'Tiếng Việt',
  'Indonesia',
  'Español',
  '°C',
  '°F',
  'MRT/BTS',
  'Demo',
  'Lounge',
  'Lounges',
  'Gate',
  'GATE',
  'Terminal',
  'Terminals',
  'TERMINAL',
  'Radar',
  'ATM',
  'Taxi',
  'Tips',
  'Wind',
  'Hotel',
  'Transfer',
  'Check-in',
  'Check-out',
  'Upgrade',
  'Modules',
  'Silver',
  'Gold',
  'Platinum',
  'Fast Track',
  'Direct',
  'Tickets',
  'Tours',
  'Hotels',
  'eSIM',
  'Lifestyle',
  'Weekend',
  'Later',
  'Ferry',
  'Tuk Tuk',
  'Partner',
  'ACCOUNT',
  'Landing',
  'Ambulance',
  'Transit',
  'Details ›',
  'Status: {s}',
  'was {g}',
  'Gate {g}',
  'Gate: {g}',
  'Gate TBA',
  'Gate open',
  'Terminal {n}',
  '1 stop',
  '~{n} min',
  '~{min} min',
  '{n} min',
  '{n}/{max}',
  '{kg} kg CO₂',
  'kg CO₂',
  '{fl}',
  '{time}',
  '1 {local} = {rate} {dest}',
  '1 EUR = {rate} {code}',
  '1 USD = {rate} {code}',
  '{amount} {from} = {result} {to}',
  '{label}, {date}',
  '{iata}, {name}, {country}',
  '👥 {name}',
  'ETA {time}',
  'ABC123',
  'Open WaiAir',
  'WaiAir Pro ✓',
  '✈️ WaiAir Pro',
  'WaiAir Radar',
  'Gate Race',
  '⚡ Gate Race!',
  'Fly Together',
  '👥 Fly Together',
  'Live link',
  'Grab Food',
  'foodpanda',
  'Uber Eats',
  'QEEQ',
  'AutoEurope',
  'Kiwitaxi',
  'Gmail',
  'Insta-worthy',
  'Air Comfort',
  'airlines',
]);

/** Keys whose EN string is a format/brand token and may stay identical. */
const IDENTICAL_OK_KEYS = new Set([
  'localRate',
  'eurRate',
  'usdRate',
  'convertEquals',
  'quickFlightsCount',
  'min',
  'walkMin',
  'walkMinEstimate',
  'turbulenceCruise',
  'turbulencePeakAt',
  'passportStatsCo2',
  'statKgCo2',
  'celsius',
  'fahrenheit',
  'english',
  'dutch',
  'chinese',
  'thai',
  'german',
  'russian',
  'japanese',
  'korean',
  'vietnamese',
  'indonesian',
  'spanish',
  'watchIataPlaceholder',
  'dayA11y',
  'airportA11y',
  'togetherCodePlaceholder',
  'togetherLiveTitle',
  'togetherEta',
  'toPlaceholder',
  'recentAirports',
  'liveRadar',
  'importOpenMail',
]);

const SCREEN_RULES: [string, RegExp][] = [
  ['pickup', /^(pickup|picking|leaveAt|leaveNow|leaveSoon|whoPicking|surprise|waHere|saveMyLocation|enablePickup|minToAirport|yourLocation|saveLocation|baggageTakes|arrivalsHall|justLanded|leaveIn30|planToLeave|flightOnTimeLeave|wellTell|exitPickup|sendWhatsApp|sendLanding|landingWhatsApp|checkArrivals)/i],
  ['paywall', /^(paywall|upgrade|waiairPro|waiairFree|feature|monthly|yearly|perMonth|perYear|freeTrial|noCommitment|startFree|youreTracking|freePlan|notNow|saveBest|manageSub|restorePurchase|proRestored|testFlight|customerCenter|active$|flightsTracked)/i],
  ['eu261', /^(eu261|amIEligible|compensation|airlineLiability|claim|entitled|checkYourClaim|checkMyClaim|airlineClaim|airlineCompensation|openFlightCompensation|yes$|no$|whatToDo)/i],
  ['radar', /^(radar|tapAPlane|refreshRadar|closeRadar|cachedUpper|radarNext|noFlightsInApi|loadingAircraft|nextUpdateIn)/i],
  ['gateRace', /^(gateRace|fromGate|toGate|firstFlight|secondFlight|walkTimeGates|navigateToGate|exitGateRace|openGateRace|dismissGateRace|enoughTime|minutesLeft|connectingPassenger|alertGateAgent|callAirport|terminalChange)/i],
  ['import', /^import/i],
  ['scanner', /^(scan|closeScanner|cameraInApps|cameraAccess|allowCamera|enterFlightManually|couldNotReadPass)/i],
  ['search', /^(noFlights|tryHints|orSwitch|recentSearch|recentAirport|search|globalSearch|globalResult|routeSearch|routeHint|routeResult|routeNo|worldwide|pullToRefresh|loadingMore|popularFrom|findingNearest|loadingFlights|loadingAirport|loadingIata|chooseAirport|nearMe|noAirports|airportsWorldwide|yesterday|enterFlight|enterValid|filterFlights|dayA11y|airportA11y|eGFlight|searchByRoute|searchingFlights|clearSearch|searchCity|searchPlaceholder|searchQuery|from$|to$|date$|oneWay|roundTrip|multiCity|departDate|returnDate|selectReturn|addFlight|removeFlight|flightN|outbound|returnFlight|swapAirport|cityOrAirport|placeCity|placeAirport|popularDest|nextWeekend|inOneWeek|whereFrom|whereTo|nStops|fromPlaceholder|toPlaceholder|staleCache)/i],
  ['settings', /^(settings|notifications|defaultAirport|temperature|timeFormat|clearCache|about|version|celsius|fahrenheit|hour24|hour12|notify|useCurrent|language|refreshInterval|offlineData|privacy|analytics|terms|rateApp|contact|followUs|widget|enabled|disabled|english|dutch|chinese|thai|german|russian|japanese|korean|vietnamese|indonesian|spanish|account|appearance|preferences|data|closeSettings|themeA11y|refreshA11y|darkMode|lightMode|nearestAirport|systemNotification|setAsDefault|addWidget|priorityRefresh|waiairOn|partners|ssfPartner)/i],
  ['flightDetail', /^(live|updating|cached|demo|refreshing|updated|inbound|revised|departs|arrives|landed|scheduled|boarding|onTime|cancelled|departing|lastCall|gateClosing|status|gate|terminal|runway|delay|enRoute|seat|checkIn|bookingRef|wasGate|delayed|arrivesApprox|earlyMin|mLate|altitude|speed|heading|position|flightProgress|viewFlight|openFlight|shareFlight|untrack|track|details|hideDetails|showDetails|aircraft|lounge|visa|currency|baggage|belt|crowd|meal|reliability|wake|setWake|wakeUp|clearAlarm|loadingFleet|ageYears|firstFlight|yearsOld|flightsFlown|shareCard|couldNotCreateShare|onTimeStatus|getIntoTown|welcomeTo|localTime|localRate|eurRate|usdRate|taxiToCenter|typicallyOnTime|avgDelay|todayOutlook|history|gateColon|terminalN)/i],
];

const GROUP_ORDER = [
  'flightDetail',
  'search',
  'settings',
  'pickup',
  'paywall',
  'eu261',
  'radar',
  'gateRace',
  'import',
  'scanner',
  'other',
] as const;

function loadJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Record<string, unknown>;
}

function extractBlock(src: string, marker: string, label: string): string {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `${label} missing`);
  const brace = src.indexOf('{', start);
  let depth = 0;
  let end = brace;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return src.slice(brace + 1, end);
}

function keysInBlock(block: string): string[] {
  const keys: string[] = [];
  const re = /^\s{2}([A-Za-z][A-Za-z0-9]*)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) keys.push(m[1]);
  return keys;
}

function screenFor(key: string): (typeof GROUP_ORDER)[number] {
  for (const [name, pat] of SCREEN_RULES) {
    if (pat.test(key)) return name as (typeof GROUP_ORDER)[number];
  }
  return 'other';
}

function stripTodo(s: string): string {
  for (const p of TODO_PREFIXES) {
    if (s.startsWith(p)) return s.slice(p.length);
  }
  return s;
}

function parseOnboardingOverrides(src: string): Record<string, Set<string>> {
  const block = extractBlock(src, 'const ONBOARDING_PRESET_I18N', 'ONBOARDING_PRESET_I18N');
  const out: Record<string, Set<string>> = {};
  const locRe = /^\s{2}([a-z]{2})\s*:\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = locRe.exec(block))) {
    const loc = m[1];
    const innerStart = m.index + m[0].length - 1;
    let depth = 0;
    let end = innerStart;
    for (let i = innerStart; i < block.length; i++) {
      if (block[i] === '{') depth += 1;
      else if (block[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const inner = block.slice(innerStart + 1, end);
    const keys = new Set<string>();
    const keyRe = /^\s{4}([A-Za-z][A-Za-z0-9]*)\s*:/gm;
    let k: RegExpExecArray | null;
    while ((k = keyRe.exec(inner))) keys.add(k[1]);
    out[loc] = keys;
  }
  return out;
}

function parseZhFnOverrideKeys(src: string): Set<string> {
  const block = extractBlock(src, 'const ZH_FN_OVERRIDES', 'ZH_FN_OVERRIDES');
  return new Set(keysInBlock(block));
}

function presentKeys(
  loc: string,
  json: Record<string, unknown>,
  onboarding: Record<string, Set<string>>,
  zhFn: Set<string>,
): Set<string> {
  const present = new Set(Object.keys(json).filter(k => !k.startsWith('_')));
  for (const k of onboarding[loc] ?? []) present.add(k);
  if (loc === 'zh') for (const k of zhFn) present.add(k);
  return present;
}

function identicalAllowed(key: string, enVal: string, locVal: string): boolean {
  if (IDENTICAL_OK_KEYS.has(key)) return true;
  if (IDENTICAL_OK.has(enVal) || IDENTICAL_OK.has(locVal)) return true;
  if (enVal === locVal && IDENTICAL_OK.has(enVal.trim())) return true;
  return false;
}

type LocaleReport = {
  loc: string;
  missing: string[];
  untranslated: string[];
  present: Set<string>;
};

function buildReports(): {
  enKeys: string[];
  enJson: Record<string, string>;
  reports: LocaleReport[];
  i18nSrc: string;
} {
  const i18nSrc = readFileSync(join(ROOT, 'lib/i18n.ts'), 'utf8');
  assert.ok(!i18nSrc.includes('const NL_STRINGS'), 'NL_STRINGS must be deleted');

  const enKeys = keysInBlock(extractBlock(i18nSrc, '\nconst EN = {', 'EN catalog'));
  const enJson = loadJson(JSON_PATH.en) as Record<string, string>;
  const onboarding = parseOnboardingOverrides(i18nSrc);
  const zhFn = parseZhFnOverrideKeys(i18nSrc);

  const reports: LocaleReport[] = [];
  for (const loc of SHIPPED) {
    const json = loadJson(JSON_PATH[loc]);
    const present = presentKeys(loc, json, onboarding, zhFn);
    const missing = loc === 'en' ? [] : enKeys.filter(k => !present.has(k));
    const untranslated: string[] = [];
    if (loc !== 'en') {
      for (const key of enKeys) {
        if (!present.has(key)) continue;
        if (!(key in json)) continue;
        const raw = json[key];
        if (typeof raw !== 'string') continue;
        const enVal = enJson[key];
        if (typeof enVal !== 'string') continue;
        const stripped = stripTodo(raw);
        const hadTodo = stripped !== raw;
        if (hadTodo || (stripped === enVal && !identicalAllowed(key, enVal, stripped))) {
          untranslated.push(key);
        }
      }
    }
    reports.push({ loc, missing, untranslated, present });
  }
  return { enKeys, enJson, reports, i18nSrc };
}

function writeMissingFiles(enKeys: string[], enJson: Record<string, string>, reports: LocaleReport[]): void {
  const dir = join(ROOT, 'i18n/missing');
  mkdirSync(dir, { recursive: true });
  for (const { loc, missing } of reports) {
    const groups: Record<string, Record<string, string>> = {};
    for (const g of GROUP_ORDER) groups[g] = {};
    for (const key of missing) {
      groups[screenFor(key)][key] = enJson[key] ?? '';
    }
    const payload = {
      locale: loc,
      missingCount: missing.length,
      groups,
    };
    writeFileSync(join(dir, `${loc}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  }
}

function writeBaseline(reports: LocaleReport[]): Record<string, string[]> {
  const baseline: Record<string, string[]> = {};
  for (const { loc, present } of reports) {
    baseline[loc] = [...present].sort();
  }
  writeFileSync(join(ROOT, 'i18n/coverage-baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`);
  return baseline;
}

function petReport(): { loc: string; keys: number; untranslated: string[] }[] {
  const src = readFileSync(join(ROOT, 'lib/pet/petStrings.ts'), 'utf8');
  const enKeys = keysInBlock(extractBlock(src, '\nconst EN = {', 'pet EN'));
  const locales = ['nl', 'es', 'de', 'ru'] as const;
  const out: { loc: string; keys: number; untranslated: string[] }[] = [
    { loc: 'en', keys: enKeys.length, untranslated: [] },
  ];
  for (const loc of locales) {
    const marker = loc === 'nl'
      ? 'const NL: PetStrings = {'
      : loc === 'es'
        ? 'const ES: PetStrings = {'
        : loc === 'de'
          ? 'const DE: PetStrings = {'
          : 'const RU: PetStrings = {';
    const start = src.indexOf(marker);
    assert.ok(start >= 0, `pet ${loc} missing`);
    const brace = src.indexOf('{', start);
    let depth = 0;
    let end = brace;
    for (let i = brace; i < src.length; i++) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const block = src.slice(brace + 1, end);
    const untranslated: string[] = [];
    for (const key of enKeys) {
      const enRef = new RegExp(`^\\s{2}${key}\\s*:\\s*EN\\.${key}\\s*,`, 'm');
      if (enRef.test(block)) untranslated.push(key);
    }
    out.push({ loc, keys: enKeys.length, untranslated });
  }
  return out;
}

test('i18n catalogue completeness', () => {
  const { enKeys, enJson, reports, i18nSrc } = buildReports();

  assert.ok(enKeys.length > 1000, `EN catalog too small: ${enKeys.length}`);
  for (const key of enKeys) {
    assert.ok(key in enJson, `en.json missing ${key}`);
  }

  for (const key of REQUIRED_KEYS) {
    assert.ok(enKeys.includes(key), `EN missing required ${key}`);
  }

  const nl = loadJson(JSON_PATH.nl) as Record<string, string>;
  assert.equal(nl.landed, 'Geland');
  assert.equal(nl.scheduled, 'Gepland');
  assert.equal(nl.departs, 'Vertrek');
  assert.equal(nl.arrives, 'Aankomst');
  assert.equal(nl.inboundFlight, 'Inkomende vlucht');
  assert.equal(nl.revised, 'Herzien');

  for (const loc of SHIPPED) {
    const json = loadJson(JSON_PATH[loc]);
    for (const key of REQUIRED_KEYS) {
      assert.equal(typeof json[key], 'string', `${loc} missing hard-assert key ${key}`);
    }
  }
  assert.equal((loadJson(JSON_PATH.th) as Record<string, string>).revised, 'เวลาใหม่');
  assert.equal((loadJson(JSON_PATH.zh) as Record<string, string>).revised, '更新');

  let baseline: Record<string, string[]>;
  const baselinePath = join(ROOT, 'i18n/coverage-baseline.json');
  if (WRITE_ARTIFACTS) {
    writeMissingFiles(enKeys, enJson, reports);
    baseline = writeBaseline(reports);
  } else {
    baseline = loadJson('i18n/coverage-baseline.json') as Record<string, string[]>;
  }

  console.log(`\nI18N completeness  EN=${enKeys.length} keys  STRICT=${STRICT ? '1' : '0'}\n`);
  for (const { loc, missing, untranslated, present } of reports) {
    const examples = missing.slice(0, 10).join(', ') || '—';
    console.log(
      `${loc.padEnd(4)} present=${String(present.size).padStart(4)}  missing=${String(missing.length).padStart(4)}  untranslated=${String(untranslated.length).padStart(4)}  e.g. ${examples}`,
    );
  }

  const pet = petReport();
  console.log('\nPET catalogue (lib/pet/petStrings.ts) — not merged into main i18n\n');
  for (const row of pet) {
    const eg = row.untranslated.slice(0, 8).join(', ') || '—';
    console.log(
      `${row.loc.padEnd(4)} keys=${String(row.keys).padStart(3)}  untranslated=${String(row.untranslated.length).padStart(3)}  e.g. ${eg}`,
    );
  }
  console.log('');

  const regressions: string[] = [];
  for (const { loc, present } of reports) {
    for (const key of baseline[loc] ?? []) {
      if (!present.has(key)) regressions.push(`${loc}:${key}`);
    }
  }
  assert.equal(regressions.length, 0, `coverage regression: ${regressions.slice(0, 20).join(', ')}`);

  if (STRICT) {
    for (const { loc, missing, untranslated } of reports) {
      assert.equal(missing.length, 0, `${loc} missing ${missing.length} keys (I18N_STRICT=1)`);
      assert.equal(untranslated.length, 0, `${loc} untranslated ${untranslated.length} keys (I18N_STRICT=1)`);
    }
  }

  void i18nSrc;
  void baselinePath;
});
