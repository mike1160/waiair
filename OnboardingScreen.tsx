import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MagnifyingGlass, MapPin, X } from 'phosphor-react-native';
import { groupAirportsByRegion } from './lib/airportRegions';
import { t } from './lib/i18n';

const GOLD = '#FFD700';
const BG = '#05070F';
const W = Dimensions.get('window').width;
const PAGE_COUNT = 5;

export type OnboardingAirport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  distanceKm?: number;
};

type PickerProps = {
  pickerQuery: string;
  onPickerQueryChange: (q: string) => void;
  pickerResults: OnboardingAirport[];
  pickerBusy: boolean;
  recentAirports: OnboardingAirport[];
  favorites: OnboardingAirport[];
  nearMeResults: OnboardingAirport[];
  nearMeActive: boolean;
  nearMeBusy: boolean;
  onNearMe: () => void;
  selectedAirport: OnboardingAirport | null;
  onSelectAirport: (a: OnboardingAirport) => void;
};

type Props = PickerProps & {
  visible: boolean;
  onComplete: (airport: OnboardingAirport) => void;
};

function seededStars(n: number) {
  let s = 1103515245;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: n }, () => ({
    left: rnd(),
    top: rnd(),
    size: 1 + rnd() * 1.5,
    opacity: 0.15 + rnd() * 0.35,
  }));
}

const STARS = seededStars(60);

