/** Unified WaiAir design tokens — single source of truth for colors & spacing. */
export const Theme = {
  background: '#0F1728',
  card: '#1A2744',
  gold: '#C9A84C',
  goldLight: 'rgba(201,168,76,0.15)',
  text: '#FFFFFF',
  textMuted: '#8892A4',
  statusGreen: '#22c55e',
  statusAmber: '#f59e0b',
  statusRed: '#ef4444',
  statusBlue: '#3b82f6',
  cardRadius: 16,
  cardPadding: 16,
  gap: 12,
} as const;

export type ThemeTokens = typeof Theme;
