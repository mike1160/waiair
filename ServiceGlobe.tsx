import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'phosphor-react-native';
import BrandLogoTileRow from './BrandLogoTileRow';
import { HERO_BRANDS, LOCAL_LOGOS, LOGOS } from './GlobeBrandMark';
import { TILE_GOLD } from './lib/affiliateBrands';
import { runWhileAppActive } from './lib/appActivity';
import {
  LOCAL_LIFE_CATEGORY_META,
  LOCAL_LIFE_CATEGORY_ORDER,
  LOCAL_LIFE_HERO,
  epicPlacesGrouped,
  epicPlacesHero,
  epicPlacesVisible,
  localLifeByCategory,
  localLifeVisible,
  tripComFlightsUrl,
  type EpicPlace,
  type LocalLifeCategory,
} from './lib/affiliateConfig';
import {
  GLOBE_SERVICES,
  globeServiceUrl,
  openGlobeService,
  servicesByCategory,
  type GlobeCategory,
  type GlobeService,
  type GlobeServiceCtx,
} from './lib/globeServices';
import { openRideHailing } from './lib/getIntoTown';
import { t } from './lib/i18n';

const CANVAS = 280;
const RADIUS = 110;
const CENTER = CANVAS / 2;
const PERSPECTIVE = 380;
const ROTATE_STEP = 0.004;
const DRAG_MIN_PX = 6;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SIZE_MIN = 28;
const SIZE_MAX = 48;
const OPACITY_MIN = 0.3;
const OPACITY_MAX = 1;
const FRONT_SCALE = 0.8;
const SECTION_BG = '#0A1628';
const NAVY = '#0A1628';
const PAUSE_MS = 5000;
const PAUSE_GROW = 1.2;
const HERO_SIZE = 72;
const HERO_MS = 5000;
const HERO_MERGE_MS = 720;
const LOGO_PAD = 8;
const HERO_RING = HERO_SIZE * 1.8;

const VISUAL_GLOBE_DOTS: GlobeService[] = [
  { key: 'grab', name: 'Grab', color: '#00B14F', initials: 'G', category: 'transport' },
  { key: 'bolt', name: 'Bolt', color: '#34D186', initials: 'B', category: 'transport' },
  { key: 'uber', name: 'Uber', color: '#000000', initials: 'U', category: 'transport' },
  { key: 'indrive', name: 'InDrive', color: '#C6FF00', initials: 'ID', category: 'transport' },
];

const HERO_GLOBE_DOTS: GlobeService[] = [
  { key: 'booking', name: 'Booking.com', color: '#003580', initials: 'B', category: 'hotels' },
  { key: 'agoda', name: 'Agoda', color: '#E5132C', initials: 'A', category: 'hotels' },
  { key: 'airbnb', name: 'Airbnb', color: '#FF5A5F', initials: 'AB', category: 'hotels' },
  { key: 'hotelscom', name: 'Hotels.com', color: '#E31837', initials: 'HC', category: 'hotels' },
  ...VISUAL_GLOBE_DOTS,
];

const HERO_DOT_KEYS = new Set(HERO_GLOBE_DOTS.map(s => s.key));

const TRIP_COM_DOT: DotItem = {
  key: 'tripcom',
  name: 'Trip.com',
  color: '#1890FF',
  initials: 'TC',
  category: 'flights',
  logoUrl: 'https://www.trip.com/favicon.ico',
  url: tripComFlightsUrl(),
};

const ALL_GLOBE_DOTS: DotItem[] = (() => {
  const rest = GLOBE_SERVICES.filter(s => !HERO_DOT_KEYS.has(s.key));
  const mid = Math.floor(rest.length / 2);
  const merged: DotItem[] = [...rest.slice(0, mid), ...HERO_GLOBE_DOTS, ...rest.slice(mid)];
  const kiwi = merged.findIndex(s => s.key === 'kiwi');
  const avia = merged.findIndex(s => s.key === 'aviasales');
  const at = kiwi >= 0 ? kiwi + 1 : avia >= 0 ? avia + 1 : merged.length;
  merged.splice(at, 0, TRIP_COM_DOT);
  return merged;
})();

const VISUAL_DOT_KEYS = new Set(VISUAL_GLOBE_DOTS.map(s => s.key));

let lastGlobePage: 1 | 2 | 3 = 1;
export function getGlobePage(): 1 | 2 {
  return lastGlobePage === 1 ? 1 : 2;
}

type DotItem = {
  key: string;
  name: string;
  color: string;
  initials: string;
  category: string;
  url?: string;
  logoUrl?: string | null;
  emoji?: string;
  kind?: 'place';
  tag?: string;
  tiktokUrl?: string;
  instaUrl?: string;
  urlByRegion?: Record<string, string>;
};

type GlobePage = 1 | 2 | 3;

const HERO_SERVICE_KEY: Record<string, string> = {
  'Booking.com': 'booking',
  Agoda: 'agoda',
  Airbnb: 'airbnb',
  'Hotels.com': 'hotelscom',
};

function openHeroBrand(name: string, ctx?: GlobeServiceCtx) {
  const key = HERO_SERVICE_KEY[name];
  if (key) {
    const url = globeServiceUrl({ key }, ctx);
    if (url) void Linking.openURL(url);
    return;
  }
  void openRideHailing(name);
}

function localLifeOpenUrl(
  service: { url?: string; urlByRegion?: Record<string, string> },
  destIata?: string,
): string {
  const map = service.urlByRegion;
  if (map) {
    const code = String(destIata || '').trim().toUpperCase();
    return (code && map[code]) || map.DEFAULT || service.url || '';
  }
  return service.url || '';
}

async function openPreferredUrl(deep: string, web: string) {
  try {
    if (await Linking.canOpenURL(deep)) {
      await Linking.openURL(deep);
      return;
    }
  } catch {
    /* scheme missing from queries or app not installed */
  }
  await Linking.openURL(web);
}