function StarField() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map((star, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${star.left * 100}%`,
            top: `${star.top * 55}%`,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#fff',
            opacity: star.opacity,
          }}
        />
      ))}
      <View style={styles.mapGlow} />
    </View>
  );
}

function DotIndicators({ page }: { page: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: PAGE_COUNT }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: i === page ? GOLD : '#64748B', opacity: i === page ? 1 : 0.4 }]}
        />
      ))}
    </View>
  );
}

function InfoSlide({
  emoji,
  title,
  subtitle,
  showStars,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  showStars?: boolean;
}) {
  return (
    <View style={[styles.page, { width: W }]}>
      {showStars ? <StarField /> : null}
      <View style={styles.slideBody}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function HowItWorksSlide() {
  const copy = t();
  const items = [
    { icon: '✈️', title: copy.onboardingHowArrivesTitle, body: copy.onboardingHowArrivesBody },
    { icon: '🔔', title: copy.onboardingHowTrackedTitle, body: copy.onboardingHowTrackedBody },
    { icon: '📡', title: copy.onboardingHowRadarTitle, body: copy.onboardingHowRadarBody },
    { icon: '⚙️', title: copy.onboardingHowSettingsTitle, body: copy.onboardingHowSettingsBody },
  ];

  return (
    <View style={[styles.page, styles.howPage, { width: W }]}>
      <Text style={styles.howTitle}>{copy.onboardingHowTitle}</Text>
      <View style={styles.howList}>
        {items.map(item => (
          <View key={item.title} style={styles.howRow}>
            <Text style={styles.howIcon}>{item.icon}</Text>
            <View style={styles.howText}>
              <Text style={styles.howItemTitle}>{item.title}</Text>
              <Text style={styles.howItemBody} numberOfLines={2}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AirportSlide(props: PickerProps) {
  const copy = t();
  const {
    pickerQuery,
    onPickerQueryChange,
    pickerResults,
    pickerBusy,
    recentAirports,
    favorites,
    nearMeResults,
    nearMeActive,
    nearMeBusy,
    onNearMe,
    selectedAirport,
    onSelectAirport,
  } = props;

  const showSearch = pickerQuery.trim().length > 0;
  const showNearMe = nearMeActive && nearMeResults.length > 0;

  const renderRow = (a: OnboardingAirport) => {
    const selected = selectedAirport?.iata === a.iata;
    return (
      <TouchableOpacity
        key={a.iata}
        style={[styles.airportRow, selected && styles.airportRowSelected]}
        onPress={() => onSelectAirport(a)}
        accessibilityRole="button"
        accessibilityLabel={copy.airportA11y(a.iata, a.name, a.country)}
      >
        <Text style={styles.airportFlag}>{a.flag}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.airportIata} numberOfLines={1}>
            {a.iata}
            <Text style={styles.airportName}>  {a.name}</Text>
          </Text>
          <Text style={styles.airportCity} numberOfLines={1}>
            {typeof a.distanceKm === 'number'
              ? `${a.distanceKm} km`
              : `${a.city}${a.country ? ` · ${a.country}` : ''}`}
          </Text>
        </View>
        {selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.page, styles.airportPage, { width: W }]}>
      <View style={styles.airportHeader}>
        <Text style={styles.emojiSmall}>📍</Text>
        <Text style={styles.title}>{copy.onboardingAirportTitle}</Text>
        <Text style={styles.subtitleCompact}>{copy.onboardingAirportSubtitle}</Text>
      </View>

      <View style={styles.searchRow}>
        <MagnifyingGlass size={16} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          value={pickerQuery}
          onChangeText={onPickerQueryChange}
          placeholder={copy.searchCityAirport}
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {pickerQuery.length > 0 ? (
          <TouchableOpacity onPress={() => onPickerQueryChange('')} hitSlop={8}>
            <X size={16} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView style={styles.airportList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.nearMeBtn} onPress={onNearMe} disabled={nearMeBusy}>
          {nearMeBusy ? (
            <ActivityIndicator size="small" color={GOLD} />
          ) : (
            <MapPin size={16} color={GOLD} />
          )}
          <Text style={styles.nearMeTxt}>{copy.nearMe}</Text>
        </TouchableOpacity>

        {!showSearch && recentAirports.length > 0 ? (
          <View>
            <Text style={styles.sectionLbl}>{copy.recentAirports}</Text>
            {recentAirports.map(renderRow)}
          </View>
        ) : null}

        {showNearMe ? (
          <View>
            <Text style={styles.sectionLbl}>{copy.nearby}</Text>
            {nearMeResults.map(renderRow)}
          </View>
        ) : null}

        {!showSearch && favorites.length > 0 ? (
          <View>
            <Text style={styles.sectionLbl}>{copy.favourites}</Text>
            {favorites.map(renderRow)}
          </View>
        ) : null}

        {showSearch ? (
          <View>
            <Text style={styles.sectionLbl}>{pickerBusy ? copy.searching : copy.results}</Text>
            {groupAirportsByRegion(pickerResults).map(group => (
              <View key={group.region}>
                <Text style={styles.regionLbl}>{group.region}</Text>
                {group.items.map(renderRow)}
              </View>
            ))}
            {!pickerBusy && pickerResults.length === 0 ? (
              <Text style={styles.emptyTxt}>{copy.noAirportsMatch(pickerQuery.trim())}</Text>
            ) : null}
          </View>
        ) : null}

        {!showSearch && !recentAirports.length && !favorites.length ? (
          <Text style={styles.emptyTxt}>{copy.airportsWorldwide}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function OnboardingScreen({
  visible,
  onComplete,
  ...picker
}: Props) {
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<number>>(null);
  const copy = t();

  useEffect(() => {
    if (!visible) {
      setPage(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [visible]);

  if (!visible) return null;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(PAGE_COUNT - 1, next));
    setPage(clamped);
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / W);
    if (next !== page) setPage(next);
  };

  const finish = () => {
    const airport = picker.selectedAirport;
    if (!airport?.iata) return;
    onComplete(airport);
  };

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <TouchableOpacity
        onPress={() => goTo(PAGE_COUNT - 1)}
        style={styles.skip}
        accessibilityRole="button"
        accessibilityLabel={copy.skip}
      >
        <Text style={styles.skipTxt}>{copy.skip}</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={[0, 1, 2, 3, 4]}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={i => String(i)}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        renderItem={({ item }) => {
          if (item === 0) {
            return (
              <InfoSlide
                emoji="✈️"
                title={copy.onboardingWelcomeTitle}
                subtitle={copy.onboardingWelcomeSubtitle}
                showStars
              />
            );
          }
          if (item === 1) {
            return (
              <InfoSlide
                emoji="🔔"
                title={copy.onboardingAlertsTitle}
                subtitle={copy.onboardingAlertsSubtitle}
              />
            );
          }
          if (item === 2) {
            return (
              <InfoSlide
                emoji="🚗"
                title={copy.onboardingPickupTitle}
                subtitle={copy.onboardingPickupSubtitle}
              />
            );
          }
          if (item === 3) {
            return <HowItWorksSlide />;
          }
          return <AirportSlide {...picker} />;
        }}
      />

      <DotIndicators page={page} />

      {page < PAGE_COUNT - 1 ? (
        <TouchableOpacity
          style={styles.cta}
          onPress={() => goTo(page + 1)}
          accessibilityRole="button"
          accessibilityLabel={copy.next}
        >
          <Text style={styles.ctaTxt}>{copy.next}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.cta, !picker.selectedAirport && styles.ctaDisabled]}
          onPress={finish}
          disabled={!picker.selectedAirport}
          accessibilityRole="button"
          accessibilityLabel={copy.getStarted}
        >
          <Text style={styles.ctaTxt}>{copy.getStarted}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 80,
    backgroundColor: BG,
    paddingTop: 56,
    paddingBottom: 28,
  },
  skip: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  skipTxt: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
  page: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  mapGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '18%',
    width: W * 0.7,
    height: W * 0.35,
    borderRadius: W * 0.35,
    backgroundColor: 'rgba(255,215,0,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.08)',
  },
  slideBody: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 24,
  },
  emoji: {
    fontSize: 72,
    lineHeight: 80,
    textAlign: 'center',
  },
  emojiSmall: {
    fontSize: 40,
    lineHeight: 48,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 320,
  },
  subtitleCompact: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 6,
  },
  howPage: {
    justifyContent: 'flex-start',
    paddingTop: 16,
  },
  howTitle: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 28,
  },
  howList: {
    gap: 20,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  howIcon: {
    fontSize: 32,
    lineHeight: 36,
    width: 40,
    textAlign: 'center',
  },
  howText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  howItemTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '800',
  },
  howItemBody: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cta: {
    marginHorizontal: 28,
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaTxt: {
    color: '#0A0E1A',
    fontSize: 16,
    fontWeight: '800',
  },
  airportPage: {
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  airportHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
  },
  airportList: {
    flex: 1,
    marginBottom: 8,
  },
  nearMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  nearMeTxt: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionLbl: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  regionLbl: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  airportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  airportRowSelected: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  airportFlag: {
    fontSize: 22,
  },
  airportIata: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  airportName: {
    color: '#CBD5E1',
    fontWeight: '600',
  },
  airportCity: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  checkMark: {
    color: GOLD,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyTxt: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
