import type { ReactNode } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DETAIL_GOLD } from './lib/detailCardStyles';

export type BrandLogoTile = {
  key: string;
  label: string;
  source?: ImageSourcePropType;
  icon?: ReactNode;
  onPress: () => void;
};

type Props = {
  title: string;
  tiles: BrandLogoTile[];
  mutedColor: string;
};

const TILE_NAVY = '#0A1628';

const TILE_SHADOW = Platform.select({
  ios: {
    shadowColor: DETAIL_GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  android: { elevation: 6 },
  default: {},
});

export default function BrandLogoTileRow({ title, tiles, mutedColor }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: mutedColor }]}>{title}</Text>
      <View style={styles.row}>
        {tiles.map(tile => (
          <Pressable
            key={tile.key}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={tile.onPress}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
          >
            {tile.source ? (
              <Image source={tile.source} style={styles.logo} resizeMode="contain" />
            ) : (
              tile.icon
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: TILE_NAVY,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    ...TILE_SHADOW,
  },
  tilePressed: {
    borderColor: DETAIL_GOLD,
    opacity: 0.92,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
});