function openEpicTikTok(place: Pick<EpicPlace, 'name'>) {
  const tiktokUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(place.name)}`;
  void Linking.openURL(tiktokUrl);
}

function openEpicInsta(place: Pick<EpicPlace, 'tag' | 'instaUrl'>) {
  void openPreferredUrl(
    `instagram://explore/tags/${place.tag}`,
    place.instaUrl,
  );
}

function placeToDot(place: EpicPlace): DotItem {
  return {
    key: `epic-${place.tag}`,
    name: place.name,
    color: 'transparent',
    initials: place.emoji,
    category: 'epic',
    emoji: place.emoji,
    kind: 'place',
    tag: place.tag,
    tiktokUrl: place.tiktokUrl,
    instaUrl: place.instaUrl,
  };
}

function displayLogoUri(logoUrl?: string | null): string | undefined {
  if (!logoUrl) return undefined;
  try {
    const parsed = new URL(logoUrl);
    if (/\.ico$/i.test(parsed.pathname)) {
      return `https://www.google.com/s2/favicons?sz=128&domain=${parsed.hostname}`;
    }
  } catch {
    return logoUrl;
  }
  return logoUrl;
}

function hexRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '').trim();
  const n = raw.length === 3
    ? raw.split('').map(ch => ch + ch).join('')
    : raw.slice(0, 6).padEnd(6, '0');
  const v = Number.parseInt(n, 16);
  if (!Number.isFinite(v)) return { r: 10, g: 22, b: 40 };
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function darkRgba(hex: string, a: number): string {
  const { r, g, b } = hexRgb(hex);
  return `rgba(${Math.round(r * 0.45)},${Math.round(g * 0.45)},${Math.round(b * 0.45)},${a})`;
}

const SERVICE_LOGOS: Record<string, string> = {
  Airalo: 'https://www.airalo.com/favicon.ico',
  Yesim: 'https://yesim.app/favicon.ico',
  Saily: 'https://saily.com/favicon.ico',
  GigSky: 'https://www.gigsky.com/favicon.ico',
  KKday: 'https://www.kkday.com/favicon.ico',
  Drimsim: 'https://drimsim.app/favicon.ico',
  EKTA: 'https://ekta.life/favicon.ico',
  SafetyWing: 'https://safetywing.com/favicon.ico',
  Klook: 'https://www.klook.com/favicon.ico',
  Tiqets: 'https://www.tiqets.com/favicon.ico',
  GetYourGuide: 'https://www.getyourguide.com/favicon.ico',
  GoCity: 'https://gocity.com/favicon.ico',
  WeGoTrip: 'https://wegotrip.com/favicon.ico',
  QEEQ: 'https://www.qeeq.com/favicon.ico',
  LocalRent: 'https://localrent.com/favicon.ico',
  GetRentACar: 'https://www.getrentacar.com/favicon.ico',
  EconomyBookings: 'https://www.economybookings.com/favicon.ico',
  AutoEurope: 'https://www.autoeurope.com/favicon.ico',
  'Trip.com': 'https://www.trip.com/favicon.ico',
};

type UnitPoint = { x: number; y: number; z: number };

type ProjectedDot = {
  service: DotItem;
  left: number;
  top: number;
  size: number;
  opacity: number;
  z: number;
  scale: number;
  labelOpacity: number;
};

function fibonacciSphere(count: number): UnitPoint[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    };
  });
}

function projectDots(
  timeOffset: number,
  services: DotItem[] = ALL_GLOBE_DOTS,
): ProjectedDot[] {
  const points = fibonacciSphere(services.length);
  const cos = Math.cos(timeOffset);
  const sin = Math.sin(timeOffset);
  const dots: ProjectedDot[] = points.map((p, i) => {
    const x = p.x * cos + p.z * sin;
    const z = -p.x * sin + p.z * cos;
    const depth = (z + 1) / 2;
    const persp = PERSPECTIVE / (PERSPECTIVE - z * RADIUS);
    const size = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * depth;
    const sx = CENTER + x * RADIUS * persp;
    const sy = CENTER + p.y * RADIUS * persp;
    const scale = depth;
    const labelOpacity = scale <= FRONT_SCALE ? 0 : (scale - FRONT_SCALE) / (1 - FRONT_SCALE);
    return {
      service: services[i],
      left: sx - size / 2,
      top: sy - size / 2,
      size,
      opacity: OPACITY_MIN + (OPACITY_MAX - OPACITY_MIN) * depth,
      z,
      scale,
      labelOpacity,
    };
  });
  dots.sort((a, b) => a.z - b.z);
  return dots;
}

function PaddedBrandMark({
  name,
  initials,
  color,
  size,
  logoUrl,
  emoji,
}: {
  name: string;
  initials: string;
  color: string;
  size: number;
  logoUrl?: string | null;
  emoji?: string;
}) {
  const local = LOCAL_LOGOS[name];
  const raw = logoUrl !== undefined
    ? (logoUrl || undefined)
    : (SERVICE_LOGOS[name] || LOGOS[name]);
  const uri = displayLogoUri(raw) ?? raw;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const source = local || (uri && !failed ? { uri } : undefined);
  const tryImage = !!source && !failed;
  const showLogo = tryImage && ready;
  const img = Math.max(8, size - LOGO_PAD * 2);
  const glow = size * 0.72;
  const mark = emoji && !showLogo ? emoji : initials;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: showLogo ? color : darkRgba(color, 0.4),
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: showLogo ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }}
    >
      {showLogo ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: glow,
            height: glow,
            borderRadius: glow / 2,
            backgroundColor: rgba(color, 0.8),
          }}
        />
      )}
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: emoji && !showLogo ? Math.max(14, size * 0.42) : 15,
          fontWeight: '800',
          letterSpacing: 0.5,
          opacity: showLogo ? 0 : 1,
        }}
      >
        {mark}
      </Text>
      {tryImage ? (
        <Image
          source={source}
          resizeMode="contain"
          onLoad={() => setReady(true)}
          onError={() => {
            setFailed(true);
            setReady(false);
          }}
          style={{
            position: 'absolute',
            width: img,
            height: img,
            opacity: ready ? 1 : 0,
          }}
        />
      ) : null}
    </View>
  );
}

