import { Platform } from 'react-native';

export type ThemeId =
  | 'classic'
  | 'midnight'
  | 'blossom'
  | 'tropical'
  | 'junior'
  | 'gold'
  | 'dutch'
  | 'platinum'
  | 'spotter'
  | 'thai'
  | 'singapore'
  | 'japan'
  | 'korea'
  | 'china'
  | 'india'
  | 'malaysia'
  | 'indonesia'
  | 'vietnam'
  | 'philippines'
  | 'uk'
  | 'germany'
  | 'france'
  | 'spain'
  | 'italy'
  | 'swiss'
  | 'turkey'
  | 'uae'
  | 'qatar'
  | 'hongkong'
  | 'australia'
  | 'usa'
  | 'world';

export type ThemeColors = {
  bg: string;
  card: string;
  list: string;
  border: string;
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  accentDim: string;
  tabOn: string;
  field: string;
  fieldBorder: string;
  gold: string;
  icon: string;
  isDark: boolean;
  fontScale: number;
  statusEmoji: boolean;
  flightNumberColor: string;
  cardOutline: string;
  cardWash: string | null;
  cardShimmer: boolean;
  flightNumberFont?: string;
  tabBar?: string;
  searchPlaceholder?: string;
  datePillOutline?: boolean;
  badgeBoarding?: string;
  badgeBoardingText?: string;
  badgeDelayed?: string;
  badgeLanded?: string;
  gateSkin?: 'schiphol' | 'spotter';
  handle?: string;
};

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  pro?: boolean;
  swatchBg: string;
  swatchAccent: string;
  group?: 'country';
};

export const THEME_STORAGE_KEY = 'waiair.theme';
export const THEME_STORAGE_KEY_LEGACY = 'waiair.theme.v1';

export const THEME_CATALOG: ThemeMeta[] = [
  { id: 'classic', name: 'Classic', swatchBg: '#0F1728', swatchAccent: '#C9A84C' },
  { id: 'midnight', name: 'Midnight', swatchBg: '#000000', swatchAccent: '#007AFF' },
  { id: 'blossom', name: 'Blossom', swatchBg: '#FFF5F8', swatchAccent: '#FF2D78' },
  { id: 'tropical', name: 'Tropical', swatchBg: '#0D2E1C', swatchAccent: '#32D74B' },
  { id: 'junior', name: 'Junior', swatchBg: '#FFFFFF', swatchAccent: '#FF9500' },
  { id: 'gold', name: 'Gold', swatchBg: '#0A0A0A', swatchAccent: '#FFD700' },
  { id: 'platinum', name: 'Platinum', pro: true, swatchBg: '#1C1C1E', swatchAccent: '#E8E8E8' },
  { id: 'spotter', name: '✈ Spotter', swatchBg: '#0F1728', swatchAccent: '#00FF41' },
  { id: 'dutch', name: '🇳🇱 Dutch', swatchBg: '#00A1E4', swatchAccent: '#FFD700', group: 'country' },
  { id: 'thai', name: '🇹🇭 Thai', swatchBg: '#1A0A2E', swatchAccent: '#C9A84C', group: 'country' },
  { id: 'singapore', name: '🇸🇬 Singapore', swatchBg: '#001A3D', swatchAccent: '#C8A84B', group: 'country' },
  { id: 'japan', name: '🇯🇵 Japan', swatchBg: '#4A0A14', swatchAccent: '#BC002D', group: 'country' },
  { id: 'korea', name: '🇰🇷 Korea', swatchBg: '#000D2E', swatchAccent: '#E61E2B', group: 'country' },
  { id: 'china', name: '🇨🇳 China', swatchBg: '#8B1518', swatchAccent: '#FFD700', group: 'country' },
  { id: 'india', name: '🇮🇳 India', swatchBg: '#4A1A00', swatchAccent: '#FF8C00', group: 'country' },
  { id: 'malaysia', name: '🇲🇾 Malaysia', swatchBg: '#002B7F', swatchAccent: '#CC0001', group: 'country' },
  { id: 'indonesia', name: '🇮🇩 Indonesia', swatchBg: '#5C1018', swatchAccent: '#E8192C', group: 'country' },
  { id: 'vietnam', name: '🇻🇳 Vietnam', swatchBg: '#001228', swatchAccent: '#DA251D', group: 'country' },
  { id: 'philippines', name: '🇵🇭 Philippines', swatchBg: '#0038A8', swatchAccent: '#FCD116', group: 'country' },
  { id: 'uk', name: '🇬🇧 UK', swatchBg: '#012169', swatchAccent: '#C8102E', group: 'country' },
  { id: 'germany', name: '🇩🇪 Germany', swatchBg: '#0A0A0A', swatchAccent: '#FFCC00', group: 'country' },
  { id: 'france', name: '🇫🇷 France', swatchBg: '#002654', swatchAccent: '#EF3340', group: 'country' },
  { id: 'spain', name: '🇪🇸 Spain', swatchBg: '#6B1212', swatchAccent: '#F1BF00', group: 'country' },
  { id: 'italy', name: '🇮🇹 Italy', swatchBg: '#003C2A', swatchAccent: '#009246', group: 'country' },
  { id: 'swiss', name: '🇨🇭 Swiss', swatchBg: '#4A0808', swatchAccent: '#FF0000', group: 'country' },
  { id: 'turkey', name: '🇹🇷 Turkey', swatchBg: '#4A0018', swatchAccent: '#E30A17', group: 'country' },
  { id: 'uae', name: '🇦🇪 UAE', swatchBg: '#0A1A0A', swatchAccent: '#C8A84B', group: 'country' },
  { id: 'qatar', name: '🇶🇦 Qatar', swatchBg: '#4A0E2A', swatchAccent: '#8D1B3D', group: 'country' },
  { id: 'hongkong', name: '🇭🇰 Hong Kong', swatchBg: '#003D3A', swatchAccent: '#006564', group: 'country' },
  { id: 'australia', name: '🇦🇺 Australia', swatchBg: '#001B4D', swatchAccent: '#E8192C', group: 'country' },
  { id: 'usa', name: '🇺🇸 USA', swatchBg: '#0A3161', swatchAccent: '#B31942', group: 'country' },
  { id: 'world', name: '🌍 World', swatchBg: '#0F1728', swatchAccent: '#C9A84C', group: 'country' },
];

