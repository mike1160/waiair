import { getLocales } from 'expo-localization';

export type PassportOpt = { code: string; flag: string };

export const PASSPORT_OPTIONS: PassportOpt[] = [
  { code: 'NL', flag: '🇳🇱' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'GB', flag: '🇬🇧' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'AU', flag: '🇦🇺' },
  { code: 'CN', flag: '🇨🇳' },
  { code: 'JP', flag: '🇯🇵' },
  { code: 'KR', flag: '🇰🇷' },
  { code: 'IN', flag: '🇮🇳' },
  { code: 'TH', flag: '🇹🇭' },
  { code: 'SG', flag: '🇸🇬' },
  { code: 'MY', flag: '🇲🇾' },
];

const EU = new Set(['NL', 'DE', 'FR']);
const SCHENGEN = new Set(['NL', 'DE', 'FR', 'ES', 'IT', 'AT', 'BE', 'PT', 'IE']);
const CODES = new Set(PASSPORT_OPTIONS.map(p => p.code));

const LANG_TO_PASSPORT: Record<string, string> = {
  nl: 'NL', de: 'DE', fr: 'FR', th: 'TH', ja: 'JP', ko: 'KR',
  zh: 'CN', hi: 'IN', ms: 'MY',
};

export function defaultPassportCode(): string {
  const loc = getLocales()[0];
  const region = String(loc?.regionCode || '').toUpperCase();
  if (CODES.has(region)) return region;
  const lang = String(loc?.languageCode || '').toLowerCase();
  if (lang === 'en') {
    if (region === 'US' || region === 'AU' || region === 'GB') return region;
    return 'GB';
  }
  return LANG_TO_PASSPORT[lang] || 'NL';
}

export function passportFlag(code: string): string {
  return PASSPORT_OPTIONS.find(p => p.code === code)?.flag || '🛂';
}

/** Short nationality-aware line; falls back to the destination’s generic visa note. */
export function visaTextForPassport(destCountry: string, passport: string, generic: string): string {
  const dest = String(destCountry || '').toUpperCase();
  const p = String(passport || '').toUpperCase();
  if (!p) return generic;
  if (p === dest) return 'You are entering your home country — citizens do not need a visitor visa.';
  if (EU.has(p) && (EU.has(dest) || SCHENGEN.has(dest))) {
    return 'EU/Schengen free movement for EU citizens. Bring your passport or national ID.';
  }
  if (dest === 'TH' && ['NL', 'DE', 'FR', 'GB', 'US', 'AU', 'JP', 'KR', 'SG', 'MY'].includes(p)) {
    return 'Visa exemption up to 60 days for this passport; e-visa is also available.';
  }
  if (dest === 'TH' && (p === 'CN' || p === 'IN')) {
    return 'e-visa or visa exemption may apply — confirm the current rule for this passport before travel.';
  }
  if (dest === 'SG' && p !== 'CN' && p !== 'IN') {
    return 'Visa-free for this passport (typically 30–90 days). Check the latest ICA advice.';
  }
  if (dest === 'MY' && p !== 'CN') {
    return 'Visa exemption is typical for this passport (often 30–90 days).';
  }
  if (dest === 'GB' && ['NL', 'DE', 'FR', 'US', 'AU', 'SG', 'JP', 'KR'].includes(p)) {
    return 'ETA required before travel for this passport (not a visa). Apply online.';
  }
  if (dest === 'US' && ['NL', 'DE', 'FR', 'GB', 'AU', 'JP', 'KR', 'SG'].includes(p)) {
    return 'ESTA / Visa Waiver likely for this passport — authorize before boarding.';
  }
  if (dest === 'AU' && ['NL', 'DE', 'FR', 'GB', 'US', 'SG', 'JP', 'KR', 'MY'].includes(p)) {
    return 'ETA or eVisitor required before travel for this passport.';
  }
  if (p === 'CN' || p === 'IN') {
    return `${generic} ${p} passports often need an e-visa or pre-approval — verify before you fly.`;
  }
  return `${generic} Confirm the latest rule for ${p} passports before you fly.`;
}

export const VISA_SCREEN_PASSPORT_CODES = [
  'NL', 'DE', 'GB', 'US', 'AU', 'CN', 'JP', 'KR', 'IN', 'TH',
] as const;

export function visaScreenPassports(): PassportOpt[] {
  return VISA_SCREEN_PASSPORT_CODES.map(code => {
    const hit = PASSPORT_OPTIONS.find(p => p.code === code);
    return hit || { code, flag: '🛂' };
  });
}

export type VisaCheckKind = 'free' | 'evisa' | 'required' | 'eta';

export type VisaCheckResult = {
  kind: VisaCheckKind;
  headline: string;
  detail: string;
  officialUrl: string;
  officialLabel: string;
};

