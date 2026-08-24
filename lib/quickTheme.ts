import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
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
    return {
      background: '#FFFFFF',
      card: '#F5F5F7',
      accent: '#F5C518',
      text: '#0f1117',
      subtext: '#666666',
      inputBg: '#F0F0F2',
      inputPlaceholder: '#888888',
      onAccent: '#000000',
      accentBorder: 'rgba(245, 197, 24, 0.55)',
      accentBorderSoft: 'rgba(245, 197, 24, 0.45)',
      accentBorderFaint: 'rgba(245, 197, 24, 0.22)',
      bgOverlay: 'rgba(255, 255, 255, 0.92)',
      bgOverlaySoft: 'rgba(255, 255, 255, 0.85)',
      dotInactive: 'rgba(15, 17, 23, 0.28)',
      dotSlotBorder: 'rgba(15, 17, 23, 0.22)',
      accentDot: 'rgba(245, 197, 24, 0.45)',
      headerIconBg: 'rgba(15, 17, 23, 0.08)',
      headerIconBorder: 'rgba(15, 17, 23, 0.12)',
      isDark: false,
    };
  }

  return {
    background: '#0f1117',
    card: '#1a1c23',
    accent: '#F5C518',
    text: '#ffffff',
    subtext: '#888888',
    inputBg: '#252830',
    inputPlaceholder: '#888888',
    onAccent: '#000000',
    accentBorder: 'rgba(245, 197, 24, 0.55)',
    accentBorderSoft: 'rgba(245, 197, 24, 0.45)',
    accentBorderFaint: 'rgba(245, 197, 24, 0.22)',
    bgOverlay: 'rgba(15, 17, 23, 0.85)',
    bgOverlaySoft: 'rgba(15, 17, 23, 0.72)',
    dotInactive: 'rgba(255, 255, 255, 0.28)',
    dotSlotBorder: 'rgba(255, 255, 255, 0.22)',
    accentDot: 'rgba(245, 197, 24, 0.45)',
    headerIconBg: '#1a1c23',
    headerIconBorder: 'rgba(255,255,255,0.12)',
    isDark: true,
  };
}

/** Quick mode kleuren + styles — volgt app-thema (toggle), fallback systeem. */
export function useQuickTheme(explicitMode?: 'light' | 'dark') {
  const fromContext = useContext(QuickThemeModeContext);
  const system = useColorScheme();
  const scheme = explicitMode ?? fromContext ?? system ?? 'dark';
  return useMemo(() => {
    const colors = quickThemeForScheme(scheme);
    return { colors, styles: createQuickStyles(colors) };
  }, [scheme]);
}