function globeCatLabel(category: GlobeCategory): string {
  const copy = t();
  switch (category) {
    case 'transport': return copy.globeCatTransport;
    case 'transfer': return copy.globeCatTransfer;
    case 'hotels': return copy.globeCatHotels;
    case 'esim': return copy.globeCatEsim;
    case 'activities': return copy.globeCatActivities;
    case 'car': return copy.globeCatCar;
    case 'bikes': return copy.globeCatBikes;
    case 'insurance': return copy.globeCatInsurance;
    case 'compensation': return copy.globeCatCompensation;
    case 'luggage': return copy.globeCatLuggage;
    case 'flights': return copy.globeCatFlights;
  }
}

function anyCatLabel(category: string): string {
  if (category in LOCAL_LIFE_CATEGORY_META) {
    return LOCAL_LIFE_CATEGORY_META[category as LocalLifeCategory].label;
  }
  return globeCatLabel(category as GlobeCategory);
}

function wrapAngDelta(from: number, to: number): number {
  let d = to - from;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function angFromCenter(x: number, y: number): number {
  return Math.atan2(y - CENTER, x - CENTER);
}

function displayGeom(dot: ProjectedDot, expanded: boolean) {
  const grow = expanded ? PAUSE_GROW : 1;
  const displaySize = dot.size * grow;
  return {
    displaySize,
    displayLeft: dot.left - (displaySize - dot.size) / 2,
    displayTop: dot.top - (displaySize - dot.size) / 2,
  };
}

function GlobeDot({
  dot,
  expanded,
  onPress,
}: {
  dot: ProjectedDot;
  expanded: boolean;
  onPress: (service: DotItem) => void;
}) {
  const { service, opacity, z, labelOpacity } = dot;
  const zIndex = Math.round((z + 1) * 100);
  const { displaySize, displayLeft, displayTop } = displayGeom(dot, expanded);
  const displayOpacity = expanded ? 1 : opacity;
  const inCenter = labelOpacity > 0.02;
  const glow = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (!inCenter) {
      glow.stopAnimation();
      glow.setValue(0.2);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.2, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      glow.setValue(0.2);
    };
  }, [glow, inCenter]);

  const ring = displaySize + 20;

  return (
    <>
      {inCenter ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: displayLeft - 10,
            top: displayTop - 10,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.5)',
            opacity: glow,
            zIndex: zIndex - 1,
          }}
        />
      ) : null}
      <Pressable
        onPress={() => onPress(service)}
        pointerEvents={expanded ? 'auto' : 'none'}
        accessibilityRole="button"
        accessibilityLabel={
          service.kind === 'place' || VISUAL_DOT_KEYS.has(service.key)
            ? service.name
            : `${service.name}, ${anyCatLabel(service.category)}, ${t().globeMore}`
        }
        style={[
          styles.dot,
          {
            left: displayLeft,
            top: displayTop,
            width: displaySize,
            height: displaySize,
            borderRadius: displaySize / 2,
            overflow: service.kind === 'place' ? 'visible' : 'hidden',
            opacity: displayOpacity,
            zIndex,
          },
        ]}
      >
        {service.kind === 'place' ? (
          <EpicPlaceMark emoji={service.emoji || ''} size={displaySize} />
        ) : (
          <PaddedBrandMark
            name={service.name}
            initials={service.initials}
            color={service.color}
            size={displaySize}
            logoUrl={service.logoUrl}
            emoji={service.emoji}
          />
        )}
      </Pressable>
    </>
  );
}

