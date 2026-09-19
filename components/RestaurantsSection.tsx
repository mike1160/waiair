/**
 * "Restaurants & wijken" on the flight detail page (Pro): neighbourhood chips for the arrival city, and the
 * top-rated restaurants in the one you tap. Free users see the header and one blurred chip behind the Pro badge.
 * The restaurants come from the proxy (Google Places key stays there); the photos from the existing Unsplash route.
 */
import { useSquareStyles } from '../lib/modeContext';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { ForkKnife, Lock } from 'phosphor-react-native';
import CardPhoto from './CardPhoto';
import { t } from '../lib/i18n';
import { haptics } from '../lib/haptics';
import { neighbourhoodChips, type NeighbourhoodChip } from '../lib/neighbourhoods';
import { usePlacePhoto } from '../lib/placePhotoStore';
import {
  MAX_PHOTO_ATTEMPTS,
  createPhotoClaims,
  restaurantMapsUrl,
  restaurantMeta,
  restaurantPhotoOffset,
  restaurantPhotoQueries,
  restaurantPhotoSubject,
  type Restaurant,
} from '../lib/restaurants';
import { useNeighbourhoodSelection, useRestaurants } from '../lib/restaurantStore';

const PHOTO_HEIGHT = 96;
const GOLD = '#C9A227';

type Theme = { text: string; muted: string; accent: string; card: string; border: string; gold?: string };

type Props = {
  /** Arrival airport; decides which neighbourhoods are offered. */
  destIata?: string | null;
  /** Arrival city, used when the airport has no curated list ("Explore {city}"). */
  destCity?: string | null;
  /** Local currency code, for the price level (฿฿ in Thailand, €€ in the Netherlands). */
  currencyCode?: string | null;
  /** Arrival airport coordinates: they keep a generic area name ("Marina", "Downtown") in the right city. */
  lat?: number | null;
  lon?: number | null;
  isPro: boolean;
  /** Free user tapped the locked section: the existing Pro paywall. */
  onRequirePro: (highlight?: string) => void;
  theme: Theme;
};

type PhotoClaims = ReturnType<typeof createPhotoClaims>;

