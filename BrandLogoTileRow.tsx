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

export default function BrandLogoTileRow({ title, tiles, mutedColor }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: mutedColor }]}>{title}</Text>
      <View style={styles.row}>
        {tiles.map(tile => (
          <Pressable
            key={tile.key}
            style={styles.tile}
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

const TILE_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  android: { elevation: 2 },
  default: {},
});

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
    width: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...TILE_SHADOW,
  },
  logo: {
    width: 32,
    height: 32,
  },
});