/** ISO 3166-1 alpha-2 codes for country-theme SVG flags. */
export const FLAG_ISO: Partial<Record<ThemeId, string>> = {
  dutch: 'NL',
  thai: 'TH',
  japan: 'JP',
  singapore: 'SG',
  germany: 'DE',
  france: 'FR',
  uk: 'GB',
  italy: 'IT',
  swiss: 'CH',
  turkey: 'TR',
  uae: 'AE',
  qatar: 'QA',
  china: 'CN',
  korea: 'KR',
  india: 'IN',
  malaysia: 'MY',
  indonesia: 'ID',
  vietnam: 'VN',
  philippines: 'PH',
  hongkong: 'HK',
  australia: 'AU',
  usa: 'US',
  spain: 'ES',
};

/** Large watermark flag for country themes. Style themes are omitted on purpose. */
export const FLAG_EMOJI: Partial<Record<ThemeId, string>> = {
  dutch: '🇳🇱',
  thai: '🇹🇭',
  japan: '🇯🇵',
  singapore: '🇸🇬',
  germany: '🇩🇪',
  france: '🇫🇷',
  uk: '🇬🇧',
  italy: '🇮🇹',
  swiss: '🇨🇭',
  turkey: '🇹🇷',
  uae: '🇦🇪',
  qatar: '🇶🇦',
  china: '🇨🇳',
  korea: '🇰🇷',
  india: '🇮🇳',
  malaysia: '🇲🇾',
  indonesia: '🇮🇩',
  vietnam: '🇻🇳',
  philippines: '🇵🇭',
  hongkong: '🇭🇰',
  australia: '🇦🇺',
  usa: '🇺🇸',
  spain: '🇪🇸',
  world: '🌍',
};

const IDS = new Set<string>(THEME_CATALOG.map(t => t.id));

function countryTheme(p: {
  bg: string;
  card: string;
  list: string;
  accent: string;
  text: string;
  secondary: string;
  tabOn: string;
}): ThemeColors {
  return {
    bg: p.bg,
    card: '#1A2744',
    list: '#1A2744',
    border: 'rgba(255,255,255,0.15)',
    text: p.text,
    secondary: p.secondary,
    muted: p.secondary,
    accent: p.accent,
    accentDim: p.list,
    tabOn: p.tabOn,
    field: p.list,
    fieldBorder: p.card,
    gold: p.accent,
    icon: p.accent,
    isDark: true,
    fontScale: 1,
    statusEmoji: false,
    flightNumberColor: p.text,
    cardOutline: 'rgba(255,255,255,0.15)',
    cardWash: null,
    cardShimmer: false,
    tabBar: p.list,
  };
}

