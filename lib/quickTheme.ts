import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { PALETTE_TOKENS } from './themeTokens';
import { createQuickStyles } from '../screens/quickStyles';

/** App-thema override voor Quick mode (van ThemeCtx.mode in App.tsx). */
export const QuickThemeModeContext = createContext<'light' | 'dark' | undefined>(undefined);

export type QuickThemeColors = {
  background: string;
  card: string;
  accent: string;
  text: string;
  subtext: string;
  inputBg: string;
  inputPlaceholder: string;
  onAccent: string;
  accentBorder: string;
  accentBorderSoft: string;
  accentBorderFaint: string;
  bgOverlay: string;
  bgOverlaySoft: string;
  dotInactive: string;
  dotSlotBorder: string;
  accentDot: string;
  headerIconBg: string;
  headerIconBorder: string;
  isDark: boolean;
};

export function quickThemeForScheme(scheme: string | null | undefined): QuickThemeColors {
  if (scheme === 'light') {
    const t = PALETTE_TOKENS.light;
    return {
      background: t.bg,
      card: t.card,
      accent: t.gold,
      text: t.text,
      subtext: t.textMuted,
      inputBg: '#EFEBE3',
      inputPlaceholder: '#8A8490',
      onAccent: t.navy,
      accentBorder: 'rgba(201,168,76,0.55)',
      accentBorderSoft: 'rgba(201,168,76,0.45)',
      accentBorderFaint: 'rgba(201,168,76,0.22)',
      bgOverlay: 'rgba(247,245,240,0.92)',
      bgOverlaySoft: 'rgba(247,245,240,0.85)',
      dotInactive: 'rgba(13,27,46,0.28)',
      dotSlotBorder: 'rgba(13,27,46,0.22)',
      accentDot: 'rgba(201,168,76,0.45)',
      headerIconBg: 'rgba(13,27,46,0.08)',
      headerIconBorder: 'rgba(13,27,46,0.12)',
      isDark: false,
    };
  }

  const t = PALETTE_TOKENS.dark;
  return {
    background: t.bg,
    card: t.card,
    accent: t.gold,
    text: t.text,
    subtext: t.textMuted,
    inputBg: '#16233C',
    inputPlaceholder: t.textMuted,
    onAccent: t.navy,
    accentBorder: 'rgba(201,168,76,0.55)',
    accentBorderSoft: 'rgba(201,168,76,0.45)',
    accentBorderFaint: 'rgba(201,168,76,0.22)',
    bgOverlay: 'rgba(13,27,46,0.85)',
    bgOverlaySoft: 'rgba(13,27,46,0.72)',
    dotInactive: 'rgba(255,255,255,0.28)',
    dotSlotBorder: 'rgba(255,255,255,0.22)',
    accentDot: 'rgba(201,168,76,0.45)',
    headerIconBg: t.card,
    headerIconBorder: 'rgba(255,255,255,0.12)',
    isDark: true,
  };
}

/** Quick mode kleuren + styles — volgt app-thema (toggle), fallback systeem. */
export function useQuickTheme(explicitMode?: 'light' | 'dark') {
  const fromContext = useContext(QuickThemeModeContext);
  const system = useColorScheme();
  const scheme = explicitMode ?? fromContext ?? system ?? 'light';
  return useMemo(() => {
    const colors = quickThemeForScheme(scheme);
    return { colors, styles: createQuickStyles(colors) };
  }, [scheme]);
}
