export type ThemeId =
  | 'classic'
  | 'midnight'
  | 'blossom'
  | 'tropical'
  | 'junior'
  | 'gold'
  | 'platinum';

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
};

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  pro?: boolean;
  swatchBg: string;
  swatchAccent: string;
};

export const THEME_STORAGE_KEY = 'waiair.theme';
export const THEME_STORAGE_KEY_LEGACY = 'waiair.theme.v1';

export const THEME_CATALOG: ThemeMeta[] = [
  { id: 'classic', name: 'Classic', swatchBg: '#0A0F1E', swatchAccent: '#C9A84C' },
  { id: 'midnight', name: 'Midnight', swatchBg: '#000000', swatchAccent: '#007AFF' },
  { id: 'blossom', name: 'Blossom', swatchBg: '#FFF5F8', swatchAccent: '#FF2D78' },
  { id: 'tropical', name: 'Tropical', swatchBg: '#0D2E1C', swatchAccent: '#32D74B' },
  { id: 'junior', name: 'Junior', swatchBg: '#FFFFFF', swatchAccent: '#FF9500' },
  { id: 'gold', name: 'Gold', swatchBg: '#0A0A0A', swatchAccent: '#FFD700' },
  { id: 'platinum', name: 'Platinum', pro: true, swatchBg: '#1C1C1E', swatchAccent: '#E8E8E8' },
];

const IDS = new Set<string>(THEME_CATALOG.map(t => t.id));

export const THEMES: Record<ThemeId, ThemeColors> = {
  classic: {
    bg: '#0A0F1E', card: '#141420', list: '#1A1A28', border: '#2A2D3A',
    text: '#FFFFFF', secondary: '#8896B0', muted: '#8896B0',
    accent: '#C9A84C', accentDim: '#1A2235', tabOn: '#FFFFFF',
    field: '#111827', fieldBorder: '#1E2D45', gold: '#C9A84C', icon: '#C9A84C',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#FFFFFF', cardOutline: '#2A2D3A', cardWash: null, cardShimmer: false,
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
  platinum: {
    bg: '#1C1C1E', card: '#2C2C2E', list: '#3A3A3C', border: '#48484A',
    text: '#F2F2F7', secondary: '#AEAEB2', muted: '#8E8E93',
    accent: '#E8E8E8', accentDim: '#2A2A2C', tabOn: '#1C1C1E',
    field: '#2C2C2E', fieldBorder: '#636366', gold: '#E8E8E8', icon: '#E8E8E8',
    isDark: true, fontScale: 1, statusEmoji: false,
    flightNumberColor: '#E8E8E8', cardOutline: 'rgba(232,232,232,0.55)', cardWash: 'rgba(232,232,232,0.08)', cardShimmer: true,
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