export const THEMES: Record<ThemeId, ThemeColors> = {
  classic: {
    bg: '#0F1728', card: '#1A2744', list: '#1A2744', border: 'rgba(170,190,220,0.16)',
    text: '#F4F7FB', secondary: '#C5D0E0', muted: '#A7B4C8',
    accent: '#C9A84C', accentDim: '#1E2C48', tabOn: '#FFFFFF',
    field: '#16233C', fieldBorder: '#2C3E5C', gold: '#C9A84C', icon: '#C9A84C',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: 'rgba(170,190,220,0.18)', cardWash: null, cardShimmer: false,
  },
  midnight: {
    bg: '#000000', card: '#0C0C0E', list: '#121214', border: '#1C1C1E',
    text: '#F5F5F7', secondary: '#8E8E93', muted: '#636366',
    accent: '#007AFF', accentDim: '#001A33', tabOn: '#FFFFFF',
    field: '#0C0C0E', fieldBorder: '#2C2C2E', gold: '#007AFF', icon: '#007AFF',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#F5F5F7', cardOutline: '#1C1C1E', cardWash: null, cardShimmer: false,
  },
  blossom: {
    bg: '#FFF5F8', card: '#FFFFFF', list: '#FFF8FA', border: '#F8D0DC',
    text: '#3B1020', secondary: '#9A6074', muted: '#C49AAA',
    accent: '#FF2D78', accentDim: '#FFE4EE', tabOn: '#FFFFFF',
    field: '#FFFFFF', fieldBorder: '#F3C1D0', gold: '#FF2D78', icon: '#FF2D78',
    isDark: false, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#3B1020', cardOutline: 'rgba(255,45,120,0.35)', cardWash: 'rgba(255,45,120,0.04)', cardShimmer: false,
  },
  tropical: {
    bg: '#0D2E1C', card: '#123826', list: '#184530', border: '#1F5A3C',
    text: '#F2FFF6', secondary: '#8FBF9A', muted: '#6A9A78',
    accent: '#32D74B', accentDim: '#143B24', tabOn: '#0D2E1C',
    field: '#123826', fieldBorder: '#1F5A3C', gold: '#32D74B', icon: '#32D74B',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#F2FFF6', cardOutline: '#1F5A3C', cardWash: 'rgba(50,215,75,0.06)', cardShimmer: false,
  },
  junior: {
    bg: '#FFFFFF', card: '#FFFFFF', list: '#FFF7ED', border: '#FED7AA',
    text: '#1C1917', secondary: '#78716C', muted: '#A8A29E',
    accent: '#FF9500', accentDim: '#FFF4E5', tabOn: '#FFFFFF',
    field: '#FFFFFF', fieldBorder: '#FDBA74', gold: '#FF9500', icon: '#FF9500',
    isDark: false, fontScale: 1.12, statusEmoji: true,
    flightNumberColor: '#1C1917', cardOutline: 'rgba(255,149,0,0.45)', cardWash: 'rgba(255,149,0,0.05)', cardShimmer: false,
  },
  gold: {
    bg: '#0A0A0A', card: '#12100A', list: '#1A160C', border: '#3D3420',
    text: '#FFF8E7', secondary: '#B8A56A', muted: '#8A7A4A',
    accent: '#FFD700', accentDim: '#2A2208', tabOn: '#0A0A0A',
    field: '#12100A', fieldBorder: '#4A3F1C', gold: '#FFD700', icon: '#FFD700',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFD700', cardOutline: 'rgba(255,215,0,0.45)', cardWash: 'rgba(255,215,0,0.07)', cardShimmer: true,
  },
  dutch: {
    bg: '#00A1E4', card: '#1A2744', list: '#1A2744', border: 'rgba(255,255,255,0.25)',
    text: '#FFFFFF', secondary: '#E8F7FF', muted: '#B8E4F7',
    accent: '#FFD700', accentDim: '#1A3A6E', tabOn: '#0F1728',
    field: '#00245E', fieldBorder: '#0040A0', gold: '#FFD700', icon: '#FFD700',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: 'rgba(255,255,255,0.15)', cardWash: 'rgba(255,215,0,0.08)', cardShimmer: false,
    tabBar: '#0085C3',
  },
  thai: countryTheme({
    bg: '#1A0A2E', card: '#2D1B4E', list: '#120820',
    accent: '#C9A84C', text: '#FFFFFF', secondary: '#C4A8E0', tabOn: '#FFFFFF',
  }),
  singapore: countryTheme({
    bg: '#001A3D', card: '#002456', list: '#001230',
    accent: '#C8A84B', text: '#FFFFFF', secondary: '#A0B8D8', tabOn: '#FFFFFF',
  }),
  japan: countryTheme({
    bg: '#4A0A14', card: '#5C101A', list: '#38080F',
    accent: '#BC002D', text: '#FFFFFF', secondary: '#E8A0A8', tabOn: '#FFFFFF',
  }),
  korea: countryTheme({
    bg: '#000D2E', card: '#001540', list: '#000820',
    accent: '#E61E2B', text: '#FFFFFF', secondary: '#A0B0D0', tabOn: '#FFFFFF',
  }),
  china: countryTheme({
    bg: '#8B1518', card: '#A01C20', list: '#6E1014',
    accent: '#FFD700', text: '#FFFFFF', secondary: '#F0C8A0', tabOn: '#FFFFFF',
  }),
  india: countryTheme({
    bg: '#4A1A00', card: '#5C2200', list: '#331200',
    accent: '#FF8C00', text: '#FFFFFF', secondary: '#E0B070', tabOn: '#FFFFFF',
  }),
  malaysia: countryTheme({
    bg: '#002B7F', card: '#003399', list: '#001F5C',
    accent: '#CC0001', text: '#FFFFFF', secondary: '#A8C4F0', tabOn: '#FFFFFF',
  }),
  indonesia: countryTheme({
    bg: '#5C1018', card: '#70141E', list: '#480C12',
    accent: '#E8192C', text: '#FFFFFF', secondary: '#E0A080', tabOn: '#FFFFFF',
  }),
  vietnam: countryTheme({
    bg: '#001228', card: '#001E40', list: '#000C1A',
    accent: '#DA251D', text: '#FFFFFF', secondary: '#A0B8D8', tabOn: '#FFFFFF',
  }),
  philippines: countryTheme({
    bg: '#0038A8', card: '#0044C4', list: '#002B80',
    accent: '#FCD116', text: '#FFFFFF', secondary: '#A8C8F0', tabOn: '#FFFFFF',
  }),
  uk: countryTheme({
    bg: '#012169', card: '#012A82', list: '#011850',
    accent: '#C8102E', text: '#FFFFFF', secondary: '#A0B0D8', tabOn: '#FFFFFF',
  }),
  germany: countryTheme({
    bg: '#0A0A0A', card: '#161616', list: '#050505',
    accent: '#FFCC00', text: '#FFFFFF', secondary: '#C0C0C0', tabOn: '#FFFFFF',
  }),
  france: countryTheme({
    bg: '#002654', card: '#003070', list: '#001C40',
    accent: '#EF3340', text: '#FFFFFF', secondary: '#A0B0D8', tabOn: '#FFFFFF',
  }),
  spain: countryTheme({
    bg: '#6B1212', card: '#801818', list: '#540E0E',
    accent: '#F1BF00', text: '#FFFFFF', secondary: '#E8C8A0', tabOn: '#FFFFFF',
  }),
  italy: countryTheme({
    bg: '#003C2A', card: '#004D36', list: '#002C1E',
    accent: '#009246', text: '#FFFFFF', secondary: '#A0D0B8', tabOn: '#FFFFFF',
  }),
  swiss: countryTheme({
    bg: '#4A0808', card: '#5C0C0C', list: '#380606',
    accent: '#FF0000', text: '#FFFFFF', secondary: '#E0A0A0', tabOn: '#FFFFFF',
  }),
  turkey: countryTheme({
    bg: '#4A0018', card: '#5C0020', list: '#380012',
    accent: '#E30A17', text: '#FFFFFF', secondary: '#E0A0B8', tabOn: '#FFFFFF',
  }),
  uae: countryTheme({
    bg: '#0A1A0A', card: '#0F280F', list: '#061006',
    accent: '#C8A84B', text: '#FFFFFF', secondary: '#90B890', tabOn: '#FFFFFF',
  }),
  qatar: countryTheme({
    bg: '#4A0E2A', card: '#5C1234', list: '#380A20',
    accent: '#8D1B3D', text: '#FFFFFF', secondary: '#E0A8C0', tabOn: '#FFFFFF',
  }),
  hongkong: countryTheme({
    bg: '#003D3A', card: '#004D49', list: '#002C2A',
    accent: '#006564', text: '#FFFFFF', secondary: '#90D0C8', tabOn: '#FFFFFF',
  }),
  australia: countryTheme({
    bg: '#001B4D', card: '#002266', list: '#001238',
    accent: '#E8192C', text: '#FFFFFF', secondary: '#A0B8D8', tabOn: '#FFFFFF',
  }),
  usa: countryTheme({
    bg: '#0A3161', card: '#0C3A75', list: '#071F40',
    accent: '#B31942', text: '#FFFFFF', secondary: '#A0B8D8', tabOn: '#FFCC00',
  }),
  world: {
    bg: '#0F1728', card: '#1A2744', list: '#1A2744', border: 'rgba(170,190,220,0.16)',
    text: '#F4F7FB', secondary: '#C5D0E0', muted: '#A7B4C8',
    accent: '#C9A84C', accentDim: '#1E2C48', tabOn: '#FFFFFF',
    field: '#16233C', fieldBorder: '#2C3E5C', gold: '#C9A84C', icon: '#C9A84C',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: 'rgba(170,190,220,0.18)', cardWash: null, cardShimmer: false,
  },
  platinum: {
    bg: '#1C1C1E', card: '#2C2C2E', list: '#3A3A3C', border: '#48484A',
    text: '#F2F2F7', secondary: '#AEAEB2', muted: '#8E8E93',
    accent: '#E8E8E8', accentDim: '#2A2A2C', tabOn: '#1C1C1E',
    field: '#2C2C2E', fieldBorder: '#636366', gold: '#E8E8E8', icon: '#E8E8E8',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#E8E8E8', cardOutline: 'rgba(232,232,232,0.55)', cardWash: 'rgba(232,232,232,0.08)', cardShimmer: true,
  },
  spotter: {
    bg: '#0F1728', card: '#111827', list: '#070B14', border: 'rgba(0, 255, 65, 0.15)',
    text: '#E2E8F0', secondary: '#4B5563', muted: '#6B7280',
    accent: '#00FF41', accentDim: 'rgba(0, 255, 65, 0.08)', tabOn: '#00FF41',
    field: '#111827', fieldBorder: 'rgba(0, 255, 65, 0.25)', gold: '#00FF41', icon: '#00FF41',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#00FF41', cardOutline: 'rgba(0, 255, 65, 0.15)', cardWash: 'rgba(0, 255, 65, 0.04)', cardShimmer: false,
    flightNumberFont: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    tabBar: '#070B14',
    searchPlaceholder: '#00FF41',
    datePillOutline: true,
    badgeBoarding: '#00FF41',
    badgeBoardingText: '#000000',
    badgeDelayed: '#FF4500',
    badgeLanded: '#00FF41',
    gateSkin: 'spotter',
    handle: '#00FF41',
  },
};

