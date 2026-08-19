export type ImmigrationApp = {
  country: string;
  appName: string;
  description: string;
  /** Official web form or government site. Prefer this over the App Store. */
  webUrl?: string;
  appStoreUrl: string;
  airports: string[];
  flagEmoji: string;
};

const IMMIGRATION_APPS: ImmigrationApp[] = [
  {
    country: 'Thailand',
    appName: 'THIM',
    description: 'Speed up Thai immigration',
    webUrl: 'https://tdac.immigration.go.th',
    appStoreUrl: 'https://apps.apple.com/app/thim/id6738285606',
    airports: ['BKK', 'DMK', 'HKT', 'CNX', 'USM', 'KBV', 'HDY', 'UTH', 'UBP'],
    flagEmoji: '🇹🇭',
  },
  {
    country: 'Singapore',
    appName: 'SG Arrival Card',
    description: 'Required for all visitors to Singapore',
    webUrl: 'https://eservices.ica.gov.sg/sgarrivalcard/',
    appStoreUrl: 'https://apps.apple.com/app/sg-arrival-card/id1546082607',
    airports: ['SIN'],
    flagEmoji: '🇸🇬',
  },
  {
    country: 'Japan',
    appName: 'Visit Japan Web',
    description: 'Faster immigration and customs in Japan',
    webUrl: 'https://www.vjw.digital.go.jp/',
    appStoreUrl: 'https://apps.apple.com/app/visit-japan-web/id1671066150',
    airports: ['NRT', 'HND', 'KIX', 'NGO', 'CTS', 'FUK'],
    flagEmoji: '🇯🇵',
  },
  {
    country: 'Indonesia',
    appName: 'Molina',
    description: 'Apply for Indonesia e-VOA online',
    webUrl: 'https://molina.imigrasi.go.id/',
    appStoreUrl: 'https://apps.apple.com/app/molina/id1601609678',
    airports: ['DPS', 'CGK', 'SUB', 'MES'],
    flagEmoji: '🇮🇩',
  },
  {
    country: 'Philippines',
    appName: 'eTravel',
    description: 'Required health declaration for Philippines',
    webUrl: 'https://etravel.gov.ph/',
    appStoreUrl: 'https://apps.apple.com/app/etravel/id1626070482',
    airports: ['MNL', 'CEB', 'DVO', 'CRK'],
    flagEmoji: '🇵🇭',
  },
  {
    country: 'Malaysia',
    appName: 'MyTravelPass',
    description: 'Malaysia immigration pre-arrival',
    webUrl: 'https://imigresen-online.imi.gov.my/mdac/main',
    appStoreUrl: 'https://apps.apple.com/app/mytravelpass/id1234567890',
    airports: ['KUL', 'PEN', 'BKI', 'KCH'],
    flagEmoji: '🇲🇾',
  },
  {
    country: 'Australia',
    appName: 'Australia Travel Declaration',
    description: 'Required for all arrivals to Australia',
    appStoreUrl: 'https://apps.apple.com/app/atd/id1570991532',
    airports: ['SYD', 'MEL', 'BNE', 'PER', 'ADL'],
    flagEmoji: '🇦🇺',
  },
  {
    country: 'United Kingdom',
    appName: 'UK ETA',
    description: 'Required for visa-free visitors to UK',
    webUrl: 'https://www.gov.uk/eta/apply',
    appStoreUrl: 'https://apps.apple.com/app/uk-eta/id1530237988',
    airports: ['LHR', 'LGW', 'STN', 'LTN', 'LCY', 'MAN', 'BHX', 'EDI', 'GLA'],
    flagEmoji: '🇬🇧',
  },
  {
    country: 'United Arab Emirates',
    appName: 'UAE Pass',
    description: 'Digital identity for UAE visitors',
    appStoreUrl: 'https://apps.apple.com/app/uae-pass/id1474051492',
    airports: ['DXB', 'AUH', 'SHJ', 'DWC'],
    flagEmoji: '🇦🇪',
  },
  {
    country: 'Saudi Arabia',
    appName: 'Absher',
    description: 'Saudi Arabia government services',
    webUrl: 'https://www.absher.sa/',
    appStoreUrl: 'https://apps.apple.com/app/absher/id942520761',
    airports: ['RUH', 'JED', 'DMM', 'MED'],
    flagEmoji: '🇸🇦',
  },
  {
    country: 'Qatar',
    appName: 'Ehteraz',
    description: 'Qatar entry requirements',
    appStoreUrl: 'https://apps.apple.com/app/ehteraz/id1507150431',
    airports: ['DOH'],
    flagEmoji: '🇶🇦',
  },
  {
    country: 'Bahrain',
    appName: 'BeAware Bahrain',
    description: 'Bahrain travel registration',
    appStoreUrl: 'https://apps.apple.com/app/beaware-bahrain/id1501281600',
    airports: ['BAH'],
    flagEmoji: '🇧🇭',
  },
  {
    country: 'United States',
    appName: 'CBP One',
    description: 'US Customs and Border Protection app',
    appStoreUrl: 'https://apps.apple.com/app/cbp-one/id1466680420',
    airports: ['JFK', 'LAX', 'ORD', 'MIA', 'SFO', 'DFW', 'ATL', 'SEA', 'BOS', 'IAD'],
    flagEmoji: '🇺🇸',
  },
  {
    country: 'New Zealand',
    appName: 'NZETA',
    description: 'Required for visa-free visitors to New Zealand',
    webUrl: 'https://nzeta.immigration.govt.nz/',
    appStoreUrl: 'https://apps.apple.com/app/nzeta/id1462380199',
    airports: ['AKL', 'CHC', 'WLG', 'ZQN'],
    flagEmoji: '🇳🇿',
  },
  // TODO: Add EU ETIAS when launched (not yet available).
];

export function getImmigrationApp(destIata: string): ImmigrationApp | null {
  return IMMIGRATION_APPS.find(a =>
    a.airports.includes(destIata.toUpperCase()),
  ) ?? null;
}

/** Web form / official site when available; otherwise App Store. */
export function immigrationOpenUrl(app: ImmigrationApp): string {
  return app.webUrl || app.appStoreUrl;
}

export function immigrationNeedsRegionWarning(app: ImmigrationApp): boolean {
  return !app.webUrl;
}
