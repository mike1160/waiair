import { Platform } from 'react-native';
import { PALETTE_TOKENS, resolveThemeSelection } from './themeTokens';

export type ThemeId =
  | 'classic'
  | 'day'
  | 'midnight'
  | 'blossom'
  | 'tropical'
  | 'junior'
  | 'gold'
  | 'dutch'
  | 'platinum'
  | 'spotter'
  | 'eagle'
  | 'cockpit'
  | 'deepspace'
  | 'holo'
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
  | 'world'
  | 'airport'
  | 'kids'
  | 'blackout'
  | 'vapor'
  | 'arctic';

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
  /** Airport mode: no rounded corners. */
  square?: boolean;
  /** Airport mode: the monospace family for numbers, times and labels. */
  mono?: string;
  /** Kids mode: sky background, bouncy presses, kid-friendly copy. */
  kids?: boolean;
  /** Blackout mode: pure black, no colour, heavier and wider-tracked type, nothing decorative. */
  blackout?: boolean;
  /** Vapor mode: deep purple with neon pink and cyan, all-caps titles, a faint glow on accents. */
  vapor?: boolean;
  /** Arctic mode: ice white, light type, soft corners and a lot of air. The first light mode theme. */
  arctic?: boolean;
  /** Eagle: Apollo mission control — NASA orange on deep blue, monospace for anything technical. */
  eagle?: boolean;
  /** Cockpit: instrument panel — amber and instrument green on near-black, every number monospace. */
  cockpit?: boolean;
  /** Deep Space: nebula purple and neon cyan on almost-black. */
  deepspace?: boolean;
  /** Holographic: iridescent on near-white, the one light theme that is not quiet. */
  holo?: boolean;
};

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  pro?: boolean;
  swatchBg: string;
  swatchAccent: string;
  /** 'mode': reached through the home screen's MODE button, not listed in the Settings theme picker. */
  group?: 'country' | 'mode';
};

export const THEME_STORAGE_KEY = 'waiair.theme';
export const THEME_STORAGE_KEY_LEGACY = 'waiair.theme.v1';
/**
 * The theme the user was on before they switched into a mode theme (Blackout, Vapor, Arctic). Turning the
 * mode off again returns them to it, rather than dumping them on Day or Night — leaving a mode should give
 * back exactly the screen they left.
 */
export const PREVIOUS_THEME_KEY = 'waiair.previousTheme';

