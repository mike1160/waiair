export type ImmigrationApp = {
  country: string;
  appName: string;
  description: string;
  /** Official web form or government site. Prefer this over the App Store. */
  webUrl?: string;
  /**
   * The official app, when there is one. Several of these forms are web-only (Thailand's TDAC, Visit Japan Web,
   * Malaysia's MDAC): an invented or retired App Store link is worse than none. Every entry has at least one URL.
   */
  appStoreUrl?: string;
  airports: string[];
  flagEmoji: string;
};

const IMMIGRATION_APPS: ImmigrationApp[] = [
  {
    country: 'Thailand',
    appName: 'THIM',
    description: 'Speed up Thai immigration',
    webUrl: 'https://tdac.immigration.go.th',
    airports: ['BKK', 'DMK', 'HKT', 'CNX', 'USM', 'KBV', 'HDY', 'UTH', 'UBP'],
    flagEmoji: '🇹🇭',
  },
  {
    country: 'Singapore',
    appName: 'SG Arrival Card',
    description: 'Required for all visitors to Singapore',
    webUrl: 'https://eservices.ica.gov.sg/sgarrivalcard/',
    appStoreUrl: 'https://apps.apple.com/app/id1584952674', // MyICA Mobile (ICA), holds the SG Arrival Card
    airports: ['SIN'],
    flagEmoji: '🇸🇬',
  },
  {
    country: 'Japan',
    appName: 'Visit Japan Web',
    description: 'Faster immigration and customs in Japan',
    webUrl: 'https://www.vjw.digital.go.jp/',
    airports: ['NRT', 'HND', 'KIX', 'NGO', 'CTS', 'FUK'],
    flagEmoji: '🇯🇵',
  },
  {
    country: 'Indonesia',
    appName: 'Molina',
    description: 'Apply for Indonesia e-VOA online',
    webUrl: 'https://molina.imigrasi.go.id/',
    appStoreUrl: 'https://apps.apple.com/app/id6749558272', // All Indonesia (Directorate General of Immigration)
    airports: ['DPS', 'CGK', 'SUB', 'MES'],
    flagEmoji: '🇮🇩',
  },
  {
    country: 'Philippines',
    appName: 'eTravel',
    description: 'Required health declaration for Philippines',
    webUrl: 'https://etravel.gov.ph/',
    appStoreUrl: 'https://apps.apple.com/app/id6447682225', // eGovPH, which now contains eTravel
    airports: ['MNL', 'CEB', 'DVO', 'CRK'],
    flagEmoji: '🇵🇭',
  },
  {
    country: 'Malaysia',
    appName: 'MyTravelPass',
    description: 'Malaysia immigration pre-arrival',
    webUrl: 'https://imigresen-online.imi.gov.my/mdac/main',
    airports: ['KUL', 'PEN', 'BKI', 'KCH'],
    flagEmoji: '🇲🇾',
  },
  {
    country: 'Australia',
    appName: 'AustralianETA',
    description: 'Apply for your Australian ETA',
    webUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601',
    appStoreUrl: 'https://apps.apple.com/app/id1527982364', // AustralianETA (Department of Home Affairs)
    airports: ['SYD', 'MEL', 'BNE', 'PER', 'ADL'],
    flagEmoji: '🇦🇺',
  },
  {
    country: 'United Kingdom',
    appName: 'UK ETA',
    description: 'Required for visa-free visitors to UK',
    webUrl: 'https://www.gov.uk/eta/apply',
    appStoreUrl: 'https://apps.apple.com/app/id6444912481', // UK ETA (Home Office)
    airports: ['LHR', 'LGW', 'STN', 'LTN', 'LCY', 'MAN', 'BHX', 'EDI', 'GLA'],
    flagEmoji: '🇬🇧',
  },
  {
    country: 'United Arab Emirates',
    appName: 'UAE Pass',
    description: 'Digital identity for UAE visitors',
    webUrl: 'https://u.ae/en/information-and-services/visa-and-emirates-id',
    appStoreUrl: 'https://apps.apple.com/app/id1377158818', // UAE PASS
    airports: ['DXB', 'AUH', 'SHJ', 'DWC'],
    flagEmoji: '🇦🇪',
  },
  {
    country: 'Saudi Arabia',
    appName: 'Absher',
    description: 'Saudi Arabia government services',
    webUrl: 'https://www.absher.sa/',
    appStoreUrl: 'https://apps.apple.com/app/id1004966456', // Absher
    airports: ['RUH', 'JED', 'DMM', 'MED'],
    flagEmoji: '🇸🇦',
  },
  {
    country: 'Qatar',
    appName: 'Hayya to Qatar',
    description: 'Qatar entry and visa services',
    webUrl: 'https://www.hayya.qa/',
    appStoreUrl: 'https://apps.apple.com/app/id1593845586', // Hayya to Qatar
    airports: ['DOH'],
    flagEmoji: '🇶🇦',
  },
  {
    country: 'Bahrain',
    appName: 'Bahrain eVisa',
    description: 'Bahrain electronic visa service',
    webUrl: 'https://www.evisa.gov.bh/',
    airports: ['BAH'],
    flagEmoji: '🇧🇭',
  },
  {
    country: 'United States',
    appName: 'Mobile Passport Control',
    description: 'Faster US customs with Mobile Passport Control',
    webUrl: 'https://www.cbp.gov/travel/us-citizens/mobile-passport-control',
    appStoreUrl: 'https://apps.apple.com/app/id1520656722', // Mobile Passport Control (CBP)
    airports: ['JFK', 'LAX', 'ORD', 'MIA', 'SFO', 'DFW', 'ATL', 'SEA', 'BOS', 'IAD'],
    flagEmoji: '🇺🇸',
  },
  {
    country: 'New Zealand',
    appName: 'NZETA',
    description: 'Required for visa-free visitors to New Zealand',
    webUrl: 'https://nzeta.immigration.govt.nz/',
    appStoreUrl: 'https://apps.apple.com/app/id1470900142', // NZeTA (MBIE)
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
  return app.webUrl || app.appStoreUrl || '';
}

export function immigrationNeedsRegionWarning(app: ImmigrationApp): boolean {
  return !app.webUrl;
}
