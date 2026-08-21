import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BrandLogoTileRow, { type BrandLogoTile } from './BrandLogoTileRow';
import { LOCAL_LOGOS, LOGOS } from './GlobeBrandMark';
import { TILE_GOLD } from './lib/affiliateBrands';
import {
  openPublicTransport,
  openRideHailing,
  publicTransportFor,
  rideHailingFor,
  RIDE_COLORS,
} from './lib/getIntoTown';
import { globeInkColor } from './lib/globeServices';
import { t } from './lib/i18n';

export default function GetIntoTownRow({ destIata }: { destIata?: string }) {
  const rides = useMemo(() => rideHailingFor(destIata), [destIata]);
  const transit = useMemo(() => publicTransportFor(destIata), [destIata]);

  const tiles: BrandLogoTile[] = rides.map(name => ({
    key: name,
    label: name,
    skipLogo: false,
    source: LOCAL_LOGOS[name],
    logoUri: LOGOS[name],
    brandColor: RIDE_COLORS[name] || TILE_GOLD,
    brandTextColor: globeInkColor(RIDE_COLORS[name] || TILE_GOLD),
    onPress: () => { void openRideHailing(name); },
  }));

  if (tiles.length === 0 && transit.length === 0) return null;

  return (
    <View style={st.wrap}>
      <Text style={st.title}>{t().getIntoTownTitle.toUpperCase()}</Text>
      {tiles.length ? (
        <BrandLogoTileRow tiles={tiles} mutedColor={TILE_GOLD} />
      ) : null}
      {transit.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.pills}
        >
          {transit.map(item => (
            <Pressable
              key={item.name}
              onPress={() => { void openPublicTransport(item.url); }}
              accessibilityRole="link"
              accessibilityLabel={item.name}
              style={({ pressed }) => [st.pill, pressed && st.pillPressed]}
            >
              <Text style={st.pillTxt}>{item.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: TILE_GOLD,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  pillPressed: {
    opacity: 0.72,
  },
  pillTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