export const THEME_CATALOG: ThemeMeta[] = [
  { id: 'classic', name: 'Classic', swatchBg: '#0D1B2E', swatchAccent: '#C9A84C' },
  { id: 'day', name: 'Day', swatchBg: '#F7F5F0', swatchAccent: '#C9A84C' },
  { id: 'midnight', name: 'Midnight', swatchBg: '#000000', swatchAccent: '#007AFF' },
  { id: 'blossom', name: 'Blossom', swatchBg: '#FFF5F8', swatchAccent: '#FF2D78' },
  { id: 'tropical', name: 'Tropical', swatchBg: '#0D2E1C', swatchAccent: '#32D74B' },
  { id: 'junior', name: 'Junior', swatchBg: '#FFFFFF', swatchAccent: '#FF9500' },
  { id: 'gold', name: 'Gold', swatchBg: '#0A0A0A', swatchAccent: '#FFD700' },
  { id: 'platinum', name: 'Platinum', pro: true, swatchBg: '#1C1C1E', swatchAccent: '#E8E8E8' },
  { id: 'spotter', name: '✈ Spotter', swatchBg: '#0F1728', swatchAccent: '#00FF41' },
  { id: 'eagle', name: 'Eagle', swatchBg: '#0A0E1A', swatchAccent: '#FF6B00' },
  { id: 'cockpit', name: 'Cockpit', swatchBg: '#1C1C1E', swatchAccent: '#FF9500' },
  { id: 'deepspace', name: 'Deep Space', swatchBg: '#050510', swatchAccent: '#7B2FFF' },
  { id: 'holo', name: 'Holographic', swatchBg: '#F8F8FF', swatchAccent: '#C44DFF' },
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
  { id: 'airport', name: '✈️ Airport', swatchBg: '#1A1A1A', swatchAccent: '#FFB800', group: 'mode' },
  { id: 'kids', name: '👶 Kids', swatchBg: '#E8F4FD', swatchAccent: '#FF6B6B', group: 'mode' },
  // group 'mode' keeps these out of the Settings theme grid while still making them known to the boot
  // resolver — without a catalogue entry a saved mode theme is rejected on launch and falls back to classic.
  { id: 'blackout', name: '⬛ Blackout', swatchBg: '#000000', swatchAccent: '#FFFFFF', group: 'mode' },
  { id: 'vapor', name: '🌆 Vapor', swatchBg: '#0D0015', swatchAccent: '#FF006E', group: 'mode' },
  { id: 'arctic', name: '❄️ Arctic', swatchBg: '#F0F4F8', swatchAccent: '#2E5BBA', group: 'mode' },
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

const light = PALETTE_TOKENS.light;
const dark = PALETTE_TOKENS.dark;

/** Airport-mode monospace: the platform's own, so nothing extra is bundled. */
export const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export const THEMES: Record<ThemeId, ThemeColors> = {
  classic: {
    bg: dark.bg, card: dark.card, list: dark.card, border: 'rgba(170,190,220,0.16)',
    text: '#F4F7FB', secondary: '#C5D0E0', muted: dark.textMuted,
    accent: dark.gold, accentDim: '#1E2C48', tabOn: '#FFFFFF',
    field: '#16233C', fieldBorder: '#2C3E5C', gold: dark.gold, icon: dark.gold,
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: 'rgba(170,190,220,0.18)', cardWash: null, cardShimmer: false,
  },
  day: {
    bg: light.bg, card: light.card, list: '#F3F1EC', border: 'rgba(13,27,46,0.10)',
    text: light.text, secondary: '#4A5568', muted: light.textMuted,
    accent: light.gold, accentDim: '#F3EBD0', tabOn: light.navy,
    field: '#FFFFFF', fieldBorder: '#D5D0C6', gold: light.gold, icon: light.navy,
    isDark: false, fontScale: 1, statusEmoji: false,
    flightNumberColor: light.navy, cardOutline: 'rgba(13,27,46,0.10)',
    cardWash: light.goldLight, cardShimmer: false,
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
  /** Airport mode: a departures board — near-black, Schiphol yellow, terminal green, monospace, square corners. */
  /**
   * Eagle: Apollo mission control [P/1]. NASA orange on the deep blue of a night launch, with white as the
   * second voice — the palette of a console, not of a poster. Technical values take the monospace face.
   */
  eagle: {
    bg: '#0A0E1A', card: '#111827', list: '#141C2E', border: '#1E3A5F',
    text: '#FFFFFF', secondary: '#8899AA', muted: '#6B7A8C',
    accent: '#FF6B00', accentDim: 'rgba(255, 107, 0, 0.14)', tabOn: '#FF6B00',
    field: '#111827', fieldBorder: '#1E3A5F', gold: '#FF6B00', icon: '#FF6B00',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: '#1E3A5F', cardWash: null, cardShimmer: false,
    flightNumberFont: MONO,
    tabBar: '#0A0E1A',
    searchPlaceholder: '#6B7A8C',
    datePillOutline: true,
    badgeBoarding: '#FF6B00',
    badgeBoardingText: '#0A0E1A',
    badgeDelayed: '#FF6B00',
    badgeLanded: '#00CC66',
    handle: '#FF6B00',
    mono: MONO,
    eagle: true,
  },
  /**
   * Cockpit: the instrument panel [P/1]. Amber for what needs reading, instrument green for what is well,
   * red for what is not — the three colours a flight deck actually uses, on the grey of the glare shield.
   */
  cockpit: {
    bg: '#1C1C1E', card: '#2C2C2E', list: '#242426', border: '#3A3A3C',
    text: '#F2F2F7', secondary: '#8E8E93', muted: '#636366',
    accent: '#FF9500', accentDim: 'rgba(255, 149, 0, 0.14)', tabOn: '#FF9500',
    field: '#2C2C2E', fieldBorder: '#3A3A3C', gold: '#FF9500', icon: '#FF9500',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#F2F2F7', cardOutline: '#3A3A3C', cardWash: null, cardShimmer: false,
    flightNumberFont: MONO,
    tabBar: '#1C1C1E',
    searchPlaceholder: '#636366',
    datePillOutline: true,
    badgeBoarding: '#FF9500',
    badgeBoardingText: '#1C1C1E',
    badgeDelayed: '#FF3B30',
    badgeLanded: '#30D158',
    handle: '#FF9500',
    mono: MONO,
    cockpit: true,
  },
  /**
   * Deep Space [P/1]: nebula purple and neon cyan on a black with a hint of blue in it. An original of our
   * own — nothing here is borrowed from anyone's galaxy.
   */
  deepspace: {
    bg: '#050510', card: '#0D0D2B', list: '#101034', border: '#1A1A4A',
    text: '#FFFFFF', secondary: '#8888BB', muted: '#6B6B99',
    accent: '#7B2FFF', accentDim: 'rgba(123, 47, 255, 0.18)', tabOn: '#00D4FF',
    field: '#0D0D2B', fieldBorder: '#1A1A4A', gold: '#00D4FF', icon: '#00D4FF',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: '#1A1A4A', cardWash: 'rgba(123, 47, 255, 0.06)', cardShimmer: false,
    tabBar: '#050510',
    searchPlaceholder: '#6B6B99',
    datePillOutline: true,
    badgeBoarding: '#7B2FFF',
    badgeBoardingText: '#FFFFFF',
    badgeDelayed: '#FF2FD4',
    badgeLanded: '#00D4FF',
    handle: '#00D4FF',
    deepspace: true,
  },
  /**
   * Holographic [P/1]: iridescent on near-white — the opposite of Blackout, and the only light theme here
   * that raises its voice. The gradient lives in HOLO below; a palette can only hold flat colours.
   */
  holo: {
    bg: '#F8F8FF', card: '#FFFFFF', list: '#FDFDFF', border: '#E0E0FF',
    text: '#1A1A2E', secondary: '#6A6A8E', muted: '#8E8EB0',
    accent: '#C44DFF', accentDim: 'rgba(196, 77, 255, 0.12)', tabOn: '#FFFFFF',
    field: '#FFFFFF', fieldBorder: '#E0E0FF', gold: '#FF6B9D', icon: '#C44DFF',
    isDark: false, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#1A1A2E', cardOutline: '#E0E0FF', cardWash: 'rgba(196, 77, 255, 0.05)', cardShimmer: true,
    tabBar: '#F8F8FF',
    searchPlaceholder: '#8E8EB0',
    badgeBoarding: '#C44DFF',
    badgeBoardingText: '#FFFFFF',
    badgeDelayed: '#FF6B9D',
    badgeLanded: '#4DAAFF',
    handle: '#C44DFF',
    holo: true,
  },
  /*
   * Airport: a real departures board [P/1]. The greys were a shade too dark and the yellow a shade too
   * green; these are the values the boards at Schiphol, Changi and Phuket actually use, so a panel on the
   * phone and a panel overhead read as the same thing.
   */
  airport: {
    bg: '#1A1A1A', card: '#242424', list: '#242424', border: '#333333',
    text: '#FFFFFF', secondary: '#999999', muted: '#999999',
    accent: '#FFB800', accentDim: 'rgba(255, 184, 0, 0.12)', tabOn: '#FFB800',
    field: '#242424', fieldBorder: '#333333', gold: '#FFB800', icon: '#FFB800',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: '#333333', cardWash: null, cardShimmer: false,
    flightNumberFont: MONO,
    tabBar: '#1A1A1A',
    searchPlaceholder: '#999999',
    datePillOutline: true,
    badgeBoarding: '#FFB800',
    badgeBoardingText: '#1A1A1A',
    badgeDelayed: '#FFB800',
    badgeLanded: '#FFFFFF',
    handle: '#FFB800',
    square: true,
    mono: MONO,
  },
  /** Kids mode: sky blue and coral, big friendly type, a sky picture behind every screen. */
  kids: {
    bg: '#E8F4FD', card: '#FFFFFF', list: '#F4FAFE', border: '#B8DFF5',
    text: '#1A1A2E', secondary: '#5A7A9A', muted: '#5A7A9A',
    accent: '#FF6B6B', accentDim: '#FFE3E3', tabOn: '#FFFFFF',
    field: '#FFFFFF', fieldBorder: '#B8DFF5', gold: '#FF6B6B', icon: '#FF6B6B',
    isDark: false, fontScale: 1.08, statusEmoji: true,
    flightNumberColor: '#1A1A2E', cardOutline: '#B8DFF5', cardWash: null, cardShimmer: false,
    badgeBoarding: '#FFE66D',
    badgeBoardingText: '#1A1A2E',
    badgeDelayed: '#FF6B6B',
    badgeLanded: '#2ECC71',
    handle: '#FF6B6B',
    kids: true,
  },
  /** Arctic mode: ice white and frost, one deep arctic blue, no shadows. */
  arctic: {
    bg: '#F0F4F8', card: '#FFFFFF', list: '#E8EEF4', border: '#D0DCE8',
    text: '#0A1628', secondary: '#6B8299', muted: '#6B8299',
    accent: '#2E5BBA', accentDim: '#E8EEF4', tabOn: '#2E5BBA',
    field: '#FFFFFF', fieldBorder: '#D0DCE8', gold: '#2E5BBA', icon: '#2E5BBA',
    isDark: false, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#0A1628', cardOutline: '#D0DCE8', cardWash: null, cardShimmer: false,
    tabBar: '#F0F4F8',
    searchPlaceholder: '#B0C4D8',
    datePillOutline: true,
    badgeBoarding: '#E8EEF4',
    badgeBoardingText: '#2E5BBA',
    badgeDelayed: '#7A5C2E',
    badgeLanded: '#2E7D52',
    handle: '#2E5BBA',
    arctic: true,
  },
  /** Vapor mode: deep space purple, neon pink and cyan. Card outlines glow; plain dividers do not. */
  vapor: {
    bg: '#0D0015', card: '#130020', list: '#1A0030', border: '#2A0040',
    text: '#FFFFFF', secondary: '#CC00FF', muted: '#CC00FF',
    accent: '#00F5FF', accentDim: '#1A0030', tabOn: '#FF006E',
    field: '#130020', fieldBorder: '#2A0040', gold: '#FF006E', icon: '#00F5FF',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#00F5FF', cardOutline: '#FF006E', cardWash: null, cardShimmer: false,
    tabBar: '#0D0015',
    searchPlaceholder: '#440066',
    datePillOutline: true,
    badgeBoarding: '#FF006E',
    badgeBoardingText: '#000000',
    badgeDelayed: '#FF8800',
    badgeLanded: '#00F5FF',
    handle: '#FF006E',
    vapor: true,
  },
  /**
   * Blackout mode: pure black and pure white, no colour anywhere. Status greens and reds are flattened to
   * greys on purpose — the point is that nothing on the screen competes for attention. Square corners and no
   * shadows come from `square`, the same flag airport mode uses.
   */
  blackout: {
    bg: '#000000', card: '#0A0A0A', list: '#111111', border: '#1A1A1A',
    text: '#FFFFFF', secondary: '#888888', muted: '#888888',
    accent: '#FFFFFF', accentDim: '#1A1A1A', tabOn: '#FFFFFF',
    field: '#0A0A0A', fieldBorder: '#1A1A1A', gold: '#C0C0C0', icon: '#FFFFFF',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: '#1A1A1A', cardWash: null, cardShimmer: false,
    tabBar: '#000000',
    searchPlaceholder: '#444444',
    datePillOutline: true,
    badgeBoarding: '#333333',
    badgeBoardingText: '#FFFFFF',
    badgeDelayed: '#666666',
    badgeLanded: '#AAAAAA',
    handle: '#FFFFFF',
    square: true,
    blackout: true,
  },
};

/**
 * Vapor mode: retrowave. Neon pink is the accent on a card's outline, not on every divider — pink on every
 * hairline reads as an error state rather than synthwave, so ordinary borders take a deep plum instead.
 */
/**
 * Arctic mode: Scandinavian stillness. Status colours are muted rather than removed — a delay should read
 * as information, not an alarm — and the type is light, with a medium weight for titles and never bold.
 */
export const ARCTIC = {
  textSubtle: '#B0C4D8',
  goldLight: '#E8EEF4',
  statusGreen: '#2E7D52',
  statusRed: '#8B2635',
  statusOrange: '#7A5C2E',
  statusPillBg: '#FFFFFF',
  statusPillText: '#2E5BBA',
  letterSpacingBody: 0.8,
  letterSpacingTitle: 0.8,
  weightBody: '300' as const,
  weightTitle: '500' as const,
  /** Every card and row gets a little more air than the other themes. */
  extraPadding: 4,
} as const;

export const VAPOR = {
  textSubtle: '#440066',
  goldLight: '#1A0030',
  statusGreen: '#00F5FF',
  statusRed: '#FF006E',
  statusOrange: '#FF8800',
  statusPillBg: '#FF006E',
  statusPillText: '#000000',
  cardBorder: '#FF006E',
  divider: '#2A0040',
  letterSpacingBody: 1,
  letterSpacingTitle: 2,
  /** React Native has no CSS textShadow: it wants the three props below. */
  glow: {
    textShadowColor: '#FF006E',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
} as const;

/** The greys blackout mode uses beyond the palette: status colours flattened, and the type treatment. */
export const BLACKOUT = {
  textSubtle: '#444444',
  goldLight: '#1A1A1A',
  statusGreen: '#AAAAAA',
  statusRed: '#666666',
  statusOrange: '#777777',
  statusPillBg: '#333333',
  statusPillText: '#FFFFFF',
  /** Body copy is tracked wider and set heavier; titles wider still. */
  letterSpacingBody: 0.5,
  letterSpacingTitle: 1.5,
} as const;

/** The fixed airport-mode colours the board uses beyond the theme's own. */
export const AIRPORT_BOARD = {
  /** On time, delayed, cancelled and landed, as a board shows them [P/1]. */
  green: '#00CC44',
  amber: '#FFB800',
  red: '#FF3333',
  landed: '#FFFFFF',
  soft: '#999999',
  accentSoft: '#7A5800',
  /** The panel itself: near-black with a lighter card and a visible rule between rows. */
  bg: '#1A1A1A',
  card: '#242424',
  rule: '#333333',
} as const;

/**
 * Eagle [P/1]: the console colours beyond the palette. Green for nominal, orange for anything that moved —
 * mission control never used more than that, and neither does this.
 */
export const EAGLE = {
  statusGreen: '#00CC66',
  statusOrange: '#FF6B00',
  starField: 'rgba(255,255,255,0.35)',
  letterSpacingTitle: 1.6,
  weightTitle: '700' as const,
} as const;

/**
 * Cockpit [P/1]: the three colours a flight deck uses and nothing else. Amber to read, green for well,
 * red for not — on the grey of the glare shield.
 */
export const COCKPIT = {
  amber: '#FF9500',
  green: '#30D158',
  red: '#FF3B30',
  gauge: 'rgba(255,149,0,0.10)',
  letterSpacingLabel: 1.8,
  weightTitle: '700' as const,
} as const;

/** Deep Space [P/1]: the nebula's own colours, kept off the ordinary dividers so they stay an accent. */
export const DEEP_SPACE = {
  purple: '#7B2FFF',
  cyan: '#00D4FF',
  nebula: '#FF2FD4',
  glow: {
    shadowColor: '#7B2FFF',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  stars: 'rgba(255,255,255,0.6)',
} as const;

/**
 * Holographic [P/1]: the iridescence, as the three stops of one gradient and the timing of the shimmer that
 * moves across it. Flat colours cannot hold a gradient, so it lives here and the components read it.
 */
export const HOLO = {
  gradient: ['#FF6B9D', '#C44DFF', '#4DAAFF'] as const,
  onGradient: '#FFFFFF',
  glass: 'rgba(255,255,255,0.8)',
  glassBorder: '#E0E0FF',
  /** One slow pass, looping: fast enough to notice, slow enough to forget. */
  shimmerMs: 3000,
} as const;

/** The fixed kids-mode colours beyond the theme's own. */
export const KIDS_COLORS = {
  green: '#2ECC71',
  amber: '#FFE66D',
  red: '#FF6B6B',
  accentSoft: '#FFB3B3',
  /** Over the sky picture: light in light mode, deep blue when the system is dark. */
  overlayLight: 'rgba(232, 244, 253, 0.85)',
  overlayDark: 'rgba(20, 40, 60, 0.85)',
} as const;

/**
 * Kids mode's dark variant: the same sky under a deep-blue wash (rgba(20, 40, 60, 0.85)),
 * so the cards turn navy and the text light. Coral stays the accent.
 */
export const KIDS_DARK: ThemeColors = {
  ...THEMES.kids,
  bg: 'rgb(20, 40, 60)',
  card: '#1E3A55',
  list: '#1A3450',
  border: '#2E5A80',
  text: '#F2F8FF',
  secondary: '#A9C4DD',
  muted: '#A9C4DD',
  accentDim: 'rgba(255, 107, 107, 0.22)',
  tabOn: '#1E3A55',
  field: '#1E3A55',
  fieldBorder: '#2E5A80',
  flightNumberColor: '#F2F8FF',
  cardOutline: '#2E5A80',
  badgeBoardingText: '#1A1A2E',
  isDark: true,
};

/** The colours a theme paints with; only Kids mode has a light and a dark variant of its own. */
export function paletteFor(id: ThemeId, kidsDark: boolean): ThemeColors {
  if (id === 'kids' && kidsDark) return KIDS_DARK;
  return THEMES[id];
}

export function parseStoredTheme(raw?: string | null): ThemeId {
  const { id } = resolveThemeSelection({
    saved: raw,
    knownIds: [...IDS],
  });
  return (IDS.has(id) ? id : 'classic') as ThemeId;
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
