import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Briefcase, Clock, CurrencyEur, Taxi, X } from 'phosphor-react-native';
import { WeatherGlyph } from './LuxuryInfoPanel';
import ConfettiBurst from './components/ConfettiBurst';
import ProPaywallCard from './components/ProPaywallCard';
import { getLocale, t } from './lib/i18n';
import { formatRate, type FxSnapshot, type WeatherSnapshot } from './lib/destinationServices';
import { AFFILIATE_CONFIG, openAffiliateUrl } from './lib/affiliateConfig';
import { getLocalizedCity } from './lib/cityLocalized';
import { fetchDestinationPhoto } from './lib/destinationBackgrounds';
import type { DestinationPhoto } from './lib/destinationPhoto';
import { hasShownDiscoveryCard, markDiscoveryCardShown } from './lib/discoveryCardStore';
import { DISCOVERY_REVEAL_DELAY_MS, DISCOVERY_REVEAL_MS, landingDiscovery } from './lib/landingDiscovery';
import LostLuggagePrompt from './LostLuggagePrompt';
import { LANDING_PAYWALL_DELAY_MS } from './lib/smartPaywall';

export type LandedWelcome = {
  flightNumber: string;
  city: string;
  flag: string;
  iata: string;
  localTime: string;
  weather?: WeatherSnapshot | null;
  fx?: FxSnapshot | null;
  belt?: string;
  taxiMin?: number | null;
  airlineCode?: string;
  landedAtMs?: number | null;
  destCountry?: string;
  /** Tracked flight key — the discovery tip and landing paywall at most once per flight. */
  discoveryId?: string;
  flightKey?: string;
};

type Props = {
  data: LandedWelcome | null;
  onDismiss: () => void;
  onRequestPaywall?: (data: LandedWelcome) => Promise<boolean>;
  onPaywallDismissed?: () => void;
  onProUnlocked?: () => void;
};

