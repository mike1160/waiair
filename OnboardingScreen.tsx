import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MagnifyingGlass, MapPin, X } from 'phosphor-react-native';
import { groupAirportsByRegion } from './lib/airportRegions';
import { t } from './lib/i18n';

const GOLD = '#FFD700';
const BG = '#0A0E1A';
const MUTED = '#94a3b8';
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

function useFloatAnim(active: boolean) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      y.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, y]);
  return y;
}

function useShakeAnim(active: boolean) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      rot.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rot, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(rot, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.delay(1200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, rot]);
  return rot.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-12deg', '0deg', '12deg'],
  });
}

function useDriveAnim(active: boolean) {
  const x = useRef(new Animated.Value(-100)).current;
  useEffect(() => {
    if (!active) {
      x.setValue(-100);
      return;
    }
    Animated.spring(x, {
      toValue: 0,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [active, x]);
  return x;
}

function usePulseAnim(active: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);
  return scale;
}

function BoardMockBackground() {
  const rows = [
    { num: 'TG205', route: 'BKK → SIN', gate: '9', time: '14:35', status: 'Boarding' },
    { num: 'QR835', route: 'DOH → BKK', gate: 'C4', time: '15:10', status: 'On time' },
    { num: 'SQ712', route: 'SIN → BKK', gate: '—', time: '15:42', status: 'Delayed' },
    { num: 'EK385', route: 'DXB → BKK', gate: '12', time: '16:05', status: 'Scheduled' },
    { num: 'JL708', route: 'NRT → BKK', gate: '7', time: '16:28', status: 'On time' },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.boardMock}>
        {rows.map(row => (
          <View key={row.num} style={styles.boardRow}>
            <Text style={styles.boardNum}>{row.num}</Text>
            <Text style={styles.boardRoute}>{row.route}</Text>
            <View style={styles.boardGate}>
              <Text style={styles.boardGateTxt}>{row.gate}</Text>
            </View>
            <Text style={styles.boardTime}>{row.time}</Text>
          </View>
        ))}
      </View>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.boardOverlay} />
    </View>
  );
}

