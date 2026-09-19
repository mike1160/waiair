/**
 * The colours of the hotel & transfer sheet and cards, taken from the active theme instead of a fixed navy and
 * gold: light in Day, dark in Night, coral in Kids, yellow on black in Airport. Pure, so it is unit-tested.
 */
import type { ThemeColors } from './themes.ts';

export type TripExtrasPalette = {
  /** The sheet and card surface. */
  surface: string;
  /** Inputs, tabs, and the close button. */
  field: string;
  text: string;
  muted: string;
  /** Buttons, the selected tab, links and icons. */
  accent: string;
  /** Text on an accent button: white or ink, whichever reads better on that accent. */
  onAccent: string;
  /** Hairlines and outlines. */
  line: string;
  /** A faint accent wash (the "add your hotel" banner). */
  tint: string;
  /** The dimmed page behind the sheet. */
  scrim: string;
  /** A dark theme: illustrations (the sky behind the import buttons) switch to night. */
  dark: boolean;
};

const WHITE = '#FFFFFF';
const INK = '#10151F';

function channel(hex: string, i: number): number {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB colour; null for anything else (rgba, names). */
export function luminance(color: string): number | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  return 0.2126 * channel(color, 0) + 0.7152 * channel(color, 1) + 0.0722 * channel(color, 2);
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** White or ink on this background, whichever has the higher contrast. */
export function readableOn(background: string): string {
  const l = luminance(background);
  if (l == null) return WHITE;
  return contrast(l, luminance(WHITE)!) >= contrast(l, luminance(INK)!) ? WHITE : INK;
}

export function tripExtrasPalette(c: ThemeColors): TripExtrasPalette {
  return {
    surface: c.card,
    field: c.field || c.list,
    text: c.text,
    muted: c.muted,
    accent: c.accent,
    onAccent: readableOn(c.accent),
    line: c.border,
    tint: c.accentDim,
    scrim: c.isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(13, 27, 46, 0.35)',
    dark: !!c.isDark,
  };
}
