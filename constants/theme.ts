/** Unified WaiAir design tokens — single source of truth for colors & spacing. */

import { PALETTE_TOKENS } from '../lib/themeTokens';

const dark = PALETTE_TOKENS.dark;

export const Theme = {
  background: dark.bg,
  card: dark.card,
  gold: dark.gold,
  goldLight: dark.goldLight,
  navy: dark.navy,
  text: dark.text,
  textMuted: dark.textMuted,
  statusGreen: dark.statusGreen,
  statusAmber: dark.statusAmber,
  statusRed: dark.statusRed,
  statusBlue: dark.statusBlue,
  cardRadius: 16,
  cardPadding: 16,
  gap: 12,
} as const;

export type ThemeTokens = typeof Theme;
