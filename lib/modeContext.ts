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
  /**
   * Kids mode's dark sky: on when the user came to Kids from a dark theme (Night, Midnight…) or the phone
   * itself reports dark. The app is locked to light appearance, so the user's own choice is what counts.
   */
  kidsDark: boolean;
  setMode: (mode: AppMode) => void;
  /**
   * Leave the current mode theme for whatever the user was on before it (see PREVIOUS_THEME_KEY), falling
   * back to their own light or dark theme when there is nothing remembered.
   */
  exitMode: () => void;
};

export const ModeCtx = createContext<ModeCtxValue>({
  mode: 'night',
  themeId: 'classic',
  C: THEMES.classic,
  kidsDark: false,
  setMode: () => {},
  exitMode: () => {},
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

/** Blackout mode: pure black, no colour, nothing decorative on screen. */
export function useIsBlackout(): boolean {
  return useContext(ModeCtx).mode === 'blackout';
}

/** Alias, for callers that read better as a mode question than an "is" question. */
export const useBlackoutMode = useIsBlackout;

/** Vapor mode: retrowave — deep purple, neon pink and cyan. */
export function useIsVapor(): boolean {
  return useContext(ModeCtx).mode === 'vapor';
}

export const useVaporMode = useIsVapor;

/** Arctic mode: Scandinavian stillness — ice white, light type, a lot of air. */
export function useIsArctic(): boolean {
  return useContext(ModeCtx).mode === 'arctic';
}

export const useArcticMode = useIsArctic;

/*
 * The [P/1] themes are ordinary themes, not modes, so they are asked for by theme id rather than by mode.
 * Each one is read by exactly one piece of chrome — the chime (lib/useThemeChime.ts) and the background
 * layer (components/ThemeBackground.tsx) — and by nothing the other themes go through.
 */

/** Eagle: Apollo mission control — NASA orange on deep blue. */
export function useIsEagle(): boolean {
  return useContext(ModeCtx).themeId === 'eagle';
}

/** Cockpit: the instrument panel — amber, instrument green, red. */
export function useIsCockpit(): boolean {
  return useContext(ModeCtx).themeId === 'cockpit';
}

/** Deep Space: nebula purple and neon cyan, with a star field behind the screen. */
export function useIsDeepSpace(): boolean {
  return useContext(ModeCtx).themeId === 'deepspace';
}

/** Holographic: iridescent on near-white, with a slow shimmer behind the screen. */
export function useIsHolo(): boolean {
  return useContext(ModeCtx).themeId === 'holo';
}

/** A component's stylesheet with square corners in airport mode, unchanged in every other mode. */
export function useSquareStyles<T extends Record<string, unknown>>(sheet: T): T {
  const airport = useIsAirport();
  return useMemo(() => (airport ? squareStyles(sheet) : sheet), [airport, sheet]);
}