const IMMIGRATION_URLS: Record<string, { evisa?: string; info?: string; label: string }> = {
  TH: { evisa: 'https://www.thaievisa.go.th/', info: 'https://www.immigration.go.th/', label: 'Thai eVisa portal' },
  SG: { info: 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements', label: 'ICA Singapore' },
  MY: { info: 'https://www.imi.gov.my/index.php/en/main-services/visa/visa-requirement-by-country', label: 'Malaysia Immigration' },
  US: { evisa: 'https://esta.cbp.dhs.gov/', label: 'ESTA application' },
  GB: { evisa: 'https://www.gov.uk/get-electronic-travel-authorisation', label: 'UK ETA' },
  AU: { evisa: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/evisitor-651', label: 'Australian eVisitor' },
  VN: { evisa: 'https://evisa.xuatnhapcanh.gov.vn/', label: 'Vietnam eVisa' },
  IN: { evisa: 'https://indianvisaonline.gov.in/', label: 'India eVisa' },
  CN: { info: 'https://www.visaforchina.cn/', label: 'China visa information' },
  JP: { info: 'https://www.mofa.go.jp/j_info/visit/visa/', label: 'Japan visa information' },
  KR: { evisa: 'https://www.k-eta.go.kr/', label: 'K-ETA portal' },
  ID: { evisa: 'https://molina.imigrasi.go.id/', label: 'Indonesia eVisa' },
  PH: { info: 'https://www.immigration.gov.ph/', label: 'Philippines Immigration' },
  NL: { info: 'https://www.netherlandsworldwide.nl/', label: 'Netherlands Worldwide' },
  DE: { info: 'https://www.auswaertiges-amt.de/', label: 'German Foreign Office' },
  FR: { info: 'https://france-visas.gouv.fr/', label: 'France Visas' },
};

function immigrationUrl(dest: string, preferEvisa = false): { url: string; label: string } {
  const row = IMMIGRATION_URLS[dest];
  if (row) {
    const url = (preferEvisa && row.evisa) || row.evisa || row.info || '';
    if (url) return { url, label: row.label };
  }
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(`${dest} visa official immigration`)}`,
    label: 'Official visa information',
  };
}

/** Structured visa outcome for VisaCheckScreen. */
export function visaCheckResult(destCountry: string, passport: string, generic: string): VisaCheckResult {
  const dest = String(destCountry || '').toUpperCase();
  const p = String(passport || '').toUpperCase();
  const detail = visaTextForPassport(dest, passport, generic);

  if (p === dest) {
    const { url, label } = immigrationUrl(dest);
    return { kind: 'free', headline: '✅ Visa free — home country', detail, officialUrl: url, officialLabel: label };
  }
  if (EU.has(p) && (EU.has(dest) || SCHENGEN.has(dest))) {
    const { url, label } = immigrationUrl(dest);
    return { kind: 'free', headline: '✅ Visa free — EU/Schengen', detail, officialUrl: url, officialLabel: label };
  }
  if (dest === 'TH' && ['NL', 'DE', 'FR', 'GB', 'US', 'AU', 'JP', 'KR', 'SG', 'MY'].includes(p)) {
    const { url, label } = immigrationUrl('TH', true);
    return { kind: 'free', headline: '✅ Visa free — 60 days', detail, officialUrl: url, officialLabel: label };
  }
  if (dest === 'TH' && (p === 'CN' || p === 'IN')) {
    const { url, label } = immigrationUrl('TH', true);
    return { kind: 'evisa', headline: '⚠️ eVisa required', detail, officialUrl: url, officialLabel: `Apply — ${label}` };
  }
  if (dest === 'SG' && p !== 'CN' && p !== 'IN') {
    const { url, label } = immigrationUrl('SG');
    return { kind: 'free', headline: '✅ Visa free — 30–90 days', detail, officialUrl: url, officialLabel: label };
  }
  if (dest === 'MY' && p !== 'CN') {
    const { url, label } = immigrationUrl('MY');
    return { kind: 'free', headline: '✅ Visa free — 30–90 days', detail, officialUrl: url, officialLabel: label };
  }
  if (dest === 'GB' && ['NL', 'DE', 'FR', 'US', 'AU', 'SG', 'JP', 'KR'].includes(p)) {
    const { url, label } = immigrationUrl('GB', true);
    return { kind: 'eta', headline: '⚠️ ETA required', detail, officialUrl: url, officialLabel: `Apply — ${label}` };
  }
  if (dest === 'US' && ['NL', 'DE', 'FR', 'GB', 'AU', 'JP', 'KR', 'SG'].includes(p)) {
    const { url, label } = immigrationUrl('US', true);
    return { kind: 'eta', headline: '⚠️ ESTA required', detail, officialUrl: url, officialLabel: `Apply — ${label}` };
  }
  if (dest === 'AU' && ['NL', 'DE', 'FR', 'GB', 'US', 'SG', 'JP', 'KR', 'MY'].includes(p)) {
    const { url, label } = immigrationUrl('AU', true);
    return { kind: 'eta', headline: '⚠️ ETA required', detail, officialUrl: url, officialLabel: `Apply — ${label}` };
  }
  if (p === 'CN' || p === 'IN') {
    const { url, label } = immigrationUrl(dest, true);
    return {
      kind: 'evisa',
      headline: '⚠️ eVisa likely required',
      detail,
      officialUrl: url,
      officialLabel: `Apply — ${label}`,
    };
  }
  if (/visa.?free|exemption|no visa|free movement|do not need/i.test(detail)) {
    const { url, label } = immigrationUrl(dest);
    const days = detail.match(/(\d+)\s*days?/i);
    return {
      kind: 'free',
      headline: days ? `✅ Visa free — ${days[1]} days` : '✅ Visa free',
      detail,
      officialUrl: url,
      officialLabel: label,
    };
  }
  if (/e.?visa|eta|esta|evisitor|pre-approval|authorize before/i.test(detail)) {
    const { url, label } = immigrationUrl(dest, true);
    return {
      kind: 'evisa',
      headline: '⚠️ eVisa required',
      detail,
      officialUrl: url,
      officialLabel: `Apply — ${label}`,
    };
  }
  const { url, label } = immigrationUrl(dest);
  return {
    kind: 'required',
    headline: '❌ Visa required',
    detail,
    officialUrl: url,
    officialLabel: `Embassy info — ${label}`,
  };
}
