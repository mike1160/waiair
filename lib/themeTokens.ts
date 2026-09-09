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

export type SkyImageId = 'dawn' | 'day' | 'dusk' | 'night';

export type SkyOverlay = {
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
};

export type SkyScene = {
  image: SkyImageId;
  overlay: SkyOverlay;
  dim: number;
  iconLight: boolean;
};

type SkyPeriod = SkyImageId;

function hourNorm(hourLocal: number): number {
  const h = Math.floor(Number(hourLocal));
  if (!Number.isFinite(h)) return 0;
  return ((h % 24) + 24) % 24;
}

function skyPeriod(hourLocal: number): SkyPeriod {
  const h = hourNorm(hourLocal);
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 16) return 'day';
  if (h >= 16 && h < 20) return 'dusk';
  return 'night';
}

const CREAM = PALETTE_TOKENS.light.bg;
const DARK_BG = PALETTE_TOKENS.dark.bg;

function imageFor(period: SkyPeriod, isDark: boolean): SkyImageId {
  if (!isDark) return period;
  return period === 'night' ? 'night' : 'dusk';
}

/** Overlay + dim for a chosen photo. Ignores hour (used by skyFor and the __DEV__ override). */
export function skyForImage(image: SkyImageId, isDark: boolean): SkyScene {
  const fade = isDark ? DARK_BG : CREAM;
  if (image === 'night') {
    const top = isDark ? 'rgba(4,8,20,0.9)' : 'rgba(6,12,28,0.84)';
    return {
      image,
      overlay: {
        colors: [top, 'rgba(6,12,28,0.48)', 'rgba(6,12,28,0.1)', fade],
        locations: [0, 0.3, 0.58, 1],
      },
      dim: 0.25,
      iconLight: true,
    };
  }
  if (image === 'dusk') {
    const top = isDark ? 'rgba(13,27,46,0.52)' : 'rgba(13,27,46,0.3)';
    return {
      image,
      overlay: {
        colors: [top, 'rgba(13,27,46,0.06)', fade],
        locations: [0, 0.38, 1],
      },
      dim: isDark ? 0.12 : 0,
      iconLight: true,
    };
  }
  return {
    image,
    overlay: {
      colors: ['rgba(13,27,46,0.22)', 'rgba(13,27,46,0)', fade],
      locations: [0, 0.36, 1],
    },
    dim: 0,
    iconLight: false,
  };
}

/** Photo sky + overlay stops. Dark theme uses dusk/night photos with a darker wash. */
export function skyFor(hourLocal: number, isDark: boolean): SkyScene {
  const period = skyPeriod(hourLocal);
  return skyForImage(imageFor(period, isDark), isDark);
}

/** True when chrome sitting on the sky should be light (dusk/night photos). */
export function skyTopIsDark(scene: SkyScene): boolean {
  return scene.iconLight;
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