function GlobeTip({
  dot,
  expanded,
  ctx,
  destIata,
}: {
  dot: ProjectedDot;
  expanded: boolean;
  ctx?: GlobeServiceCtx;
  destIata?: string;
}) {
  const nudge = useRef(new Animated.Value(0)).current;
  const { displaySize, displayLeft, displayTop } = displayGeom(dot, expanded);
  const more = t().globeMore.replace(/\s*→\s*$/u, '').trim();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, { toValue: 4, duration: 500, useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      nudge.setValue(0);
    };
  }, [nudge]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        if (dot.service.urlByRegion) {
          const url = localLifeOpenUrl(dot.service, destIata);
          if (url) void Linking.openURL(url);
          return;
        }
        if (dot.service.url) {
          void Linking.openURL(dot.service.url);
          return;
        }
        if (HERO_DOT_KEYS.has(dot.service.key)) {
          openHeroBrand(dot.service.name, ctx);
          return;
        }
        void openGlobeService(dot.service as GlobeService, ctx);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${dot.service.name}, ${anyCatLabel(dot.service.category)}, ${t().globeMore}`}
      style={[
        styles.tip,
        {
          left: displayLeft + displaySize / 2 - 60,
          top: displayTop + displaySize + 4,
          opacity: expanded ? 1 : dot.labelOpacity,
        },
      ]}
    >
      <View style={styles.tipBox}>
        <Text style={styles.tipName} numberOfLines={1}>{dot.service.name}</Text>
        <Text style={styles.tipCat} numberOfLines={1}>
          {anyCatLabel(dot.service.category)}
        </Text>
        <View style={styles.tipMoreRow}>
          <Text style={styles.tipMore}>{more}</Text>
          <Animated.Text
            style={[styles.tipMore, { transform: [{ translateX: nudge }] }]}
          >
            →
          </Animated.Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GlobeTips({
  dots,
  expanded,
  ctx,
  destIata,
}: {
  dots: ProjectedDot[];
  expanded: boolean;
  ctx?: GlobeServiceCtx;
  destIata?: string;
}) {
  return dots.map(dot => {
    if (dot.labelOpacity <= 0.02) return null;
    if (dot.service.kind === 'place') {
      return (
        <EpicPlaceTip
          key={`tip-${dot.service.key}`}
          dot={dot}
          expanded={expanded}
        />
      );
    }
    return (
      <GlobeTip
        key={`tip-${dot.service.key}`}
        dot={dot}
        expanded={expanded}
        ctx={ctx}
        destIata={destIata}
      />
    );
  });
}

function heroSlots(): { left: number; top: number }[] {
  const r = HERO_RING;
  const half = HERO_SIZE / 2;
  return HERO_BRANDS.map((_, i) => {
    const a = (i / HERO_BRANDS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      left: CENTER + Math.cos(a) * r - half,
      top: CENTER + Math.sin(a) * r - half,
    };
  });
}

function HeroIntro({
  scale,
  opacity,
  ctx,
}: {
  scale: Animated.Value;
  opacity: Animated.Value;
  ctx?: GlobeServiceCtx;
}) {
  const slots = useMemo(() => heroSlots(), []);
  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {HERO_BRANDS.map((brand, i) => (
        <TouchableOpacity
          key={brand.name}
          activeOpacity={0.8}
          onPress={() => openHeroBrand(brand.name, ctx)}
          accessibilityRole="button"
          accessibilityLabel={brand.name}
          style={[
            styles.dot,
            {
              left: slots[i].left,
              top: slots[i].top,
              width: HERO_SIZE,
              height: HERO_SIZE,
              borderRadius: HERO_SIZE / 2,
              overflow: 'hidden',
            },
          ]}
        >
          <Animated.View
            style={{
              width: HERO_SIZE,
              height: HERO_SIZE,
              borderRadius: HERO_SIZE / 2,
              overflow: 'hidden',
              transform: [{ scale }],
            }}
          >
            <PaddedBrandMark
              name={brand.name}
              initials={brand.initials}
              color={brand.color}
              size={HERO_SIZE}
            />
          </Animated.View>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

function LocalHeroIntro({
  scale,
  opacity,
}: {
  scale: Animated.Value;
  opacity: Animated.Value;
}) {
  const slots = useMemo(() => {
    const r = HERO_RING;
    const half = HERO_SIZE / 2;
    return LOCAL_LIFE_HERO.map((_, i) => {
      const a = (i / LOCAL_LIFE_HERO.length) * Math.PI * 2 - Math.PI / 2;
      return {
        left: CENTER + Math.cos(a) * r - half,
        top: CENTER + Math.sin(a) * r - half,
      };
    });
  }, []);
  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {LOCAL_LIFE_HERO.map((brand, i) => (
        <TouchableOpacity
          key={brand.key}
          activeOpacity={0.8}
          onPress={() => { void Linking.openURL(brand.url); }}
          accessibilityRole="button"
          accessibilityLabel={brand.name}
          style={[
            styles.dot,
            {
              left: slots[i].left,
              top: slots[i].top,
              width: HERO_SIZE,
              height: HERO_SIZE,
              borderRadius: HERO_SIZE / 2,
              overflow: 'hidden',
            },
          ]}
        >
          <Animated.View
            style={{
              width: HERO_SIZE,
              height: HERO_SIZE,
              borderRadius: HERO_SIZE / 2,
              overflow: 'hidden',
              transform: [{ scale }],
            }}
          >
            <PaddedBrandMark
              name={brand.name}
              initials={brand.initials}
              color={brand.color}
              size={HERO_SIZE}
              logoUrl={brand.logoUrl}
              emoji={brand.emoji}
            />
          </Animated.View>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

function EpicPlaceMark({ emoji, size }: { emoji: string; size: number }) {
  const fontSize = size >= HERO_SIZE - 1 ? 24 : Math.min(24, Math.max(14, size * 0.58));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize, lineHeight: fontSize + 4, textAlign: 'center' }}>
        {emoji}
      </Text>
    </View>
  );
}

function EpicPlaceTip({
  dot,
  expanded,
}: {
  dot: ProjectedDot;
  expanded: boolean;
}) {
  const { displaySize, displayLeft, displayTop } = displayGeom(dot, expanded);
  const service = dot.service;
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.epicTip,
        {
          left: displayLeft + displaySize / 2 - 84,
          top: displayTop + displaySize + 4,
          opacity: expanded ? 1 : dot.labelOpacity,
        },
      ]}
    >
      <View style={styles.tipBox}>
        <Text style={styles.tipName} numberOfLines={2}>{service.name}</Text>
        <View style={styles.epicTipBtns}>
          <Pressable
            onPress={() => openEpicTikTok({ name: service.name })}
            accessibilityRole="button"
            accessibilityLabel="TikTok"
            style={styles.epicTikTokBtn}
          >
            <Text style={styles.epicSocialTxt}>TikTok</Text>
          </Pressable>
          <Pressable
            onPress={() => openEpicInsta({
              tag: service.tag || '',
              instaUrl: service.instaUrl || `https://www.instagram.com/explore/tags/${service.tag || ''}`,
            })}
            accessibilityRole="button"
            accessibilityLabel="Instagram"
            style={styles.epicInstaBtn}
          >
            <Text style={styles.epicSocialTxt}>Instagram</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function EpicHeroIntro({
  scale,
  opacity,
  destIata,
}: {
  scale: Animated.Value;
  opacity: Animated.Value;
  destIata?: string;
}) {
  const brands = useMemo(() => epicPlacesHero(destIata), [destIata]);
  const slots = useMemo(() => {
    const r = HERO_RING;
    const half = HERO_SIZE / 2;
    return brands.map((_, i) => {
      const a = (i / Math.max(1, brands.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        left: CENTER + Math.cos(a) * r - half,
        top: CENTER + Math.sin(a) * r - half,
      };
    });
  }, [brands]);
  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {brands.map((place, i) => (
        <TouchableOpacity
          key={place.tag}
          activeOpacity={0.8}
          onPress={() => openEpicTikTok(place)}
          accessibilityRole="button"
          accessibilityLabel={place.name}
          style={[
            styles.dot,
            {
              left: slots[i].left,
              top: slots[i].top,
              width: HERO_SIZE,
              height: HERO_SIZE,
              borderRadius: HERO_SIZE / 2,
            },
          ]}
        >
          <Animated.View
            style={{
              width: HERO_SIZE,
              height: HERO_SIZE,
              borderRadius: HERO_SIZE / 2,
              transform: [{ scale }],
            }}
          >
            <EpicPlaceMark emoji={place.emoji} size={HERO_SIZE} />
          </Animated.View>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

function EpicPlacesList({ destIata }: { destIata?: string }) {
  const groups = useMemo(() => epicPlacesGrouped(destIata), [destIata]);
  return (
    <View style={styles.localList}>
      {groups.map(group => (
        <View key={group.label} style={styles.localSection}>
          <Text style={styles.localTitle}>{group.label}</Text>
          {group.places.map(place => (
            <View key={place.tag} style={styles.epicListRow}>
              <View style={styles.epicListMark}>
                <EpicPlaceMark emoji={place.emoji} size={36} />
              </View>
              <Text style={styles.rowName} numberOfLines={2}>{place.name}</Text>
              <Pressable
                onPress={() => openEpicTikTok(place)}
                accessibilityRole="button"
                accessibilityLabel={`${place.name} TikTok`}
                style={styles.epicTikTokBtn}
              >
                <Text style={styles.epicSocialTxt}>TikTok</Text>
              </Pressable>
              <Pressable
                onPress={() => openEpicInsta(place)}
                accessibilityRole="button"
                accessibilityLabel={`${place.name} Instagram`}
                style={styles.epicInstaBtn}
              >
                <Text style={styles.epicSocialTxt}>Instagram</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function LocalLifeSheet({
  category,
  destIata,
  onClose,
}: {
  category: LocalLifeCategory;
  destIata?: string;
  onClose: () => void;
}) {
  const items = localLifeByCategory(category, destIata);
  const title = LOCAL_LIFE_CATEGORY_META[category].label;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t().globeClose}
              style={styles.closeBtn}
            >
              <X size={18} color="#FFFFFF" weight="bold" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetList}
            showsVerticalScrollIndicator={false}
          >
            {items.map(service => (
              <Pressable
                key={`${category}-${service.key}`}
                onPress={() => {
                  onClose();
                  void Linking.openURL(localLifeOpenUrl(service, destIata));
                }}
                accessibilityRole="button"
                accessibilityLabel={service.name}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowDot}>
                  <PaddedBrandMark
                    name={service.name}
                    initials={service.initials}
                    color={service.color}
                    size={36}
                    logoUrl={service.logoUrl}
                    emoji={service.emoji}
                  />
                </View>
                <Text style={styles.rowName}>{service.name}</Text>
                <Text style={styles.rowChevron}>→</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function LocalLifeList({ destIata }: { destIata?: string }) {
  if (lastGlobePage === 3) {
    return <EpicPlacesList destIata={destIata} />;
  }
  return <LocalLifeRows destIata={destIata} />;
}

function LocalLifeRows({ destIata }: { destIata?: string }) {
  const rows = useMemo(() => {
    return LOCAL_LIFE_CATEGORY_ORDER.map(category => ({
      category,
      services: localLifeByCategory(category, destIata),
    })).filter(row => row.services.length > 0);
  }, [destIata]);

  return (
    <View style={styles.localList}>
      {rows.map(row => (
        <View key={row.category} style={styles.localSection}>
          <Text style={styles.localTitle}>{LOCAL_LIFE_CATEGORY_META[row.category].label}</Text>
          <BrandLogoTileRow
            tiles={row.services.map(service => ({
              key: service.key,
              label: service.name,
              skipLogo: !service.logoUrl,
              logoUri: displayLogoUri(service.logoUrl),
              brandColor: service.color,
              brandTextColor: '#FFFFFF',
              onPress: () => { void Linking.openURL(localLifeOpenUrl(service, destIata)); },
            }))}
            mutedColor={TILE_GOLD}
          />
        </View>
      ))}
    </View>
  );
}

function CategorySheet({
  category,
  ctx,
  onClose,
}: {
  category: GlobeCategory;
  ctx?: GlobeServiceCtx;
  onClose: () => void;
}) {
  const items: DotItem[] = category === 'flights'
    ? [...servicesByCategory(category, ctx).filter(s => s.key !== 'tripcom'), TRIP_COM_DOT]
    : servicesByCategory(category, ctx);
  const title = globeCatLabel(category);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t().globeClose}
              style={styles.closeBtn}
            >
              <X size={18} color="#FFFFFF" weight="bold" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetList}
            showsVerticalScrollIndicator={false}
          >
            {items.map(service => (
              <Pressable
                key={`${category}-${service.key}`}
                onPress={() => {
                  onClose();
                  if (service.url) {
                    void Linking.openURL(service.url);
                    return;
                  }
                  void openGlobeService(service as GlobeService, ctx);
                }}
                accessibilityRole="button"
                accessibilityLabel={service.name}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowDot}>
                  <PaddedBrandMark
                    name={service.name}
                    initials={service.initials}
                    color={service.color}
                    size={36}
                    logoUrl={service.logoUrl}
                  />
                </View>
                <Text style={styles.rowName}>{service.name}</Text>
                <Text style={styles.rowChevron}>→</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PageIndicators({
  page,
  onSelect,
}: {
  page: GlobePage;
  onSelect: (next: GlobePage) => void;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  const copy = t();
  const labels: { id: GlobePage; label: string }[] = [
    { id: 1, label: copy.globePageArrival },
    { id: 2, label: copy.globePageLifestyle },
    { id: 3, label: copy.globePageInsta },
  ];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.25, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View pointerEvents="box-none" style={styles.pageDots}>
      {labels.map(item => {
        const on = page === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            hitSlop={8}
            style={styles.pageDotHit}
          >
            <Animated.View
              style={[
                on ? styles.pageDotOn : styles.pageDotOff,
                on ? null : { opacity: pulse },
              ]}
            />
            <Text style={[styles.pageDotLabel, on && styles.pageDotLabelOn]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ServiceGlobe({
  ctx,
  destIata,
}: {
  ctx?: GlobeServiceCtx;
  destIata?: string;
}) {
  const page2Services = useMemo(() => localLifeVisible(destIata), [destIata]);
  const page2Ref = useRef({ services: page2Services });
  page2Ref.current = { services: page2Services };
  const page3Services = useMemo(
    () => epicPlacesVisible(destIata).map(placeToDot),
    [destIata],
  );
  const page3Ref = useRef({ services: page3Services });
  page3Ref.current = { services: page3Services };

  const angleRef = useRef(0);
  const angle2Ref = useRef(0);
  const angle3Ref = useRef(0);
  const pausedRef = useRef(false);
  const paused2Ref = useRef(false);
  const paused3Ref = useRef(false);
  const ignoreBgRef = useRef(false);
  const heroDoneRef = useRef(false);
  const hero2DoneRef = useRef(false);
  const hero2StartedRef = useRef(false);
  const hero3DoneRef = useRef(false);
  const hero3StartedRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer2 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer3 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef<GlobePage>(1);
  const [page, setPage] = useState<GlobePage>(lastGlobePage);
  pageRef.current = page;
  const [paused, setPaused] = useState(false);
  const [paused2, setPaused2] = useState(false);
  const [paused3, setPaused3] = useState(false);
  const [heroDone, setHeroDone] = useState(false);
  const [hero2Done, setHero2Done] = useState(false);
  const [hero3Done, setHero3Done] = useState(false);
  const [dots, setDots] = useState(() => projectDots(0));
  const [dots2, setDots2] = useState(() => projectDots(0, page2Services));
  const [dots3, setDots3] = useState(() => projectDots(0, page3Services));
  const dotsRef = useRef(dots);
  const dots2Ref = useRef(dots2);
  const dots3Ref = useRef(dots3);
  dotsRef.current = dots;
  dots2Ref.current = dots2;
  dots3Ref.current = dots3;
  const [openCategory, setOpenCategory] = useState<GlobeCategory | null>(null);
  const [openLocalCat, setOpenLocalCat] = useState<LocalLifeCategory | null>(null);
  const heroScale = useRef(new Animated.Value(1)).current;
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const globeOpacity = useRef(new Animated.Value(0)).current;
  const hero2Scale = useRef(new Animated.Value(1)).current;
  const hero2Opacity = useRef(new Animated.Value(1)).current;
  const globe2Opacity = useRef(new Animated.Value(0)).current;
  const hero3Scale = useRef(new Animated.Value(1)).current;
  const hero3Opacity = useRef(new Animated.Value(1)).current;
  const globe3Opacity = useRef(new Animated.Value(0)).current;
  const goToPageRef = useRef<(next: GlobePage) => void>(() => {});

  const clearIdleTimer = () => {
    if (idleTimer.current != null) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const clearIdleTimer2 = () => {
    if (idleTimer2.current != null) {
      clearTimeout(idleTimer2.current);
      idleTimer2.current = null;
    }
  };

  const clearIdleTimer3 = () => {
    if (idleTimer3.current != null) {
      clearTimeout(idleTimer3.current);
      idleTimer3.current = null;
    }
  };

  const resumeNow = () => {
    clearIdleTimer();
    pausedRef.current = false;
    setPaused(false);
  };

  const resumeNow2 = () => {
    clearIdleTimer2();
    paused2Ref.current = false;
    setPaused2(false);
  };

  const resumeNow3 = () => {
    clearIdleTimer3();
    paused3Ref.current = false;
    setPaused3(false);
  };

  const armIdleTimer = () => {
    clearIdleTimer();
    idleTimer.current = setTimeout(() => {
      idleTimer.current = null;
      pausedRef.current = false;
      setPaused(false);
    }, PAUSE_MS);
  };

  const armIdleTimer2 = () => {
    clearIdleTimer2();
    idleTimer2.current = setTimeout(() => {
      idleTimer2.current = null;
      paused2Ref.current = false;
      setPaused2(false);
    }, PAUSE_MS);
  };

  const armIdleTimer3 = () => {
    clearIdleTimer3();
    idleTimer3.current = setTimeout(() => {
      idleTimer3.current = null;
      paused3Ref.current = false;
      setPaused3(false);
    }, PAUSE_MS);
  };

  const enterPause = () => {
    pausedRef.current = true;
    setPaused(true);
    armIdleTimer();
  };

  const enterPause2 = () => {
    paused2Ref.current = true;
    setPaused2(true);
    armIdleTimer2();
  };

  const enterPause3 = () => {
    paused3Ref.current = true;
    setPaused3(true);
    armIdleTimer3();
  };

  const goToPage = (next: GlobePage) => {
    if (next === pageRef.current) return;
    lastGlobePage = next;
    setPage(next);
    setOpenCategory(null);
    setOpenLocalCat(null);
  };
  goToPageRef.current = goToPage;

  const applySpin = (da: number) => {
    if (!Number.isFinite(da) || da === 0) return;
    const p = pageRef.current;
    if (p === 1) {
      angleRef.current += da;
      setDots(projectDots(angleRef.current));
    } else if (p === 2) {
      angle2Ref.current += da;
      setDots2(projectDots(angle2Ref.current, page2Ref.current.services));
    } else {
      angle3Ref.current += da;
      setDots3(projectDots(angle3Ref.current, page3Ref.current.services));
    }
  };
  const applySpinRef = useRef(applySpin);
  applySpinRef.current = applySpin;

  const freezeAuto = () => {
    const p = pageRef.current;
    if (p === 1) {
      clearIdleTimer();
      if (!pausedRef.current) {
        pausedRef.current = true;
        setPaused(true);
      }
    } else if (p === 2) {
      clearIdleTimer2();
      if (!paused2Ref.current) {
        paused2Ref.current = true;
        setPaused2(true);
      }
    } else {
      clearIdleTimer3();
      if (!paused3Ref.current) {
        paused3Ref.current = true;
        setPaused3(true);
      }
    }
  };
  const freezeAutoRef = useRef(freezeAuto);
  freezeAutoRef.current = freezeAuto;

  const armAfterDrag = () => {
    const p = pageRef.current;
    if (p === 1) armIdleTimer();
    else if (p === 2) armIdleTimer2();
    else armIdleTimer3();
  };
  const armAfterDragRef = useRef(armAfterDrag);
  armAfterDragRef.current = armAfterDrag;

  const hitBubble = (x: number, y: number): DotItem | null => {
    const p = pageRef.current;
    const expanded = p === 1 ? pausedRef.current : p === 2 ? paused2Ref.current : paused3Ref.current;
    const list = p === 1 ? dotsRef.current : p === 2 ? dots2Ref.current : dots3Ref.current;
    let best: ProjectedDot | null = null;
    for (const d of list) {
      const g = displayGeom(d, expanded);
      if (x < g.displayLeft || x > g.displayLeft + g.displaySize) continue;
      if (y < g.displayTop || y > g.displayTop + g.displaySize) continue;
      if (!best || d.z > best.z) best = d;
    }
    return best?.service ?? null;
  };

  const onDotRef = useRef<(s: DotItem) => void>(() => {});
  const onGlobeBgRef = useRef<() => void>(() => {});
  const spinDrag = useRef({ lastAng: 0, moved: false, startX: 0, startY: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        const p = pageRef.current;
        if (p === 1) return !pausedRef.current;
        if (p === 2) return !paused2Ref.current;
        return !paused3Ref.current;
      },
      onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 4,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.hypot(g.dx, g.dy) > 8,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: e => {
        const x = e.nativeEvent.locationX;
        const y = e.nativeEvent.locationY;
        spinDrag.current = {
          lastAng: angFromCenter(x, y),
          moved: false,
          startX: x,
          startY: y,
        };
        freezeAutoRef.current();
      },
      onPanResponderMove: e => {
        const x = e.nativeEvent.locationX;
        const y = e.nativeEvent.locationY;
        const ang = angFromCenter(x, y);
        const da = wrapAngDelta(spinDrag.current.lastAng, ang);
        spinDrag.current.lastAng = ang;
        if (Math.hypot(x - spinDrag.current.startX, y - spinDrag.current.startY) > DRAG_MIN_PX) {
          spinDrag.current.moved = true;
        }
        applySpinRef.current(da);
      },
      onPanResponderRelease: (e, g) => {
        if (spinDrag.current.moved) {
          const flick = (Number(g.vx) || 0) * 0.18;
          if (Math.abs(flick) > 0.002) applySpinRef.current(flick);
          armAfterDragRef.current();
          return;
        }
        const hit = hitBubble(e.nativeEvent.locationX, e.nativeEvent.locationY);
        if (hit) onDotRef.current(hit);
        else onGlobeBgRef.current();
      },
    }),
  ).current;

  useEffect(() => {
    const wait = setTimeout(() => {
      Animated.parallel([
        Animated.timing(heroScale, {
          toValue: 0.38,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(heroOpacity, {
          toValue: 0,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(globeOpacity, {
          toValue: 1,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        heroDoneRef.current = true;
        setHeroDone(true);
      });
    }, HERO_MS);
    return () => clearTimeout(wait);
  }, [globeOpacity, heroOpacity, heroScale]);

  useEffect(() => {
    if (page !== 2 || hero2DoneRef.current || hero2StartedRef.current) return;
    hero2StartedRef.current = true;
    const wait = setTimeout(() => {
      Animated.parallel([
        Animated.timing(hero2Scale, {
          toValue: 0.38,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(hero2Opacity, {
          toValue: 0,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(globe2Opacity, {
          toValue: 1,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        hero2DoneRef.current = true;
        setHero2Done(true);
      });
    }, HERO_MS);
    return () => {
      clearTimeout(wait);
      if (!hero2DoneRef.current) hero2StartedRef.current = false;
    };
  }, [globe2Opacity, hero2Opacity, hero2Scale, page]);

  useEffect(() => {
    if (page !== 3 || hero3DoneRef.current || hero3StartedRef.current) return;
    hero3StartedRef.current = true;
    const wait = setTimeout(() => {
      Animated.parallel([
        Animated.timing(hero3Scale, {
          toValue: 0.38,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(hero3Opacity, {
          toValue: 0,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(globe3Opacity, {
          toValue: 1,
          duration: HERO_MERGE_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        hero3DoneRef.current = true;
        setHero3Done(true);
      });
    }, HERO_MS);
    return () => {
      clearTimeout(wait);
      if (!hero3DoneRef.current) hero3StartedRef.current = false;
    };
  }, [globe3Opacity, hero3Opacity, hero3Scale, page]);

  useEffect(() => {
    setDots2(projectDots(angle2Ref.current, page2Services));
  }, [page2Services]);

  useEffect(() => {
    setDots3(projectDots(angle3Ref.current, page3Services));
  }, [page3Services]);

  useEffect(() => {
    return runWhileAppActive(() => {
      let raf = 0;
      const tick = () => {
        const p = pageRef.current;
        if (p === 1 && heroDoneRef.current && !pausedRef.current) {
          angleRef.current += ROTATE_STEP;
          setDots(projectDots(angleRef.current));
        } else if (p === 2 && hero2DoneRef.current && !paused2Ref.current) {
          const cur = page2Ref.current;
          angle2Ref.current += ROTATE_STEP;
          setDots2(projectDots(angle2Ref.current, cur.services));
        } else if (p === 3 && hero3DoneRef.current && !paused3Ref.current) {
          const cur = page3Ref.current;
          angle3Ref.current += ROTATE_STEP;
          setDots3(projectDots(angle3Ref.current, cur.services));
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    });
  }, []);

  useEffect(() => () => {
    clearIdleTimer();
    clearIdleTimer2();
    clearIdleTimer3();
  }, []);

  const onDot = (service: DotItem) => {
    ignoreBgRef.current = true;
    if (pageRef.current === 3) {
      if (!paused3Ref.current) enterPause3();
      else armIdleTimer3();
      return;
    }
    if (pageRef.current === 2) {
      if (!paused2Ref.current) {
        enterPause2();
        return;
      }
      armIdleTimer2();
      setOpenLocalCat(service.category as LocalLifeCategory);
      return;
    }
    if (!pausedRef.current) {
      enterPause();
      return;
    }
    armIdleTimer();
    setOpenCategory(service.category as GlobeCategory);
  };

  const closeSheet = () => {
    setOpenCategory(null);
    if (pausedRef.current) armIdleTimer();
  };

  const closeLocalSheet = () => {
    setOpenLocalCat(null);
    if (paused2Ref.current) armIdleTimer2();
  };

  const onGlobeBg = () => {
    if (ignoreBgRef.current) {
      ignoreBgRef.current = false;
      return;
    }
    if (openCategory || openLocalCat) return;
    if (pageRef.current === 3) {
      if (!paused3Ref.current) enterPause3();
      else resumeNow3();
      return;
    }
    if (pageRef.current === 2) {
      if (!paused2Ref.current) enterPause2();
      else resumeNow2();
      return;
    }
    if (!pausedRef.current) enterPause();
    else resumeNow();
  };
  onDotRef.current = onDot;
  onGlobeBgRef.current = onGlobeBg;

  const onCanvasWheel = (e: { nativeEvent?: { deltaX?: number; deltaY?: number }; deltaX?: number; deltaY?: number; preventDefault?: () => void }) => {
    const dx = Number(e.nativeEvent?.deltaX ?? e.deltaX ?? 0);
    const dy = Number(e.nativeEvent?.deltaY ?? e.deltaY ?? 0);
    if (dx === 0 && dy === 0) return;
    e.preventDefault?.();
    freezeAuto();
    applySpin((dx + dy) * 0.0035);
    armAfterDrag();
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View pointerEvents="none" style={styles.wrapFill} />
      <View
        style={styles.canvas}
        pointerEvents="auto"
        {...panResponder.panHandlers}
        {...(Platform.OS === 'web'
          ? { onWheel: onCanvasWheel, style: [styles.canvas, { cursor: 'grab' } as object] }
          : null)}
      >
        <Pressable
          onPress={onGlobeBg}
          accessibilityRole="button"
          accessibilityLabel={
            (page === 3 ? paused3 : page === 2 ? paused2 : paused)
              ? t().globeResume
              : t().globePause
          }
          style={StyleSheet.absoluteFill}
          android_ripple={{ color: 'transparent' }}
        />
        {page === 1 ? (
          <>
            <Animated.View
              pointerEvents="box-none"
              style={[styles.dotLayer, { opacity: globeOpacity }]}
            >
              {dots.map(dot => (
                <GlobeDot
                  key={dot.service.key}
                  dot={dot}
                  expanded={paused}
                  onPress={onDot}
                />
              ))}
              <GlobeTips dots={dots} expanded={paused} ctx={ctx} destIata={destIata} />
            </Animated.View>
            {heroDone ? null : (
              <HeroIntro scale={heroScale} opacity={heroOpacity} ctx={ctx} />
            )}
          </>
        ) : page === 2 ? (
          <>
            <Animated.View
              pointerEvents="box-none"
              style={[styles.dotLayer, { opacity: globe2Opacity }]}
            >
              {dots2.map(dot => (
                <GlobeDot
                  key={dot.service.key}
                  dot={dot}
                  expanded={paused2}
                  onPress={onDot}
                />
              ))}
              <GlobeTips dots={dots2} expanded={paused2} ctx={ctx} destIata={destIata} />
            </Animated.View>
            {hero2Done ? null : (
              <LocalHeroIntro scale={hero2Scale} opacity={hero2Opacity} />
            )}
          </>
        ) : (
          <>
            <Animated.View
              pointerEvents="box-none"
              style={[styles.dotLayer, { opacity: globe3Opacity }]}
            >
              {dots3.map(dot => (
                <GlobeDot
                  key={dot.service.key}
                  dot={dot}
                  expanded={paused3}
                  onPress={onDot}
                />
              ))}
              <GlobeTips dots={dots3} expanded={paused3} ctx={ctx} destIata={destIata} />
            </Animated.View>
            {hero3Done ? null : (
              <EpicHeroIntro
                scale={hero3Scale}
                opacity={hero3Opacity}
                destIata={destIata}
              />
            )}
          </>
        )}
      </View>
      <PageIndicators page={page} onSelect={goToPage} />
      {openCategory ? (
        <CategorySheet category={openCategory} ctx={ctx} onClose={closeSheet} />
      ) : null}
      {openLocalCat ? (
        <LocalLifeSheet category={openLocalCat} destIata={destIata} onClose={closeLocalSheet} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingBottom: 52,
    backgroundColor: SECTION_BG,
  },
  wrapFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: CANVAS,
    backgroundColor: SECTION_BG,
  },
  pageDots: {
    zIndex: 999,
    elevation: 999,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 16,
  },
  pageDotHit: {
    minWidth: 76,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  pageDotOn: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  pageDotOff: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  pageDotLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  pageDotLabelOn: {
    color: 'rgba(255,255,255,0.92)',
  },
  localList: {
    gap: 24,
  },
  localSection: {
    gap: 10,
  },
  localTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TILE_GOLD,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  canvas: {
    width: CANVAS,
    height: CANVAS,
    overflow: 'visible',
    alignSelf: 'center',
  },
  dotLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  dot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  tip: {
    position: 'absolute',
    width: 120,
    minWidth: 120,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 10,
  },
  tipBox: {
    zIndex: 999,
    elevation: 10,
    backgroundColor: 'rgba(10,14,30,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tipCat: {
    color: TILE_GOLD,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },
  tipMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  tipMore: {
    color: TILE_GOLD,
    fontSize: 10,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 16,
    maxHeight: '72%',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 12,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    color: TILE_GOLD,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    maxHeight: 420,
  },
  sheetList: {
    gap: 6,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowPressed: {
    opacity: 0.72,
  },
  rowDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInitials: {
    fontSize: 11,
    fontWeight: '800',
  },
  rowName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  rowChevron: {
    color: TILE_GOLD,
    fontSize: 14,
    fontWeight: '700',
  },
  epicTip: {
    position: 'absolute',
    width: 168,
    minWidth: 168,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 10,
  },
  epicTipBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  epicTikTokBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  epicInstaBtn: {
    backgroundColor: '#E1306C',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  epicSocialTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  epicListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  epicListMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