/** One restaurant: photo, name and the meta line, opening Google Maps on tap. */
function RestaurantRow({ r, index, listSize, claims, city, currencyCode, theme }: {
  r: Restaurant; index: number; listSize: number; claims: PhotoClaims;
  city: string; currencyCode?: string | null; theme: Theme;
}) {
  const styles = useSquareStyles(baseStyles);
  // The row index picks a different Unsplash result; a retry jumps a whole list further.
  const [attempt, setAttempt] = useState(0);
  const offset = restaurantPhotoOffset(index, attempt, listSize);
  const photo = usePlacePhoto('restaurant', restaurantPhotoSubject(r, offset), restaurantPhotoQueries(r, city), offset);
  const [shown, setShown] = useState<typeof photo>(null);

  // Two cuisines can still return the same Unsplash photo. If another row already shows this one, try the next
  // result; after a few tries the row goes without a photo rather than repeat one.
  useEffect(() => {
    if (!photo) {
      setShown(null);
      return;
    }
    if (claims.claim(photo.url, index)) {
      setShown(photo);
      return;
    }
    setShown(null);
    if (attempt + 1 < MAX_PHOTO_ATTEMPTS) setAttempt(a => a + 1);
  }, [photo, claims, index, attempt]);

  useEffect(() => () => claims.release(index), [claims, index]);

  const meta = restaurantMeta(r, currencyCode, t().restaurantsOpenNow);
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        void Linking.openURL(restaurantMapsUrl(r, city)).catch(() => {});
      }}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={[r.name, meta].filter(Boolean).join(', ')}
    >
      {shown ? <CardPhoto photo={shown} height={PHOTO_HEIGHT} gradientHeight={40} radius={14} /> : null}
      <View style={styles.cardBody}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{r.name}</Text>
        {meta ? <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function RestaurantsSection({
  destIata,
  destCity,
  currencyCode,
  lat,
  lon,
  isPro,
  onRequirePro,
  theme,
}: Props) {
  const styles = useSquareStyles(baseStyles);
  const copy = t();
  const chips = neighbourhoodChips(destIata, destCity, city => copy.restaurantsExplore(city));
  const [picked, toggle] = useNeighbourhoodSelection();
  const city = chips[0]?.city || '';
  // Free users never pick anything, so this hook never fetches for them.
  const { list, loading, empty } = useRestaurants(isPro ? picked : null, city, undefined, lat, lon);
  // A fresh registry per neighbourhood: photos only have to be unique within the list on screen.
  const claims = useMemo(() => createPhotoClaims(), [picked]);

  if (!chips.length) return null;

  const gold = theme.gold || GOLD;
  const header = (
    <View style={styles.headRow}>
      <ForkKnife size={15} color={theme.muted} weight="bold" />
      <Text style={[styles.section, { color: theme.muted }]}>{copy.restaurantsTitle}</Text>
      <View style={[styles.proBadge, { borderColor: gold + '80' }]}>
        <Lock size={10} color={gold} weight="bold" />
        <Text style={[styles.proTxt, { color: gold }]}>{copy.pro}</Text>
      </View>
    </View>
  );

  if (!isPro) {
    // Locked: the first neighbourhood behind a blur, with the upgrade line. Tapping anywhere opens the paywall.
    return (
      <View style={styles.wrap}>
        {header}
        <Pressable
          onPress={() => { haptics.light(); onRequirePro('restaurants'); }}
          accessibilityRole="button"
          accessibilityLabel={copy.restaurantsLockedCta}
          style={[styles.locked, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={styles.lockedChips}>
            {chips.slice(0, 3).map(chip => (
              <View key={chip.label} style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.chipTxt, { color: theme.text }]} numberOfLines={1}>{chip.label}</Text>
              </View>
            ))}
            <BlurView intensity={18} tint="default" style={StyleSheet.absoluteFill} pointerEvents="none" />
          </View>
          <Text style={[styles.lockedCta, { color: gold }]}>{copy.restaurantsLockedCta}</Text>
        </Pressable>
      </View>
    );
  }

  const press = (chip: NeighbourhoodChip) => {
    haptics.light();
    if (chip.kind === 'explore') {
      void Linking.openURL(chip.url).catch(() => {});
      return;
    }
    toggle(chip.area);
  };

  return (
    <View style={styles.wrap}>
      {header}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {chips.map(chip => {
          const on = chip.kind === 'area' && chip.area === picked;
          return (
            <Pressable
              key={chip.label}
              onPress={() => press(chip)}
              style={[
                styles.chip,
                { backgroundColor: on ? theme.accent : theme.card, borderColor: on ? theme.accent : theme.border },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={chip.label}
            >
              <Text style={[styles.chipTxt, { color: on ? '#fff' : theme.text }]} numberOfLines={1}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {!picked ? (
        <Text style={[styles.hint, { color: theme.muted }]}>{copy.restaurantsHint}</Text>
      ) : loading ? (
        <Text style={[styles.hint, { color: theme.muted }]}>{copy.restaurantsLoading}</Text>
      ) : empty ? (
        <Text style={[styles.hint, { color: theme.muted }]}>{copy.restaurantsEmpty}</Text>
      ) : (
        <View style={styles.list}>
          {list.map((r, i) => (
            <RestaurantRow
              key={r.placeId || r.name}
              r={r}
              index={i}
              listSize={list.length}
              claims={claims}
              city={city}
              currencyCode={currencyCode}
              theme={theme}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: { marginTop: 14 },
  // Wraps on narrow phones (iPhone SE): the title may break over two lines and the PRO badge moves under it
  // rather than off the edge of the screen.
  headRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4, marginBottom: 8 },
  section: { flexShrink: 1, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  proTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12, marginTop: 10, marginLeft: 2 },
  list: { gap: 8, marginTop: 10 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  cardBody: { paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12 },
  locked: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 10 },
  lockedChips: { flexDirection: 'row', gap: 8, overflow: 'hidden' },
  lockedCta: { fontSize: 13, fontWeight: '700' },
});