export function parseStoredTheme(raw?: string | null): ThemeId {
  const v = String(raw || '').trim().toLowerCase();
  if (IDS.has(v)) return v as ThemeId;
  if (v === 'dark') return 'classic';
  if (v === 'light') return 'blossom';
  return 'classic';
}

export function isProTheme(id: ThemeId): boolean {
  return id === 'platinum';
}

/** ISO country code → country theme. Unknown codes fall back to Classic. */
export const REGION_TO_THEME: Record<string, ThemeId> = {
  // Europa
  NL: 'dutch', BE: 'dutch', DE: 'germany',
  FR: 'france', ES: 'spain', IT: 'italy',
  GB: 'uk', IE: 'uk', CH: 'swiss',
  AT: 'swiss', TR: 'turkey', PT: 'spain',
  GR: 'classic', SE: 'classic', NO: 'classic',
  DK: 'classic', FI: 'classic', PL: 'classic',

  // Midden-Oosten
  AE: 'uae', QA: 'qatar', SA: 'qatar',
  KW: 'qatar', BH: 'qatar', OM: 'qatar',

  // Azië
  TH: 'thai', SG: 'singapore', MY: 'malaysia',
  ID: 'indonesia', PH: 'philippines', VN: 'vietnam',
  JP: 'japan', KR: 'korea', CN: 'china',
  TW: 'china', HK: 'hongkong', MO: 'hongkong',
  IN: 'india', LK: 'india', NP: 'india',
  BD: 'india', MM: 'thai', KH: 'thai',
  LA: 'thai',

  // Oceanië
  AU: 'australia', NZ: 'australia',

  // Amerika
  US: 'usa', CA: 'usa', MX: 'usa',
  BR: 'usa', AR: 'usa',

  // Fallback
  DEFAULT: 'classic',
};

export function themeIdForRegion(countryCode?: string | null): ThemeId {
  const cc = String(countryCode || '').trim().toUpperCase();
  if (!cc) return REGION_TO_THEME.DEFAULT;
  return REGION_TO_THEME[cc] || REGION_TO_THEME.DEFAULT;
}

export function juniorStatusLabel(status: string, fallback: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'boarding') return `🛫 ${fallback}`;
  if (s === 'delayed') return `⏰ ${fallback}`;
  if (s === 'landed') return `🎉 ${fallback}`;
  if (s === 'cancelled') return `❌ ${fallback}`;
  if (s === 'en-route') return `✈️ ${fallback}`;
  if (s === 'scheduled') return `✅ ${fallback}`;
  return fallback;
}
