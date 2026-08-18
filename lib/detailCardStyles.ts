import { StyleSheet } from 'react-native';

export const DETAIL_CARD_BG = 'rgba(136,150,176,0.08)';
export const DETAIL_GOLD = '#C9A84C';

export const detailCardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 18 },
  body: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  pillTxt: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  tip: { fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 4 },
  banner: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export type DetailCardTheme = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  card: string;
};

export function detailCardBg(theme: DetailCardTheme): string {
  return theme.card || DETAIL_CARD_BG;
}
