import { useState, type ReactNode } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { brandFields, TILE_GOLD } from './lib/affiliateBrands';

export const MAX_BRAND_TILES = 3;

export type BrandLogoTile = {
  key: string;
  label: string;
  source?: ImageSourcePropType;
  logoUri?: string;
  skipLogo?: boolean;
  brandColor?: string;
  brandTextColor?: string;
  icon?: ReactNode;
  hint?: string;
  onPress: () => void;
};

type Props = {
  title?: string;
  tiles: BrandLogoTile[];
  mutedColor: string;
};

export function withBrand(tile: BrandLogoTile): BrandLogoTile {
  if (tile.skipLogo) {
    return {
      ...tile,
      logoUri: undefined,
      source: undefined,
    };
  }
  const fields = brandFields(tile.key);
  return {
    ...fields,
    ...tile,
    brandColor: tile.brandColor || fields.brandColor,
    brandTextColor: tile.brandTextColor || fields.brandTextColor,
    logoUri: tile.logoUri ?? fields.logoUri,
    source: tile.source,
  };
}

function initials(label: string): string {
  const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(label || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

function CircleLogo({ tile }: { tile: BrandLogoTile }) {
  const [uriFailed, setUriFailed] = useState(false);
  const brandCircle = !!tile.skipLogo && !!tile.brandColor;

  let inner: ReactNode = (
    <Text style={[styles.initials, brandCircle && { color: tile.brandTextColor || '#FFFFFF' }]}>
      {initials(tile.label)}
    </Text>
  );
  if (!tile.skipLogo && tile.source && !uriFailed) {
    inner = (
      <Image
        source={tile.source}
        style={styles.logo}
        resizeMode="contain"
        onError={() => setUriFailed(true)}
      />
    );
  } else if (!tile.skipLogo && tile.logoUri && !uriFailed) {
    inner = (
      <Image
        source={{ uri: tile.logoUri }}
        style={styles.logo}
        resizeMode="contain"
        onError={() => setUriFailed(true)}
      />
    );
  } else if (!tile.skipLogo && tile.icon) {
    inner = tile.icon;
  }

  return (
    <View style={[styles.circle, brandCircle && { backgroundColor: tile.brandColor }]}>
      {inner}
    </View>
  );
}

export default function BrandLogoTileRow({ title, tiles, mutedColor }: Props) {
  const shown = tiles.map(withBrand);
  if (shown.length === 0) return null;

  return (
    <View style={[styles.wrap, !title && styles.wrapFlush]}>
      {title ? <Text style={[styles.title, { color: mutedColor }]}>{title}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {shown.map(tile => (
          <Pressable
            key={tile.key}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={tile.onPress}
            accessibilityRole="button"
            accessibilityLabel={tile.hint ? `${tile.label}. ${tile.hint}` : tile.label}
          >
            <CircleLogo tile={tile} />
            <Text style={styles.label} numberOfLines={1}>{tile.label}</Text>
            {tile.hint ? (
              <Text style={styles.promo} numberOfLines={1}>{tile.hint}</Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginBottom: 4,
  },
  wrapFlush: {
    marginTop: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 4,
  },
  item: {
    width: 70,
    alignItems: 'center',
  },
  itemPressed: {
    opacity: 0.72,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 40,
    height: 40,
  },
  initials: {
    color: '#0D1B2E',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  label: {
    marginTop: 6,
    width: 70,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  promo: {
    marginTop: 2,
    width: 70,
    fontSize: 9,
    fontWeight: '600',
    color: TILE_GOLD,
    textAlign: 'center',
  },
});
