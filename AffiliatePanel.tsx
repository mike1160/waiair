import { useSquareStyles } from './lib/modeContext';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from './constants/theme';
import { TILE_CREAM, TILE_NAVY } from './lib/affiliateBrands';
import type { DetailCardTheme } from './lib/detailCardStyles';
import { TileSurfaceContext } from './lib/tileSurface';

/**
 * The panel around "Hungry after landing", "Into town", "Things to do" and "Need a car".
 * With a theme it is an ordinary card of the flight page — the theme's card colour, border and text, so it is
 * light in light mode and follows dark mode like every other card. Without one it keeps the old navy panel.
 */
export default function AffiliatePanel({
  title,
  icon,
  children,
  theme,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  theme?: DetailCardTheme;
}) {
  const st = useSquareStyles(baseSt);
  if (!theme) {
    return (
      <View style={[st.card, st.navy]}>
        <View style={st.head}>
          {icon}
          <Text style={[st.title, { color: TILE_CREAM }]} numberOfLines={1}>{title}</Text>
        </View>
        <View style={st.body}>{children}</View>
      </View>
    );
  }

  const border = theme.border || 'rgba(0,0,0,0.08)';
  return (
    <View style={[st.card, { backgroundColor: theme.card, borderColor: border }]}>
      <View style={st.head}>
        {icon}
        <Text style={[st.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      </View>
      <TileSurfaceContext.Provider value={{ labelColor: theme.secondary || theme.muted, circleBorder: border }}>
        <View style={st.body}>{children}</View>
      </TileSurfaceContext.Provider>
    </View>
  );
}

const baseSt = StyleSheet.create({
  card: {
    borderRadius: Theme.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: 10,
  },
  navy: {
    backgroundColor: TILE_NAVY,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.45)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 8,
  },
});
