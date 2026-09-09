/** Light/dark colour tokens — one place for navy + gold.

 * `classic` (dark) and `day` (light) palettes in lib/themes.ts are built from these.
 * Screens that still import constants/theme.ts keep the dark set for layout stability;
 * App chrome follows the active ThemeId via ThemeCtx.
 */

export const PALETTE_TOKENS = {
  light: {
    bg: '#F7F5F0',
    card: '#FFFFFF',
    navy: '#0D1B2E',
    gold: '#C9A84C',
    goldLight: 'rgba(201,168,76,0.16)',
    text: '#0D1B2E',
    textMuted: '#5C6578',
    statusGreen: '#16a34a',
    statusAmber: '#d97706',
    statusRed: '#dc2626',
    statusBlue: '#2563eb',
  },
  dark: {
    bg: '#0D1B2E',
    card: '#1A2744',
    navy: '#0D1B2E',
    gold: '#C9A84C',
    goldLight: 'rgba(201,168,76,0.15)',
    text: '#FFFFFF',
    textMuted: '#8892A4',
    statusGreen: '#22c55e',
    statusAmber: '#f59e0b',
    statusRed: '#ef4444',
    statusBlue: '#3b82f6',
  },
} as const;

export type PaletteMode = keyof typeof PALETTE_TOKENS;
export type PaletteTokens = (typeof PALETTE_TOKENS)[PaletteMode];

export const SYSTEM_LIGHT_THEME = 'day';
export const SYSTEM_DARK_THEME = 'classic';

const LEGACY_THEME_ID: Record<string, string> = {
  dark: SYSTEM_DARK_THEME,
  light: SYSTEM_LIGHT_THEME,
};

export function paletteTokens(mode: PaletteMode): PaletteTokens {
  return PALETTE_TOKENS[mode];
}

export function themeIdForSystemScheme(scheme: string | null | undefined): string {
  return scheme === 'dark' ? SYSTEM_DARK_THEME : SYSTEM_LIGHT_THEME;
}

export function resolveThemeSelection(input: {
  saved?: string | null;
  legacy?: string | null;
  systemScheme?: string | null;
  knownIds?: readonly string[];
}): { id: string; followsSystem: boolean } {
  const explicit = String(input.saved || '').trim() || String(input.legacy || '').trim();
  if (explicit) {
    const v = explicit.toLowerCase();
    if (input.knownIds?.includes(v)) return { id: v, followsSystem: false };
    if (LEGACY_THEME_ID[v]) return { id: LEGACY_THEME_ID[v], followsSystem: false };
    return { id: SYSTEM_DARK_THEME, followsSystem: false };
  }
  return {
    id: themeIdForSystemScheme(input.systemScheme),
    followsSystem: true,
  };
}
