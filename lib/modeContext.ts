/**
 * The active mode for screens and components outside App.tsx (the home screens, the flight page parts).
 * App.tsx owns the theme state and provides this next to its own ThemeCtx; everything here is read-only
 * except setMode, which goes through the same setTheme — so persistence ("waiair.theme") is unchanged.
 */
import { createContext, useContext, useMemo } from 'react';
import { squareStyles } from './squareStyles';
import { THEMES, type ThemeColors, type ThemeId } from './themes';
import type { AppMode } from './modes';

export type ModeCtxValue = {
  mode: AppMode;
  themeId: ThemeId;
  C: ThemeColors;
  /** The device's own dark mode — Kids mode darkens its sky with it. */
  systemDark: boolean;
  setMode: (mode: AppMode) => void;
};

export const ModeCtx = createContext<ModeCtxValue>({
  mode: 'night',
  themeId: 'classic',
  C: THEMES.classic,
  systemDark: false,
  setMode: () => {},
});

export function useMode(): ModeCtxValue {
  return useContext(ModeCtx);
}

export function useIsAirport(): boolean {
  return useContext(ModeCtx).mode === 'airport';
}

export function useIsKids(): boolean {
  return useContext(ModeCtx).mode === 'kids';
}

/** A component's stylesheet with square corners in airport mode, unchanged in every other mode. */
export function useSquareStyles<T extends Record<string, unknown>>(sheet: T): T {
  const airport = useIsAirport();
  return useMemo(() => (airport ? squareStyles(sheet) : sheet), [airport, sheet]);
}
