import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlobeIcon, ListIcon } from 'phosphor-react-native';
import BrandLogoTileRow, { type BrandLogoTile } from './BrandLogoTileRow';
import HotelSearchCard, { shouldShowHotelSearchCard } from './HotelSearchCard';
import LoungePanel from './LoungePanel';
import GetIntoTownRow from './GetIntoTownRow';
import { LOCAL_LOGOS, LOGOS } from './GlobeBrandMark';
import ServiceGlobe, { getGlobePage, LocalLifeList } from './ServiceGlobe';
import { timezoneForIata } from './lib/airportTz';
import { flightBoardDate, shiftDateKey } from './lib/boardFilter';
import { TILE_GOLD } from './lib/affiliateBrands';
import { type DetailCardTheme } from './lib/detailCardStyles';
import {
  CATEGORIES,
  globeInkColor,
  openGlobeService,
  saveServiceViewMode,
  servicesByCategory,
  type GlobeCategory,
  type GlobeServiceCtx,
  type ServiceViewMode,
} from './lib/globeServices';
import { t } from './lib/i18n';
import { type LandingCardPhase } from './lib/landingCards';
import { fastTrackFor, loungesFor } from './data/lounges';

const SECTION_BG = '#0A1628';

type LoungeTheme = DetailCardTheme & {
  border: string;
  list: string;
};

type Props = {
  type: 'arrival' | 'departure';
  status?: string;
  arrIso?: string;
  destIata?: string;
  destCity?: string;
  originCountry?: string;
  destCountry?: string;
  landingPhase?: LandingCardPhase;
  airlineIata?: string;
  isPro?: boolean;
  durationMs?: number | null;
  theme: LoungeTheme;
};

function sectionLabel(raw: string): string {
  return raw.replace(/\?+$/, '').trim().toUpperCase();
}

function CategorySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={st.title}>{sectionLabel(title)}</Text>
      {children}
    </View>
  );
}

function categoryTitle(category: GlobeCategory): string {
  return CATEGORIES[category].label;
}

const LIST_CATEGORY_ORDER: GlobeCategory[] = [
  'hotels',
  'transfer',
  'activities',
  'esim',
  'car',
  'bikes',
  'luggage',
  'compensation',
  'flights',
];

function GlobeServiceList({
  ctx,
  mutedColor,
  hotelSlot,
  destIata,
}: {
  ctx?: GlobeServiceCtx;
  mutedColor: string;
  hotelSlot?: ReactNode;
  destIata?: string;
}) {
  const rows = useMemo(() => {
    return LIST_CATEGORY_ORDER.map(category => {
      const services = servicesByCategory(category, ctx);
      const tiles: BrandLogoTile[] = services.map(service => ({
        key: `${category}-${service.key}`,
        label: service.name,
        skipLogo: !LOCAL_LOGOS[service.name] && !LOGOS[service.name],
        source: LOCAL_LOGOS[service.name],
        logoUri: LOGOS[service.name],
        brandColor: service.color,
        brandTextColor: globeInkColor(service.color),
        onPress: () => { void openGlobeService(service, ctx); },
      }));
      return { category, tiles };
    }).filter(row => row.tiles.length > 0);
  }, [ctx]);

  return (
    <View style={st.list}>
      <GetIntoTownRow destIata={destIata} />
      {rows.map(row => (
        <CategorySection key={row.category} title={categoryTitle(row.category)}>
          <BrandLogoTileRow tiles={row.tiles} mutedColor={mutedColor} />
          {row.category === 'hotels' ? hotelSlot : null}
        </CategorySection>
      ))}
    </View>
  );
}

export default function PostLandingAccordion({
  type,
  status,
  arrIso,
  destIata,
  destCity,
  destCountry,
  landingPhase,
  airlineIata,
  isPro,
  theme,
}: Props) {
  const copy = t();
  const code = String(destIata || '').trim().toUpperCase();
  const [mode, setMode] = useState<ServiceViewMode>('globe');

  const globeCtx = useMemo((): GlobeServiceCtx => {
    const tz = timezoneForIata(destIata, destCountry);
    const checkIn = flightBoardDate({ arrivalTime: arrIso }, tz);
    return {
      city: destCity,
      checkIn,
      checkOut: checkIn ? shiftDateKey(checkIn, 1) : undefined,
    };
  }, [arrIso, destCity, destCountry, destIata]);

  const showHotel = shouldShowHotelSearchCard({
    type, destIata, destCity, destCountry, arrIso, status, landingPhase,
  });
  const showLounge = !!isPro && !!code && (loungesFor(code).length > 0 || fastTrackFor(code).length > 0);

  const hotelLive = showHotel ? (
    <HotelSearchCard
      type={type}
      destIata={destIata}
      destCity={destCity}
      destCountry={destCountry}
      arrIso={arrIso}
      status={status}
      landingPhase={landingPhase}
      theme={theme}
      embedded
      liveOnly
      liveTitle={mode === 'globe' ? copy.needAHotel : undefined}
    />
  ) : null;

  const toggleMode = () => {
    const next: ServiceViewMode = mode === 'globe' ? 'list' : 'globe';
    setMode(next);
    void saveServiceViewMode(next);
  };

  const nextViewLabel = mode === 'globe' ? 'List view' : 'Globe view';
  const [tipVisible, setTipVisible] = useState(false);

  return (
    <View style={st.feed}>
      <View style={st.toolbar}>
        <View style={st.toggleWrap}>
          {tipVisible ? (
            <View style={st.tipBubble} pointerEvents="none">
              <Text style={st.tipTxt}>{nextViewLabel}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={toggleMode}
            onPressIn={() => setTipVisible(true)}
            onPressOut={() => setTipVisible(false)}
            accessibilityRole="button"
            accessibilityLabel={nextViewLabel}
            style={({ pressed }) => [st.toggle, pressed && st.togglePressed]}
          >
            {mode === 'globe' ? (
              <ListIcon size={16} color={TILE_GOLD} weight="bold" />
            ) : (
              <GlobeIcon size={16} color={TILE_GOLD} weight="bold" />
            )}
          </Pressable>
        </View>
      </View>

      {mode === 'globe' ? (
        <ServiceGlobe ctx={globeCtx} destIata={code} />
      ) : getGlobePage() === 2 ? (
        <LocalLifeList destIata={code} />
      ) : (
        <GlobeServiceList
          ctx={globeCtx}
          mutedColor={theme.muted}
          hotelSlot={hotelLive}
          destIata={code}
        />
      )}

      {mode === 'globe' ? hotelLive : null}

      {showLounge ? (
        <CategorySection title={copy.loungesTitle}>
          <LoungePanel
            iata={code}
            airlineIata={airlineIata}
            theme={theme}
            embedded
          />
        </CategorySection>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  feed: {
    gap: 8,
    marginTop: 8,
    backgroundColor: SECTION_BG,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: -8,
    backgroundColor: SECTION_BG,
  },
  toggleWrap: {
    position: 'relative',
  },
  tipBubble: {
    position: 'absolute',
    right: 34,
    top: 2,
    backgroundColor: 'rgba(10,22,40,0.92)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,168,76,0.45)',
  },
  tipTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePressed: {
    opacity: 0.72,
  },
  list: {
    gap: 24,
  },
  section: {
    gap: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: TILE_GOLD,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
});