function DotIndicators({ page }: { page: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: PAGE_COUNT }, (_, i) => {
        const active = i === page;
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: active ? 22 : 8,
                backgroundColor: active ? GOLD : '#475569',
                opacity: active ? 1 : 0.45,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function WelcomeSlide({ active }: { active: boolean }) {
  const copy = t();
  const floatY = useFloatAnim(active);
  return (
    <View style={[styles.page, { width: W }]}>
      <BoardMockBackground />
      <View style={styles.slideForeground}>
        <Animated.Text style={[styles.heroEmoji, { transform: [{ translateY: floatY }] }]}>
          ✈️
        </Animated.Text>
        <Text style={styles.title}>{copy.onboardingTitle}</Text>
        <Text style={styles.subtitle}>{copy.onboardingSubtitle}</Text>
      </View>
    </View>
  );
}

function AlertsSlide({ active }: { active: boolean }) {
  const copy = t();
  const shake = useShakeAnim(active);
  const floatY = useFloatAnim(active);
  return (
    <View style={[styles.page, { width: W }]}>
      <View style={styles.notifMock}>
        <View style={styles.notifIcon}>
          <Text style={styles.notifIconTxt}>✈</Text>
        </View>
        <View style={styles.notifBody}>
          <Text style={styles.notifApp}>WaiAir</Text>
          <Text style={styles.notifTxt} numberOfLines={2}>{copy.onboardingNotifMock}</Text>
        </View>
      </View>
      <View style={styles.slideBody}>
        <Animated.Text
          style={[
            styles.heroEmoji,
            {
              transform: [
                { translateY: floatY },
                { rotate: shake },
              ],
            },
          ]}
        >
          🔔
        </Animated.Text>
        <Text style={styles.title}>{copy.onboardingAlertsTitle}</Text>
        <Text style={styles.subtitle}>{copy.onboardingAlertsSubtitle}</Text>
      </View>
    </View>
  );
}

function PickupSlide({ active }: { active: boolean }) {
  const copy = t();
  const driveX = useDriveAnim(active);
  return (
    <View style={[styles.page, { width: W }]}>
      <View style={styles.slideBody}>
        <Animated.Text style={[styles.heroEmoji, { transform: [{ translateX: driveX }] }]}>
          🚗
        </Animated.Text>
        <Text style={styles.title}>{copy.onboardingPickupTitle}</Text>
        <Text style={styles.subtitle}>{copy.onboardingPickupSubtitle}</Text>
        <View style={styles.pickupMock}>
          <Text style={styles.pickupMockLine1}>{copy.onboardingPickupMockActive}</Text>
          <Text style={styles.pickupMockLine2}>{copy.onboardingPickupMockLeave}</Text>
        </View>
      </View>
    </View>
  );
}

function HowItWorksSlide() {
  const copy = t();
  const items = [
    { icon: '✈️', line: `${copy.onboardingHowArrivesTitle} — ${copy.onboardingHowArrivesBody}` },
    { icon: '🔔', line: `${copy.onboardingHowTrackedTitle} — ${copy.onboardingHowTrackedBody}` },
    { icon: '📡', line: `${copy.onboardingHowRadarTitle} — ${copy.onboardingHowRadarBody}` },
    { icon: '⚙️', line: `${copy.onboardingHowSettingsTitle} — ${copy.onboardingHowSettingsBody}` },
  ];

  return (
    <View style={[styles.page, styles.howPage, { width: W }]}>
      <Text style={styles.title}>{copy.onboardingHowTitle}</Text>
      <View style={styles.howList}>
        {items.map(item => (
          <View key={item.line} style={styles.howRow}>
            <Text style={styles.howIcon}>{item.icon}</Text>
            <Text style={styles.howLine}>{item.line}</Text>
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
        <Text style={styles.subtitleCompact}>{copy.onboardingAirportsWorldwideShort}</Text>
      </View>

      <View style={styles.searchRow}>
        <MagnifyingGlass size={18} color={MUTED} />
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
            <X size={18} color={MUTED} />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity style={styles.nearMeBtnGold} onPress={onNearMe} disabled={nearMeBusy}>
        {nearMeBusy ? (
          <ActivityIndicator size="small" color={BG} />
        ) : (
          <MapPin size={18} color={BG} weight="fill" />
        )}
        <Text style={styles.nearMeGoldTxt}>{copy.nearMe}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.airportList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
  const ctaPulse = usePulseAnim(page === PAGE_COUNT - 1);

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

  const isLast = page === PAGE_COUNT - 1;

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
          const active = page === item;
          if (item === 0) return <WelcomeSlide active={active} />;
          if (item === 1) return <AlertsSlide active={active} />;
          if (item === 2) return <PickupSlide active={active} />;
          if (item === 3) return <HowItWorksSlide />;
          return <AirportSlide {...picker} />;
        }}
      />

      <DotIndicators page={page} />

      <Animated.View style={isLast ? { transform: [{ scale: ctaPulse }] } : undefined}>
        {!isLast ? (
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
      </Animated.View>
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
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  page: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  slideForeground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 40,
    zIndex: 2,
  },
  slideBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 24,
  },
  heroEmoji: {
    fontSize: 120,
    lineHeight: 132,
    textAlign: 'center',
  },
  emojiSmall: {
    fontSize: 44,
    lineHeight: 52,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  subtitle: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 320,
  },
  subtitleCompact: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 8,
  },
  boardMock: {
    ...StyleSheet.absoluteFill,
    paddingTop: 72,
    paddingHorizontal: 16,
    gap: 10,
    opacity: 0.55,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  boardNum: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '800',
    width: 52,
  },
  boardRoute: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  boardGate: {
    backgroundColor: GOLD,
    borderRadius: 6,
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
  boardGateTxt: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  boardTime: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    width: 44,
    textAlign: 'right',
  },
  boardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,14,26,0.82)',
  },
  notifMock: {
    position: 'absolute',
    top: 8,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.55)',
    zIndex: 3,
  },
  notifIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,215,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIconTxt: {
    fontSize: 16,
  },
  notifBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  notifApp: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  notifTxt: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  pickupMock: {
    marginTop: 8,
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  pickupMockLine1: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  pickupMockLine2: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  howPage: {
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
  howList: {
    marginTop: 28,
    gap: 18,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  howIcon: {
    fontSize: 24,
    lineHeight: 28,
    width: 32,
    textAlign: 'center',
  },
  howLine: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
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
    color: BG,
    fontSize: 16,
    fontWeight: '800',
  },
  airportPage: {
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingHorizontal: 20,
  },
  airportHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    padding: 0,
  },
  nearMeBtnGold: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  nearMeGoldTxt: {
    color: BG,
    fontSize: 16,
    fontWeight: '800',
  },
  airportList: {
    flex: 1,
    marginBottom: 8,
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
    color: '#FFFFFF',
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