export default function AfterLandingCard({
  data,
  onDismiss,
  onRequestPaywall,
  onPaywallDismissed,
  onProUnlocked,
}: Props) {
  const insets = useSafeAreaInsets();
  const copy = t();
  const [photo, setPhoto] = useState<DestinationPhoto | null>(null);
  const [sheet, setSheet] = useState(false);
  const [paywallResolved, setPaywallResolved] = useState(!onRequestPaywall);
  const sheetY = useRef(new Animated.Value(480)).current;

  useEffect(() => {
    setPhoto(null);
    setSheet(false);
    setPaywallResolved(!onRequestPaywall);
    sheetY.setValue(480);
    if (!data) return;
    let alive = true;
    fetchDestinationPhoto(data.iata).then(p => { if (alive) setPhoto(p); });
    return () => { alive = false; };
  }, [data?.discoveryId, data?.flightKey, data?.iata, onRequestPaywall, sheetY]);

  useEffect(() => {
    if (!data || !onRequestPaywall) return;
    let cancelled = false;
    const id = setTimeout(() => {
      void onRequestPaywall(data).then(ok => {
        if (cancelled) return;
        setPaywallResolved(true);
        if (!ok) return;
        setSheet(true);
        Animated.spring(sheetY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 160,
        }).start();
      });
    }, LANDING_PAYWALL_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [data, onRequestPaywall, sheetY]);

  if (!data) return null;

  const city = getLocalizedCity(data.iata, getLocale(), data.city) || data.city || data.iata;
  const wx = data.weather;
  const fx = data.fx;

  const closePaywall = () => {
    setSheet(false);
    onPaywallDismissed?.();
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.root}>
        {photo?.url ? (
          <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#071018', '#0B1C2C', '#1A3A5C']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(7,16,24,0.2)', 'rgba(7,16,24,0.42)', 'rgba(7,16,24,0.9)']}
          style={StyleSheet.absoluteFill}
        />
        <ConfettiBurst active />

        <TouchableOpacity
          style={[styles.close, { top: insets.top + 8 }]}
          onPress={() => {
            if (sheet) onPaywallDismissed?.();
            onDismiss();
          }}
          accessibilityRole="button"
          accessibilityLabel={copy.close}
        >
          <X size={18} color="#fff" />
        </TouchableOpacity>

        <View style={[styles.hero, { paddingTop: insets.top + 56 }]}>
          <Text style={styles.kicker}>{data.flightNumber}</Text>
          <Text style={styles.headline}>{copy.landedSafeTravels}</Text>
          <Text style={styles.city}>{city}{data.flag ? ` ${data.flag}` : ''}</Text>
        </View>

        {!sheet ? (
          <View style={styles.rows}>
            <View style={styles.row}>
              <Clock size={14} color="#C9A227" />
              <Text style={styles.rowTxt}>{copy.localTimeColon(data.localTime)}</Text>
            </View>
            {wx ? (
              <View style={styles.row}>
                <WeatherGlyph icon={wx.icon} color="#C9A227" size={14} />
                <Text style={styles.rowTxt}>{wx.temp}°C · {wx.description}</Text>
              </View>
            ) : null}
            {fx?.usdToDest != null ? (
              <View style={styles.row}>
                <CurrencyEur size={14} color="#C9A227" />
                <Text style={styles.rowTxt}>
                  {fx.localCode && fx.localToDest != null && fx.localCode !== fx.destCode && fx.localCode !== 'USD'
                    ? `${copy.localRate(formatRate(fx.localToDest), fx.localCode, fx.destCode)} · `
                    : ''}
                  {copy.usdRate(formatRate(fx.usdToDest), fx.destCode)}
                </Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <Briefcase size={14} color="#C9A227" />
              <Text style={styles.rowTxt}>
                {data.belt ? copy.baggageBeltColon(data.belt) : copy.baggageInfoPending}
              </Text>
            </View>
            {data.taxiMin != null ? (
              <View style={styles.row}>
                <Taxi size={14} color="#C9A227" />
                <Text style={styles.rowTxt}>{copy.taxiToCenter(data.taxiMin)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {!sheet && paywallResolved ? (
          <View style={styles.extras}>
            <LostLuggagePrompt
              status="landed"
              belt={data.belt}
              airlineCode={data.airlineCode}
              landedAtMs={data.landedAtMs}
              destIata={data.iata}
              destCountry={data.destCountry}
            />
            <DiscoveryTip id={data.discoveryId} iata={data.iata} city={city} />
          </View>
        ) : null}

        {sheet ? (
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 16, transform: [{ translateY: sheetY }] },
            ]}
          >
            <LinearGradient colors={['#0B1C2C', '#12263C']} style={StyleSheet.absoluteFill} />
            <ProPaywallCard
              moment="landing"
              city={city}
              compact
              onDismiss={closePaywall}
              onProUnlocked={() => {
                onProUnlocked?.();
                onDismiss();
              }}
            />
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

function DiscoveryTip({ id, iata, city }: { id?: string; iata: string; city: string }) {
  const [visible, setVisible] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void hasShownDiscoveryCard(id).then(shown => {
        if (cancelled || shown) return;
        void markDiscoveryCardShown(id);
        setVisible(true);
        Animated.timing(reveal, {
          toValue: 1,
          duration: DISCOVERY_REVEAL_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      });
    }, DISCOVERY_REVEAL_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, reveal]);

  if (!visible) return null;
  const copy = t();
  const pick = landingDiscovery(iata);
  const url = AFFILIATE_CONFIG.activities[pick.provider];
  const cityLabel = getLocalizedCity(iata, getLocale(), city) || city || iata;

  return (
    <Animated.View
      style={[
        styles.tip,
        {
          opacity: reveal,
          maxHeight: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }),
          transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <Pressable
        style={styles.tipClose}
        onPress={() => setVisible(false)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={copy.dismiss}
      >
        <Text style={styles.tipCloseTxt}>×</Text>
      </Pressable>
      <Text style={styles.tipTitle}>{copy[`discovery${pick.copy}Title`]}</Text>
      <Text style={styles.tipBody}>{copy[`discovery${pick.copy}Body`]}</Text>
      <TouchableOpacity
        style={styles.tipCta}
        activeOpacity={0.85}
        accessibilityRole="link"
        onPress={() => {
          void openAffiliateUrl(url);
          setVisible(false);
        }}
      >
        <Text style={styles.tipCtaTxt}>{copy.discoveryExplore(cityLabel)}</Text>
      </TouchableOpacity>
      <Text style={styles.tipPartner}>{copy.partnerLink}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1C2C' },
  close: {
    position: 'absolute',
    right: 16,
    zIndex: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { paddingHorizontal: 28, alignItems: 'center', gap: 8 },
  kicker: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  headline: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  city: {
    color: '#C9A227',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  rows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  rowTxt: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  extras: { marginTop: 18, paddingHorizontal: 20 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  tip: {
    marginBottom: 18,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(248,250,252,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.22)',
    overflow: 'hidden',
  },
  tipClose: { position: 'absolute', top: 6, right: 12, zIndex: 1 },
  tipCloseTxt: { color: 'rgba(255,255,255,0.55)', fontSize: 22, fontWeight: '500' },
  tipTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '800', paddingRight: 24 },
  tipBody: { color: 'rgba(240,244,255,0.72)', fontSize: 14, lineHeight: 20, marginTop: 6 },
  tipCta: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C9A84C',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tipCtaTxt: { color: '#C9A84C', fontSize: 14, fontWeight: '800' },
  tipPartner: { color: 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: '600', marginTop: 8 },
});
