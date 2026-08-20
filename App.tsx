import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput, Modal, Share, Linking, Animated, Easing,
  ScrollView, ActivityIndicator, RefreshControl, Platform, KeyboardAvoidingView, Pressable,
  Dimensions, PanResponder, AppState, Alert, Keyboard, InteractionManager,
  type AppStateStatus, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import Svg, { Defs, Line, LinearGradient, Stop, Rect } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import {
  Airplane,
  AirplaneLanding,
  AirplaneTakeoff,
  ArrowRight,
  ArrowsClockwise,
  ArrowsLeftRight,
  Barcode,
  BellRinging,
  BellSimple,
  Briefcase,
  Car,
  CaretDown,
  CaretUp,
  Check,
  CheckCircle,
  Clock,
  CurrencyDollar,
  CurrencyEur,
  DoorOpen,
  Gear,
  Info,
  IconContext,
  Lightning,
  Lock,
  MagnifyingGlass,
  MapPin,
  Moon,
  ShareNetwork,
  SquaresFour,
  Stack,
  Star,
  Sun,
  Train,
  Trash,
  Warning,
  WarningCircle,
  WaveSawtooth,
  WifiSlash,
  X,
  XCircle,
  type Icon,
} from 'phosphor-react-native';
import { useState, useEffect, useRef, useCallback, useMemo, memo, Fragment, createContext, useContext, startTransition, type ReactNode, type RefObject } from 'react';
import { FlashList } from '@shopify/flash-list';
import RadarFlightSheet, { type RadarPick } from './RadarFlightSheet';
import PromoCard, {
  fidsIndexWithPromos,
  insertBoardPromos,
  isPromoItem,
  type PromoListItem,
} from './PromoBoardCard';
import { buildRadarHTML, RADAR_MAX_ZOOM } from './radarHtml';
import { countNear, fetchRadarNear, fetchRadarSnapshot, mergeAircraft, nearestWithin, readRadarCache, writeRadarCache, RADAR_KEEP_KM, type RadarAircraft } from './lib/radar';
import {
  GATE_CLOSE_BEFORE_DEP_MIN,
  boardingCountdownLabel,
  boardingPushCopy,
  departureBoardingAlertsEnabled,
  boardingTargetIso,
  boardingVisualPhase,
  flightCardBoarding,
  formatDurationMs,
  getBoardingPhase,
  isLastCall,
  isBoardingNowDisplay,
  boardingNowUrgentLabel,
  isStillOnGround,
  minutesUntilDeparture,
  minutesUntilGateClose,
  clockAdjustedStatus,
  flightHasLanded,
  liveBoardPhase,
  liveStatusLabel,
} from './boardingCountdown';
import {
  endLiveActivity,
  reconcileLiveActivities,
  startOrUpdateLiveActivity,
  syncAllLiveActivities,
  toFlightActivityProps,
} from './liveActivitySync';
import { buildFlightShareMessage } from './lib/flightQuickShare';
import { syncHomeScreenWidget } from './widgetSync';
import { initPurchases, checkProStatus, subscribeProStatus } from './lib/purchases';
import { saveLandedToHistory } from './lib/proStorage';
import ProPaywallScreen from './ProPaywallScreen';
import UpgradeLimitPrompt from './UpgradeLimitPrompt';
import SettingsScreen from './SettingsScreen';
import FlightHistorySection from './FlightHistorySection';
import FlightMemoryCard from './FlightMemoryCard';
import FlightPassportShare from './FlightPassportShare';
import PassportTabCover from './PassportTabCover';
import FlightStageTimeline from './FlightStageTimeline';
import AirportInfoCard from './AirportInfoCard';
import AircraftInfoCard from './AircraftInfoCard';
import LoungePanel from './LoungePanel';
import BoardingPassScanner from './BoardingPassScanner';
import { type BoardingPassInfo } from './lib/bcbp';
import GateBadge, { compactTerminal, formatGateLabel, gateUrgencyFor, hasRealGate } from './GateBadge';
import FlightStatusBadge, { statusBadgeToneFromPhase } from './FlightStatusBadge';
import RouteHero from './RouteHero';
import SmartSearchPanel, { parseRoutePair, type BoardFlightHit } from './SmartSearchPanel';
import FlightAutocomplete from './FlightAutocomplete';
import { AIRPORTS as LOCAL_AIRPORTS, searchAirportsLocal, type AirportRec } from './lib/airportsDb';
import { applySearchedFlightNumber, formatFlightNumber, identsMatch, slugFlightIdent } from './lib/flightIdent';
import { haptics } from './lib/haptics';
import WakeUpControl from './WakeUpControl';
import LuxuryInfoPanel from './LuxuryInfoPanel';
import HotelSearchCard from './HotelSearchCard';
import GetIntoTownCard from './GetIntoTownCard';
import ImmigrationTipCard from './ImmigrationTipCard';
import BookThisFlightButton from './BookThisFlightButton';
import FoodAfterLandingCard from './FoodAfterLandingCard';
import JetlagTipsCard from './JetlagTipsCard';
import RestaurantsCard from './RestaurantsCard';
import EarlyCheckInCard from './EarlyCheckInCard';
import QuickShareRow from './components/QuickShareRow';
import {
  openTransportOption,
  TRANSPORT_INFO,
  type TransportInfo,
  type TransportKind,
  type TransportOption,
} from './lib/transportBooking';
import CompensationBanner from './CompensationBanner';
import { eu261Claim, haversineKm, hasEu261Connection, delayMinutesFromTimes } from './lib/eu261';
import {
  buildNotificationData,
  COLD_START_NOTIFICATION_MS,
  parseNotificationData,
  type DetailFocusSection,
  type ParsedNotificationRoute,
} from './lib/notificationDeepLink';
import PickupModeCard from './PickupModeCard';
import PickupCountdownBanner from './PickupCountdownBanner';
import PickupPersonSheet from './PickupPersonSheet';
import PickupLiveScreen, { type PickupLiveData } from './PickupLiveScreen';
import UrgentBoardingOverlay, { type UrgentBoardingData } from './UrgentBoardingOverlay';
import LandedWeatherCard from './LandedWeatherCard';
import GateRaceScreen, { GateRaceBanner } from './GateRaceScreen';
import GateClosingBanner from './GateClosingBanner';
import LandedStampOverlay from './LandedStampOverlay';
import GateRaceConnectionCard from './components/GateRaceConnectionCard';
import FlyTogetherScreen, {
  JoinTogetherSheet,
  shareDataToTogetherFlight,
} from './FlyTogetherScreen';
import {
  createTogetherGroup,
  getActiveTogetherCode,
  getTogetherDeviceId,
  getTogetherDisplayName,
  parseTogetherCodeFromUrl,
  syncTogetherParticipant,
  togetherFlightFromTracked,
} from './lib/flyTogether';
import {
  findGateRacePair,
  gateRacePairForFlight,
  isIncomingLanded,
  notifyGateRaceDelayRisk,
  notifyGateRaceLanding,
  notifyGateRaceMissed,
  shouldNotifyGateRaceMissed,
  type GateRacePair,
} from './lib/gateRace';
import { arrivalExitHint, baggageWalkMinutes } from './lib/gateWalk';
import { getTerminalWalkTime, hasTerminalChange } from './lib/terminalWalkTimes';
import { cleanBaggageBelt, BAGGAGE_POLL_MS, needsBaggagePoll } from './lib/baggageBelt';
import DelayPredictionCard from './DelayPredictionCard';
import { airlineReliabilityDotColor, airlineReliabilitySnapshot } from './lib/delayHistory';
import ReliabilityDotPopup, { type ReliabilityPopupAnchor } from './ReliabilityDotPopup';
import MyNextFlightShare, { type NextFlightShareData } from './MyNextFlightShare';
import { parseWaiAirLink, type DeepLinkAction } from './lib/deepLinks';
import { registerQuickActions } from './lib/quickActions';
import {
  isPickupEnabled,
  notifyPickupGate,
  notifyPickupLanding,
  pickupAirportCoords,
  refreshPickupEta,
} from './lib/pickup';
import { landingCardPhase } from './lib/landingCards';
import {
  buildMinutesSinceLanding,
  sortVisibleCardSections,
  type FlightContext,
} from './lib/cardPriority';
import {
  loadCardPreferences,
  recordCardView,
} from './lib/cardPreferences';
import DetailCardSection from './DetailCardSection';
import AfterLandingCard, { type LandedWelcome } from './AfterLandingCard';
import {
  buildPassportEntry,
  loadPassportEntries,
  passportEntryToMemoryCard,
  savePassportEntry,
  PASSPORT_STORAGE_KEY,
  type MemoryCardData,
} from './lib/flightPassport';
import {
  fetchFxSnapshot,
  fetchWeatherSnapshot,
  localTimeSnapshot,
  taxiMinutes,
  timezoneForIata,
  walkMinutes,
} from './lib/destinationServices';
import { canCheckConnection, recordConnectionCheck, FREE_CONN_PER_DAY, loadLastConnectionResult, saveLastConnectionResult } from './lib/connectionQuota';
import { fetchJsonRetry } from './lib/net';
import { getArrivals, getDepartures, getFlightDetail } from './services/DataManager';
import { enrichAmsBoard, enrichFlightWithSchiphol, isAmsAirport } from './services/SchipholService';
import { setProOverride, isProUnlocked } from './services/SubscriptionManager';
import type { FAFlightDetail } from './services/FlightAwareService';
import {
  fidsPollIntervalMs,
  isLiveStale,
  shiftDateKey,
  formatDayShort,
  LIVE_ACTIVITY_TICK_MS,
} from './lib/boardFilter';
import { airportDateKey, isoInAirportTzToUtcMs, localDateKey } from './lib/localFlightTime';
import { knownTimeZone } from './lib/airportTz';
import {
  getPrefs,
  loadPrefs,
  savePrefs,
  subscribePrefs,
  clearFidsCaches,
  LAST_BOARD_DAY_KEY,
  type AppPrefs,
} from './lib/prefs';
import { t, flightStatusLabel, type Locale } from './lib/i18n';
import { loadRecentSearches, pushRecentSearch, removeRecentSearch, loadRecentAirports, pushRecentAirport } from './lib/recents';
import { groupAirportsByRegion } from './lib/airportRegions';
import { HighlightText } from './lib/highlight';
import {
  EMPTY_CLOCK,
  airportClockLabel,
  clocksAreSame,
  flightClockUtcMs,
  flightProgressPct,
  formatAirportClock,
  formatAirportClockLabeled,
  formatArrivesClockLabeled,
  offsetIso,
  resolveArrivalIso,
  resolveDepartureIso,
  typicalDurationMs,
} from './lib/flightTimes';
import {
  cleanQuery,
  emptySearchCopy,
  popularFromFlights,
  prettySearchLabel,
  resolveSearchAirport,
  searchFlights,
  type SearchableFlight,
} from './lib/smartSearch';
import { shouldShowUpgradePrompt, dismissUpgradePrompt } from './lib/upgradePrompt';
import { hasSentNotification, markSentNotification, notificationDedupeKey } from './lib/notificationDedupe';
import { runWhileAppActive, startLoopWhileActive } from './lib/appActivity';
import { registerTrackedBackgroundTask } from './lib/backgroundRefresh';
import { searchDuffelFlightsOrFallback } from './lib/duffel';
import { maybeRequestReview, recordAppOpen } from './lib/storeReview';
import OnboardingScreen, { type OnboardingAirport } from './OnboardingScreen';
import SkeletonCards from './SkeletonCards';
import RefreshOverlay from './RefreshOverlay';
import AirportHeroBackdrop from './AirportHeroBackdrop';
import LiveMapBackdrop from './LiveMapBackdrop';
import AirlineLogo, { AIRLINE_LOGO_SIZE } from './AirlineLogo';
import {
  THEMES,
  THEME_STORAGE_KEY,
  THEME_STORAGE_KEY_LEGACY,
  parseStoredTheme,
  isProTheme,
  juniorStatusLabel,
  type ThemeColors,
  type ThemeId,
} from './lib/themes';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

const BOARD_INITIAL_NUM_TO_RENDER = 8;
const BOARD_PAINT_COALESCE_MS = 500;
const BOARD_PAGE_SIZE = 50;
const BOARD_END_REACHED_THRESHOLD = 0.3;
const FIDS_PAST_HIDE_MS = 2 * 60 * 60 * 1000;
const FIDS_NOW_LEAD_MS = 30 * 60 * 1000;

type BoardListItem = Flight | PromoListItem;
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<BoardListItem>);

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
/** TestFlight beta: unlimited tracking, no paywall anywhere. */
const BETA_MODE = true;
const SHEET_COLLAPSED_PX = 0;
const TRACK_STORAGE_KEY = 'waiair.tracked.v1';
/** Explicit badge colors — never inherit from parent Text styles */
const BADGE_DARK = { backgroundColor:'#1a1d27', color:'#ffffff' } as const;
const BADGE_LIGHT = { backgroundColor:'#e2e8f0', color:'#0f1117' } as const;
const BADGE_ACTIVE_TXT = '#ffffff';

function badgePalette(mode:'light'|'dark'){
  return mode==='dark' ? BADGE_DARK : BADGE_LIGHT;
}
const PUSH_TOKEN_KEY = 'waiair.pushToken.v1';
const CONN_NOTIFIED_KEY = 'waiair.connNotified.v1';
const AIRPORT2_KEY = 'waiair.airport2.v1';
const SHARE_BASE = 'https://waiair.app/flight';
const FIDS_POLL_FREE_MS = 60 * 1000;
/** Fresh offline snapshot TTL — active boards must not serve data older than 60s as "live". */
const FIDS_CACHE_TTL_MS = 60 * 1000;
/** Absolute max age for true offline fallback (banner shows stale age). */
const FIDS_CACHE_STALE_MAX_MS = 3 * 60 * 60 * 1000;

async function checkForUpdate(){
  try{
    if(Platform.OS==='web' || !Updates.isEnabled) return;
    const update=await Updates.checkForUpdateAsync();
    if(update.isAvailable){
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch(e){
    if(__DEV__) console.warn('OTA check failed:', e);
  }
}

const BRAND = {
  navy: '#1A2F5A',
  gold: '#C9A84C',
  text: '#1C1917',
  gray: '#8896B0',
  cream: '#FAFAF8',
  deep: '#0A0F1E',
} as const;

const LIVE = {
  onTime: '#00C853',
  delayed: '#FFB300',
  cancelled: '#F87171',
  boarding: '#00C853',
  gateDep: '#FF8A00',
  gateArr: '#3b82f6',
  share: '#2563EB',
} as const;
const boardingHapticKeys = new Set<string>();
const lastCallHapticKeys = new Set<string>();

type ThemeMode = 'dark'|'light';

const cardShadow = Platform.select({
  ios: {
    shadowColor:'#0A0F1E',
    shadowOpacity:0.08,
    shadowRadius:16,
    shadowOffset:{ width:0, height:6 },
  },
  android: { elevation:3 },
  default: {
    shadowColor:'#0A0F1E',
    shadowOpacity:0.08,
    shadowRadius:16,
    shadowOffset:{ width:0, height:6 },
  },
}) as object;

/** Active palette — reassigned on theme change; styles rebuilt via applyTheme() */
let C:ThemeColors = THEMES.classic;
let themeMode:ThemeMode = 'dark';
let activeThemeId:ThemeId = 'classic';

function fs(n:number){
  return Math.round(n * (C.fontScale || 1));
}

type ThemeCtxValue = {
  themeId:ThemeId;
  mode:ThemeMode;
  C:ThemeColors;
  toggle:()=>void;
  setTheme:(id:ThemeId)=>void;
};
const ThemeCtx = createContext<ThemeCtxValue>({
  themeId:'classic', mode:'dark', C:THEMES.classic, toggle:()=>{}, setTheme:()=>{},
});
function useTheme(){ return useContext(ThemeCtx); }

type AppTab = 'arrival'|'departure'|'myflights';
type FidsTab = 'arrival'|'departure';
type StatusFilter = 'all'|'boarding'|'delayed'|'scheduled'|'landed'|'cancelled';

const STATUS_FILTER_TABS:{
  key:StatusFilter;
  Icon:Icon;
}[] = [
  { key:'all',       Icon:Stack },
  { key:'boarding',  Icon:DoorOpen },
  { key:'delayed',   Icon:Clock },
  { key:'scheduled', Icon:CheckCircle },
  { key:'landed',    Icon:AirplaneLanding },
  { key:'cancelled', Icon:XCircle },
];

function statusFilterLabel(key:StatusFilter):string{
  const copy=t();
  switch(key){
    case 'all': return copy.all;
    case 'boarding': return copy.boarding;
    case 'delayed': return copy.delayed;
    case 'scheduled': return copy.onTime;
    case 'landed': return copy.landed;
    case 'cancelled': return copy.cancelled;
  }
}

if(Platform.OS!=='web'){
  Notifications.setNotificationHandler({
    handleNotification: async()=>({
      shouldPlaySound:true,
      shouldSetBadge:false,
      shouldShowBanner:true,
      shouldShowList:true,
    }),
  });
}

type Airport = { iata:string; name:string; city:string; country:string; flag:string; lat:number; lon:number; distanceKm?:number };
type ApiAirport = { iata:string; name:string; municipality:string; country:string; lat:number; lon:number };

const NEAR_ME_AUTO_KM = 50;

function airportPickerQueryLabel(a: Airport): string {
  const name = String(a.name || a.city || a.iata).trim();
  return `${name} (${a.iata})`;
}

const FAV_STORAGE_KEY = 'favouriteAirports';
const FAV_STORAGE_KEY_LEGACY = 'waiair.favorites.v1';
const FAV_MAX = 5;
const FALLBACK_AIRPORT:Airport = {
  iata:'BKK', name:'Suvarnabhumi Airport', city:'Bangkok',
  country:'TH', flag:'🇹🇭', lat:13.6900, lon:100.7501,
};

const airportCache = new Map<string, Airport>([[FALLBACK_AIRPORT.iata, FALLBACK_AIRPORT]]);

function flagFromIso(iso:string):string{
  const c=(iso||'').toUpperCase();
  if(c.length!==2) return '·';
  return String.fromCodePoint(...[...c].map(ch=>0x1F1E6 + ch.charCodeAt(0) - 65));
}

for (const a of LOCAL_AIRPORTS) {
  if (airportCache.has(a.iata)) continue;
  airportCache.set(a.iata, {
    iata: a.iata,
    name: a.name,
    city: a.city,
    country: a.country,
    flag: flagFromIso(a.country),
    lat: a.lat,
    lon: a.lon,
  });
}

function fromApiAirport(a:Partial<ApiAirport> & { city?:string; flag?:string; distanceKm?:number }):Airport{
  const iata=String(a.iata||'').toUpperCase();
  const ap:Airport={
    iata,
    name:a.name||iata,
    city:a.municipality||a.city||'',
    country:String(a.country||'').toUpperCase(),
    flag:a.flag||flagFromIso(String(a.country||'')),
    lat:Number(a.lat)||0,
    lon:Number(a.lon)||0,
    distanceKm: typeof a.distanceKm==='number' ? a.distanceKm : undefined,
  };
  if(iata) airportCache.set(iata, ap);
  return ap;
}

function fromLocalAirportRec(a: AirportRec): Airport {
  return {
    iata: a.iata,
    name: a.name,
    city: a.city,
    country: a.country,
    flag: flagFromIso(a.country),
    lat: a.lat,
    lon: a.lon,
  };
}

async function searchAirports(q:string):Promise<Airport[]>{
  const trimmed=q.trim();
  const localHits=searchAirportsLocal(trimmed, 50).map(fromLocalAirportRec);
  try{
    const res=await fetch(`${PROXY}/airports/search?q=${encodeURIComponent(trimmed)}`);
    if(!res.ok) return localHits;
    const data=await res.json();
    const api=(Array.isArray(data)?data:[]).map(fromApiAirport);
    if(!api.length) return localHits;
    const seen=new Set(localHits.map(a=>a.iata));
    const merged=[...localHits];
    for(const a of api){
      if(seen.has(a.iata)) continue;
      seen.add(a.iata);
      merged.push(a);
    }
    return merged;
  } catch {
    return localHits;
  }
}

async function nearestAirportsApi(lat:number, lon:number):Promise<Airport[]>{
  const res=await fetch(`${PROXY}/airports/search/term/${lat},${lon}`);
  if(!res.ok){
    const fallback=await fetch(`${PROXY}/airports/nearest?lat=${lat}&lon=${lon}`);
    if(!fallback.ok) throw new Error('Nearest airports failed');
    const data=await fallback.json();
    return (Array.isArray(data)?data:[]).map(fromApiAirport);
  }
  const data=await res.json();
  return (Array.isArray(data)?data:[]).map(fromApiAirport);
}

async function loadFavorites():Promise<Airport[]>{
  try{
    let raw=await AsyncStorage.getItem(FAV_STORAGE_KEY);
    if(!raw){
      raw=await AsyncStorage.getItem(FAV_STORAGE_KEY_LEGACY);
      if(raw){
        await AsyncStorage.setItem(FAV_STORAGE_KEY, raw).catch(()=>{});
      }
    }
    if(!raw) return [];
    const list=JSON.parse(raw);
    if(!Array.isArray(list)) return [];
    return list.slice(0,FAV_MAX).map((a:any)=>fromApiAirport(a));
  } catch{ return []; }
}

async function saveFavorites(list:Airport[]){
  await AsyncStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(list.slice(0,FAV_MAX)));
}

function TransportOptionIcon({ kind, color }:{ kind:TransportKind; color:string }){
  const size = 18;
  if(kind==='rail' || kind==='bus') return <Train size={size} color={color}/>;
  if(kind==='taxi') return <Car size={size} color={BRAND.gray}/>;
  if(kind==='bolt') return <Lightning size={size} color={color}/>;
  return <Car size={size} color={color}/>;
}

function airportByIata(iata:string):Airport|undefined{
  return airportCache.get(iata.toUpperCase());
}

function hasGeo(lat?:number, lon?:number):boolean{
  return lat!=null && lon!=null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat===0 && lon===0);
}

function cacheAirportCoords(iata:string, lat?:number, lon?:number, extra?:Partial<Airport>){
  const code=String(iata||'').trim().toUpperCase();
  if(!code || !hasGeo(lat, lon)) return;
  const prev=airportCache.get(code);
  if(prev && hasGeo(prev.lat, prev.lon)) return;
  airportCache.set(code, {
    iata:code,
    name:extra?.name || prev?.name || code,
    city:extra?.city || prev?.city || '',
    country:extra?.country || prev?.country || '',
    flag:extra?.flag || prev?.flag || flagFromIso(extra?.country || prev?.country || ''),
    lat:lat!,
    lon:lon!,
    distanceKm:prev?.distanceKm,
  });
}

function pickAirportLatLon(ap:any):{lat?:number; lon?:number}{
  if(!ap||typeof ap!=='object') return {};
  const lat=Number(ap.location?.lat ?? ap.location?.latitude ?? ap.lat ?? ap.latitude);
  const lon=Number(ap.location?.lon ?? ap.location?.lng ?? ap.location?.longitude ?? ap.lon ?? ap.lng ?? ap.longitude);
  if(!hasGeo(lat, lon)) return {};
  return {lat, lon};
}

function coordsForIata(iata?:string, current?:Airport):{lat?:number; lon?:number}{
  const code=usableAirportCode(iata);
  if(!code) return {};
  const known=pickupAirportCoords(code);
  if(known) return known;
  const ap=airportByIata(code);
  if(ap && hasGeo(ap.lat, ap.lon)) return {lat:ap.lat, lon:ap.lon};
  if(current && usableAirportCode(current.iata)===code && hasGeo(current.lat, current.lon)){
    return {lat:current.lat, lon:current.lon};
  }
  const t=TRANSPORT_INFO[code];
  if(t) return {lat:t.lat, lon:t.lng};
  return {};
}

function durationHintMs(f:Flight, airport?:Airport):number|null{
  const dep=resolveDepartureIso(f);
  const knownArr=f.estimatedArrival || f.scheduledArrival
    || (f.boardSide === 'arrival' ? (f.revisedTime || f.scheduledTime) : '')
    || (f.arrivalTime && !clocksAreSame(dep, f.arrivalTime, f) ? f.arrivalTime : '');
  if(dep && knownArr){
    const a=flightClockUtcMs(dep, f.origin, f.originCountry);
    const b=flightClockUtcMs(knownArr, f.destination, f.destCountry);
    if(a!=null && b!=null && b>a+15*60*1000 && b-a<20*3600*1000) return b-a;
  }
  const o=coordsForIata(f.origin, airport);
  const d=coordsForIata(f.destination, airport);
  const typical=typicalDurationMs(o.lat, o.lon, d.lat, d.lon);
  if(typical) return typical;
  // Arrival FIDS often has no origin coords — still infer a block time so the dep clock can render.
  if(f.boardSide==='arrival' && (f.scheduledTime || f.scheduledArrival || f.estimatedArrival)){
    return 3 * 3600 * 1000;
  }
  return null;
}

async function ensureAirportCoords(iata?:string):Promise<void>{
  const code=usableAirportCode(iata);
  if(!code) return;
  if(hasGeo(coordsForIata(code).lat, coordsForIata(code).lon)) return;
  try{
    const hits=await searchAirports(code);
    const exact=hits.find(h=>h.iata===code) || hits[0];
    if(exact) cacheAirportCoords(exact.iata, exact.lat, exact.lon, exact);
  } catch{ /* ignore */ }
}

async function detectNearestAirport():Promise<Airport>{
  // Dev / no-GPS: always start at BKK (Bangkok Suvarnabhumi)
  if(__DEV__) return FALLBACK_AIRPORT;
  try{
    const { status }=await Location.requestForegroundPermissionsAsync();
    if(status!=='granted') return FALLBACK_AIRPORT;
    const last=await Location.getLastKnownPositionAsync();
    const current=last ?? await Promise.race([
      Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.Balanced }),
      new Promise<null>(resolve=>setTimeout(()=>resolve(null), 2500)),
    ]);
    const pos=current || last;
    if(!pos) return FALLBACK_AIRPORT;
    const nearest=await nearestAirportsApi(pos.coords.latitude, pos.coords.longitude);
    return nearest[0]||FALLBACK_AIRPORT;
  } catch{
    return FALLBACK_AIRPORT;
  }
}

/** Detect flight-number-like queries, e.g. TG205 / EK 373 / UO700 */
function isFlightNumberQuery(q:string):boolean{
  return /^[A-Z]{1,3}\s?\d{1,4}[A-Z]?$/i.test(q.trim());
}

/** Normalize user-entered flight number; null if invalid. */
function normalizeFlightNumberInput(q:string):string|null{
  const clean=String(q||'').replace(/\s+/g,'').toUpperCase();
  if(!isFlightNumberQuery(clean)) return null;
  return clean;
}

type FlightStatus = 'boarding'|'en-route'|'landed'|'delayed'|'scheduled'|'cancelled'|'unknown';

interface Flight {
  id:string; number:string; operatingNumber?:string; airline:string; airlineCode:string;
  origin:string; originCity:string; originCountry:string;
  destination:string; destCity:string; destCountry:string;
  scheduledTime:string; revisedTime:string; actualTime:string;
  arrivalTime:string; departureTime:string;
  scheduledDeparture?:string; scheduledArrival?:string;
  estimatedDeparture?:string; estimatedArrival?:string;
  actualDeparture?:string; actualArrival?:string;
  boardSide?: 'arrival' | 'departure' | 'both';
  gate:string; terminal:string; baggage:string; runway:string;
  arrTerminal:string; depTerminal:string;
  status:FlightStatus; delay:number; aircraft:string;
  aircraftReg:string; callSign:string; progress:number;
  premium?:boolean;
  lat?:number; lng?:number;
  altitudeFt?:number; speedKts?:number; headingDeg?:number;
}

const STATUS_CFG:Record<FlightStatus,{label:string;color:string;bg:string;desc:string;priority:number}> = {
  boarding:   {label:'Boarding Now', color:'#00C853', bg:'#052e16', desc:'Head to your gate now',    priority:0},
  'en-route': {label:'En Route',  color:'#3B82F6', bg:'#172554', desc:'Flight is in the air',     priority:1},
  scheduled:  {label:'Scheduled', color:'#8896B0', bg:'#0f172a', desc:'On time as planned',        priority:2},
  delayed:    {label:'Delayed',   color:'#F59E0B', bg:'#451a03', desc:'Departure pushed back',    priority:3},
  landed:     {label:'Landed',    color:'#22C55E', bg:'#052e16', desc:'Aircraft has arrived',      priority:4},
  unknown:    {label:'Unknown',   color:'#8896B0', bg:'#0f172a', desc:'Status unavailable',        priority:5},
  cancelled:  {label:'Cancelled', color:'#F87171', bg:'#7F1D1D', desc:'Flight has been cancelled',priority:6},
};

const TRANSPORT_ACCENT:Record<TransportKind, string> = {
  rail:'#3B82F6',
  grab:'#22C55E',
  bolt:'#22C55E',
  indrive:'#B4E04B',
  taxi:'#EAB308',
  bus:'#3B82F6',
};

/** Search aliases (EN + NL) → flight status */
const STATUS_SEARCH_ALIASES:Record<string, FlightStatus> = {
  boarding:'boarding', board:'boarding', boarden:'boarding', instappen:'boarding',
  delayed:'delayed', delay:'delayed', vertraagd:'delayed', vertraging:'delayed', late:'delayed',
  cancelled:'cancelled', canceled:'cancelled', cancel:'cancelled', geannuleerd:'cancelled', annulering:'cancelled',
  scheduled:'scheduled', schedule:'scheduled', gepland:'scheduled', ontime:'scheduled', 'on time':'scheduled',
  landed:'landed', land:'landed', geland:'landed', arrived:'landed', arrival:'landed', aangekomen:'landed',
  'en-route':'en-route', enroute:'en-route', 'en route':'en-route', airborne:'en-route', flying:'en-route',
  onderweg:'en-route', unknown:'unknown', onbekend:'unknown',
};

function statusMatchesQuery(status:FlightStatus, q:string):boolean{
  const needle=q.trim().toLowerCase().replace(/\s+/g,' ');
  if(!needle) return false;
  if(STATUS_SEARCH_ALIASES[needle]===status) return true;
  const compact=needle.replace(/[\s-]+/g,'');
  if(STATUS_SEARCH_ALIASES[compact]===status) return true;
  if(status===needle || status.replace(/-/g,'')===compact) return true;
  const label=(STATUS_CFG[status]?.label||'').toLowerCase();
  if(label && (label===needle || label.includes(needle))) return true;
  return false;
}

function countryFlag(code:string):string{
  if(!code||code.length!==2) return '';
  const b=0x1F1E6;
  return String.fromCodePoint(b+code.toUpperCase().charCodeAt(0)-65)+
         String.fromCodePoint(b+code.toUpperCase().charCodeAt(1)-65);
}

function fmt(iso:string, iata?:string, country?:string){
  if(!iso) return EMPTY_CLOCK;
  return formatAirportClock(iso, iata, getPrefs().timeFormat==='12h', country);
}

function fmtLabeled(iso:string, iata?:string, country?:string){
  if(!iso) return EMPTY_CLOCK;
  return formatAirportClockLabeled(iso, iata, getPrefs().timeFormat==='12h', country);
}

function fmtArrives(iso:string, iata?:string, country?:string){
  if(!iso) return EMPTY_CLOCK;
  return formatArrivesClockLabeled(iso, iata, getPrefs().timeFormat==='12h', country);
}

function fmtLocal(iso:string, iata?:string, _city?:string, _otherIata?:string, country?:string){
  return fmtLabeled(iso, iata, country);
}

function clockSuffix(_city?:string, iata?:string):string{
  return airportClockLabel('', iata);
}

function anyFlightClock(f:Flight, side:'departure'|'arrival', durationMs?:number|null):string{
  if(side==='departure') return resolveDepartureIso(f);
  return resolveArrivalIso(f, { durationMs });
}

function bestDisplayTime(f:Flight, type?:'arrival'|'departure', durationMs?:number|null):string{
  if(type==='arrival') return resolveArrivalIso(f, { durationMs });
  if(type==='departure') return resolveDepartureIso(f);
  return resolveDepartureIso(f) || resolveArrivalIso(f, { durationMs });
}

function HeroClock({
  iso, color, iata, country,
}:{
  iso:string;
  color:string;
  city?:string;
  iata?:string;
  otherIata?:string;
  country?:string;
  otherCountry?:string;
}){
  const clock=fmt(iso, iata, country);
  const suffix=clock===EMPTY_CLOCK ? '' : clockSuffix('', iata);
  return (
    <View style={{flex:1, minWidth:0}}>
      <Text
        style={[dc.heroTime, { color }]}
        numberOfLines={1}
        ellipsizeMode="clip"
        allowFontScaling={false}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >{clock}</Text>
      {suffix?(
        <Text
          style={dc.timeSuffix}
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling={false}
        >{suffix}</Text>
      ):null}
    </View>
  );
}

const STRIKE_TIME_COLOR = 'rgba(255, 80, 80, 1)';
const STRIKE_CARD_COLOR = 'rgba(136, 150, 176, 0.95)';

function StrikethroughTime({
  text,
  style,
  wrapStyle,
  strikeColor = STRIKE_TIME_COLOR,
}: {
  text?: string | null;
  style: StyleProp<TextStyle>;
  wrapStyle?: StyleProp<ViewStyle>;
  strikeColor?: string;
}) {
  const label = String(text ?? '').trim();
  if (!label) return null;
  return (
    <View style={[{ position: 'relative', alignSelf: 'flex-start', flexShrink: 1 }, wrapStyle]}>
      <Text
        style={style}
        allowFontScaling={false}
        numberOfLines={1}
        ellipsizeMode="tail"
      >{label}</Text>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 1,
          backgroundColor: strikeColor,
          transform: [{ translateY: -0.5 }],
        }}
      />
    </View>
  );
}

/** Normalize AeroDataBox time strings for Date / delay math. */
function normalizeAdbTime(raw:string):string{
  if(!raw) return '';
  return String(raw).trim().replace(' ','T');
}

/**
 * Extract a usable time string from AeroDataBox FIDS / status payloads.
 * Real FIDS shape: movement.scheduledTime.{local|utc}  e.g. "2026-08-12 13:25+02:00"
 * Also accepts rarer scheduledTimeLocal / dateLocal+timeLocal variants if present.
 */
function extractAdbTime(...candidates:any[]):string{
  for(const c of candidates){
    if(!c) continue;
    if(typeof c==='string' && c.trim()) return normalizeAdbTime(c);
    if(typeof c==='object'){
      if(c.dateLocal && c.timeLocal){
        return normalizeAdbTime(`${c.dateLocal} ${c.timeLocal}`);
      }
      const local=c.local??c.dateLocal??c.timeLocal??'';
      if(typeof local==='string' && local.trim()) return normalizeAdbTime(local);
      const utc=c.utc??'';
      if(typeof utc==='string' && utc.trim()) return normalizeAdbTime(utc);
      // AeroDataBox / proxies: { scheduled: { local, utc } } or departure.scheduled
      for(const nested of [c.scheduledTime, c.scheduled, c.revisedTime, c.revised]){
        if(!nested || nested===c) continue;
        const inner=extractAdbTime(nested);
        if(inner) return inner;
      }
    }
  }
  return '';
}

/** Prefer IATA; ignore AeroDataBox placeholder { name: "Unknown" }. */
function extractAdbAirport(ap:any):{ code:string; city:string; country:string }{
  if(!ap||typeof ap!=='object') return { code:'', city:'', country:'' };
  const code=pickAirportCode(ap);
  const city=pickAirportCity(ap, code);
  const country=pickAirportCountry(ap, code);
  return { code, city, country };
}

/**
 * Codeshares often arrive as { airport: { name: "Unknown" } }.
 * Fill from a sibling flight with the same scheduled UTC + gate + aircraft.
 */
function enrichFidsRemoteAirports(items:any[]):void{
  const keyOf=(d:any):string=>{
    const mov=d?.movement??{};
    const ac=d?.aircraft??{};
    const t=mov.scheduledTime?.utc||mov.scheduledTime?.local||'';
    return `${t}|${mov.gate||''}|${ac.reg||ac.model||''}`;
  };
  const bestByKey=new Map<string, any>();
  for(const d of items){
    const ap=d?.movement?.airport;
    if(!pickAirportCode(ap)) continue;
    const k=keyOf(d);
    if(!bestByKey.has(k)) bestByKey.set(k, ap);
  }
  for(const d of items){
    const ap=d?.movement?.airport;
    if(!ap) continue;
    if(pickAirportCode(ap)) continue;
    const donor=bestByKey.get(keyOf(d));
    if(donor) d.movement.airport={ ...donor };
  }
}

function fmtDate(iso:string, iata?:string, country?:string){
  return fmtDateLong(iso, iata, country);
}

function countdown(iso:string, iata?:string, country?:string){
  if(!iso) return null;
  const ms=flightClockUtcMs(iso, iata, country);
  if(ms==null) return null;
  const diff=Math.floor((ms-Date.now())/60000);
  if(diff<=0) return null;
  if(diff<60) return `${diff}m`;
  return `${Math.floor(diff/60)}h ${diff%60}m`;
}

function fmtDateLong(iso:string, iata?:string, country?:string){
  if(!iso) return '';
  try{
    const ms=flightClockUtcMs(iso, iata, country);
    if(ms==null) return '';
    const code=usableAirportCode(iata);
    const tz=code ? timezoneForIata(code, country) : null;
    if(tz){
      const key=localDateKey(new Date(ms), tz);
      const todayKey=airportDateKey(code, country);
      const tomKey=shiftDateKey(todayKey, 1);
      const yestKey=shiftDateKey(todayKey, -1);
      if(key===todayKey) return t().today;
      if(key===tomKey) return t().tomorrow;
      if(key===yestKey) return t().yesterday;
      try{
        return new Date(ms).toLocaleDateString('en-GB',{
          timeZone: tz, weekday:'short', day:'numeric', month:'short',
        });
      } catch{ /* fall through */ }
    }
    const d=new Date(ms);
    if(Number.isNaN(d.getTime())) return '';
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today=new Date();
    const todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const tom=new Date(today.getFullYear(), today.getMonth(), today.getDate()+1);
    const tomKey=`${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`;
    const yest=new Date(today.getFullYear(), today.getMonth(), today.getDate()-1);
    const yestKey=`${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`;
    if(key===todayKey) return t().today;
    if(key===tomKey) return t().tomorrow;
    if(key===yestKey) return t().yesterday;
    return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  } catch{ return ''; }
}

function gateCloseIso(f:Flight):string{
  const iso=boardingTargetIso(f);
  if(!iso) return '';
  const t=isoInAirportTzToUtcMs(iso, f.origin, f.originCountry);
  if(t==null) return '';
  return new Date(t - GATE_CLOSE_BEFORE_DEP_MIN*60*1000).toISOString();
}

function airportTitle(iata:string, fallback:string){
  const code=usableAirportCode(iata);
  const ap=code?airportByIata(code):undefined;
  const city=cleanAirportName(ap?.city || fallback || '');
  if(city && city!=='—' && city.toLowerCase()!=='unknown') return city;
  return code;
}

function sinceTime(iso:string){
  if(!iso) return null;
  const diff=Math.floor((Date.now()-new Date(iso).getTime())/60000);
  if(diff<0||diff>600) return null;
  if(diff<60) return `${diff}m ago`;
  return `${Math.floor(diff/60)}h ${diff%60}m ago`;
}

/** Pulsing boarding banner — green / orange / last-call red. */
function BoardingNowBanner({f, compact, role}:{f:Flight; compact?:boolean; role?:'arrival'|'departure'}){
  const [, setTick]=useState(0);
  const pulse=useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    return runWhileAppActive(()=>{
      const id=setInterval(()=>setTick(t=>t+1),1000);
      return ()=>clearInterval(id);
    });
  },[]);

  const card=flightCardBoarding(f, Date.now(), role);
  useEffect(()=>{
    if(!card.boarding){
      pulse.setValue(1);
      return;
    }
    pulse.setValue(1);
    const half=Math.max(120, Math.round(card.pulseMs/2));
    return startLoopWhileActive(()=>
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse,{toValue:card.pulseTo,duration:half,useNativeDriver:true}),
          Animated.timing(pulse,{toValue:1,duration:half,useNativeDriver:true}),
        ]),
      ),
    );
  },[card.boarding, card.phase, card.pulseMs, card.pulseTo, pulse]);

  if(!card.boarding) return null;
  const label=card.urgent ? boardingNowUrgentLabel(f) : card.label;

  return (
    <View
      style={[
        compact?dc.boardNowCompact:dc.boardNow,
        {
          backgroundColor: card.color+'24',
          borderColor: card.color,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={label}
    >
      <Animated.View style={[fr.liveDot,{ backgroundColor:card.color, opacity:pulse, marginRight:8 }]}/>
      <Text
        style={[compact?dc.boardNowTxtSm:dc.boardNowTxt, { color: card.color, flexShrink: 0 }]}
      >{label}</Text>
    </View>
  );
}


// Parse AeroDataBox ICAO FIDS item (departures[] / arrivals[] entries)
function parseFIDS(raw:any, type:'arrival'|'departure', localIata=''):Flight{
  // FIDS items are flat: { movement, number, status, airline, aircraft }
  // (not nested under departure/arrival — that shape is /flights/number only)
  const mov=raw.movement??raw.departure?.movement??raw.arrival?.movement??{};
  const ap=mov.airport??raw.departure?.airport??raw.arrival?.airport??raw.airport??{};

  const sched=extractAdbTime(
    mov.scheduledTime,
    mov.scheduled,
    mov.scheduledTimeLocal,
    raw.scheduledTime,
    raw.scheduled,
    raw.scheduledTimeLocal,
  );
  // Prefer revised over predicted — predicted alone caused stale +349m delays
  const revisedOnly=extractAdbTime(mov.revisedTime, mov.revisedTimeLocal);
  const predicted=extractAdbTime(mov.predictedTime, mov.predictedTimeLocal);
  const revised=revisedOnly||predicted||sched;
  const actual=extractAdbTime(
    mov.runwayTime,
    mov.actualTime,
    mov.actualTimeLocal,
  );

  const rawSt=String(raw.status??'').toLowerCase();
  const delayMin=computeDelayMin(sched, actual, revisedOnly||predicted||'');
  const status=mapRawStatus(rawSt, delayMin);

  const remote=extractAdbAirport(ap);
  const depAp=extractAdbAirport(raw.departure?.airport);
  const arrAp=extractAdbAirport(raw.arrival?.airport);
  const remoteLoc=pickAirportLatLon(ap);
  if(remote.code) cacheAirportCoords(remote.code, remoteLoc.lat, remoteLoc.lon, {city:remote.city, country:remote.country});
  const depLoc=pickAirportLatLon(raw.departure?.airport);
  if(depAp.code) cacheAirportCoords(depAp.code, depLoc.lat, depLoc.lon, {city:depAp.city, country:depAp.country});
  const arrLoc=pickAirportLatLon(raw.arrival?.airport);
  if(arrAp.code) cacheAirportCoords(arrAp.code, arrLoc.lat, arrLoc.lon, {city:arrAp.city, country:arrAp.country});
  const local=usableAirportCode(localIata);
  const airline=raw.airline??{};
  const gateRaw = raw.movement?.gate ?? null;
  const best=actual||revised||sched;
  const arrExtract=extractAdbTime(
    raw.arrival?.movement?.revisedTime,
    raw.arrival?.movement?.predictedTime,
    raw.arrival?.movement?.scheduledTime,
    raw.arrival?.movement?.scheduled,
    raw.arrival?.scheduledTime,
    raw.arrival?.scheduled,
  );
  const depExtract=extractAdbTime(
    raw.departure?.movement?.revisedTime,
    raw.departure?.movement?.predictedTime,
    raw.departure?.movement?.scheduledTime,
    raw.departure?.movement?.scheduled,
    raw.departure?.scheduledTime,
    raw.departure?.scheduled,
  );
  const arrActual=type==='arrival'?actual:extractAdbTime(raw.arrival?.movement?.runwayTime, raw.arrival?.movement?.actualTime);
  const depActual=type==='departure'?actual:extractAdbTime(raw.departure?.movement?.runwayTime, raw.departure?.movement?.actualTime);
  const scheduledDeparture=type==='departure'?sched:extractAdbTime(
    raw.departure?.movement?.scheduledTime, raw.departure?.movement?.scheduled,
    raw.departure?.scheduledTime, raw.departure?.scheduled,
  );
  const scheduledArrival=type==='arrival'?sched:extractAdbTime(
    raw.arrival?.movement?.scheduledTime, raw.arrival?.movement?.scheduled,
    raw.arrival?.scheduledTime, raw.arrival?.scheduled,
  );
  const estimatedDeparture=type==='departure'?(revisedOnly||predicted||''):extractAdbTime(raw.departure?.movement?.revisedTime, raw.departure?.movement?.predictedTime);
  const estimatedArrival=type==='arrival'?(revisedOnly||predicted||''):extractAdbTime(raw.arrival?.movement?.revisedTime, raw.arrival?.movement?.predictedTime);

  const depCode=usableAirportCode(depAp.code);
  const arrCode=usableAirportCode(arrAp.code);
  const otherCode=usableAirportCode(remote.code)
    || (type==='arrival' ? depCode : arrCode);
  const otherCity=remote.city
    || (type==='arrival' ? depAp.city : arrAp.city)
    || '';
  const otherCountry=remote.country
    || (type==='arrival' ? depAp.country : arrAp.country)
    || '';
  const otherIsLocal=!!local && otherCode===local;

  let origin='';
  let dest='';
  let originCity='';
  let destCity='';
  let originCountry='';
  let destCountry='';
  if(type==='arrival'){
    dest=local;
    origin=(!otherIsLocal && otherCode) ? otherCode : (depCode && depCode!==local ? depCode : '');
    originCity=origin?otherCity:'';
    originCountry=origin?otherCountry:'';
  } else {
    origin=local;
    dest=(!otherIsLocal && otherCode) ? otherCode : (arrCode && arrCode!==local ? arrCode : '');
    destCity=dest?otherCity:'';
    destCountry=dest?otherCountry:'';
  }
  if(origin && dest && origin===dest){
    if(type==='arrival') origin='';
    else dest='';
  }

  const flight:Flight={
    id:          String(raw.number??Math.random()),
    number:      raw.number??'—',
    airline:     airline.name||airline.iata||'—',
    airlineCode: airline.iata||'—',
    origin,
    originCity,
    originCountry,
    destination: dest,
    destCity,
    destCountry,
    scheduledTime:sched,
    revisedTime:  revised,
    actualTime:   actual,
    arrivalTime:  type==='arrival'? best : arrExtract,
    departureTime:type==='departure'? best : depExtract,
    scheduledDeparture,
    scheduledArrival,
    estimatedDeparture,
    estimatedArrival,
    actualDeparture: depActual,
    actualArrival: arrActual,
    boardSide: type,
    gate:         gateRaw != null && gateRaw !== '' ? String(gateRaw) : '',
    terminal:     mov.terminal??'',
    baggage:      cleanBaggageBelt(mov.baggage??mov.baggageBelt??''),
    runway:       mov.runway??'',
    arrTerminal:  type==='arrival'?(mov.terminal??''):'',
    depTerminal:  type==='departure'?(mov.terminal??''):'',
    status,
    delay:        delayMin,
    aircraft:     raw.aircraft?.model??'',
    aircraftReg:  raw.aircraft?.reg??'',
    callSign:     raw.callSign??'',
    progress:     status==='landed'||actual?1.0:status==='en-route'?0.5:0,
  };
  return applyClockStatus(flight, type);
}


// Demo data
const DEMO:Flight[]=(()=>{
  const n=Date.now();
  const mk=(id:string,num:string,al:string,ac:string,org:string,oc:string,cc:string,dep:number,gate:string,term:string,st:FlightStatus,delay:number,acft:string,reg:string):Flight=>{
    const sched=new Date(n+dep*60000).toISOString();
    const revised=new Date(n+(dep+delay)*60000).toISOString();
    const actual=dep<-10?new Date(n+dep*60000).toISOString():'';
    return {
      id,number:num,airline:al,airlineCode:ac,
      origin:org,originCity:oc,originCountry:cc,
      destination:'BKK',destCity:'Bangkok',destCountry:'th',
      scheduledTime:sched, revisedTime:revised, actualTime:actual,
      arrivalTime:actual||revised,
      departureTime:new Date(n+(dep-180)*60000).toISOString(),
      scheduledArrival:sched,
      estimatedArrival:revised,
      actualArrival:actual,
      scheduledDeparture:new Date(n+(dep-180)*60000).toISOString(),
      boardSide:'arrival',
      gate,terminal:term,baggage:dep<-10?'5':'',runway:'19R',
      arrTerminal:term, depTerminal:'',
      status:st,delay,aircraft:acft,aircraftReg:reg,
      callSign:ac+num.replace(/\D/g,''),progress:dep<-30?1:dep<0?0.6:0,
    };
  };
  return [
    mk('1','EK373','Emirates','EK','DXB','Dubai','ae',10,'B04','1','boarding',0,'Airbus A380-800','A6-END'),
    mk('2','TG937','Thai Airways','TG','AMS','Amsterdam','nl',-82,'C05','1','landed',82,'Airbus A350-941','HS-THJ'),
    mk('3','QR836','Qatar Airways','QR','DOH','Doha','qa',60,'C07','2','delayed',35,'Boeing 787-9','A7-BHV'),
    mk('4','SQ972','Singapore Air','SQ','SIN','Singapore','sg',90,'A03','1','en-route',0,'Airbus A350-900','9V-SMK'),
    mk('5','CX751','Cathay Pacific','CX','HKG','Hong Kong','hk',130,'B11','1','scheduled',0,'Airbus A359','B-LRC'),
    mk('6','TK069','Turkish Airlines','TK','IST','Istanbul','tr',160,'','1','scheduled',0,'Boeing 777-300ER','TC-LJA'),
    mk('7','MH782','Malaysia Airlines','MH','KUL','Kuala Lumpur','my',95,'D05','2','cancelled',0,'Airbus A330-300','9M-MTK'),
    mk('8','VN602','Vietnam Airlines','VN','SGN','Ho Chi Minh','vn',200,'E01','1','scheduled',0,'Airbus A321','VN-A356'),
    mk('9','GA867','Garuda Indonesia','GA','CGK','Jakarta','id',240,'F03','2','scheduled',0,'Boeing 737-800','PK-GMR'),
    mk('10','FD233','Thai AirAsia','FD','CNX','Chiang Mai','th',270,'D02','2','scheduled',0,'Airbus A320','HS-ABK'),
  ];
})();

function cleanAirportName(name:string):string{
  const raw=(name??'').replace(/\s+International\b/gi,'').replace(/\s+Airport\b/gi,'').trim();
  if(/schiphol/i.test(raw)) return 'Schiphol';
  return raw;
}

/** Best available airport code from AeroDataBox airport object (never invent ??? / UNK). */
function pickAirportCode(ap:any):string{
  if(!ap||typeof ap!=='object') return '';
  const iata=usableAirportCode(ap.iata||ap.iataCode||ap.localCode||'');
  if(iata.length===3) return iata;
  const icao=String(ap.icao||ap.icaoCode||'').trim().toUpperCase();
  if(icao.length===4 && icao!=='UNKN') return icao;
  return '';
}

/** City/airport label from API fields; falls back to local mapping when present. */
function pickAirportCity(ap:any, code?:string):string{
  const fromApi=cleanAirportName(
    ap?.municipalityName||ap?.shortName||ap?.name||''
  );
  // AeroDataBox often returns { name: "Unknown" } with no IATA for codeshares
  if(fromApi && fromApi.toLowerCase()!=='unknown') return fromApi;
  const local=code?airportByIata(code):undefined;
  return local?.city||local?.name||code||'';
}

function pickAirportCountry(ap:any, code?:string):string{
  const fromApi=(ap?.countryCode||'').toString().trim();
  if(fromApi) return fromApi;
  const local=code?airportByIata(code):undefined;
  return local?.country||'';
}

/** Prefer local city/flag when IATA is known; otherwise keep API values. */
function displayAirport(code:string, city:string, country:string){
  const clean=usableAirportCode(code);
  const local=clean?airportByIata(clean):undefined;
  const cityName=cleanAirportName(local?.city||city||'');
  const unknown=!cityName || cityName==='—' || cityName.toLowerCase()==='unknown';
  return {
    code: clean,
    city: unknown ? (clean||'') : cityName,
    flag: local?.flag||countryFlag(country)||'',
  };
}

function usableAirportCode(code?:string):string{
  const c=String(code||'').trim().toUpperCase();
  if(!c || c==='—' || c==='-' || c==='–' || c==='???' || c==='UNK' || c==='NULL' || c==='UNKNOWN' || c==='N/A' || c==='NA') return '';
  return c;
}

function formatCardRoute(origin?:string, dest?:string):string{
  const o=usableAirportCode(origin);
  const d=usableAirportCode(dest);
  if(!o && !d) return '';
  if(o && d && o===d) return `???  →  ${d}`;
  return `${o || '???'}  →  ${d || '???'}`;
}

function startDuffelSearch(origin?: string, dest?: string, iso?: string) {
  const o = usableAirportCode(origin);
  const d = usableAirportCode(dest);
  const date = String(iso || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!o || !d || !date) return;
  void searchDuffelFlightsOrFallback(o, d, date, 1);
}

function routePlaceLabel(city?:string, code?:string):string{
  const name=cleanAirportName(city||'');
  if(name && name!=='—' && name!=='-' && name!=='–' && name.toLowerCase()!=='unknown') return name;
  return usableAirportCode(code);
}

function airportShortLabel(ap:Airport):string{
  if(/schiphol/i.test(`${ap.name} ${ap.city}`)) return `${ap.iata} · Amsterdam`;
  const city=(ap.city || cleanAirportName(ap.name) || '').trim();
  if(city && city.toUpperCase()!==ap.iata) return `${ap.iata} · ${city}`;
  return ap.iata;
}

/**
 * Map AeroDataBox status → app status.
 * Never overwrite terminal/in-air states with "delayed" — delay is a pre-departure concept.
 */
function mapRawStatus(rawSt:string, delayMin:number):FlightStatus{
  const s=String(rawSt||'').toLowerCase().trim();
  if(s==='arrived'||s==='landed') return 'landed';
  if(s==='canceled'||s==='cancelled') return 'cancelled';
  if(s==='departed'||s==='en-route'||s==='enroute'||s==='airborne'||s==='in air'||s==='in-air'){
    return 'en-route';
  }
  if(s.includes('board')
    || s.includes('gate open')
    || s.includes('gate closed')
    || s.includes('go to gate')
    || s.includes('gotogate')
    || s.includes('final call')
    || s.includes('last call')
    || s.includes('final boarding')
    || s.includes('departing')){
    return 'boarding';
  }
  if(s==='delayed') return 'delayed';
  if(s==='expected'||s==='scheduled'||s==='on time'||s==='ontime'||!s){
    return delayMin>5 ? 'delayed' : 'scheduled';
  }
  // Unknown raw label: only mark delayed while still pre-departure
  if(s && s!=='scheduled' && s!=='on time'){
    console.warn('[Status] unmapped:', s);
  }
  return delayMin>5 ? 'delayed' : 'scheduled';
}

function adbSideTime(side:any, ...keys:string[]):string{
  if(!side||typeof side!=='object') return '';
  for(const k of keys){
    const v=side[k];
    const t=extractAdbTime(v);
    if(t) return t;
  }
  return '';
}

/** Delay minutes from scheduled → best known actual/revised (never arrival-predicted vs dep-sched). */
function computeDelayMin(scheduled:string, actual:string, revised:string):number{
  const schedMs=scheduled?new Date(normalizeAdbTime(scheduled)).getTime():0;
  if(!schedMs||!Number.isFinite(schedMs)) return 0;
  const basis=actual||revised;
  const basisMs=basis?new Date(normalizeAdbTime(basis)).getTime():0;
  if(!basisMs||!Number.isFinite(basisMs)) return 0;
  return Math.max(0, Math.round((basisMs-schedMs)/60000));
}

function mapFaStatus(s:string):FlightStatus{
  const x=String(s||'').toLowerCase();
  if(x.includes('cancel')) return 'cancelled';
  if(x.includes('divert')) return 'delayed';
  if(x.includes('land') || x.includes('arriv')) return 'landed';
  if(x.includes('taxi') || x.includes('board')) return 'boarding';
  if(x.includes('en route') || x.includes('active') || x.includes('air')) return 'en-route';
  if(x.includes('delay')) return 'delayed';
  return 'scheduled';
}

function faDetailToFlight(d:FAFlightDetail, base?:Flight):Flight{
  const status=mapFaStatus(d.status);
  const depGate=d.departureGate||'';
  const arrGate=d.arrivalGate||'';
  const delay=computeDelayMin(d.scheduledDeparture, d.actualDeparture, d.estimatedDeparture);
  const rawProgress=Number(d.progress)||0;
  const progress=rawProgress>1 ? Math.min(1, rawProgress/100) : rawProgress;
  const flight:Flight={
    id: base?.id || `${d.flightNumber}-${d.scheduledDeparture||Date.now()}`,
    number: d.flightNumber || base?.number || '—',
    airline: d.airline || base?.airline || '—',
    airlineCode: base?.airlineCode || String(d.flightNumber||'').replace(/[^A-Z]/g,'').slice(0,3) || '—',
    origin: d.departure || base?.origin || '',
    originCity: base?.originCity || d.departure || '',
    originCountry: base?.originCountry || '',
    destination: d.destination || base?.destination || '',
    destCity: base?.destCity || d.destination || '',
    destCountry: base?.destCountry || '',
    scheduledTime: d.scheduledDeparture || base?.scheduledTime || '',
    revisedTime: d.estimatedDeparture || base?.revisedTime || '',
    actualTime: d.actualDeparture || base?.actualTime || '',
    departureTime: d.actualDeparture || d.estimatedDeparture || d.scheduledDeparture || base?.departureTime || '',
    arrivalTime: d.actualArrival || d.estimatedArrival || d.scheduledArrival || base?.arrivalTime || '',
    scheduledDeparture: d.scheduledDeparture || '',
    scheduledArrival: d.scheduledArrival || '',
    estimatedDeparture: d.estimatedDeparture || '',
    estimatedArrival: d.estimatedArrival || '',
    actualDeparture: d.actualDeparture || '',
    actualArrival: d.actualArrival || '',
    boardSide: 'both',
    gate: depGate || arrGate || base?.gate || '',
    terminal: d.departureTerminal || d.arrivalTerminal || base?.terminal || '',
    baggage: d.baggageBelt || base?.baggage || '',
    runway: base?.runway || '',
    arrTerminal: d.arrivalTerminal || base?.arrTerminal || '',
    depTerminal: d.departureTerminal || base?.depTerminal || '',
    status,
    delay: delay || d.delay || base?.delay || 0,
    aircraft: d.aircraft || base?.aircraft || '',
    aircraftReg: d.registration || base?.aircraftReg || '',
    callSign: base?.callSign || '',
    progress: progress || base?.progress || 0,
    premium: true,
    lat: d.lat ?? undefined,
    lng: d.lng ?? undefined,
    altitudeFt: d.altitude ?? undefined,
    speedKts: d.speed ?? undefined,
    headingDeg: d.heading ?? undefined,
  };
  return applyClockStatus(flight, 'departure');
}

const RATE_LIMIT_MSG='Too many requests — please wait a moment and try again';

function sleep(ms:number){
  return new Promise<void>(r=>setTimeout(r, ms));
}

async function fetchProxyJson(url:string, _debugLabel=''):Promise<any>{
  return fetchJsonRetry(url, 8000);
}

function applyClockStatus(f:Flight, role?:'arrival'|'departure'):Flight{
  const side=role || (f.boardSide==='arrival' ? 'arrival' : 'departure');
  const next=clockAdjustedStatus(f.status, f, Date.now(), side);
  if(next===f.status) return f;
  return {
    ...f,
    status: next as FlightStatus,
    progress: next==='en-route' ? Math.max(f.progress||0, 0.15) : f.progress,
  };
}

function stampBoardRoute(f:Flight, type:'arrival'|'departure', iata:string):Flight{
  const known=airportByIata(iata);
  const stub:Airport=known||{ iata:String(iata||'').toUpperCase(), name:'', city:'', country:'', flag:'', lat:0, lon:0 };
  const r=resolveRoute(f, type, stub);
  const stamped:Flight={
    ...f,
    origin:r.origin,
    originCity:r.originCity||f.originCity,
    destination:r.destination,
    destCity:r.destCity||f.destCity,
    boardSide: f.boardSide || type,
  };
  const next=clockAdjustedStatus(stamped.status, stamped, Date.now(), type);
  return next===stamped.status ? stamped : { ...stamped, status: next as FlightStatus };
}

/** Flight-number or airport/city search — list is not the selected hub board. */
function isGlobalBoardSearch(raw:string):boolean{
  const q=String(raw||'').trim();
  if(!q) return false;
  return isFlightNumberQuery(q) || !!resolveSearchAirport(q);
}

/** Arrives/Departs for a searched airport (CDG), using boardSide then route. */
function flightMatchesPlaceTab(f:Flight, tab:'arrival'|'departure', placeIata:string):boolean{
  const code=String(placeIata||'').toUpperCase();
  if(!code) return true;
  const side=f.boardSide;
  if(tab==='departure'){
    if(side==='departure' || side==='both') return true;
    if(side==='arrival') return false;
    return String(f.origin||'').toUpperCase()===code;
  }
  if(side==='arrival' || side==='both') return true;
  if(side==='departure') return false;
  return String(f.destination||'').toUpperCase()===code;
}

async function fetchFIDS(iata:string, type:'arrival'|'departure', offsetDays=0, destIata?:string):Promise<{ flights:Flight[]; source:'live'|'cached' }>{
  const cc=airportCache.get(iata)?.country;
  const date=offsetDays ? shiftDateKey(airportDateKey(iata, cc), offsetDays) : undefined;
  const bundle = type==='arrival'
    ? await getArrivals(iata, offsetDays, date)
    : await getDepartures(iata, offsetDays, date, destIata);
  const items = Array.isArray(bundle.data) ? bundle.data : [];
  if(bundle.normalized){
    return { flights: (items as Flight[]).map(f=>stampBoardRoute(f, type, iata)), source: bundle.source };
  }
  if(!items.length) return { flights: [], source: bundle.source };
  enrichFidsRemoteAirports(items);
  let flights=items.map((i:any) => stampBoardRoute(parseFIDS(i, type, iata), type, iata));
  const dest=usableAirportCode(destIata);
  if(dest) flights=flights.filter(f=>usableAirportCode(f.destination)===dest);
  if(isAmsAirport(iata)){
    flights=await enrichAmsBoard(flights, type, date);
  }
  return { flights, source: bundle.source };
}

function trackedArrivalIata(t: TrackedFlight): string {
  const dest=usableAirportCode(t.flight?.destination);
  if(dest) return dest;
  return t.type==='arrival'?usableAirportCode(t.airportIata):'';
}

async function enrichBaggageFromFids(flight:Flight, destIata:string):Promise<Flight>{
  if(cleanBaggageBelt(flight.baggage)) return flight;
  const iata=usableAirportCode(destIata);
  if(!iata) return flight;
  if(isAmsAirport(iata) || isAmsAirport(flight.destination)){
    const next=await enrichFlightWithSchiphol({ ...flight, destination: iata || flight.destination });
    if(cleanBaggageBelt(next.baggage)) return next;
  }
  try{
    const { flights }=await fetchFIDS(iata,'arrival');
    const slug=flightSlug(flight.number);
    const hit=flights.find(f=>identsMatch(f.number, slug) || identsMatch(f.operatingNumber, slug));
    const belt=cleanBaggageBelt(hit?.baggage);
    if(belt) return { ...flight, baggage:belt };
  } catch{ /* optional FIDS fallback */ }
  return flight;
}

function bestSideTime(side:any):string{
  return adbSideTime(side, 'runwayTime', 'actualTime', 'revisedTime', 'predictedTime', 'scheduledTime');
}

/** Parse AeroDataBox /flights/number response (has departure + arrival) */
function parseFlightStatus(raw:any):Flight{
  const dep=raw.departure??{};
  const arr=raw.arrival??{};
  const depAp=dep.airport??{};
  const arrAp=arr.airport??{};

  // Keep legs separate — never mix arrival-predicted with departure-scheduled (caused +349m on SQ731)
  const depSched=adbSideTime(dep, 'scheduledTime');
  const depRevisedOnly=adbSideTime(dep, 'revisedTime');
  const depPredicted=adbSideTime(dep, 'predictedTime');
  const depActual=adbSideTime(dep, 'runwayTime', 'actualTime');
  const depRevised=depRevisedOnly||depPredicted||depSched;
  const departureTime=depActual||depRevised||depSched;

  const arrSched=adbSideTime(arr, 'scheduledTime');
  const arrRevisedOnly=adbSideTime(arr, 'revisedTime');
  const arrPredicted=adbSideTime(arr, 'predictedTime');
  const arrActual=adbSideTime(arr, 'runwayTime', 'actualTime');
  const arrRevised=arrRevisedOnly||arrPredicted||arrSched;
  const arrivalTime=arrActual||arrRevised||arrSched;

  const rawSt=String(raw.status??'').toLowerCase();
  const isAirborne=rawSt==='departed'||rawSt.includes('en-route')||rawSt==='airborne'||rawSt==='in air';
  const isArrived=rawSt==='arrived'||rawSt==='landed';

  // Delay vs the leg that is still relevant
  let delayMin=0;
  let sched=depSched;
  let revised=depRevised;
  let actual=depActual;
  if(isArrived || (arrActual && !depActual && !isAirborne)){
    sched=arrSched||depSched;
    revised=arrRevisedOnly||arrPredicted||arrSched||depRevised;
    actual=arrActual;
    delayMin=computeDelayMin(arrSched||depSched, arrActual, arrRevisedOnly||arrPredicted||'');
  } else {
    delayMin=computeDelayMin(depSched, depActual, depRevisedOnly||depPredicted||'');
  }

  const originCode=pickAirportCode(depAp);
  const destCode=pickAirportCode(arrAp);
  const status=mapRawStatus(rawSt, delayMin);
  const gate=String(
    dep.gate ?? dep.movement?.gate ?? raw.movement?.gate ?? arr.movement?.gate ?? arr.gate ?? '',
  );
  const flight:Flight={
    id:          `${raw.number??'—'}-${depSched||arrSched||Math.random()}`,
    number:      raw.number??'—',
    airline:     raw.airline?.name||raw.airline?.iata||'—',
    airlineCode: raw.airline?.iata||'—',
    origin:      originCode,
    originCity:  pickAirportCity(depAp, originCode),
    originCountry:pickAirportCountry(depAp, originCode),
    destination: destCode,
    destCity:    pickAirportCity(arrAp, destCode),
    destCountry: pickAirportCountry(arrAp, destCode),
    scheduledTime:sched,
    revisedTime:  revised,
    actualTime:   actual,
    arrivalTime,
    departureTime,
    scheduledDeparture: depSched,
    scheduledArrival: arrSched,
    estimatedDeparture: depRevisedOnly || depPredicted || '',
    estimatedArrival: arrRevisedOnly || arrPredicted || '',
    actualDeparture: depActual,
    actualArrival: arrActual,
    boardSide: 'both',
    gate:         gate,
    terminal:     (dep.terminal??arr.terminal??'')+'',
    baggage:      cleanBaggageBelt(arr.baggage??arr.baggageBelt??''),
    runway:       (isArrived?arr.runway:dep.runway)??'',
    arrTerminal:  arr.terminal??'',
    depTerminal:  dep.terminal??'',
    status,
    delay:        delayMin,
    aircraft:     raw.aircraft?.model??'',
    aircraftReg:  raw.aircraft?.reg??'',
    callSign:     raw.callSign??'',
    progress:     status==='landed'||arrActual?1.0:status==='en-route'||depActual?0.5:0,
  };
  return applyClockStatus(flight);
}

function flightLookupError(number:string):string{
  const clean=number.replace(/\s+/g,'').toUpperCase();
  return t().couldNotFindFlight(clean);
}

async function fetchFlightByNumber(number:string):Promise<Flight[]>{
  const clean=number.replace(/\s+/g,'').toUpperCase();
  try{
    const bundle=await getFlightDetail(clean);
    let flights:Flight[];
    if(bundle.premium && bundle.data && !Array.isArray(bundle.data)){
      flights=[faDetailToFlight(bundle.data as FAFlightDetail)];
    } else {
      const items=Array.isArray(bundle.data) ? bundle.data : [];
      if(!items.length){
        throw new Error(flightLookupError(clean));
      }
      if(items[0]?._normalized || (typeof items[0]?.status==='string' && items[0]?.number && items[0]?.id)){
        flights=items as Flight[];
      } else {
        flights=items.map(parseFlightStatus);
      }
    }
    flights=collapseCodeshareSearchHits(flights, clean);
    return Promise.all(flights.map(async f=>{
      const withGate=await mergeFidsGate(f);
      return enrichFlightWithSchiphol(withGate);
    }));
  } catch(e:any){
    const msg=(e?.message||'').toString().toLowerCase();
    if(
      msg.includes('json') ||
      msg.includes('empty response') ||
      msg.includes('unexpected end of input') ||
      msg.includes('http 404') ||
      msg.includes('adb_flight')
    ){
      throw new Error(flightLookupError(clean));
    }
    throw e;
  }
}

const ROUTE_LOOKUP = new Map<string, Flight>();

function mergeRouteFields(base:Flight, extra:Flight):Flight{
  const origin=usableAirportCode(base.origin)||usableAirportCode(extra.origin);
  let dest=usableAirportCode(base.destination)||usableAirportCode(extra.destination);
  if(origin && dest===origin){
    const alt=usableAirportCode(extra.destination);
    dest = alt && alt!==origin ? alt : '';
  }
  return {
    ...base,
    origin,
    originCity: base.originCity || extra.originCity,
    originCountry: base.originCountry || extra.originCountry,
    destination: dest,
    destCity: base.destCity || extra.destCity,
    destCountry: base.destCountry || extra.destCountry,
    departureTime: base.departureTime || extra.departureTime,
    arrivalTime: base.arrivalTime || extra.arrivalTime,
    gate: hasRealGate(extra.gate) ? extra.gate : base.gate,
    terminal: extra.terminal || base.terminal,
    depTerminal: extra.depTerminal || base.depTerminal,
    arrTerminal: extra.arrTerminal || base.arrTerminal,
  };
}

/** Prefer the searched marketing number and fill UNK dest from the operating sibling. */
function collapseCodeshareSearchHits(flights:Flight[], searched:string):Flight[]{
  if(!flights.length) return flights;
  const filled=flights.map(f=>{
    if(usableAirportCode(f.origin) && usableAirportCode(f.destination)) return f;
    const sib=flights.find(o=>
      o!==f
      && usableAirportCode(o.origin)
      && usableAirportCode(o.destination)
      && (
        String(o.scheduledTime||'').slice(0,16)===String(f.scheduledTime||'').slice(0,16)
        || (!!f.aircraftReg && f.aircraftReg===o.aircraftReg)
      )
    );
    return sib ? mergeRouteFields(f, sib) : f;
  });
  const labeled=filled.map(f=>applySearchedFlightNumber(f, searched));
  const seen=new Map<string, Flight>();
  for(const f of labeled){
    const key=[
      String(f.scheduledTime||f.scheduledDeparture||'').slice(0,16),
      usableAirportCode(f.origin)||f.aircraftReg||'',
      usableAirportCode(f.destination)||'',
    ].join('|');
    const prev=seen.get(key);
    seen.set(key, prev ? mergeRouteFields(prev, f) : f);
  }
  const out=[...seen.values()];
  const q=slugFlightIdent(searched);
  out.sort((a,b)=>{
    const aHit=identsMatch(a.number, q)?0:1;
    const bHit=identsMatch(b.number, q)?0:1;
    return aHit-bHit;
  });
  return out;
}

async function enrichFlightRoute(f:Flight):Promise<Flight>{
  if(usableAirportCode(f.origin) && usableAirportCode(f.destination) && f.origin!==f.destination){
    return f;
  }
  const slug=flightSlug(f.number);
  if(!slug) return f;
  const cached=ROUTE_LOOKUP.get(slug);
  if(cached) return mergeRouteFields(f, cached);
  try{
    const hits=await fetchFlightByNumber(slug);
    const hit=hits[0];
    if(!hit) return f;
    ROUTE_LOOKUP.set(slug, hit);
    return mergeRouteFields(f, hit);
  } catch{
    return f;
  }
}

// ── Connection checker ─────────────────────────────────────────────────────────
type ConnVerdict = 'good'|'tight'|'miss'|'unknown';

type ConnResult = {
  incoming:Flight;
  outgoing:Flight;
  hub:string;
  arriveMs:number;
  departMs:number;
  gapMin:number;
  mct:number;
  domestic:boolean;
  sameTerminal:boolean|null;
  verdict:ConnVerdict;
  message:string;
  walk?:number;
  buffer?:number;
};

function fmtDuration(mins:number):string{
  const abs=Math.abs(Math.round(mins));
  const h=Math.floor(abs/60);
  const m=abs%60;
  if(h<=0) return `${m}m`;
  if(m===0) return `${h}h`;
  return `${h}h ${m}m`;
}

function timeMs(iso:string, iata?:string, country?:string):number{
  if(!iso) return 0;
  const t=flightClockUtcMs(iso, iata, country);
  return t!=null?t:0;
}

function pickIncoming(hits:Flight[]):Flight|undefined{
  return hits.find(f=>!!f.destination)
    ?? hits[0];
}

function pickOutgoing(hits:Flight[], hub:string):Flight|undefined{
  const H=hub.toUpperCase();
  return hits.find(f=>f.origin===H)
    ?? hits.find(f=>!!f.origin)
    ?? hits[0];
}

function resolveConnectionPair(innHits:Flight[], outHits:Flight[]){
  for(const inn of innHits){
    if(!inn.destination) continue;
    const out=outHits.find(f=>f.origin===inn.destination);
    if(out){
      return { incoming:inn, outgoing:out, hub:inn.destination };
    }
  }
  const incoming=pickIncoming(innHits);
  const hub=(incoming?.destination||'').toUpperCase();
  const outgoing=pickOutgoing(outHits, hub);
  return { incoming, outgoing, hub };
}

function isDomesticHub(hub:string, inn:Flight, out:Flight):boolean{
  const H=hub.toUpperCase();
  const hubCountry =
    H==='BKK'||H==='DMK'||H==='HKT'||H==='CNX'||H==='HDY'||H==='USM'||H==='KBV'||H==='UTP' ? 'th' :
    H==='SIN' ? 'sg' :
    H==='KUL'||H==='PEN'||H==='BKI' ? 'my' : '';
  if(!hubCountry) return false;
  return (inn.originCountry||'').toLowerCase()===hubCountry
    && (out.destCountry||'').toLowerCase()===hubCountry;
}

function minConnectionMinutes(hub:string, domestic:boolean):number{
  const H=hub.toUpperCase();
  if(H==='BKK') return domestic?45:60;
  if(H==='DMK') return 45;
  if(H==='SIN') return 60;
  if(H==='KUL') return 75;
  return 60;
}

function evaluateConnection(incoming:Flight, outgoing:Flight, hub:string):ConnResult{
  const arriveMs=timeMs(resolveArrivalIso(incoming), incoming.destination, incoming.destCountry);
  const departMs=timeMs(resolveDepartureIso(outgoing), outgoing.origin, outgoing.originCountry);
  const gapMin=arriveMs&&departMs?(departMs-arriveMs)/60000:NaN;
  const domestic=isDomesticHub(hub, incoming, outgoing);

  const innTerm=(incoming.arrTerminal||incoming.terminal||'').trim();
  const outTerm=(outgoing.depTerminal||outgoing.terminal||'').trim();
  const sameTerminal=innTerm&&outTerm?innTerm===outTerm:null;

  const walk=walkMinutes(hub, sameTerminal);
  const buffer=Number.isFinite(gapMin)?gapMin-walk:NaN;

  let verdict:ConnVerdict='unknown';
  let message:string=t().unableConnectionTime;

  if(incoming.status==='cancelled'||outgoing.status==='cancelled'){
    verdict='miss';
    message=incoming.status==='cancelled'
      ?t().incomingCancelled
      :t().connectingCancelled;
  } else if(!Number.isFinite(gapMin)){
    verdict='unknown';
    message=t().missingTimes;
  } else if(gapMin<0 || buffer<0){
    verdict='miss';
    message=t().missConnection;
  } else if(gapMin>24*60){
    verdict='miss';
    message=t().notSameDay;
  } else if(buffer<12){
    verdict='tight';
    message=t().tightBuffer(Math.round(buffer));
  } else {
    verdict='good';
    message=t().makeConnection(Math.round(buffer));
  }

  return { incoming, outgoing, hub:hub.toUpperCase(), arriveMs, departMs, gapMin, mct:walk, domestic, sameTerminal, verdict, message, walk, buffer };
}

async function checkConnection(innNum:string, outNum:string):Promise<ConnResult>{
  // Sequential fetches with gap — avoids RapidAPI 429 from parallel calls
  const innHits=await fetchFlightByNumber(innNum);
  await sleep(1500);
  const outHits=await fetchFlightByNumber(outNum);
  const { incoming, outgoing, hub }=resolveConnectionPair(innHits, outHits);
  if(!incoming) throw new Error(flightLookupError(innNum));
  if(!outgoing) throw new Error(flightLookupError(outNum));
  if(!hub) throw new Error(t().couldNotDetectHub);
  return evaluateConnection(incoming, outgoing, hub);
}

const VERDICT_UI:Record<ConnVerdict,{color:string;bg:string;border:string;bgLight:string;borderLight:string}>={
  good:    {color:'#16a34a', bg:'#052e16', border:'#166534', bgLight:'#ecfdf5', borderLight:'#86efac'},
  tight:   {color:'#d97706', bg:'#451a03', border:'#92400e', bgLight:'#fff7ed', borderLight:'#fdba74'},
  miss:    {color:'#dc2626', bg:'#450a0a', border:'#7f1d1d', bgLight:'#fef2f2', borderLight:'#fca5a5'},
  unknown: {color:'#6b7280', bg:'#0f172a', border:'#1e293b', bgLight:'#f5f5f5', borderLight:'#d1d5db'},
};

function toSearchableFlight(f:Flight, type:'arrival'|'departure', airport:Airport):Flight & SearchableFlight{
  const r=resolveRoute(f,type,airport);
  const o=airportByIata(r.origin);
  const d=airportByIata(r.destination);
  return {
    ...f,
    origin: r.origin || f.origin,
    destination: r.destination || f.destination,
    originCity: r.originCity || f.originCity,
    destCity: r.destCity || f.destCity,
    originCountry: f.originCountry || o?.country || '',
    destCountry: f.destCountry || d?.country || '',
    originName: o?.name || '',
    destName: d?.name || '',
    statusLabel: STATUS_CFG[f.status]?.label || '',
  };
}

function hasFullRoute(f:Flight):boolean{
  return !!usableAirportCode(f.origin) && !!usableAirportCode(f.destination)
    && usableAirportCode(f.origin)!==usableAirportCode(f.destination);
}

/** Resolve origin→destination. Arrivals at the current airport: dest is always local. */
function resolveRoute(f:Flight, type:'arrival'|'departure', airport:Airport){
  const local=usableAirportCode(airport.iata);
  const a=usableAirportCode(f.origin);
  const b=usableAirportCode(f.destination);
  const cityA=f.originCity||'';
  const cityB=f.destCity||'';
  const cityOf=(code:string)=>code===a?cityA:code===b?cityB:'';
  const remoteOf=(x:string,y:string)=>[x,y].find(c=>!!c && c!==local)||'';

  let origin='';
  let dest='';
  let originCity='';
  let destCity='';

  if(a && b && a!==b){
    if(type==='arrival' && a===local && b!==local){
      origin=b; dest=a;
    } else if(type==='departure' && b===local && a!==local){
      origin=b; dest=a;
    } else {
      origin=a; dest=b;
    }
    originCity=cityOf(origin);
    destCity=cityOf(dest);
  } else if(type==='arrival'){
    dest=local;
    destCity=airport.city||cityB;
    origin=remoteOf(a,b);
    originCity=cityOf(origin);
  } else {
    origin=local;
    originCity=airport.city||cityA;
    dest=remoteOf(a,b);
    destCity=cityOf(dest);
  }

  if(origin && dest && origin===dest){
    if(type==='arrival'){ origin=''; originCity=''; }
    else { dest=''; destCity=''; }
  }

  if(origin===local) originCity=originCity||airport.city;
  if(dest===local) destCity=destCity||airport.city;

  const o=displayAirport(origin, originCity, f.originCountry);
  const d=displayAirport(dest, destCity, f.destCountry);
  return {
    origin:o.code, originCity:routePlaceLabel(o.city, o.code), originFlag:o.flag,
    destination:d.code, destCity:routePlaceLabel(d.city, d.code), destFlag:d.flag,
  };
}

function FlightRouteMap({
  flight, type, airport, animated,
}:{
  flight:Flight;
  type:'arrival'|'departure';
  airport:Airport;
  animated:boolean;
}){
  const rr=resolveRoute(flight, type, airport);
  const origin=rr.origin;
  const destination=rr.origin && rr.origin===rr.destination ? '' : rr.destination;
  if(!destination) return null;
  const sameCode=!origin || origin===destination;
  const o=sameCode ? {} : coordsForIata(origin, airport);
  const d=coordsForIata(destination, airport);
  if(!hasGeo(d.lat, d.lon)) return null;
  const samePt=hasGeo(o.lat, o.lon) && hasGeo(d.lat, d.lon) && o.lat===d.lat && o.lon===d.lon;
  return (
    <RouteHero
      origin={origin}
      destination={destination}
      originCity={origin?rr.originCity:''}
      destCity={destination?rr.destCity:''}
      progress={flightLiveProgress(flight)}
      duration={flightDurationLabel(flight)}
      status={flight.status}
      animated={animated}
      originLat={samePt?undefined:o.lat}
      originLon={samePt?undefined:o.lon}
      destLat={samePt?undefined:d.lat}
      destLon={samePt?undefined:d.lon}
      liveLat={flight.lat}
      liveLng={flight.lng}
      headingDeg={flight.headingDeg}
    />
  );
}

// ── Flight tracking + push / local notifications ───────────────────────────────
type TrackedFlight = {
  key:string;
  flightNumber:string;
  scheduledTime:string;
  lastStatus:FlightStatus;
  lastGate:string;
  previousGate:string;
  lastDelay:number;
  lastRevisedTime:string;
  lastBaggage:string;
  /** Last values we already notified about — avoids noisy re-alerts */
  notifiedDelay:number;
  notifiedGate:string;
  notifiedStatus:FlightStatus;
  /** Gate-close push at ≤30 min before gate close — once */
  notifiedGateClose:boolean;
  /** Last-call push at ≤15 min before gate close — once */
  notifiedLastCall:boolean;
  /** Baggage belt ready push — once per flight */
  notifiedBaggageClaim:boolean;
  /** Passport stamp animation already shown for this landing */
  landedStampShown?:boolean;
  /** Full-screen boarding overlay already shown */
  urgentBoardingOverlayShown?:boolean;
  /** Full-screen last-call overlay already shown */
  urgentLastCallOverlayShown?:boolean;
  /** Epoch ms when flight first reported landed — baggage poll window */
  landedAtMs?:number;
  notifiedT24?:boolean;
  notifiedT3h?:boolean;
  notifiedT1h?:boolean;
  notifiedT30m?:boolean;
  notifiedDeparted?:boolean;
  notifiedEarly?:boolean;
  activeAlert:boolean;
  airportIata:string;
  type:'arrival'|'departure';
  flight:Flight;
  boardingPass?:BoardingPassInfo;
};

function flightSlug(number:string):string{
  return String(number||'').replace(/\s+/g,'').toUpperCase();
}

function pickFlightForTrack(hits:Flight[], dateIso?:string):Flight|undefined{
  if(!hits.length) return undefined;
  if(dateIso){
    const exact=hits.find(h=>(h.scheduledTime||'').startsWith(dateIso));
    if(exact) return exact;
    const dayMs=new Date(dateIso+'T12:00:00Z').getTime();
    return [...hits].sort((a,b)=>{
      const ta=new Date(a.scheduledTime||0).getTime();
      const tb=new Date(b.scheduledTime||0).getTime();
      return Math.abs(ta-dayMs)-Math.abs(tb-dayMs);
    })[0];
  }
  const now=Date.now();
  return [...hits].sort((a,b)=>{
    const ta=new Date(a.scheduledTime||0).getTime();
    const tb=new Date(b.scheduledTime||0).getTime();
    return Math.abs(ta-now)-Math.abs(tb-now);
  })[0];
}

function flightFromTracked(t: TrackedFlight): Flight | null {
  const live = t.flight;
  const number = live?.number || t.flightNumber;
  if (!number) return null;
  const stub = stubFlightFromNumber(number, t.scheduledTime || live?.scheduledTime, live?.origin, live?.destination);
  const base = live?.number ? { ...stub, ...live } : stub;
  return {
    ...base,
    number: flightSlug(number),
    status: live?.status || t.lastStatus || base.status,
    gate: live?.gate || t.lastGate || base.gate,
    delay: typeof live?.delay === 'number' ? live.delay : (t.lastDelay || base.delay || 0),
    scheduledTime: live?.scheduledTime || t.scheduledTime || base.scheduledTime,
    revisedTime: live?.revisedTime || t.lastRevisedTime || base.revisedTime,
    origin: live?.origin || base.origin,
    originCity: live?.originCity || base.originCity,
    destination: live?.destination || base.destination,
    destCity: live?.destCity || base.destCity,
  };
}

function stubFlightFromNumber(number:string, dateIso?:string, from?:string, to?:string):Flight{
  const clean=flightSlug(number);
  const scheduled=dateIso
    ? (String(dateIso).includes('T') ? dateIso : `${dateIso}T12:00:00.000Z`)
    : new Date().toISOString();
  return {
    id:`${clean}-${scheduled}`,
    number:clean,
    airline:'—',
    airlineCode:clean.replace(/\d.*/,'')||'—',
    origin:from||'',
    originCity:from||'',
    originCountry:'',
    destination:to||'',
    destCity:to||'',
    destCountry:'',
    scheduledTime:scheduled,
    revisedTime:scheduled,
    actualTime:'',
    arrivalTime:'',
    departureTime:scheduled,
    scheduledDeparture:scheduled,
    scheduledArrival:'',
    estimatedDeparture:'',
    estimatedArrival:'',
    actualDeparture:'',
    actualArrival:'',
    boardSide:'both',
    gate:'',
    terminal:'',
    baggage:'',
    runway:'',
    arrTerminal:'',
    depTerminal:'',
    status:'unknown',
    delay:0,
    aircraft:'',
    aircraftReg:'',
    callSign:'',
    progress:0,
  };
}

function flightShareUrl(number:string):string{
  return `${SHARE_BASE}/${encodeURIComponent(flightSlug(number))}`;
}

function flightTrackKey(f:Pick<Flight,'number'|'scheduledTime'>):string{
  return `${flightSlug(f.number)}|${f.scheduledTime}`;
}

/** Stable while a detail card stays open — excludes live scheduledTime mutations. */
function detailFlightOpenKey(f:Pick<Flight,'number'|'scheduledTime'>, type:'arrival'|'departure'):string{
  return `${flightSlug(f.number)}:${type}:${String(f.scheduledTime || '').slice(0, 10)}`;
}

function sameTrackedFlight(t:TrackedFlight, f:Pick<Flight,'number'|'scheduledTime'>):boolean{
  const slug=flightSlug(f.number);
  return t.key===flightTrackKey(f) || flightSlug(t.flightNumber)===slug;
}

const STATUS_RANK:Record<FlightStatus, number> = {
  unknown:0, scheduled:0, delayed:1, boarding:2, 'en-route':3, landed:4, cancelled:5,
};

/** Prefer the more advanced live snapshot (tracked poll) over a stale FIDS row. */
function mergeFresherFlight(board:Flight, live:Flight):Flight{
  const takeStatus=(STATUS_RANK[live.status]??0) >= (STATUS_RANK[board.status]??0);
  return {
    ...board,
    status: takeStatus ? live.status : board.status,
    gate: live.gate || board.gate,
    delay: live.delay || board.delay,
    revisedTime: live.revisedTime || board.revisedTime,
    departureTime: live.departureTime || board.departureTime,
    actualTime: live.actualTime || board.actualTime,
    arrivalTime: live.arrivalTime || board.arrivalTime,
    scheduledDeparture: live.scheduledDeparture || board.scheduledDeparture,
    scheduledArrival: live.scheduledArrival || board.scheduledArrival,
    estimatedDeparture: live.estimatedDeparture || board.estimatedDeparture,
    estimatedArrival: live.estimatedArrival || board.estimatedArrival,
    actualDeparture: live.actualDeparture || board.actualDeparture,
    actualArrival: live.actualArrival || board.actualArrival,
    boardSide: live.boardSide || board.boardSide,
    terminal: live.terminal || board.terminal,
    depTerminal: live.depTerminal || board.depTerminal,
    arrTerminal: live.arrTerminal || board.arrTerminal,
    baggage: live.baggage || board.baggage,
  };
}

function overlayTrackedLive(f:Flight, tracked:TrackedFlight[]):Flight{
  const t=tracked.find(x=>sameTrackedFlight(x, f));
  if(!t?.flight) return f;
  return mergeFresherFlight(f, t.flight);
}

function toTracked(f:Flight, airportIata:string, type:'arrival'|'departure', boardingPass?:BoardingPassInfo):TrackedFlight{
  const status=f.status;
  const activeAlert=status==='delayed' || status==='cancelled';
  const gate=f.gate||'';
  const delay=f.delay||0;
  return {
    key:flightTrackKey(f),
    flightNumber:flightSlug(f.number),
    scheduledTime:f.scheduledTime,
    lastStatus:status,
    lastGate:gate,
    previousGate:'',
    lastDelay:delay,
    lastRevisedTime:f.revisedTime||f.scheduledTime,
    lastBaggage:f.baggage||'',
    notifiedDelay:delay,
    notifiedGate:gate,
    notifiedStatus:status,
    notifiedGateClose:false,
    notifiedLastCall:false,
    notifiedBaggageClaim:false,
    landedStampShown: status === 'landed',
    urgentBoardingOverlayShown: false,
    urgentLastCallOverlayShown: false,
    activeAlert,
    airportIata,
    type,
    flight:f,
    boardingPass,
  };
}

type NotifyKind = 'delay'|'gate'|'boarding'|'cancelled'|'landed'|'baggage'|'gateClose'|'lastCall'|'connection'|'t24'|'t3h'|'t1h'|'t30m'|'departed'|'early';
type NotifyEvent = { kind:NotifyKind; title:string; body:string; urgent:boolean; smart?:boolean; dedupeDetail?:string };

let expoPushTokenCache:string|null = null;

function activeAlertCount(list:TrackedFlight[]):number{
  return list.filter(t=>t.activeAlert).length;
}

async function loadTracked():Promise<TrackedFlight[]>{
  try{
    const raw=await AsyncStorage.getItem(TRACK_STORAGE_KEY);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    return parsed.map((t:any)=>{
      const status=(t?.lastStatus||'unknown') as FlightStatus;
      const activeAlert = typeof t?.activeAlert==='boolean'
        ? t.activeAlert
        : status==='delayed' || status==='cancelled';
      const gate=t?.lastGate||'';
      const delay=typeof t?.lastDelay==='number'?t.lastDelay:0;
      return {
        ...t,
        activeAlert,
        notifiedDelay: typeof t?.notifiedDelay==='number'?t.notifiedDelay:delay,
        notifiedGate: typeof t?.notifiedGate==='string'?t.notifiedGate:gate,
        notifiedStatus: (t?.notifiedStatus||status) as FlightStatus,
        notifiedGateClose: !!t?.notifiedGateClose,
        notifiedLastCall: !!t?.notifiedLastCall,
        notifiedBaggageClaim: !!t?.notifiedBaggageClaim,
        landedStampShown: typeof t?.landedStampShown === 'boolean'
          ? t.landedStampShown
          : status === 'landed' || t?.flight?.status === 'landed',
        urgentBoardingOverlayShown: !!t?.urgentBoardingOverlayShown,
        urgentLastCallOverlayShown: !!t?.urgentLastCallOverlayShown,
        previousGate: t?.previousGate||'',
      };
    });
  } catch{ return []; }
}

/** Free tier: max 3 tracked flights. Pro: unlimited. Beta: unlimited. */
const FREE_TRACK_LIMIT = 3;

async function saveTracked(list:TrackedFlight[]):Promise<void>{
  await AsyncStorage.setItem(TRACK_STORAGE_KEY, JSON.stringify(list));
}

function fidsCacheKey(iata:string, type:'arrival'|'departure'):string{
  return `cache_${iata.toUpperCase()}_${type}`;
}

async function saveFidsCache(iata:string, type:'arrival'|'departure', flights:Flight[]):Promise<void>{
  try{
    await AsyncStorage.setItem(fidsCacheKey(iata, type), JSON.stringify({
      ts:Date.now(),
      flights,
    }));
  } catch{ /* ignore */ }
}

async function loadFidsCache(
  iata:string,
  type:'arrival'|'departure',
  opts?:{ allowStale?:boolean },
):Promise<{ flights:Flight[]; ts:number }|null>{
  try{
    const raw=await AsyncStorage.getItem(fidsCacheKey(iata, type));
    if(!raw) return null;
    const parsed=JSON.parse(raw);
    if(!parsed || !Array.isArray(parsed.flights) || typeof parsed.ts!=='number') return null;
    const age=Date.now()-parsed.ts;
    if(age > FIDS_CACHE_TTL_MS){
      if(!opts?.allowStale || age > FIDS_CACHE_STALE_MAX_MS) return null;
    }
    return { flights:parsed.flights, ts:parsed.ts };
  } catch{
    return null;
  }
}

/** Fill missing gate from cached FIDS board when /flights/number omits it (e.g. CX778). */
async function mergeFidsGate(f:Flight):Promise<Flight>{
  if(hasRealGate(f.gate)) return f;
  const slugs=new Set(
    [flightSlug(f.number), slugFlightIdent(f.operatingNumber||'')].filter(Boolean),
  );
  if(!slugs.size) return f;

  const findOnBoard=async(iata:string, type:'arrival'|'departure'):Promise<Flight|null>=>{
    const cache=await loadFidsCache(iata, type, { allowStale:true });
    return cache?.flights?.find(x=>slugs.has(flightSlug(x.number)) || slugs.has(slugFlightIdent(x.operatingNumber||''))) ?? null;
  };

  const depIata=usableAirportCode(f.origin);
  const arrIata=usableAirportCode(f.destination);
  let match:Flight|null=null;
  if(depIata) match=await findOnBoard(depIata, 'departure');
  if(!hasRealGate(match?.gate) && arrIata){
    match=await findOnBoard(arrIata, 'arrival') ?? match;
  }
  if(!match || !hasRealGate(match.gate)) return f;
  return { ...f, gate:match.gate };
}

function fmtCacheAge(ts:number):string{
  try{
    return new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  } catch{
    return 'earlier';
  }
}

async function loadConnNotified():Promise<Set<string>>{
  try{
    const raw=await AsyncStorage.getItem(CONN_NOTIFIED_KEY);
    if(!raw) return new Set();
    const arr=JSON.parse(raw);
    return new Set(Array.isArray(arr)?arr.map(String):[]);
  } catch{
    return new Set();
  }
}

async function markConnNotified(key:string):Promise<void>{
  try{
    const set=await loadConnNotified();
    set.add(key);
    await AsyncStorage.setItem(CONN_NOTIFIED_KEY, JSON.stringify([...set]));
  } catch{ /* ignore */ }
}

function sameCalendarDay(aMs:number, bMs:number):boolean{
  if(!aMs||!bMs) return false;
  const a=new Date(aMs), b=new Date(bMs);
  return a.getFullYear()===b.getFullYear()
    && a.getMonth()===b.getMonth()
    && a.getDate()===b.getDate();
}

type TightConnection = {
  key:string;
  incoming:Flight;
  outgoing:Flight;
  hub:string;
  gapMin:number;
};

/** Find same-day connections between tracked flights (dest of A = origin of B). */
function findTightConnections(flights:Flight[]):TightConnection[]{
  const out:TightConnection[]=[];
  const seen=new Set<string>();
  for(let i=0;i<flights.length;i++){
    for(let j=0;j<flights.length;j++){
      if(i===j) continue;
      const inn=flights[i], dep=flights[j];
      const hub=(inn.destination||'').toUpperCase();
      if(!hub || hub!==(dep.origin||'').toUpperCase()) continue;
      const arriveMs=timeMs(resolveArrivalIso(inn), inn.destination, inn.destCountry);
      const departMs=timeMs(resolveDepartureIso(dep), dep.origin, dep.originCountry);
      if(!arriveMs||!departMs||!sameCalendarDay(arriveMs, departMs)) continue;
      const gapMin=(departMs-arriveMs)/60000;
      if(!Number.isFinite(gapMin) || gapMin<0 || gapMin>=60) continue;
      const key=`${flightSlug(inn.number)}>${flightSlug(dep.number)}|${hub}`;
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({ key, incoming:inn, outgoing:dep, hub, gapMin });
    }
  }
  return out.sort((a,b)=>a.gapMin-b.gapMin);
}

async function setupAndroidNotifyChannels():Promise<void>{
  if(Platform.OS!=='android') return;
  await Notifications.setNotificationChannelAsync('flights',{
    name:t().flightUpdates,
    importance:Notifications.AndroidImportance.DEFAULT,
    vibrationPattern:[0,120],
    lightColor:'#0B1F3A',
  });
  await Notifications.setNotificationChannelAsync('flights-urgent',{
    name:t().urgentFlightUpdates,
    importance:Notifications.AndroidImportance.HIGH,
    vibrationPattern:[0,250,250,250],
    lightColor:'#FF3B30',
  });
}

type NotifyPermStatus = 'granted'|'denied'|'undetermined'|'unavailable';

async function getNotifyPermissionStatus():Promise<NotifyPermStatus>{
  if(Platform.OS==='web') return 'unavailable';
  try{
    await setupAndroidNotifyChannels();
    const { status }=await Notifications.getPermissionsAsync();
    if(status==='granted') return 'granted';
    if(status==='denied') return 'denied';
    return 'undetermined';
  } catch{
    return 'unavailable';
  }
}

/** Request only when undetermined; denied stays false (banner guides to Settings). */
async function ensureNotifyPermission():Promise<boolean>{
  if(Platform.OS==='web') return false;
  try{
    await setupAndroidNotifyChannels();
    const { status:existing }=await Notifications.getPermissionsAsync();
    if(existing==='granted') return true;
    if(existing==='denied') return false;
    const { status }=await Notifications.requestPermissionsAsync();
    return status==='granted';
  } catch{ return false; }
}

/** Register for Expo Push Service. Graceful on Expo Go Android / simulators. */
async function registerExpoPushToken():Promise<string|null>{
  if(Platform.OS==='web') return null;
  try{
    const granted=await ensureNotifyPermission();
    if(!granted) return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    if(!projectId) return null;

    // Expo Go on Android has limited remote-push support — still attempt; catch below.
    const tokenResult=await Notifications.getExpoPushTokenAsync({ projectId });
    const token=tokenResult?.data||null;
    if(!token) return null;

    expoPushTokenCache=token;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    // Best-effort register with proxy (no-op if offline)
    try{
      await fetch(`${PROXY}/push/register`,{
        method:'POST',
        headers:{ 'Content-Type':'application/json', Accept:'application/json' },
        body:JSON.stringify({ token, platform:Platform.OS }),
      });
    } catch{ /* ignore */ }

    return token;
  } catch{
    // Expo Go / simulator / missing native module
    return null;
  }
}

async function getStoredPushToken():Promise<string|null>{
  if(expoPushTokenCache) return expoPushTokenCache;
  try{
    const t=await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if(t) expoPushTokenCache=t;
    return t;
  } catch{ return null; }
}

async function syncAlertBadge(list:TrackedFlight[]){
  if(Platform.OS==='web') return;
  try{
    await Notifications.setBadgeCountAsync(activeAlertCount(list));
  } catch{ /* ignore */ }
}

/** In-memory dedupe so the same flight/event/day is never notified twice. */
const sentNotifications = new Set<string>();

type NotifyMeta = { flightKey?: string; flightId?: string };

async function notifyLocal(flightNumber:string, event:NotifyEvent, meta?:NotifyMeta){
  if(Platform.OS==='web') return;
  const key = notificationDedupeKey(flightNumber, event.kind, event.dedupeDetail);
  if(sentNotifications.has(key)) return;
  if(await hasSentNotification(key)){
    sentNotifications.add(key);
    return;
  }
  sentNotifications.add(key);
  if(sentNotifications.size>250) sentNotifications.clear();
  try{
    const clean=flightSlug(flightNumber);
    await Notifications.scheduleNotificationAsync({
      content:{
        title:event.title,
        body:event.body,
        sound:true,
        categoryIdentifier:`flight-${clean}`,
        data:buildNotificationData({
          flightNumber:clean,
          kind:event.kind,
          flightKey:meta?.flightKey,
          flightId:meta?.flightId,
        }),
        interruptionLevel:event.urgent?'timeSensitive':'active',
        priority:event.urgent
          ?Notifications.AndroidNotificationPriority.HIGH
          :Notifications.AndroidNotificationPriority.DEFAULT,
        ...(Platform.OS==='android'
          ?{ channelId:event.urgent?'flights-urgent':'flights' }
          :{}),
      },
      trigger:null,
    });
    await markSentNotification(key);
  } catch{ /* ignore on unsupported platforms */ }
}

/** Local notification only — self-push + local previously caused duplicates. */
async function notifyFlight(flightNumber:string, event:NotifyEvent, meta?:NotifyMeta){
  const prefs=getPrefs().notify;
  const kind=event.kind;
  if((kind==='delay'||kind==='early'||kind==='t24'||kind==='t3h'||kind==='t1h'||kind==='t30m') && !prefs.delay) return;
  if(kind==='gate' && !prefs.gate) return;
  if(kind==='cancelled' && !prefs.gate) return;
  if(kind==='boarding' && !prefs.boarding) return;
  if(kind==='connection' && !prefs.boarding) return;
  if(kind==='gateClose' && !prefs.gate && !prefs.boarding) return;
  if(kind==='lastCall' && !prefs.boarding) return;
  if((kind==='landed'||kind==='baggage') && !prefs.landed) return;
  await notifyLocal(flightNumber, event, meta);
}

function matchTrackedHit(tracked:TrackedFlight, hits:Flight[]):Flight|undefined{
  const norm=flightSlug;
  const same=hits.filter(h=>norm(h.number)===norm(tracked.flightNumber));
  if(!same.length) return undefined;
  const exact=same.find(h=>h.scheduledTime===tracked.scheduledTime);
  if(exact) return exact;
  const t=new Date(tracked.scheduledTime).getTime()||0;
  return [...same].sort((a,b)=>
    Math.abs(new Date(a.scheduledTime).getTime()-t)-Math.abs(new Date(b.scheduledTime).getTime()-t)
  )[0];
}

function destFlagEmoji(live:Flight):string{
  const ap=airportByIata(live.destination||'');
  if(ap?.flag) return ap.flag;
  const cc=String(live.destCountry||'').trim();
  if(cc.length===2) return countryFlag(cc);
  return '';
}

function arrivalSkewMin(live:Flight):number|null{
  const sched=live.scheduledTime;
  const arr=live.arrivalTime||live.revisedTime;
  if(!sched||!arr) return null;
  const a=new Date(normalizeAdbTime(sched)).getTime();
  const b=new Date(normalizeAdbTime(arr)).getTime();
  if(!Number.isFinite(a)||!Number.isFinite(b)) return null;
  const mins=Math.round((b-a)/60000);
  if(mins<=-5 && mins>=-90) return mins;
  return null;
}

/** Compare live flight vs stored track state; return updated track + notification events */
function diffTracked(prev:TrackedFlight, live:Flight):{ next:TrackedFlight; events:NotifyEvent[] }{
  const events:NotifyEvent[]=[];
  const num=flightSlug(live.number)||prev.flightNumber;
  const gate=live.gate||'';
  const status=live.status;
  const delay=live.delay||0;
  const revised=live.revisedTime||live.scheduledTime;
  const baggage=cleanBaggageBelt(live.baggage||'');
  let landedAtMs=prev.landedAtMs;
  let notifiedDelay=prev.notifiedDelay ?? prev.lastDelay;
  let notifiedGate=prev.notifiedGate ?? prev.lastGate;
  let notifiedStatus=prev.notifiedStatus ?? prev.lastStatus;
  let notifiedGateClose=!!prev.notifiedGateClose;
  let notifiedBaggageClaim=!!prev.notifiedBaggageClaim;

  const copy=t();
  const isDeparture=departureBoardingAlertsEnabled(prev.type);
  if(isDeparture && gate && gate!==prev.lastGate && gate!==notifiedGate){
    const firstGate=!hasRealGate(prev.lastGate);
    events.push({
      kind:'gate',
      title: firstGate ? copy.gateAssigned : copy.gateChanged,
      body: firstGate ? copy.gateAssignedBody(num, gate) : copy.gateChangedBody(num, gate),
      urgent:true,
      dedupeDetail:gate,
    });
    notifiedGate=gate;
  }
  let notifiedLastCall=!!prev.notifiedLastCall;
  const visual=boardingVisualPhase(live, Date.now(), prev.type);
  if(isDeparture && status==='boarding'){
    if(visual==='lastCall'){
      if(!notifiedLastCall){
        const copy=boardingPushCopy({ ...live, number:num }, 'lastCall');
        events.push({ kind:'lastCall', title:copy.title, body:copy.body, urgent:true });
        notifiedLastCall=true;
      }
      notifiedGateClose=true;
      notifiedStatus='boarding';
    } else if(visual==='closing'){
      if(!notifiedGateClose){
        const copy=boardingPushCopy({ ...live, number:num }, 'closing');
        events.push({ kind:'gateClose', title:copy.title, body:copy.body, urgent:true });
        notifiedGateClose=true;
      }
      notifiedStatus='boarding';
    } else if(visual==='open' && prev.lastStatus!=='boarding' && notifiedStatus!=='boarding'){
      const copy=boardingPushCopy({ ...live, number:num }, 'open');
      events.push({ kind:'boarding', title:copy.title, body:copy.body, urgent:true });
      notifiedStatus='boarding';
    } else if(visual==='open'){
      notifiedStatus='boarding';
    }
  }
  if(delay>=(notifiedDelay+10) && delay>0){
    const isArrival=prev.type==='arrival';
    const delayIso=isArrival
      ? (live.arrivalTime || resolveArrivalIso(live) || '')
      : revised;
    const delayClock=fmt(
      delayIso,
      isArrival ? live.destination : live.origin,
      isArrival ? live.destCountry : undefined,
    );
    events.push({
      kind:'delay',
      title:copy.flightDelayed(num),
      body:isArrival
        ? copy.flightDelayedArrivalBody(num, delay, delayClock)
        : copy.flightDelayedBody(num, delay, delayClock),
      urgent:false,
      dedupeDetail:String(delay),
    });
    notifiedDelay=delay;
  }
  if(status==='cancelled' && prev.lastStatus!=='cancelled' && notifiedStatus!=='cancelled'){
    events.push({
      kind:'cancelled',
      title:copy.flightCancelled,
      body:copy.flightCancelledBody(num),
      urgent:true,
    });
    notifiedStatus='cancelled';
  }
  if(status==='landed' && prev.lastStatus!=='landed' && notifiedStatus!=='landed'){
    const city=live.destCity || live.destination || '';
    const flagEmoji=destFlagEmoji(live);
    events.push({
      kind:'landed',
      title:copy.landed,
      body: copy.landedIn(city, flagEmoji),
      urgent:false,
    });
    notifiedStatus='landed';
  }

  if(status==='landed' && !landedAtMs){
    const iso=live.actualArrival||live.actualTime||live.arrivalTime||'';
    const ms=iso?new Date(normalizeAdbTime(iso)).getTime():NaN;
    landedAtMs=Number.isFinite(ms)?ms:Date.now();
  }

  if(status==='landed' && baggage && !notifiedBaggageClaim){
    events.push({
      kind:'baggage',
      title:copy.numLanded(num),
      body:copy.baggageBeltOpen(baggage),
      urgent:false,
    });
    notifiedBaggageClaim=true;
  }

  const minsDep=minutesUntilDeparture(live);
  const origin=live.origin || '';
  const dest=live.destination || '';
  const route=`${origin}→${dest}`;
  let notifiedT24=!!prev.notifiedT24;
  let notifiedT3h=!!prev.notifiedT3h;
  let notifiedT1h=!!prev.notifiedT1h;
  let notifiedT30m=!!prev.notifiedT30m;
  let notifiedDeparted=!!prev.notifiedDeparted;
  let notifiedEarly=!!prev.notifiedEarly;

  if(isDeparture && minsDep!==null && status!=='cancelled' && status!=='landed' && status!=='en-route'){
    if(!notifiedT24 && minsDep<=24*60 && minsDep>3*60){
      events.push({
        kind:'t24', smart:true,
        title:copy.tomorrow,
        body:copy.tomorrowBody(route, fmt(live.departureTime||live.revisedTime||live.scheduledTime, live.origin)),
        urgent:false,
      });
      notifiedT24=true;
    }
    if(!notifiedT3h && minsDep<=3*60 && minsDep>60){
      events.push({
        kind:'t3h', smart:true,
        title:copy.in3Hours(num),
        body:copy.in3HoursBody,
        urgent:false,
      });
      notifiedT3h=true;
    }
    if(!notifiedT1h && minsDep<=60 && minsDep>30){
      const term=compactTerminal(live.depTerminal||live.terminal);
      const onTime=delay<=0;
      events.push({
        kind:'t1h', smart:true,
        title:copy.in1Hour(num),
        body: [
          copy.yourFlightIn1Hour,
          gate ? copy.gate(gate) : null,
          term || null,
          onTime ? copy.onTimeCheck : copy.minLate(delay),
        ].filter(Boolean).join(' · '),
        urgent:false,
      });
      notifiedT1h=true;
    }
    if(!notifiedT30m && minsDep<=30 && minsDep>0 && status!=='boarding'){
      events.push({
        kind:'t30m', smart:true,
        title:copy.boardingStartsSoon,
        body: gate ? copy.boardingStartsSoonAtGate(gate) : copy.boardingStartsSoonNum(num),
        urgent:true,
      });
      notifiedT30m=true;
    }
  }

  if(isDeparture && !notifiedDeparted && (status==='en-route' || !!live.actualTime) && prev.lastStatus!=='en-route' && prev.lastStatus!=='landed'){
    const city=live.destCity || live.destination || '';
    const arr=fmt(live.arrivalTime||live.revisedTime||'', live.destination, live.destCountry);
    events.push({
      kind:'departed', smart:true,
      title:copy.numDeparted(num),
      body: arr && arr!=='--:--'
        ? copy.numDepartedArrives(num, arr, live.destination || city)
        : copy.numDepartedShort(num),
      urgent:false,
    });
    notifiedDeparted=true;
  }

  if(prev.type==='arrival' && !notifiedEarly && (status==='en-route' || status==='landed')){
    const skew=arrivalSkewMin(live);
    if(skew!==null){
      events.push({
        kind:'early',
        title:copy.numArrivingEarly(num),
        body:copy.numArrivingEarlyBody(num, Math.abs(skew), fmt(live.arrivalTime||live.revisedTime, live.destination, live.destCountry)),
        urgent:false,
      });
      notifiedEarly=true;
    }
  }

  const activeAlert=status==='delayed' || status==='cancelled' || (!!gate && gate!==prev.lastGate);

  return {
    next:{
      ...prev,
      flightNumber:num,
      scheduledTime:live.scheduledTime||prev.scheduledTime,
      lastStatus:status,
      lastGate:gate,
      previousGate: hasRealGate(prev.lastGate) && gate && gate!==prev.lastGate
        ? prev.lastGate
        : (prev.previousGate||''),
      lastDelay:delay,
      lastRevisedTime:revised,
      lastBaggage:baggage,
      landedAtMs,
      notifiedDelay,
      notifiedGate,
      notifiedStatus,
      notifiedGateClose,
      notifiedLastCall,
      notifiedBaggageClaim,
      notifiedT24,
      notifiedT3h,
      notifiedT1h,
      notifiedT30m,
      notifiedDeparted,
      notifiedEarly,
      activeAlert,
      flight:live,
      key:flightTrackKey({ number:num, scheduledTime:live.scheduledTime||prev.scheduledTime }),
    },
    events,
  };
}

function flightSortMs(f:Flight, type:'arrival'|'departure'):number{
  const iso=bestDisplayTime(f, type);
  if(!iso) return Number.POSITIVE_INFINITY;
  const t=type==='arrival'
    ? flightClockUtcMs(iso, f.destination, f.destCountry)
    : flightClockUtcMs(iso, f.origin, f.originCountry);
  return t!=null?t:Number.POSITIVE_INFINITY;
}

function minutesUntilFlight(f:Flight, type:'arrival'|'departure', now=Date.now()):number|null{
  const t=flightSortMs(f, type);
  if(!Number.isFinite(t)) return null;
  return Math.floor((t-now)/60000);
}

function firstIndexAtOrAfter(
  list: Flight[],
  type: 'arrival' | 'departure',
  fromMs: number,
): number {
  for (let i = 0; i < list.length; i++) {
    const t = flightSortMs(list[i], type);
    if (Number.isFinite(t) && t >= fromMs) return i;
  }
  return list.length;
}

function sortFlights(
  list: Flight[],
  type: 'arrival' | 'departure',
  _airportTz = 'UTC',
): Flight[] {
  return [...list].sort((a, b) => flightSortMs(a, type) - flightSortMs(b, type));
}

function flightLiveProgress(f:Flight, airport?:Airport):number{
  return flightProgressPct(f, Date.now(), { durationMs: durationHintMs(f, airport) });
}

function flightDurationLabel(f:Flight, airport?:Airport):string{
  const dep=resolveDepartureIso(f);
  const arr=resolveArrivalIso(f, { durationMs: durationHintMs(f, airport) });
  if(!dep || !arr || clocksAreSame(dep, arr, f)) return '';
  const a=flightClockUtcMs(dep, f.origin, f.originCountry);
  const b=flightClockUtcMs(arr, f.destination, f.destCountry);
  if(a==null || b==null || !(b>a)) return '';
  return formatDurationMs(b-a);
}

function flightDurationMs(f:Flight, airport?:Airport):number|null{
  const hint=durationHintMs(f, airport);
  const dep=resolveDepartureIso(f);
  const arr=resolveArrivalIso(f, { durationMs: hint });
  if(dep && arr && !clocksAreSame(dep, arr, f)){
    const a=flightClockUtcMs(dep, f.origin, f.originCountry);
    const b=flightClockUtcMs(arr, f.destination, f.destCountry);
    if(a!=null && b!=null && b>a) return b-a;
  }
  return hint && hint>0 ? hint : null;
}

function sharePlaceLabel(iata:string, cityFallback:string, current:Airport):string{
  const ap=(iata && airportByIata(iata)) || (current.iata===iata ? current : undefined);
  const city=cleanAirportName(ap?.city || cityFallback || '');
  const name=cleanAirportName(ap?.name || '');
  if(city && name && name.toLowerCase()!==city.toLowerCase()) return `${city} ${name}`.trim();
  return city || name || iata;
}

function toNextFlightShareData(f:Flight, type:'arrival'|'departure', airport:Airport):NextFlightShareData{
  const r=resolveRoute(f, type, airport);
  const originIata=r.origin || airport.iata;
  const destIata=r.destination && r.destination!==r.origin ? r.destination : '';
  const oCoords=coordsForIata(originIata, airport);
  const dCoords=coordsForIata(destIata, airport);
  let distanceKm:number|null=null;
  if(hasGeo(oCoords.lat, oCoords.lon) && hasGeo(dCoords.lat, dCoords.lon)){
    distanceKm=haversineKm(oCoords.lat!, oCoords.lon!, dCoords.lat!, dCoords.lon!);
  }
  const depIso=resolveDepartureIso(f);
  const arrIso=resolveArrivalIso(f, { durationMs: durationHintMs(f, airport) });
  return {
    flightNumber: f.number,
    airlineCode: f.airlineCode,
    airline: f.airline,
    originIata,
    destIata: destIata || '—',
    originCity: airportTitle(originIata, r.originCity) || originIata,
    destCity: airportTitle(destIata, r.destCity) || destIata,
    originPlace: sharePlaceLabel(originIata, r.originCity, airport),
    destPlace: sharePlaceLabel(destIata, r.destCity, airport),
    originLat: oCoords.lat,
    originLon: oCoords.lon,
    destLat: dCoords.lat,
    destLon: dCoords.lon,
    dateIso: depIso || arrIso || f.scheduledTime,
    durationMs: flightDurationMs(f, airport),
    distanceKm,
    gate: type==='departure' ? f.gate : '',
    arrTerminal: f.arrTerminal || (type==='arrival' ? f.terminal : ''),
    aircraft: f.aircraft,
  };
}

function toPickupLiveData(f:Flight, type:'arrival'|'departure', airport:Airport):PickupLiveData{
  const r=resolveRoute(f, type, airport);
  const dest=r.destination || airport.iata;
  const arrIso=resolveArrivalIso(f, { durationMs: durationHintMs(f, airport) });
  return {
    flightNumber: f.number || t().yourFlightFallback,
    airlineCode: f.airlineCode,
    airline: f.airline,
    etaIso: arrIso,
    destIata: dest,
    destCountry: f.destCountry || '',
    landed: f.status==='landed',
    baggage: f.baggage,
    exitLine: arrivalExitHint(dest),
    walkMin: baggageWalkMinutes(dest),
  };
}

const PROGRESS_GOLD = '#F5A623';
const PROGRESS_LINE_H = 4;
const PROGRESS_PLANE = 20;

function FlightProgressLine({ f, remainIso, originIata, destIata }:{
  f:Flight;
  remainIso:string;
  originIata?:string;
  destIata?:string;
}){
  const { C: theme } = useTheme();
  const [trackW, setTrackW] = useState(0);
  const pct = Math.min(1, Math.max(0, flightLiveProgress(f)));
  const depIso = resolveDepartureIso(f);
  const departed = f.status==='en-route' || f.status==='landed' || !!f.actualDeparture || (!!f.actualTime && f.boardSide!=='arrival');
  let remain = '';
  if(f.status==='landed'){
    remain = t().arrived;
  } else if(flightHasLanded(f, Date.now())){
    remain = t().arrived;
  } else if(!departed){
    const cd = countdown(depIso, originIata || f.origin, f.originCountry);
    remain = cd ? t().departsIn(cd) : '';
  } else {
    const left = countdown(remainIso, destIata || f.destination, f.destCountry);
    remain = left ? t().arrivesIn(left) : '';
  }
  const origin = String(originIata || f.origin || '').toUpperCase();
  const dest = String(destIata || f.destination || '').toUpperCase();
  const rightLabel = f.status==='landed' ? t().arrived : t().progressLanding;
  const remainStroke = themeMode==='dark' ? 'rgba(255,255,255,0.15)' : 'rgba(10,14,26,0.14)';
  const fillW = trackW * pct;
  const planeLeft = trackW
    ? Math.min(Math.max(fillW - PROGRESS_PLANE / 2, 0), Math.max(0, trackW - PROGRESS_PLANE))
    : 0;

  return (
    <View
      style={dc.progressWrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      accessibilityLabel={`${origin} ${dest} ${t().departed} ${rightLabel}`.trim()}
    >
      <View style={dc.progressEnds}>
        <Text style={[dc.progressIata, { color: theme.secondary }]}>{origin}</Text>
        <Text style={[dc.progressIata, { color: theme.secondary }]}>{dest}</Text>
      </View>
      <View
        style={dc.progressTrack}
        onLayout={e => setTrackW(e.nativeEvent.layout.width)}
      >
        {trackW > 0 ? (
          <Svg width={trackW} height={PROGRESS_LINE_H}>
            <Defs>
              <LinearGradient id="flightProgressGold" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#8B93A7" />
                <Stop offset="1" stopColor={PROGRESS_GOLD} />
              </LinearGradient>
            </Defs>
            <Line
              x1={0}
              y1={PROGRESS_LINE_H / 2}
              x2={trackW}
              y2={PROGRESS_LINE_H / 2}
              stroke={remainStroke}
              strokeWidth={PROGRESS_LINE_H}
              strokeDasharray="3 5"
              strokeLinecap="round"
            />
            {fillW > 0 ? (
              <Line
                x1={0}
                y1={PROGRESS_LINE_H / 2}
                x2={fillW}
                y2={PROGRESS_LINE_H / 2}
                stroke="url(#flightProgressGold)"
                strokeWidth={PROGRESS_LINE_H}
                strokeLinecap="round"
              />
            ) : null}
          </Svg>
        ) : null}
        <View style={[dc.progressPlane, { left: planeLeft }]}>
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <Airplane size={PROGRESS_PLANE} color={PROGRESS_GOLD} weight="fill" />
          </View>
        </View>
      </View>
      <View style={dc.progressEnds}>
        <Text style={[dc.progressStatus, { color: theme.muted }]}>{t().departed}</Text>
        <Text style={[dc.progressStatus, { color: theme.muted }]}>{rightLabel}</Text>
      </View>
      {remain ? <Text style={[dc.progressRemain, { color: theme.secondary }]}>{remain}</Text> : null}
    </View>
  );
}

function SeaCoverageCard({ count, iata, live }:{ count:number; iata:string; live?:boolean }){
  return (
    <View style={s.seaCard}>
      <Text style={s.seaCardVal} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>
        {`${count} flights · ${iata}${live?' · LIVE':''}`}
      </Text>
    </View>
  );
}

function makeTb(C:ThemeColors){return StyleSheet.create({
  btn:     {borderRadius:20,paddingHorizontal:12,paddingVertical:7,
            backgroundColor:C.list,alignItems:'center',justifyContent:'center',
            flexDirection:'row',gap:6,borderWidth:1,borderColor:C.border},
  btnLg:   {borderRadius:12,paddingHorizontal:16,paddingVertical:12,
            marginTop:14,alignSelf:'stretch'},
  btnOn:   {backgroundColor:C.accent,borderColor:C.accent},
  txt:     {fontSize:12,fontWeight:'600',color:C.secondary},
  txtLg:   {fontSize:15,fontWeight:'700'},
  txtOn:   {color:themeMode==='dark'?BRAND.deep:'#ffffff'},
});}
let tb=makeTb(C);

function displayGate(gate:string):string{
  const g=(gate||'').trim();
  if(!g || /^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(g)) return '—';
  return g;
}

function calendarLocation(f:Flight):string{
  const parts:string[]=[];
  const term=(f.terminal||'').trim();
  if(term){
    parts.push(/^terminal\b/i.test(term)?term:`Terminal ${term}`);
  }
  const gate=displayGate(f.gate);
  if(gate!=='—'){
    parts.push(/^gate\b/i.test(gate)?gate:`Gate ${gate}`);
  }
  return parts.join(', ');
}

function flightCalendarTimes(f:Flight, type:'arrival'|'departure'):{ start:Date; end:Date }{
  const startIso=resolveDepartureIso(f);
  const endIso=resolveArrivalIso(f, { durationMs: durationHintMs(f) });
  const start=startIso?new Date(startIso):new Date();
  let end=endIso?new Date(endIso):new Date(start.getTime()+2*60*60*1000);
  if(!(end.getTime()>start.getTime())){
    end=new Date(start.getTime()+2*60*60*1000);
  }
  return { start, end };
}

async function ensureCalendarPermission():Promise<boolean>{
  if(Platform.OS==='web') return false;
  try{
    const current=await Calendar.getCalendarPermissions();
    if(current.granted) return true;
    const next=await Calendar.requestCalendarPermissions();
    return next.granted;
  } catch{
    return false;
  }
}

async function getWritableCalendar():Promise<Calendar.ExpoCalendar|null>{
  try{
    if(Platform.OS==='ios'){
      try{
        return Calendar.getDefaultCalendarSync();
      } catch{ /* fall through to list */ }
    }
    const calendars=await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    return calendars.find(c=>c.allowsModifications && c.isPrimary)
      ?? calendars.find(c=>c.allowsModifications)
      ?? null;
  } catch{
    return null;
  }
}

/** Create an OS calendar event for a flight. Throws on failure. */
async function addFlightToCalendar(
  f:Flight,
  type:'arrival'|'departure',
  airport:Airport,
):Promise<void>{
  if(Platform.OS==='web'){
    throw new Error(t().calendarExportApps);
  }
  const granted=await ensureCalendarPermission();
  if(!granted){
    throw new Error(t().calendarPermission);
  }
  const cal=await getWritableCalendar();
  if(!cal){
    throw new Error(t().noWritableCalendar);
  }

  const r=resolveRoute(f, type, airport);
  const slug=flightSlug(f.number);
  const { start, end }=flightCalendarTimes(f, type);
  const location=calendarLocation(f);

  await cal.createEvent({
    title:`✈️ ${slug} ${r.origin} → ${r.destination}`,
    startDate:start,
    endDate:end,
    location:location||undefined,
    notes:`Track live: ${flightShareUrl(slug)}`,
    timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

function TrackBtn({on,onPress,large,locked,onLockedPress}:{
  on:boolean; onPress:()=>void; large?:boolean;
  locked?:boolean; onLockedPress?:()=>void;
}){
  const { mode, C: theme } = useTheme();
  if(locked && !on && !BETA_MODE){
    return (
      <TouchableOpacity
        onPress={onLockedPress}
        style={[tb.btn, large&&tb.btnLg, { borderColor: BRAND.gold+'80' }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t().unlockProTracking}
      >
        <Lock size={large?16:13} color={BRAND.gold}/>
        <Text style={[tb.txt, large&&tb.txtLg, { color: BRAND.gold }]}>{t().pro}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[tb.btn, large&&tb.btnLg, on&&tb.btnOn]}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityLabel={on?t().untrackFlight:t().trackFlight}
      accessibilityState={{checked:on}}
    >
      {on
        ?<Check size={large?16:13} color={mode==='dark'?BRAND.deep:'#fff'}/>
        :<BellSimple size={large?16:13} color={theme.icon}/>}
      <Text style={[tb.txt, large&&tb.txtLg, on&&tb.txtOn]}>{on?t().untrack:t().track}</Text>
    </TouchableOpacity>
  );
}

function ShareBtn({onPress}:{onPress:()=>void}){
  const { C: theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={tb.btn}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t().share}
    >
      <ShareNetwork size={13} color={theme.icon}/>
      <Text style={tb.txt}>{t().share}</Text>
    </TouchableOpacity>
  );
}

// ── Detail Card ────────────────────────────────────────────────────────────────
function DetailFold({
  title, children, defaultOpen=false,
}:{ title:string; children:ReactNode; defaultOpen?:boolean }){
  const { C: theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={dc.fold}>
      <TouchableOpacity
        style={dc.foldHead}
        onPress={()=>setOpen(v=>!v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{expanded:open}}
      >
        <Text style={dc.foldTitle}>{title}</Text>
        {open
          ? <CaretUp size={16} color={theme.muted}/>
          : <CaretDown size={16} color={theme.muted}/>}
      </TouchableOpacity>
      {open ? <View style={dc.foldBody}>{children}</View> : null}
    </View>
  );
}

function DetailCard({f,type,airport,tracked,landedAtMs,onToggleTrack,onToast,isPro,onRequirePro,onOpenScanner,previousGate,boardingPass,onOpenPickup,onOpenPassport,gateRacePair,onOpenGateRace,focusSection,onFocusHandled,detailScrollRef,onPickupPersonSaved}:{
  f:Flight; type:'arrival'|'departure'; airport:Airport;
  tracked:boolean; landedAtMs?:number; onToggleTrack:()=>void; onToast:(msg:string)=>void;
  isPro:boolean; onRequirePro:(highlight?:string)=>void;
  onOpenScanner?:()=>void;
  previousGate?:string;
  boardingPass?:BoardingPassInfo;
  onOpenPickup?:()=>void;
  onPickupPersonSaved?:()=>void;
  onOpenPassport?:()=>void;
  gateRacePair?:GateRacePair|null;
  onOpenGateRace?:()=>void;
  focusSection?:DetailFocusSection|null;
  onFocusHandled?:()=>void;
  detailScrollRef?:RefObject<ScrollView|null>;
}){
  const { C: theme } = useTheme();
  const r=resolveRoute(f,type,airport);
  const destAp=airportByIata(r.destination);
  const originAp=airportByIata(r.origin);
  const transport=TRANSPORT_INFO[r.destination];
  const [showMore, setShowMore]=useState(false);
  const [pickupWhoOpen, setPickupWhoOpen]=useState(false);
  const [pickupPersonRev, setPickupPersonRev]=useState(0);
  const [shareBusy, setShareBusy]=useState(false);
  const [tick, setTick]=useState(0);
  const eu261SectionRef = useRef<View>(null);
  const pickupSectionRef = useRef<View>(null);
  const baggageSectionRef = useRef<View>(null);
  const detailCardY = useRef(0);
  const sectionInCardY = useRef<Partial<Record<DetailFocusSection, number>>>({});

  useEffect(()=>{
    if(!focusSection || !detailScrollRef?.current) return;
    const timer=setTimeout(()=>{
      const sectionOffset=sectionInCardY.current[focusSection];
      if(typeof sectionOffset==='number'){
        detailScrollRef.current?.scrollTo({
          y:Math.max(0, detailCardY.current+sectionOffset-12),
          animated:true,
        });
      }
      onFocusHandled?.();
    }, focusSection==='eu261' ? 120 : 380);
    return ()=>clearTimeout(timer);
  },[focusSection, f.id, detailScrollRef, onFocusHandled]);

  useEffect(()=>{
    let ms=30000;
    if(f.status==='boarding') ms=1000;
    else if(f.status==='landed') ms=60000;
    return runWhileAppActive(()=>{
      const id=setInterval(()=>setTick(t=>t+1),ms);
      return ()=>clearInterval(id);
    });
  },[f.status]);

  useEffect(()=>{
    if(!isPro) return;
    if(!previousGate || !hasRealGate(previousGate) || !hasRealGate(f.gate)) return;
    const a=String(previousGate).replace(/^gate\s+/i,'').toUpperCase();
    const b=String(f.gate).replace(/^gate\s+/i,'').toUpperCase();
    if(a===b) return;
    haptics.heavy();
  },[isPro, previousGate, f.gate]);

  const durHint = durationHintMs(f, airport);
  const arrIso = resolveArrivalIso(f, { durationMs: durHint });
  void tick;
  const landingPhase = type === 'arrival' && f.status === 'landed'
    ? landingCardPhase({ status: f.status, arrIso, landedAtMs, destIata: r.destination, destCountry: f.destCountry })
    : 'none';
  const depIso = resolveDepartureIso(f, { durationMs: durHint })
    || f.scheduledDeparture
    || f.departureTime
    || (f.boardSide !== 'arrival' && type === 'departure' ? f.scheduledTime : '')
    || (arrIso && durHint ? offsetIso(arrIso, -durHint, f.destination, f.destCountry) : '');
  const depSched = f.scheduledDeparture || (f.boardSide==='departure' ? f.scheduledTime : '');
  const arrSched = f.scheduledArrival || (f.boardSide==='arrival' ? f.scheduledTime : '');
  const showDepSched = !!(depSched && depIso && fmt(depSched, r.origin, f.originCountry)!==fmt(depIso, r.origin, f.originCountry));
  const showArrSched = !!(arrSched && arrIso && fmt(arrSched, r.destination, f.destCountry)!==fmt(arrIso, r.destination, f.destCountry));
  const livePhase = liveBoardPhase(f, Date.now(), type);
  const delayed = !(livePhase==='departed' || livePhase==='enRoute' || livePhase==='landed')
    && (f.status==='delayed' || (f.delay>0 && !f.actualTime && f.status!=='en-route' && f.status!=='landed' && f.status!=='cancelled'));
  const originCoords = coordsForIata(r.origin, airport);
  const destCoords = coordsForIata(r.destination, airport);
  const compensation = eu261Claim({
    status: f.status,
    delayMin: f.delay,
    scheduledTime: f.scheduledTime,
    actualTime: f.actualTime,
    revisedTime: f.revisedTime,
    departureTime: f.departureTime,
    arrivalTime: f.arrivalTime,
    originIata: r.origin,
    destIata: r.destination,
    originCountry: originAp?.country || f.originCountry || (r.origin===airport.iata ? airport.country : ''),
    destCountry: destAp?.country || f.destCountry || (r.destination===airport.iata ? airport.country : ''),
    originLat: originCoords.lat,
    originLon: originCoords.lon,
    destLat: destCoords.lat,
    destLon: destCoords.lon,
    flightNumber: f.number,
    airlineCode: f.airlineCode,
  });
  const euConnected = hasEu261Connection(
    r.origin,
    r.destination,
    originAp?.country || f.originCountry || (r.origin===airport.iata ? airport.country : ''),
    destAp?.country || f.destCountry || (r.destination===airport.iata ? airport.country : ''),
  );
  const delayMinForHint = delayMinutesFromTimes(
    f.scheduledTime,
    f.actualTime || f.departureTime || f.arrivalTime,
    f.revisedTime,
    f.delay,
    r.origin,
    f.originCountry,
  );
  const showNonEuCompHint = !euConnected && delayMinForHint >= 120 && delayed;
  const depColor = f.status==='cancelled' ? LIVE.cancelled : delayed ? LIVE.delayed : LIVE.onTime;
  const arrColor = f.status==='cancelled' ? LIVE.cancelled : LIVE.onTime;
  const destIataResolved = usableAirportCode(r.destination) || (type === 'arrival' ? usableAirportCode(airport.iata) : '');
  const destCountryResolved = destAp?.country || f.destCountry || (destIataResolved === airport.iata ? airport.country : '');
  const cdDep = countdown(depIso, r.origin, f.originCountry);
  const cdArr = countdown(arrIso, destIataResolved || r.destination, destCountryResolved);
  const useArrivalDay = f.status === 'en-route' || type === 'arrival';
  const dateLabelIso = useArrivalDay ? (arrIso || f.scheduledTime) : (depIso || arrIso || f.scheduledTime);
  const dateLabelIata = useArrivalDay ? destIataResolved : (usableAirportCode(r.origin) || usableAirportCode(airport.iata));
  const dateLabelCountry = useArrivalDay ? destCountryResolved : (originAp?.country || f.originCountry || airport.country);
  const dateLabel = fmtDateLong(dateLabelIso, dateLabelIata, dateLabelCountry);
  const originName = airportTitle(r.origin, r.originCity) || r.origin;
  const destDisplayLabel = destIataResolved || r.destCity
    ? (airportTitle(destIataResolved || r.destination, r.destCity) || routePlaceLabel(r.destCity, destIataResolved) || t().destinationUnknown)
    : t().destinationUnknown;
  const destName = destDisplayLabel;
  const originCode = r.origin;
  const destCode = destIataResolved;
  const fromLabel = routePlaceLabel(r.originCity, r.origin) || r.origin;
  const toLabel = routePlaceLabel(r.destCity, destIataResolved || r.destination) || destDisplayLabel;
  const routeTitle = fromLabel && toLabel && fromLabel!==toLabel
    ? `${fromLabel} to ${toLabel}`
    : (toLabel || fromLabel);
  const depGate = type==='departure' ? displayGate(f.gate) : '—';
  const arrGate = type==='arrival' ? displayGate(f.gate) : '—';
  const depTerm = f.depTerminal || (type==='departure' ? f.terminal : '');
  const arrTerm = f.arrTerminal || (type==='arrival' ? f.terminal : '');

  const shareFlightNative = async () => {
    haptics.light();
    const shareData = toNextFlightShareData(f, type, airport);
    const status = delayed
      ? t().delayedMinShort(f.delay)
      : liveStatusLabel(f, Date.now(), type);
    const message = buildFlightShareMessage(shareData, status);
    if (!message.trim()) {
      Alert.alert(t().shareFlight, 'Could not build share message.');
      return;
    }
    try {
      const result = await Share.share(
        Platform.OS === 'ios' ? { message, title: t().shareFlight } : { message },
      );
      console.warn('[Share] DetailCard native', result?.action, message.slice(0, 80));
      if (result?.action === Share.dismissedAction) return;
    } catch (e) {
      console.warn('[Share] DetailCard failed', e);
      Alert.alert(t().shareFlight, 'Share failed. Please try again.');
      haptics.error();
    }
  };

  let statusText = '';
  let statusColor: string = LIVE.onTime;
  const cardBoard=flightCardBoarding(f, Date.now(), type);
  if(f.status==='cancelled'){
    statusText=t().cancelled;
    statusColor=LIVE.cancelled;
  } else if(f.status==='landed' || livePhase==='landed' || flightHasLanded(f, Date.now(), type)){
    statusText=t().arrived;
  } else if(livePhase==='enRoute' || f.status==='en-route'){
    statusText=cdArr ? t().enRouteArrivesIn(cdArr) : t().enRoute;
  } else if(livePhase==='departed'){
    statusText=t().departed;
  } else if(livePhase==='gateClosed'){
    statusText=t().gateClosed;
    statusColor='#64748B';
  } else if(cardBoard.boarding){
    statusText=cardBoard.label;
    statusColor=cardBoard.color;
  } else if(delayed){
    statusText=t().delayedMinNewDep(f.delay, fmtLabeled(f.revisedTime||depIso, r.origin, f.originCountry));
    statusColor=LIVE.delayed;
  } else {
    statusText=cdDep ? t().gateDepartureIn(cdDep) : (cdArr ? t().arrivesIn(cdArr) : (flightStatusLabel(f.status)||t().scheduled));
  }

  const depSub = f.status==='cancelled'
    ? t().cancelled
    : livePhase==='enRoute'
      ? t().enRoute
      : livePhase==='departed'
        ? `${t().departed} · ${t().gateClosed}`
        : livePhase==='gateClosed'
          ? t().gateClosed
          : delayed
            ? t().delayNew(f.delay, fmtLabeled(f.revisedTime||depIso, r.origin, f.originCountry))
            : (cdDep ? t().onTimeDepartsIn(cdDep) : t().onTime);

  let arrSub = cdArr && livePhase!=='landed' && !flightHasLanded(f, Date.now(), type)
    ? t().arrivesIn(cdArr)
    : (f.status==='landed' || livePhase==='landed' || flightHasLanded(f, Date.now(), type) ? t().arrived : t().scheduled);
  if((livePhase==='enRoute' || livePhase==='departed' || f.status==='en-route') && livePhase!=='landed' && !flightHasLanded(f, Date.now(), type)){
    arrSub = arrIso ? fmtArrives(arrIso, destIataResolved || r.destination, destCountryResolved) : EMPTY_CLOCK;
  } else if(livePhase==='landed' || flightHasLanded(f, Date.now(), type)){
    arrSub = t().arrived;
  } else if(showArrSched && arrSched && arrIso){
    const a=flightClockUtcMs(arrSched, destIataResolved || r.destination, destCountryResolved);
    const b=flightClockUtcMs(arrIso, destIataResolved || r.destination, destCountryResolved);
    if(a!=null&&b!=null){
      const mins=Math.round((b-a)/60000);
      if(mins<0) arrSub=`${t().earlyMin(Math.abs(mins))} · ${cdArr?t().arrivesIn(cdArr):t().arrived}`;
      else if(mins>0) arrSub=`${t().delayMinShort(mins)} · ${cdArr?t().arrivesIn(cdArr):t().scheduled}`;
    }
  }

  const [frozenSectionOrder, setFrozenSectionOrder] = useState<string[] | null>(null);
  const frozenLockKeyRef = useRef<string | null>(null);
  const flightOpenKey = detailFlightOpenKey(f, type);

  useEffect(() => {
    let cancelled = false;
    const openKey = flightOpenKey;
    void loadCardPreferences().then(prefs => {
      if (cancelled) return;
      if (frozenLockKeyRef.current === openKey) return;
      const ctx: FlightContext = {
        status: f.status,
        minutesUntilDeparture: minutesUntilDeparture(f),
        minutesUntilArrival: minutesUntilFlight(f, type),
        minutesSinceLanding: buildMinutesSinceLanding({
          status: f.status, arrIso, landedAtMs,
          destIata: destIataResolved || r.destination,
          destCountry: destCountryResolved,
        }),
        isTracked: tracked,
        hasPickup: type === 'arrival' && tracked,
        isArrival: type === 'arrival',
        isDeparture: type === 'departure',
        isPro,
        destIata: destCode || r.destination || '',
        gateClosesInMinutes: minutesUntilGateClose(f),
        baggageBelt: cleanBaggageBelt(f.baggage) || null,
        landingPhase: type === 'arrival' && f.status === 'landed'
          ? landingCardPhase({ status: f.status, arrIso, landedAtMs, destIata: destIataResolved || r.destination, destCountry: destCountryResolved })
          : 'none',
        userPreferences: prefs.viewCounts,
        dismissPreferences: prefs.dismissCounts,
        hasGateRace: !!gateRacePair,
        boardingPhase: cardBoard.boarding
          ? (cardBoard.phase === 'lastCall'
            ? 'lastCall'
            : cardBoard.phase === 'closing'
              ? 'closing'
              : 'open')
          : null,
        hasAircraft: !!(f.aircraft || f.aircraftReg),
        hasBoardingPass: !!(boardingPass && (boardingPass.seat || boardingPass.sequence || boardingPass.pnr)),
        showLounge: isPro,
        showFlightMemory: f.status === 'landed' && !!onOpenPassport,
      };
      frozenLockKeyRef.current = openKey;
      setFrozenSectionOrder(sortVisibleCardSections(ctx));
    });
    return () => { cancelled = true; };
    // Intentionally only on open — do not reorder while the user is reading.
  }, [flightOpenKey]);

  const bumpCardView = useCallback((sectionId: string) => {
    void recordCardView(sectionId);
  }, []);

  const sortedCardSections = frozenSectionOrder ?? [];


  const cardTheme = {
    text: theme.text,
    secondary: theme.secondary,
    muted: theme.muted,
    accent: theme.accent,
    border: theme.border,
    card: theme.isDark ? 'rgba(136,150,176,0.08)' : theme.card,
    list: theme.list,
  };

  const renderDetailCardSection = (sectionId: string): ReactNode => {
    switch (sectionId) {
      case 'boardingBanner':
        return <BoardingNowBanner f={f} role={type}/>;
      case 'gateClosing':
        if (!(f.status === 'boarding' && cardBoard.phase === 'open' && gateCloseIso(f))) return null;
        return (() => {
          const remain = minutesUntilGateClose(f);
          return (
            <View style={[dc.gateClose, { borderLeftColor: LIVE.delayed, backgroundColor: 'rgba(255,179,0,0.10)' }]}>
              <Warning size={16} color={LIVE.delayed}/>
              <Text style={[dc.gateCloseTxt, { color: LIVE.delayed }]}>
                {t().gateCloses(fmt(gateCloseIso(f), r.origin) || '')}{remain != null && remain > 0 ? ` · ${t().minRemaining(remain)}` : ''}
              </Text>
            </View>
          );
        })();
      case 'landedWeather':
        return (
          <LandedWeatherCard
            destLat={destAp?.lat}
            destLon={destAp?.lon}
            city={r.destCity || destAp?.city || destName}
            arrivalIso={arrIso}
            theme={{
              text: theme.text,
              secondary: theme.secondary,
              muted: theme.muted,
              accent: theme.accent,
              card: theme.card,
              border: theme.border,
            }}
          />
        );
      case 'pickupMode':
        if (type !== 'arrival') return null;
        if (landingPhase === 'hidden') return null;
        return (
          <View
            ref={pickupSectionRef}
            collapsable={false}
            onLayout={e => { sectionInCardY.current.pickup = e.nativeEvent.layout.y; }}
          >
            <PickupModeCard
              boardType={type}
              flightKey={flightTrackKey(f)}
              flightNumber={f.number}
              destIata={destIataResolved || airport.iata}
              destName={destName}
              destLat={destCoords.lat}
              destLon={destCoords.lon}
              localIata={airport.iata}
              localName={airport.city || airport.name}
              localLat={airport.lat}
              localLon={airport.lon}
              terminal={arrTerm || f.arrTerminal || f.terminal}
              etaIso={arrIso}
              flightStatus={f.status}
              landedIso={f.actualArrival || f.actualTime || (f.status === 'landed' ? (f.arrivalTime || arrIso) : undefined)}
              landingPhase={landingPhase}
              theme={{
                text: theme.text,
                secondary: theme.secondary,
                muted: theme.muted,
                accent: theme.accent,
                list: theme.list,
                border: theme.border,
              }}
              onToast={onToast}
              onEnsureTracked={() => { if (!tracked) onToggleTrack(); }}
              personRevision={pickupPersonRev}
              onOpenWho={() => { haptics.light(); setPickupWhoOpen(true); }}
            />
          </View>
        );
      case 'delayPrediction':
        return (
          <DelayPredictionCard
            airlineCode={f.airlineCode}
            airlineName={f.airline}
            origin={r.origin}
            destination={r.destination}
            scheduledIso={f.scheduledTime || depIso}
            theme={{
              text: theme.text,
              secondary: theme.secondary,
              muted: theme.muted,
              list: theme.list,
              border: theme.border,
            }}
          />
        );
      case 'flightProgressLine':
        return (
          <FlightProgressLine
            f={f}
            remainIso={arrIso}
            originIata={originCode || r.origin}
            destIata={destCode || r.destination}
          />
        );
      case 'aircraftInfo':
        return (
          <>
            {isPro && (f.altitudeFt || f.speedKts) ? (
              <Text style={dc.livePos}>
                {[
                  f.altitudeFt ? `${Math.round(f.altitudeFt).toLocaleString('en-US')} ft` : null,
                  f.speedKts ? `${Math.round(f.speedKts)} kts` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <AircraftInfoCard
              model={f.aircraft}
              registration={f.aircraftReg}
              theme={{
                text: theme.text,
                secondary: theme.secondary,
                muted: theme.muted,
                accent: theme.accent,
                border: theme.border,
                card: theme.card,
                list: theme.list,
                icon: theme.icon,
              }}
            />
          </>
        );
      case 'boardingPass':
        if (!boardingPass || !(boardingPass.seat || boardingPass.sequence || boardingPass.pnr)) return null;
        return (
          <View style={dc.passCard}>
            {boardingPass.seat ? <Text style={dc.passLine}>{t().seat(boardingPass.seat)}</Text> : null}
            {boardingPass.sequence ? <Text style={dc.passLine}>{t().checkInSequence(boardingPass.sequence.padStart(3, '0'))}</Text> : null}
            {boardingPass.pnr ? <Text style={dc.passLine}>{t().bookingReference(boardingPass.pnr)}</Text> : null}
          </View>
        );
      case 'luxuryInfoPanel':
        return (
          <View
            ref={baggageSectionRef}
            collapsable={false}
            onLayout={e => { sectionInCardY.current.baggage = e.nativeEvent.layout.y; }}
          >
            <LuxuryInfoPanel
              originIata={originCode || r.origin}
              destIata={destCode || r.destination}
              destDisplayName={destDisplayLabel}
              originCity={r.originCity}
              destCity={r.destCity}
              originCountry={originAp?.country || f.originCountry}
              destCountry={destCountryResolved}
              originLat={originAp?.lat}
              originLon={originAp?.lon}
              destLat={destAp?.lat}
              destLon={destAp?.lon}
              arrivalIso={arrIso}
              status={livePhase==='enRoute' || livePhase==='departed' ? 'en-route' : f.status}
              baggage={f.baggage}
              terminal={arrTerm || f.terminal}
              landingPhase={landingPhase}
              premium={isPro}
              theme={{
                text: theme.text,
                secondary: theme.secondary,
                muted: theme.muted,
                accent: theme.accent,
                border: theme.border,
                card: theme.card,
                list: theme.list,
              }}
            />
          </View>
        );
      case 'hotelCard':
        return (
          <HotelSearchCard
            type={type}
            destIata={destCode || r.destination}
            destCity={r.destCity || destAp?.city || destName}
            destCountry={destAp?.country || f.destCountry}
            arrIso={arrIso}
            status={f.status}
            landingPhase={landingPhase}
            theme={cardTheme}
          />
        );
      case 'transportCard':
        return (
          <GetIntoTownCard
            type={type}
            status={f.status}
            arrIso={arrIso}
            destIata={destCode || r.destination}
            landingPhase={landingPhase}
            theme={cardTheme}
          />
        );
      case 'immigrationTip':
        return (
          <ImmigrationTipCard
            type={type}
            status={f.status}
            destIata={destCode || r.destination}
            landingPhase={landingPhase}
            theme={cardTheme}
          />
        );
      case 'foodCard':
        return (
          <FoodAfterLandingCard
            type={type}
            status={f.status}
            landingPhase={landingPhase}
            theme={cardTheme}
          />
        );
      case 'jetlagTips':
        return (
          <JetlagTipsCard
            originIata={originCode || r.origin}
            destIata={destCode || r.destination}
            originCountry={originAp?.country || f.originCountry}
            destCountry={destAp?.country || f.destCountry}
            theme={cardTheme}
          />
        );
      case 'restaurants':
        return (
          <RestaurantsCard
            type={type}
            status={f.status}
            arrIso={arrIso}
            destIata={destCode || r.destination}
            destCountry={destAp?.country || f.destCountry}
            landingPhase={landingPhase}
            theme={cardTheme}
          />
        );
      case 'earlyCheckIn':
        return (
          <EarlyCheckInCard
            type={type}
            status={f.status}
            arrIso={arrIso}
            destIata={destCode || r.destination}
            destCountry={destAp?.country || f.destCountry}
            landingPhase={landingPhase}
            theme={cardTheme}
          />
        );
      case 'gateRace':
        if (!gateRacePair) return null;
        return (
          <GateRaceConnectionCard
            pair={gateRacePair}
            formatTime={(iso, iata) => fmt(iso, iata)}
            theme={{
              text: theme.text,
              secondary: theme.secondary,
              muted: theme.muted,
              accent: theme.accent,
              border: theme.border,
              card: theme.card,
              list: theme.list,
            }}
            onOpenGateRace={onOpenGateRace}
          />
        );
      case 'loungePanel':
        return (
          <>
            {[type === 'departure' ? (originCode || r.origin) : '', destCode || r.destination]
              .filter((code, i, arr) => !!code && arr.indexOf(code) === i)
              .map(code => (
                <LoungePanel
                  key={code}
                  iata={code}
                  airlineIata={f.airlineCode}
                  theme={{
                    text: theme.text,
                    secondary: theme.secondary,
                    muted: theme.muted,
                    accent: theme.accent,
                    border: theme.border,
                    card: theme.card,
                    list: theme.list,
                  }}
                />
              ))}
          </>
        );
      case 'flightMemory':
        if (f.status !== 'landed') return null;
        if (!frozenSectionOrder?.includes('flightMemory')) return null;
        if (!onOpenPassport) return null;
        return (
          <TouchableOpacity
            style={dc.passportBanner}
            onPress={() => { onOpenPassport(); }}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={t().addedToPassportBanner}
          >
            <Text style={dc.passportBannerTxt}>{t().addedToPassportBanner}</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };


  return (
    <View
      style={[
      dc.card,
      delayed&&!cardBoard.boarding&&{borderLeftWidth:4,borderLeftColor:LIVE.delayed},
      f.status==='cancelled'&&{borderLeftWidth:4,borderLeftColor:LIVE.cancelled, opacity: compensation?1:0.92},
      cardBoard.boarding&&{borderLeftWidth:4,borderLeftColor:cardBoard.color},
      { overflow:'hidden' },
    ]}
      onLayout={e=>{ detailCardY.current=e.nativeEvent.layout.y; }}
    >
      {cardBoard.phase==='closing'||cardBoard.phase==='lastCall'?(
        <View pointerEvents="none" style={{
          ...StyleSheet.absoluteFill,
          backgroundColor:cardBoard.backgroundColor,
        }}/>
      ):null}
      {theme.cardWash?(
        <View pointerEvents="none" style={{
          ...StyleSheet.absoluteFill,
          backgroundColor:theme.cardWash,
          borderRadius:24,
        }}/>
      ):null}
      {theme.cardShimmer?(
        <View pointerEvents="none" style={{
          position:'absolute', top:0, left:0, right:0, height:'28%',
          backgroundColor:'rgba(255,255,255,0.06)',
          borderTopLeftRadius:24, borderTopRightRadius:24,
        }}/>
      ):null}
      <View style={dc.headRow}>
        <AirlineLogo iata={f.airlineCode} name={f.airline} size={AIRLINE_LOGO_SIZE}/>
        <View style={dc.headMain}>
          <Text
            style={[dc.flNum, { color: theme.flightNumberColor }]}
          >{formatFlightNumber(f)}</Text>
          {dateLabel?<Text style={dc.dateTxt} numberOfLines={1} ellipsizeMode="tail">· {dateLabel}</Text>:null}
        </View>
        <View style={dc.headGate}>
          <GateBadge
            compact
            type={type}
            gate={type==='departure' ? depGate : arrGate}
            terminal={type==='departure' ? (depTerm || undefined) : (arrTerm || undefined)}
            departureIso={type==='departure' ? depIso : arrIso}
            status={f.status}
            originIata={type==='departure' ? r.origin : (destIataResolved || r.destination)}
            originCountry={type==='departure' ? f.originCountry : destCountryResolved}
          />
          {previousGate && hasRealGate(previousGate) && previousGate!==(type==='departure'?depGate:arrGate)?(
            <Text style={dc.wasGate}>{t().wasGate(previousGate)}</Text>
          ):null}
        </View>
        {tracked ? (
          <TouchableOpacity
            style={dc.headTrackedBell}
            onPress={() => { onToggleTrack(); }}
            accessibilityRole="button"
            accessibilityLabel={t().untrackFlight}
            accessibilityState={{ selected: true }}
            hitSlop={10}
          >
            <BellSimple size={18} color={BRAND.gold} weight="fill" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={dc.headTrack}
            onPress={() => { onToggleTrack(); }}
            accessibilityRole="button"
            accessibilityLabel={t().trackFlight}
          >
            <BellSimple size={14} color={theme.text} />
            <Text style={dc.headTrackTxt}>{t().track}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={dc.headBook}
          onPress={() => startDuffelSearch(r.origin, destIataResolved || r.destination, depIso)}
          accessibilityRole="button"
          accessibilityLabel={t().bookThisFlight}
        >
          <AirplaneTakeoff size={14} color={BRAND.gold} />
          <Text style={dc.headBookTxt} numberOfLines={1}>{t().bookThisFlight}</Text>
        </TouchableOpacity>
      </View>
      <Text
        style={dc.routeTitle}
        allowFontScaling={false}
      >{routeTitle}</Text>

      <Text style={[dc.statusBar, { color: statusColor }]}>
        {[
          statusText,
          !(delayed && type==='departure') &&
            fmt(type==='departure'?depIso:arrIso, type==='departure'?r.origin:(destIataResolved || r.destination), type==='departure'?f.originCountry:destCountryResolved),
        ].filter(Boolean).join(' · ')}
      </Text>
      <View
        ref={eu261SectionRef}
        collapsable={false}
        onLayout={e=>{ sectionInCardY.current.eu261=e.nativeEvent.layout.y; }}
      >
        {compensation ? (
          <CompensationBanner
            variant="detailTop"
            claim={compensation}
            theme={{
              text: theme.text,
              secondary: theme.secondary,
              muted: theme.muted,
              accent: theme.accent,
              border: theme.border,
              list: theme.list,
            }}
          />
        ) : showNonEuCompHint ? (
          <Text style={dc.nonEuCompHint}>{t().airlineCompensationPolicy}</Text>
        ) : null}
      </View>
      <View>
        {sortedCardSections.map(sectionId => {
          const content = renderDetailCardSection(sectionId);
          if (!content) return null;
          return (
            <DetailCardSection key={sectionId} sectionId={sectionId} onView={bumpCardView}>
              {content}
            </DetailCardSection>
          );
        })}
      </View>

      <View style={dc.leg}>
        <View style={dc.legTop}>
          <View style={{flex:1,paddingRight:12}}>
            <Text
              style={dc.legIata}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >●  {originCode || r.origin}  ·  {originName}  ›</Text>
            <View style={dc.heroRow}>
              <HeroClock iso={depIso} color={depColor} city={r.originCity} iata={r.origin} otherIata={r.destination} country={f.originCountry} otherCountry={f.destCountry} />
            </View>
            {showDepSched && depSched ? (
              <StrikethroughTime
                text={fmt(depSched, r.origin, f.originCountry)}
                style={dc.strike}
              />
            ) : null}
            <Text style={[dc.legSub, { color: depColor }]} numberOfLines={1} ellipsizeMode="tail">{depSub}</Text>
          </View>
        </View>
      </View>

      <View style={dc.leg}>
        <View style={dc.legTop}>
          <View style={{flex:1,paddingRight:12}}>
            <Text
              style={dc.legIata}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >●  {destCode || r.destination}  ·  {destName}  ›</Text>
            <View style={dc.heroRow}>
              <HeroClock iso={arrIso} color={arrColor} city={r.destCity || destDisplayLabel} iata={destIataResolved || r.destination} otherIata={r.origin} country={destCountryResolved} otherCountry={f.originCountry} />
              {showArrSched && arrSched ? (
                <StrikethroughTime
                  text={fmt(arrSched, r.destination, f.destCountry)}
                  style={dc.strikeBig}
                  wrapStyle={{ alignSelf: 'flex-end' }}
                />
              ) : null}
            </View>
            <Text style={[dc.legSub, { color: arrColor }]} numberOfLines={1} ellipsizeMode="tail">{arrSub}</Text>
          </View>
        </View>
      </View>

      <View style={dc.bottomRow}>
        <TouchableOpacity
          style={dc.iconBtn}
          onPress={()=> onOpenScanner ? onOpenScanner() : onToast(t().scanFromMyFlights)}
          accessibilityLabel={t().scanBoardingPass}
        >
          <Barcode size={18} color={theme.icon}/>
        </TouchableOpacity>
        <TouchableOpacity
          style={dc.iconBtn}
          onPress={()=>setShowMore(v=>!v)}
          accessibilityRole="button"
          accessibilityLabel={showMore ? t().hideDetails : t().showDetails}
          accessibilityState={{ expanded: showMore }}
        >
          <Info size={16} color={theme.icon}/>
          <Text style={dc.detailsBtnTxt}>{t().details}</Text>
        </TouchableOpacity>
        {tracked ? (
          <TouchableOpacity
            style={dc.untrackBtn}
            onPress={()=>{ onToggleTrack(); }}
            accessibilityRole="button"
            accessibilityLabel={t().untrackFlight}
          >
            <BellSimple size={15} color={theme.secondary}/>
            <Text style={dc.untrackBtnTxt}>{t().untrack}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        style={dc.bookBtn}
        onPress={() => startDuffelSearch(r.origin, destIataResolved || r.destination, depIso)}
        accessibilityRole="button"
        accessibilityLabel={t().bookThisFlight}
      >
        <AirplaneTakeoff size={16} color={BRAND.gold} />
        <Text style={dc.bookBtnTxt} numberOfLines={1}>{t().bookThisFlight}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={dc.shareStoryBtn}
        onPress={()=>{ void shareFlightNative(); }}
        accessibilityRole="button"
        accessibilityLabel={t().shareFlight}
      >
        <Text style={dc.shareStoryTxt}>{t().shareFlight}</Text>
      </TouchableOpacity>
      <View style={dc.shareApps}>
        <QuickShareRow
          mode="text"
          message={buildFlightShareMessage(
            toNextFlightShareData(f, type, airport),
            delayed ? t().delayedMinShort(f.delay) : liveStatusLabel(f, Date.now(), type),
          )}
          busy={shareBusy}
          onBusy={setShareBusy}
          compact
          showLabels={false}
          showMore={false}
          platforms={['whatsapp', 'line', 'instagram', 'tiktok']}
        />
      </View>

      {showMore?(
        <View style={dc.moreWrap}>
          <FlightStageTimeline
            flight={f}
            originIata={r.origin}
            destIata={r.destination}
            originCountry={f.originCountry}
            destCountry={f.destCountry}
            theme={{
              text: theme.text,
              secondary: theme.secondary,
              muted: theme.muted,
              accent: theme.accent,
              border: theme.border,
              list: theme.list,
            }}
          />
          {transport?(()=>{
            const transitOpts=transport.options.filter(o=>o.kind==='rail'||o.kind==='bus');
            if(!transitOpts.length) return null;
            return (
            <DetailFold title={t().getIntoTown(r.destination)}>
              <View style={dc.transportOpts}>
                {transitOpts.map((opt, i)=>(
                  <TouchableOpacity
                    key={`${opt.kind}-${i}`}
                    style={[dc.transportOptRow, { borderLeftColor: TRANSPORT_ACCENT[opt.kind] }]}
                    onPress={()=>openTransportOption(opt, transport)}
                    activeOpacity={0.7}
                  >
                    <View style={[dc.transportIconWrap, { backgroundColor: `${TRANSPORT_ACCENT[opt.kind]}18` }]}>
                      <TransportOptionIcon kind={opt.kind} color={TRANSPORT_ACCENT[opt.kind]}/>
                    </View>
                    <Text style={dc.transportOptTxt}>{opt.name}</Text>
                    <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                      {/€/.test(opt.price)?<CurrencyEur size={14} color={theme.text}/>:null}
                      {/\$/.test(opt.price)?<CurrencyDollar size={14} color={theme.text}/>:null}
                      <Text style={dc.transportOptPrice}>{opt.price}</Text>
                    </View>
                    <ArrowRight size={14} color={theme.secondary}/>
                  </TouchableOpacity>
                ))}
              </View>
            </DetailFold>
            );
          })():null}
          <AirportInfoCard
            iata={r.destination || airport.iata}
            theme={{
              text: theme.text,
              secondary: theme.secondary,
              muted: theme.muted,
              accent: theme.accent,
              border: theme.border,
              card: theme.card,
              list: theme.list,
            }}
            onToast={onToast}
          />
          {tracked?(
            <WakeUpControl
              flightKey={flightTrackKey(f)}
              flightNumber={f.number}
              landAtIso={arrIso}
              isPro={isPro}
              gold={BRAND.gold}
              text={theme.text}
              secondary={theme.secondary}
              list={theme.list}
              onRequirePro={onRequirePro}
              onToast={onToast}
            />
          ):null}
        </View>
      ):null}
      {type==='arrival'?(
        <PickupPersonSheet
          visible={pickupWhoOpen}
          flightKey={flightTrackKey(f)}
          theme={{
            text: theme.text,
            secondary: theme.secondary,
            muted: theme.muted,
            accent: theme.accent,
            list: theme.list,
            border: theme.border,
            field: theme.field,
            fieldBorder: theme.fieldBorder,
          }}
          onClose={()=>setPickupWhoOpen(false)}
          onSaved={()=>{ setPickupPersonRev(n=>n+1); onPickupPersonSaved?.(); }}
        />
      ):null}
    </View>
  );
}

// ── Flight Row ─────────────────────────────────────────────────────────────────
function ListScrollFade({ visible, bg }: { visible: boolean; bg: string }) {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={listFade.wrap}>
      <Svg width="100%" height={48}>
        <Defs>
          <LinearGradient id="boardListFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={bg} stopOpacity="0" />
            <Stop offset="1" stopColor={bg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="48" fill="url(#boardListFade)" />
      </Svg>
    </View>
  );
}

const listFade = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 },
});

function isKnownCardValue(raw?: string): boolean {
  const s = String(raw || '').trim();
  return !!s && !/^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(s);
}

function cardTerminalLine(iata: string, termRaw?: string): string | null {
  if (!isKnownCardValue(termRaw)) return null;
  const term = compactTerminal(termRaw) || String(termRaw).trim();
  if (!isKnownCardValue(term)) return null;
  const code = String(iata || '').trim();
  return code ? `${code} · ${term}` : term;
}

function cardAircraftLabel(raw?: string): string | null {
  if (!isKnownCardValue(raw)) return null;
  return String(raw).trim();
}

const CARD_STATUS = {
  scheduled: { border:'#1E3A5F', tint:'rgba(30, 58, 95, 0.15)' },
  boarding:  { border:'#065F46', tint:'rgba(6, 95, 70, 0.15)', tintLow:'rgba(6, 95, 70, 0.08)', tintHigh:'rgba(6, 95, 70, 0.25)' },
  delayed:   { border:'#92400E', tint:'rgba(146, 64, 14, 0.12)' },
  landed:    { border:'#3730A3', tint:'rgba(55, 48, 163, 0.12)' },
  cancelled: { border:'#F87171', tint:'rgba(248, 113, 113, 0.22)' },
  late:      { border:'#F87171', tint:'rgba(248, 113, 113, 0.14)' },
} as const;

type CardPulseKind = 'none' | 'boarding' | 'delayed' | 'late';

const CARD_PULSE:{ [K in Exclude<CardPulseKind,'none'>]: { from:number; to:number; ms:number } } = {
  boarding: { from:0.4, to:1.0, ms:2500 },
  delayed:  { from:0.5, to:1.0, ms:4000 },
  late:     { from:0.3, to:1.0, ms:800 },
};

function cardStatusVisual(
  f:Flight,
  type:'arrival'|'departure',
  boarding:boolean,
  delayed:boolean,
  cancelled:boolean,
  now=Date.now(),
):{ pulse:CardPulseKind; border:string; tint:string; tintLow?:string; tintHigh?:string }{
  if(cancelled) return { pulse:'none', ...CARD_STATUS.cancelled };
  if(f.status==='landed') return { pulse:'none', ...CARD_STATUS.landed };
  if(boarding){
    const phase=boardingVisualPhase(f, now, type);
    if(phase==='lastCall' || phase==='closing'){
      return { pulse:'boarding', ...CARD_STATUS.boarding };
    }
    return { pulse:'none', ...CARD_STATUS.boarding };
  }
  if(delayed) return { pulse:'delayed', ...CARD_STATUS.delayed };
  if(type==='departure' && (f.status==='scheduled' || f.status==='unknown')){
    const mins=minutesUntilDeparture(f, now);
    if(mins!==null && mins>=0 && mins<10) return { pulse:'late', ...CARD_STATUS.late };
  }
  return { pulse:'none', ...CARD_STATUS.scheduled };
}

const FlightRow = memo(function FlightRow({f,type,airport,active,onPress,tracked,previousGate,index=0,highlightQuery,dimmed,locale,showLandedStamp,onLandedStampDone,showBookButton,onToggleTrack}:{
  f:Flight; type:'arrival'|'departure'; airport:Airport; active:boolean; onPress:()=>void;
  tracked?:boolean;
  previousGate?:string;
  index?:number;
  highlightQuery?:string;
  dimmed?:boolean;
  locale: Locale;
  showLandedStamp?:boolean;
  onLandedStampDone?:()=>void;
  showBookButton?:boolean;
  onToggleTrack?:(f:Flight)=>void;
}){
  if (!f?.number && !f?.airline) return null;
  const { C: theme } = useTheme();
  void locale;
  const rowTickRef = useRef(0);
  const [, setRowTick] = useState(0);
  const livePhase=liveBoardPhase(f, Date.now(), type);
  const delayed=!(livePhase==='departed' || livePhase==='enRoute' || livePhase==='landed')
    && (f.status==='delayed' || (f.delay>0 && f.status!=='en-route' && f.status!=='landed' && f.status!=='cancelled' && !f.actualTime));
  void rowTickRef.current;
  const cardBoard=flightCardBoarding(f, Date.now(), type);
  const boarding=livePhase==='gateClosed' || livePhase==='departed' || livePhase==='enRoute' ? false : cardBoard.boarding;
  const cancelled=f.status==='cancelled';
  const visual=cardStatusVisual(f, type, boarding, delayed, cancelled);
  const resolved=resolveRoute(f,type,airport);
  const originCode=resolved.origin;
  const destCode=resolved.destination && resolved.destination!==resolved.origin
    ? resolved.destination
    : (resolved.destCity && resolved.destCity!==resolved.originCity ? resolved.destCity : '');
  const r=formatCardRoute(originCode, destCode);
  const gate=displayGate(f.gate);
  const sub=liveStatusLabel(f, Date.now(), type);
  const badgePulse=useRef(new Animated.Value(1)).current;
  const statusPulse=useRef(new Animated.Value(1)).current;
  const enter=useRef(new Animated.Value(0)).current;
  const flash=useRef(new Animated.Value(0)).current;
  const shake=useRef(new Animated.Value(0)).current;
  const bleed=useRef(new Animated.Value(delayed?1:0)).current;
  const prevStatus=useRef(f.status);

  useEffect(()=>{
    if(index > 50) return;
    const needsTick=()=>{
      if(f.status==='landed' || f.status==='cancelled' || f.status==='en-route') return false;
      if(liveBoardPhase(f, Date.now(), type)==='departed') return false;
      const card=flightCardBoarding(f, Date.now(), type);
      if(card.boarding) return true;
      const depIso=resolveDepartureIso(f);
      if(!depIso) return false;
      const mins=((flightClockUtcMs(depIso, f.origin, f.originCountry) ?? Date.parse(depIso))-Date.now())/60000;
      return mins<30 && mins>-90;
    };
    if(!needsTick()) return;
    return runWhileAppActive(()=>{
      const id=setInterval(()=>{
        rowTickRef.current+=1;
        if(needsTick()) setRowTick(n=>n+1);
      }, 1000);
      return ()=>clearInterval(id);
    });
  }, [f.id, f.status, f.gate, type, f.scheduledTime, f.revisedTime, f.delay, f.scheduledDeparture, f.departureTime, index]);

  useEffect(()=>{
    const urgent=cardBoard.phase==='lastCall' || cardBoard.phase==='closing';
    if(!urgent){
      badgePulse.setValue(1);
      return;
    }
    badgePulse.setValue(1);
    return startLoopWhileActive(()=>
      Animated.loop(
        Animated.sequence([
          Animated.timing(badgePulse,{toValue:0.7,duration:600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
          Animated.timing(badgePulse,{toValue:1,duration:600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
        ]),
      ),
    );
  },[cardBoard.phase, badgePulse]);

  useEffect(()=>{
    if(index >= BOARD_INITIAL_NUM_TO_RENDER){
      enter.setValue(1);
      return;
    }
    const anim=Animated.timing(enter,{
      toValue:1, duration:280, delay:Math.min(index,12)*40, useNativeDriver:true,
    });
    anim.start();
    return ()=>{
      try{ anim.stop(); }catch(e){ console.warn('[cleanup error]', e); }
    };
  },[enter, index]);

  useEffect(()=>{
    const kind=visual.pulse;
    if(kind==='none'){
      statusPulse.setValue(1);
      return;
    }
    const cfg=CARD_PULSE[kind];
    const half=Math.max(80, Math.round(cfg.ms/2));
    statusPulse.setValue(cfg.from);
    return startLoopWhileActive(()=>
      Animated.loop(
        Animated.sequence([
          Animated.timing(statusPulse,{ toValue:cfg.to, duration:half, useNativeDriver:false }),
          Animated.timing(statusPulse,{ toValue:cfg.from, duration:half, useNativeDriver:false }),
        ]),
      ),
    );
  },[visual.pulse, statusPulse]);
  useEffect(()=>{
    if(!boarding || cancelled) return;
    const key=flightTrackKey(f);
    if(boardingHapticKeys.has(key)) return;
    boardingHapticKeys.add(key);
    haptics.medium();
    flash.setValue(1);
    const flashAnim=Animated.timing(flash,{toValue:0,duration:900,useNativeDriver:true});
    flashAnim.start();
    return ()=>{
      try{ flashAnim.stop(); }catch(e){ console.warn('[cleanup error]', e); }
    };
  },[boarding, cancelled, f.number, f.scheduledTime, flash]);
  useEffect(()=>{
    if(cardBoard.phase!=='lastCall' || cancelled) return;
    const key=flightTrackKey(f);
    if(lastCallHapticKeys.has(key)) return;
    lastCallHapticKeys.add(key);
    haptics.heavy();
  },[cardBoard.phase, cancelled, f.number, f.scheduledTime]);

  useEffect(()=>{
    const prev=prevStatus.current;
    prevStatus.current=f.status;
    if(prev!==f.status && delayed){
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake,{toValue:1,duration:50,useNativeDriver:true}),
        Animated.timing(shake,{toValue:-1,duration:50,useNativeDriver:true}),
        Animated.timing(shake,{toValue:1,duration:50,useNativeDriver:true}),
        Animated.timing(shake,{toValue:0,duration:50,useNativeDriver:true}),
      ]).start();
      Animated.timing(bleed,{toValue:1,duration:420,useNativeDriver:true}).start();
    }
    if(f.status==='cancelled'){
      Animated.timing(bleed,{toValue:1,duration:300,useNativeDriver:true}).start();
    }
  },[f.status, delayed, shake, bleed]);

  const durationMs=durationHintMs(f, airport);
  const arrIso=resolveArrivalIso(f, { durationMs }) || f.scheduledArrival || (type==='arrival' ? f.scheduledTime : '');
  const depIso=resolveDepartureIso(f, { durationMs })
    || f.scheduledDeparture
    || f.departureTime
    || (type==='departure' ? f.scheduledTime : '');
  const originIata=usableAirportCode(resolved.origin) || usableAirportCode(originCode);
  const destIata=usableAirportCode(resolved.destination) || usableAirportCode(destCode) || (type==='arrival' ? airport.iata : '');
  const depClock=fmt(depIso, originIata || resolved.origin, f.originCountry);
  const arrClock=fmt(arrIso, destIata || resolved.destination || airport.iata, f.destCountry);
  const arrSchedIso=f.scheduledArrival || (type==='arrival' ? f.scheduledTime : '');
  const depSchedIso=f.scheduledDeparture
    || (type==='departure' ? f.scheduledTime : '')
    || (arrSchedIso && durationMs ? offsetIso(arrSchedIso, -durationMs, destIata || resolved.destination || airport.iata, f.destCountry) : '');
  const depSchedClock=fmt(depSchedIso, originIata || resolved.origin, f.originCountry);
  const showDepStrike=!!(delayed && depSchedClock && depSchedClock!==EMPTY_CLOCK && depSchedClock!==depClock);
  const cardClock=type==='arrival' ? arrIso : depIso;
  const dur=flightDurationLabel(f, airport);
  const rowTerminal=compactTerminal(type==='departure' ? (f.depTerminal || f.terminal) : (f.arrTerminal || f.terminal));
  const showGate=hasRealGate(gate);
  const gateCloseMins=type==='departure' && isStillOnGround(f) && livePhase!=='gateClosed' && boardingTargetIso(f)
    ? minutesUntilGateClose(f)
    : null;
  const showGateCountdown=showGate && gateCloseMins!==null && gateCloseMins>=0;
  const gateCountdownUrgency=gateUrgencyFor(type==='departure'?(depIso||undefined):undefined, f.status, Date.now(), originIata || resolved.origin, f.originCountry);
  const q=highlightQuery||'';
  const dayLabelIata = (f.status === 'en-route' || type === 'arrival')
    ? (destIata || resolved.destination || airport.iata)
    : (originIata || resolved.origin || airport.iata);
  const dayLabelCountry = (f.status === 'en-route' || type === 'arrival')
    ? (f.destCountry || airportByIata(dayLabelIata)?.country || '')
    : (f.originCountry || airportByIata(dayLabelIata)?.country || '');
  const dayLabelIso = (f.status === 'en-route' || type === 'arrival')
    ? (arrIso || f.scheduledTime)
    : (cardClock || f.scheduledTime);
  const dayLbl=fmtDateLong(dayLabelIso, dayLabelIata, dayLabelCountry);
  const statusTxt=theme.statusEmoji
    ? juniorStatusLabel(
        livePhase==='departed' || livePhase==='enRoute' ? 'en-route'
          : livePhase==='gateClosed' ? 'boarding'
          : boarding ? 'boarding'
          : f.status==='landed' ? 'landed'
          : f.status,
        sub,
      )
    : sub;
  const depTermLine=cardTerminalLine(originIata || resolved.origin, f.depTerminal || (type==='departure' ? f.terminal : ''));
  const arrTermLine=cardTerminalLine(destIata || resolved.destination || airport.iata, f.arrTerminal || (type==='arrival' ? f.terminal : ''));
  const aircraftLabel=cardAircraftLabel(f.aircraft);
  const reliabilitySnapshot=airlineReliabilitySnapshot(f.airlineCode);
  const reliabilityBadge=reliabilitySnapshot?airlineReliabilityDotColor(f.airlineCode):null;
  const reliabilityBadgeRef=useRef<View>(null);
  const [reliabilityOpen,setReliabilityOpen]=useState(false);
  const [reliabilityAnchor,setReliabilityAnchor]=useState<ReliabilityPopupAnchor|null>(null);

  const openReliabilityPopup=()=>{
    haptics.light();
    reliabilityBadgeRef.current?.measureInWindow((x,y,width,height)=>{
      setReliabilityAnchor({ x, y, width, height });
      setReliabilityOpen(true);
    });
  };

  const closeReliabilityPopup=()=>{
    setReliabilityOpen(false);
    setReliabilityAnchor(null);
  };

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [
        { translateY: enter.interpolate({ inputRange:[0,1], outputRange:[14,0] }) },
        { translateX: shake.interpolate({ inputRange:[-1,1], outputRange:[-4,4] }) },
        { scale: boarding ? 1.01 : 1 },
      ],
    }}>
    <View
      style={[
        fr.row,
        active&&fr.active,
        boarding&&fr.rowBoard,
        dimmed&&{ opacity:0.55 },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFill,
          borderRadius:16,
          backgroundColor: visual.pulse==='boarding'
            ? statusPulse.interpolate({
                inputRange:[CARD_PULSE.boarding.from, CARD_PULSE.boarding.to],
                outputRange:[visual.tintLow || CARD_STATUS.boarding.tintLow, visual.tintHigh || CARD_STATUS.boarding.tintHigh],
              })
            : visual.tint,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position:'absolute', left:0, top:0, bottom:0, width:3,
          backgroundColor: visual.border,
          borderTopLeftRadius:16,
          borderBottomLeftRadius:16,
          opacity: visual.pulse==='none' ? 1 : statusPulse,
        }}
      />
      {theme.cardWash?(
        <View pointerEvents="none" style={{
          ...StyleSheet.absoluteFill,
          backgroundColor:theme.cardWash,
          borderRadius:16,
        }}/>
      ):null}
      {theme.cardShimmer?(
        <View pointerEvents="none" style={{
          position:'absolute', top:0, left:0, right:0, height:'42%',
          backgroundColor:'rgba(255,255,255,0.07)',
          borderTopLeftRadius:16, borderTopRightRadius:16,
        }}/>
      ):null}
      {cancelled?(
        <View pointerEvents="none" style={[fr.stampWrap,{ backgroundColor:'rgba(211,47,47,0.15)' }]}>
          <Text style={fr.stamp}>{t().cancelledStamp}</Text>
        </View>
      ):null}
      {showLandedStamp ? (
        <LandedStampOverlay onComplete={()=>onLandedStampDone?.()} />
      ):null}
      {boarding?(
        <Animated.View pointerEvents="none" style={{
          ...StyleSheet.absoluteFill,
          borderWidth:2, borderColor:cardBoard.color, borderRadius:16, opacity: flash,
        }}/>
      ):null}
      <View style={fr.logoWrap} collapsable={false}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={fr.logoTap}>
          <AirlineLogo iata={f.airlineCode} name={f.airline} variant="fids" isDark={theme.isDark}/>
        </TouchableOpacity>
        {reliabilityBadge ? (
          <TouchableOpacity
            ref={reliabilityBadgeRef}
            onPress={openReliabilityPopup}
            style={[fr.reliabilityBadge, { backgroundColor: reliabilityBadge }]}
            hitSlop={{ top:20, bottom:20, left:20, right:20 }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t().reliability}
          >
            <Text style={fr.reliabilityBadgeTxt}>%</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        style={fr.rowPress}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${formatFlightNumber(f)}, ${r}, ${depClock} ${originIata || ''} → ${arrClock} ${destIata || ''}, ${statusTxt}`}
      >
      <View style={fr.rowMain}>
      <View style={fr.mid}>
        {delayed && f.delay>0?(
          <View style={fr.delayChip}>
            <Text style={fr.delayChipTxt} allowFontScaling={false}>⚠ {t().mLate(f.delay)}</Text>
          </View>
        ):null}
        <View style={fr.numRow}>
          <HighlightText
            text={formatFlightNumber(f)}
            query={q}
            color={cancelled ? '#FFFFFF' : (theme.isDark ? '#FFFFFF' : theme.flightNumberColor)}
            highlightColor={theme.accent}
            style={[fr.num, cancelled && fr.cancelledText]}
            allowFontScaling={false}
          />
          {tracked ? (
            <TouchableOpacity
              onPress={() => onToggleTrack?.(f)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t().untrackNum(f.number)}
            >
              <BellSimple size={12} color={theme.accent}/>
            </TouchableOpacity>
          ) : null}
        </View>
        {r ? (
        <HighlightText
          text={r}
          query={q}
          color={cancelled ? '#FFFFFF' : (theme.isDark ? 'rgba(232,240,252,0.92)' : theme.secondary)}
          highlightColor={theme.accent}
          style={[fr.route, cancelled && fr.cancelledText]}
          allowFontScaling={false}
        />
        ) : null}
        {dur?(
          <Text style={fr.dur}>{dur}</Text>
        ):null}
        {aircraftLabel?(
          <Text style={fr.aircraft}>{aircraftLabel}</Text>
        ):null}
      </View>
      <View style={fr.right}>
        <View style={fr.gateSlot}>
          <GateBadge
            type={type}
            gate={gate}
            terminal={rowTerminal || undefined}
            departureIso={type==='departure' ? (depIso || undefined) : (arrIso || undefined)}
            status={f.status}
            originIata={type==='departure' ? (originIata || resolved.origin) : (destIata || resolved.destination || airport.iata)}
            originCountry={type==='departure' ? f.originCountry : f.destCountry}
            compact
          />
          {showGateCountdown?(
            <Text
              style={[
                fr.gateCountdown,
                { color: gateCloseMins! < 5 ? '#FF0000' : gateCountdownUrgency.bg },
                gateCloseMins! < 5 && fr.gateCountdownUrgent,
              ]}
              allowFontScaling={false}
            >{`Closes ${gateCloseMins}m`}</Text>
          ):null}
        </View>
        {showDepStrike && depSchedIso ? (
          <StrikethroughTime
            text={fmtLabeled(depSchedIso, originIata || resolved.origin, f.originCountry)}
            style={fr.old}
            wrapStyle={fr.oldWrap}
            strikeColor={STRIKE_CARD_COLOR}
          />
        ) : null}
        <View style={fr.timeBlock}>
          <View style={fr.timeRow}>
            <Text
              style={[fr.time, cancelled && { color: LIVE.cancelled }]}
              numberOfLines={1}
              ellipsizeMode="clip"
              allowFontScaling={false}
            >{fmtLabeled(depIso, originIata || resolved.origin, f.originCountry)}</Text>
          </View>
          {delayed && f.delay != null && f.delay !== undefined && f.delay > 0?(
            <View style={fr.delayPill}>
              <Text style={fr.delayPillTxt} allowFontScaling={false}>{`Delayed +${f.delay}m`}</Text>
            </View>
          ):null}
          {depTermLine?(
            <Text style={fr.timeMeta} numberOfLines={1} allowFontScaling={false}>{depTermLine}</Text>
          ):null}
        </View>
        <View style={[fr.timeBlock, { marginTop: 6 }]}>
          <Text
            style={[fr.time, cancelled && { color: LIVE.cancelled }]}
            numberOfLines={1}
            ellipsizeMode="clip"
            allowFontScaling={false}
            >{arrClock===EMPTY_CLOCK ? EMPTY_CLOCK : fmtLabeled(arrIso, destIata || resolved.destination || airport.iata, f.destCountry)}</Text>
          {arrTermLine?(
            <Text style={fr.timeMeta} numberOfLines={1} allowFontScaling={false}>{arrTermLine}</Text>
          ):null}
        </View>
      </View>
      </View>
      <View style={fr.statusRow}>
        <Animated.View style={{ opacity: badgePulse, flexShrink: 0, alignSelf: 'flex-start' }}>
          <FlightStatusBadge
            label={statusTxt}
            tone={statusBadgeToneFromPhase(livePhase, { boarding, delayed, cancelled })}
            liveDot={!!(boarding && cardBoard.phase==='open')}
          />
        </Animated.View>
        {dayLbl && dayLbl!==t().today?(
          <Text style={[fr.sub,{marginTop:0}]}>{dayLbl}</Text>
        ):null}
      </View>
      </TouchableOpacity>
      {showBookButton ? (
        <TouchableOpacity
          onPress={() => {
            const o = String(originIata || resolved.origin || '').trim().toUpperCase();
            const d = String(destIata || resolved.destination || '').trim().toUpperCase();
            const day = String(depIso || f.scheduledDeparture || f.departureTime || f.scheduledTime || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1];
            if (!o || !d || !day) return;
            void searchDuffelFlightsOrFallback(o, d, day, 1);
          }}
          style={fr.bookBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t().bookThisFlight}
        >
          <AirplaneTakeoff size={16} color={BRAND.gold} />
        </TouchableOpacity>
      ) : null}
      {reliabilitySnapshot ? (
        <ReliabilityDotPopup
          visible={reliabilityOpen}
          anchor={reliabilityAnchor}
          snapshot={reliabilitySnapshot}
          accentColor={theme.accent}
          onClose={closeReliabilityPopup}
          onOpenFlight={onPress}
        />
      ) : null}
    </View>
    </Animated.View>
  );
});

const BoardTrackAction = memo(function BoardTrackAction({
  f,
  isTracked,
  onToggleTrack,
}: {
  f: Flight;
  isTracked: boolean;
  onToggleTrack: (f: Flight) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => onToggleTrack(f)}
      style={[s.boardSwipeAction, { backgroundColor: isTracked ? '#C62828' : '#2E7D32' }]}
      accessibilityRole="button"
      accessibilityLabel={isTracked ? t().untrackNum(f.number) : t().track}
    >
      <BellSimple size={18} color="#fff" weight="fill" />
      <Text style={s.boardSwipeActionTxt} numberOfLines={1}>{isTracked ? t().untrack : t().track}</Text>
    </TouchableOpacity>
  );
});

const BoardShareAction = memo(function BoardShareAction({
  f,
  onShare,
}: {
  f: Flight;
  onShare: (f: Flight) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => onShare(f)}
      style={[s.boardSwipeAction, { backgroundColor: '#1565C0' }]}
      accessibilityRole="button"
      accessibilityLabel={t().share}
    >
      <ShareNetwork size={18} color="#fff" weight="fill" />
      <Text style={s.boardSwipeActionTxt}>{t().share}</Text>
    </TouchableOpacity>
  );
});

const BoardListRow = memo(function BoardListRow({
  f,
  index,
  tab,
  globalMode,
  flightTab,
  tracked,
  airport,
  selectedId,
  query,
  boardOffset,
  locale,
  onSelect,
  onToggleTrack,
  onShare,
  showLandedStamp,
  onLandedStampDone,
}: {
  f: Flight;
  index: number;
  tab: AppTab;
  globalMode: boolean;
  flightTab: 'arrival' | 'departure';
  tracked: TrackedFlight[];
  airport: Airport;
  selectedId: string;
  query: string;
  boardOffset: number;
  locale: Locale;
  onSelect: (f: Flight) => void;
  onToggleTrack: (f: Flight) => void;
  onShare: (f: Flight) => void;
  showLandedStamp?: boolean;
  onLandedStampDone?: () => void;
}) {
  if (!f?.id || (!f.number && !f.airline)) return null;
  const isTracked = tracked.some(t => sameTrackedFlight(t, f));
  const rowType = tab === 'myflights' && !globalMode
    ? (tracked.find(t => sameTrackedFlight(t, f))?.type ?? 'departure')
    : (f.boardSide==='arrival' || f.boardSide==='departure') ? f.boardSide : flightTab;
  const row = (
    <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
      <FlightRow
        f={f}
        type={rowType}
        airport={airport}
        active={selectedId === f.id}
        onPress={() => onSelect(f)}
        tracked={isTracked}
        onToggleTrack={onToggleTrack}
        previousGate={tracked.find(t => sameTrackedFlight(t, f))?.previousGate}
        index={index}
        highlightQuery={query}
        dimmed={tab === 'myflights' ? false : boardOffset === -1}
        locale={locale}
        showLandedStamp={showLandedStamp}
        onLandedStampDone={onLandedStampDone}
        showBookButton={tab === 'arrival' || tab === 'departure'}
      />
      {query.trim() ? (
        <BookThisFlightButton
          origin={f.origin}
          destination={f.destination}
          date={String(f.scheduledDeparture || f.departureTime || f.scheduledTime || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1]}
        />
      ) : null}
    </View>
  );
  return (
    <Swipeable
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <BoardTrackAction f={f} isTracked={isTracked} onToggleTrack={onToggleTrack} />
      )}
      renderRightActions={() => (
        <BoardShareAction f={f} onShare={onShare} />
      )}
    >
      {row}
    </Swipeable>
  );
});

type BoardHeaderProps = {
  openShareMyFlight: () => void;
  searchInputRef: RefObject<TextInput | null>;
  search: string;
  onSearchChange: (text: string) => void;
  clearSearch: () => void;
  themeSearchPlaceholder?: string;
  C: ThemeColors;
  themeAccent: string;
  globalBusy: boolean;
  routeBusy: boolean;
  recentSearches: string[];
  smartBoardFlights: BoardFlightHit[];
  viewDay: string;
  onApplyQuery: (q: string) => void;
  onRemoveRecent: (q: string) => void;
  onSelectFlightNumber: (n: string) => void;
  runRouteSearch: (from: string, to: string, offset: -1 | 0 | 1) => void;
  routeMode: boolean;
  globalMode: boolean;
  routeHint: string;
  sortedLength: number;
  tab: AppTab;
  statusFilter: StatusFilter;
  onStatusFilter: (key: StatusFilter) => void;
  statusCounts: Record<StatusFilter, number>;
  mode: 'light' | 'dark';
  showRadar: boolean;
  boardOffset: -1 | 0 | 1;
  boardDay: string;
  onBoardOffset: (off: -1 | 0 | 1) => void;
};

type BoardListIntroProps = {
  C: ThemeColors;
  offlineCacheAt: number | null;
  error: string;
  onRetry: () => void;
  loadingBoard: boolean;
  loadTimedOut: boolean;
  locReady: boolean;
  airport: Airport;
  viewDay: string;
  boardOffset: -1 | 0 | 1;
  tab: AppTab;
  addBusy: boolean;
  onAddTrack: (n: string) => void;
  onOpenScanner: () => void;
  myFlightsEmpty: boolean;
  onBrowseFlights: () => void;
  refreshing: boolean;
  tracked?: TrackedFlight[];
  onOpenTrackedFlight?: (f: Flight) => void;
  pickupPersonRev?: number;
  globalMode: boolean;
  sortedLength: number;
  globalBusy: boolean;
};

const BoardHeader = memo(function BoardHeader({
  openShareMyFlight,
  searchInputRef,
  search,
  onSearchChange,
  clearSearch,
  themeSearchPlaceholder,
  C,
  themeAccent,
  globalBusy,
  routeBusy,
  recentSearches,
  smartBoardFlights,
  viewDay,
  onApplyQuery,
  onRemoveRecent,
  onSelectFlightNumber,
  runRouteSearch,
  routeMode,
  globalMode,
  routeHint,
  sortedLength,
  tab,
  statusFilter,
  onStatusFilter,
  statusCounts,
  mode,
  showRadar,
  boardOffset,
  boardDay,
  onBoardOffset,
}: BoardHeaderProps){
  const recentPills = recentSearches.slice(0, 3);
  return (
    <View>
      <View style={s.searchRow}>
        <Pressable
          style={s.searchWrap}
          onPress={()=>{
            searchInputRef.current?.focus();
          }}
        >
          <MagnifyingGlass size={16} color={C.muted}/>
          <TextInput
            ref={searchInputRef}
            style={s.searchInput}
            value={search}
            onChangeText={onSearchChange}
            placeholder={t().searchPlaceholder}
            placeholderTextColor={themeSearchPlaceholder || C.muted}
            autoFocus={false}
            autoCapitalize="none"
            autoCorrect={false}
            allowFontScaling={false}
            clearButtonMode="never"
            returnKeyType="search"
            accessibilityLabel={t().searchFlights}
          />
          {globalBusy||routeBusy?<ActivityIndicator size="small" color={themeAccent}/>:null}
          {search.length>0&&(
            <TouchableOpacity style={s.searchClear} onPress={clearSearch} hitSlop={8} accessibilityRole="button" accessibilityLabel={t().clearSearch}>
              <X size={14} color={C.text}/>
            </TouchableOpacity>
          )}
        </Pressable>
        <TouchableOpacity
          onPress={openShareMyFlight}
          style={s.shareMyFlightBtn}
          accessibilityRole="button"
          accessibilityLabel={t().shareMyFlight}
        >
          <ShareNetwork size={13} color="#0A0E1A" weight="bold"/>
          <Text style={s.shareMyFlightTxt} numberOfLines={1}>{t().share}</Text>
        </TouchableOpacity>
      </View>
      <SmartSearchPanel
        query={search}
        recentSearches={recentSearches}
        boardFlights={smartBoardFlights}
        todayKey={viewDay}
        theme={{
          text: C.text,
          secondary: C.secondary,
          muted: C.muted,
          accent: C.accent,
          border: C.border,
          card: C.card,
          list: C.list,
        }}
        onApplyQuery={onApplyQuery}
        onSelectFlightNumber={onSelectFlightNumber}
        onSearchRoute={runRouteSearch}
      />
      {!search.trim() && recentPills.length>0?(
        <View style={s.recentBlock}>
          <Text style={[s.recentLabel, { color: C.secondary }]}>{t().recentAirports}</Text>
          <View style={s.recentPills}>
          {recentPills.map(q=>(
            <View key={q} style={s.recentPill}>
              <TouchableOpacity
                onPress={()=>{
                  haptics.light();
                  const route=parseRoutePair(q);
                  if(route) runRouteSearch(route.from, route.to, 0);
                  else onApplyQuery(q);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t().searchQuery(q)}
                style={s.recentPillHit}
              >
                <Text
                  style={s.recentPillTxt}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >{q}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={()=>{ haptics.light(); onRemoveRecent(q); }}
                hitSlop={8}
                style={s.recentPillClear}
                accessibilityRole="button"
                accessibilityLabel={`${t().clearSearch} ${q}`}
              >
                <X size={10} color="rgba(244,247,251,0.72)" weight="bold" />
              </TouchableOpacity>
            </View>
          ))}
          </View>
        </View>
      ):null}
      {routeMode?(
        <Text style={s.searchHint}>
          {routeBusy
            ? t().routeHintSearching(routeHint)
            : t().routeResults(routeHint, sortedLength)}
        </Text>
      ):globalMode?(
        <Text style={s.searchHint}>
          {globalBusy
            ? t().globalSearching
            : t().globalResults(sortedLength, search.trim().toUpperCase())}
        </Text>
      ):null}
      {tab!=='myflights'?(
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.statusFilters}
          contentContainerStyle={s.statusFiltersInner}
          keyboardShouldPersistTaps="handled"
        >
          {STATUS_FILTER_TABS.map(({key, Icon})=>{
            const label=statusFilterLabel(key);
            const count=statusCounts[key];
            const selected=statusFilter===key;
            const empty=count===0;
            const activeUnselected=!selected && !empty;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.statusPill,
                  selected&&s.statusPillOn,
                  empty&&!selected&&s.statusPillEmpty,
                  activeUnselected&&s.statusPillActive,
                ]}
                onPress={()=>onStatusFilter(key)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{selected:selected}}
                accessibilityLabel={t().filterFlightsA11y(label, count)}
              >
                <Icon
                  size={14}
                  color={
                    selected ? '#0A0E1A'
                    : activeUnselected ? '#FFFFFF'
                    : (C.isDark ? 'rgba(255,255,255,0.45)' : C.muted)
                  }
                />
                <Text style={[
                  s.statusPillTxt,
                  selected&&s.statusPillTxtOn,
                  empty&&!selected&&s.statusPillTxtEmpty,
                  activeUnselected&&s.statusPillTxtActive,
                ]}>{label}</Text>
                <View style={[
                  s.statusPillBadge,
                  selected&&s.statusPillBadgeOn,
                  !selected&&{ backgroundColor:badgePalette(mode).backgroundColor },
                ]}>
                  <Text style={{
                    fontSize:10,
                    fontWeight:'800',
                    textAlign:'center',
                    color: selected ? '#0A0E1A' : badgePalette(mode).color,
                  }}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ):null}
      {!showRadar && tab!=='myflights'?(
        <View>
          {!globalMode && !routeMode?(
            <View style={s.datePills}>
              {([-1,0,1] as const).map(off=>{
                const on=boardOffset===off;
                const isToday=off===0;
                const label=off===-1?t().yesterday:isToday?t().today:t().tomorrow;
                const dayKey=shiftDateKey(boardDay, off);
                const dateLbl=formatDayShort(dayKey);
                const onToday=on&&isToday;
                const txtColor=onToday?C.tabOn:on?(C.datePillOutline?C.accent:C.tabOn):C.text;
                const subColor=onToday?C.tabOn:on?(C.datePillOutline?C.accent:C.tabOn):C.muted;
                return (
                  <Pressable
                    key={off}
                    style={[
                      s.datePill,
                      on&&!isToday&&s.datePillOn,
                      onToday&&s.datePillToday,
                    ]}
                    collapsable={false}
                    onPress={()=>onBoardOffset(off)}
                    accessibilityRole="button"
                    accessibilityState={{selected:on}}
                    accessibilityLabel={t().dayA11y(label, dateLbl)}
                  >
                    <Text
                      style={[s.datePillTxt, on&&s.datePillTxtOn, { color: txtColor }]}
                      allowFontScaling={false}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    {dateLbl?(
                      <Text
                        style={[s.datePillSub, on&&s.datePillSubOn, { color: subColor }]}
                        allowFontScaling={false}
                        numberOfLines={1}
                      >
                        {dateLbl}
                      </Text>
                    ):null}
                  </Pressable>
                );
              })}
            </View>
          ):null}
        </View>
      ):null}
    </View>
  );
});

const BoardListIntro = memo(function BoardListIntro({
  C,
  offlineCacheAt,
  error,
  onRetry,
  loadingBoard,
  loadTimedOut,
  locReady,
  airport,
  viewDay,
  boardOffset,
  tab,
  addBusy,
  onAddTrack,
  onOpenScanner,
  myFlightsEmpty,
  onBrowseFlights,
  refreshing,
  tracked,
  onOpenTrackedFlight,
  pickupPersonRev,
  globalMode,
  sortedLength,
  globalBusy,
}: BoardListIntroProps){
  return (
    <View>
      {offlineCacheAt?(
        <View style={s.offlineBanner} accessibilityRole="text">
          <WifiSlash size={14} color={themeMode==='light'?'#6b7280':'#94a3b8'}/>
          <Text style={s.offlineBannerTxt}>
            {t().noConnection}
          </Text>
        </View>
      ):null}
      {error?(
        <View style={s.errBanner}>
          <Warning size={14} color={themeMode==='light'?'#b91c1c':'#fca5a5'}/>
          <Text style={s.errTxt}>{error}</Text>
          <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel={t().retry}>
            <Text style={[s.errTxt,{ fontWeight:'800' }]}>{t().retry}</Text>
          </TouchableOpacity>
        </View>
      ):null}
      {loadingBoard?(
        loadTimedOut?(
          <View style={s.center}>
            <Text style={s.emptyTxt}>{t().loadTimeout}</Text>
            <TouchableOpacity
              onPress={onRetry}
              style={{ marginTop:12, backgroundColor:C.accent, borderRadius:12, paddingHorizontal:18, paddingVertical:10 }}
              accessibilityRole="button"
              accessibilityLabel={t().retry}
            >
              <Text style={{ color:'#fff', fontWeight:'800' }}>{t().retry}</Text>
            </TouchableOpacity>
          </View>
        ):(
          <View>
            <View style={{ alignItems:'center', marginTop:12 }}>
              <ActivityIndicator size="large" color={C.accent} />
            </View>
            <Text style={[s.loadTxt,{ textAlign:'center', marginTop:8 }]} numberOfLines={2} ellipsizeMode="tail">
              {!locReady
                ? t().findingNearest
                : boardOffset!==0
                  ? t().loadingFlightsFor(formatDayShort(viewDay) || (boardOffset===1?t().tomorrow:t().yesterday))
                  : t().loadingAirport(airport.iata, airport.name)}
            </Text>
            <SkeletonCards/>
          </View>
        )
      ):null}
      {tab==='myflights'?(
        <>
          {tracked && onOpenTrackedFlight ? (
            <PickupCountdownBanner
              tracked={tracked}
              airport={airport}
              onOpenFlight={f => onOpenTrackedFlight(f as Flight)}
              personRevision={pickupPersonRev}
            />
          ) : null}
          <AddTrackedFlightPanel
            busy={addBusy}
            onSubmit={onAddTrack}
            onOpenScanner={onOpenScanner}
          />
          {myFlightsEmpty?(
            <View style={s.myEmpty}>
              <Airplane size={56} color={C.accent} weight="fill"/>
              <Text style={s.myEmptyTitle}>{t().trackYourFlight}</Text>
              <Text style={s.myEmptySub}>{t().trackEmptySub1}</Text>
              <Text style={s.myEmptySub}>{t().trackEmptySub2}</Text>
              <TouchableOpacity
                style={s.browseBtn}
                onPress={onBrowseFlights}
                accessibilityRole="button"
                accessibilityLabel={t().browseFlightsA11y}
              >
                <Text style={s.browseBtnTxt}>{t().browseFlights}</Text>
              </TouchableOpacity>
            </View>
          ):null}
        </>
      ):null}
      {tab==='myflights'&&globalMode?(
        <View style={{paddingHorizontal:16,paddingTop:8,paddingBottom:4}}>
          <Text style={s.listAirport} numberOfLines={1} ellipsizeMode="tail">{t().globalFlightSearch}</Text>
        </View>
      ):null}
      {globalBusy&&sortedLength===0?(
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.accent}/>
          <Text style={s.loadTxt}>{t().globalSearching}</Text>
        </View>
      ):null}
      <RefreshOverlay active={refreshing} accent={C.accent}/>
    </View>
  );
});

/** My Flights tab — add + timeline of tracked flights */
function AddTrackedFlightPanel({
  busy, onSubmit, onOpenScanner,
}:{
  busy:boolean;
  onSubmit:(flightNumber:string)=>void;
  onOpenScanner:()=>void;
}){
  const { C: theme } = useTheme();
  const [value, setValue]=useState('');
  const [localErr, setLocalErr]=useState('');

  const submit=()=>{
    const clean=normalizeFlightNumberInput(value);
    if(!clean){
      setLocalErr(t().enterValidFlight);
      return;
    }
    setLocalErr('');
    onSubmit(clean);
  };

  return (
    <View style={s.addPanel}>
      <Text style={s.addTitle}>{t().scanBoardingPass}</Text>
      <Text style={s.addSub}>{t().scanBoardingPassSub}</Text>

      {Platform.OS!=='web'?(
        <TouchableOpacity
          style={s.scanBtn}
          onPress={onOpenScanner}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t().scanBoardingPassBarcode}
        >
          <Barcode size={18} color="#fff"/>
          <Text style={s.scanBtnTxt}>{t().scanBoardingPass}</Text>
        </TouchableOpacity>
      ):null}

      <View style={s.addInputRow}>
        <TextInput
          style={s.addInput}
          value={value}
          onChangeText={txt=>{ setValue(txt.toUpperCase()); setLocalErr(''); }}
          placeholder={t().enterFlightNumber}
          placeholderTextColor={theme.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!busy}
          accessibilityLabel={t().flightNumber}
        />
        <TouchableOpacity
          style={[s.addBtn, busy&&{opacity:0.65}]}
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t().addFlightToTracking}
        >
          {busy
            ?<ActivityIndicator color="#fff" size="small"/>
            :<Text style={s.addBtnTxt}>{t().add}</Text>}
        </TouchableOpacity>
      </View>
      {localErr?<Text style={s.addErr}>{localErr}</Text>:null}
    </View>
  );
}

function MyFlightsTimeline({
  flights, selectedId, onSelect, onUntrack, connections, onBrowse,
}:{
  flights:Flight[];
  selectedId:string;
  onSelect:(f:Flight)=>void;
  onUntrack:(f:Flight)=>void;
  connections:TightConnection[];
  onBrowse:()=>void;
}){
  const { C: theme } = useTheme();
  const [, setTick]=useState(0);
  useEffect(()=>{
    return runWhileAppActive(()=>{
      const id=setInterval(()=>setTick(t=>t+1),1000);
      return ()=>clearInterval(id);
    });
  },[]);

  const sorted=useMemo(()=>[...flights].sort((a,b)=>{
    const ta=new Date(a.revisedTime||a.scheduledTime||0).getTime();
    const tb=new Date(b.revisedTime||b.scheduledTime||0).getTime();
    return ta-tb;
  }),[flights]);

  const connAfter=useMemo(()=>{
    const map=new Map<string, TightConnection>();
    for(const c of connections){
      map.set(flightTrackKey(c.incoming), c);
    }
    return map;
  },[connections]);

  if(!sorted.length){
    return (
      <View style={s.myEmpty}>
        <Airplane size={56} color={theme.accent} weight="fill"/>
        <Text style={s.myEmptyTitle}>{t().trackYourFlight}</Text>
        <Text style={s.myEmptySub}>{t().trackEmptySub1}</Text>
        <Text style={s.myEmptySub}>{t().trackEmptySub2}</Text>
        <TouchableOpacity
          style={s.browseBtn}
          onPress={onBrowse}
          accessibilityRole="button"
          accessibilityLabel={t().browseFlightsA11y}
        >
          <Text style={s.browseBtnTxt}>{t().browseFlights}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.myWrap}>
      <View style={s.secHead}>
        <View style={s.secLabelRow}>
          <BellSimple size={14} color={theme.accent}/>
          <Text style={[s.secLabel,{color:theme.accent}]}>{t().timelineTitle}</Text>
        </View>
        <Text style={[s.secCount,{color:theme.text,backgroundColor:theme.accentDim}]}>{sorted.length}</Text>
      </View>
      {sorted.map((f,i)=>{
        const cfg=STATUS_CFG[f.status]??STATUS_CFG.unknown;
        const livePhase=liveBoardPhase(f);
        const liveLabel=liveStatusLabel(f);
        const phase=getBoardingPhase(f);
        const pillColor=livePhase==='departed'||livePhase==='enRoute'?'#3B82F6'
          : livePhase==='gateClosed'?'#64748B'
          : cfg.color;
        const active=selectedId===f.id;
        const o=usableAirportCode(f.origin)||f.originCity;
        const d=usableAirportCode(f.destination)||f.destCity;
        const route=formatCardRoute(o, d);
        const conn=connAfter.get(flightTrackKey(f));
        const critical=conn?conn.gapMin<30:false;
        const connFromTerm=conn?(conn.incoming.arrTerminal || conn.incoming.terminal):'';
        const connToTerm=conn?(conn.outgoing.depTerminal || conn.outgoing.terminal):'';
        const connTermWalk=conn && hasTerminalChange(connFromTerm, connToTerm)
          ? getTerminalWalkTime(conn.hub, connFromTerm, connToTerm)
          : null;
        const pct=Math.round(flightLiveProgress(f)*100);
        const remain=countdown(resolveArrivalIso(f, { durationMs: durationHintMs(f) })||'', f.destination, f.destCountry);
        const progressLine=livePhase==='landed' || flightHasLanded(f)
          ? t().arrived
          : livePhase==='enRoute'
          ? t().enRoutePct(pct, remain || '')
          : livePhase==='departed' ? t().departed
          : livePhase==='gateClosed' ? t().gateClosed
          : boardingCountdownLabel(f);
        return (
          <Fragment key={flightTrackKey(f)}>
            <View style={s.myRowWrap}>
              <View style={s.myRail}>
                <View style={[s.myDot,{backgroundColor:pillColor}]}/>
                {i<sorted.length-1||conn?<View style={s.myLine}/>:null}
              </View>
              <Swipeable
                overshootRight={false}
                containerStyle={{flex:1}}
                renderRightActions={()=>(
                  <TouchableOpacity
                    onPress={()=>onUntrack(f)}
                    style={s.untrackSwipe}
                    accessibilityRole="button"
                    accessibilityLabel={t().untrackNum(f.number)}
                  >
                    <Text style={s.untrackSwipeTxt} numberOfLines={1}>{t().untrack}</Text>
                  </TouchableOpacity>
                )}
              >
              <View style={[s.myCard, active&&s.myCardOn]}>
                <View style={s.myCardTop}>
                  <Pressable
                    style={s.myCardTopMain}
                    onPress={()=>onSelect(f)}
                    accessibilityRole="button"
                    accessibilityLabel={t().openFlightDetails(f.number)}
                  >
                    <AirlineLogo iata={f.airlineCode} name={f.airline} size={AIRLINE_LOGO_SIZE}/>
                    <Text style={s.myNum}>{formatFlightNumber(f)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={()=>onUntrack(f)}
                    hitSlop={10}
                    style={s.myTrash}
                    accessibilityRole="button"
                    accessibilityLabel={t().untrackNum(f.number)}
                  >
                    <Trash size={16} color={theme.muted}/>
                  </Pressable>
                </View>
                <Pressable
                  onPress={()=>onSelect(f)}
                  accessibilityRole="button"
                  accessibilityLabel={t().openFlightDetails(f.number)}
                >
                <View style={s.myStatusWrap}>
                  <FlightStatusBadge label={liveLabel} tone={statusBadgeToneFromPhase(livePhase)} />
                </View>
                {route ? <Text style={s.myRoute}>{route}</Text> : null}
                <View style={s.miniTrack}>
                  <View style={[s.miniFill,{ width:`${Math.min(100, Math.max(3, pct))}%` as any, backgroundColor:pillColor }]}/>
                </View>
                <Text style={[s.myCd,{
                  color:phase==='boarding'?'#22c55e':phase==='departed'?'#94a3b8':theme.accent,
                }]} numberOfLines={1} ellipsizeMode="tail">
                  {progressLine||(() => {
                    const myArr=resolveArrivalIso(f, { durationMs: durationHintMs(f) });
                    const myDep=resolveDepartureIso(f);
                    return myArr
                      ? fmtArrives(myArr, f.destination, f.destCountry)
                      : fmtLabeled(myDep, f.origin, f.originCountry);
                  })()}
                </Text>
              </Pressable>
              </View>
              </Swipeable>
            </View>
            {conn?(
              <View style={s.myRowWrap}>
                <View style={s.myRail}>
                  <View style={[s.myDot,{backgroundColor:critical?'#dc2626':'#d97706'}]}/>
                  {i<sorted.length-1?<View style={s.myLine}/>:null}
                </View>
                <View style={[
                  s.connCard,
                  critical?s.connCardCritical:s.connCardTight,
                ]}>
                  {critical
                    ?<WarningCircle size={18} color="#dc2626"/>
                    :<ArrowsLeftRight size={18} color="#d97706"/>}
                  <View style={{flex:1,minWidth:0}}>
                    <Text style={[s.connCardTitle,{color:critical?'#dc2626':'#b45309'}]}>
                      {critical
                        ? t().criticalConnection(Math.round(conn.gapMin))
                        : t().tightConnectionMin(Math.round(conn.gapMin))}
                    </Text>
                    <Text style={s.connCardSub}>
                      {flightSlug(conn.incoming.number)} → {flightSlug(conn.outgoing.number)} · {conn.hub}
                    </Text>
                    {connTermWalk && connTermWalk.minutes > 0 ? (
                      <Text style={[s.connCardSub, { color: critical ? '#dc2626' : '#b45309', fontWeight: '700' }]}>
                        {t().terminalChangeAllow(
                          compactTerminal(connFromTerm) || connFromTerm || '—',
                          compactTerminal(connToTerm) || connToTerm || '—',
                          connTermWalk.minutes,
                        )}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ):null}
          </Fragment>
        );
      })}
    </View>
  );
}

// ── Connection modal ───────────────────────────────────────────────────────────
function ConnectionModal({
  visible, onClose, defaultHub, defaultIncoming='', isPro=false, onRequirePro,
}:{ visible:boolean; onClose:()=>void; defaultHub:string; defaultIncoming?:string;
  isPro?:boolean; onRequirePro?:(highlight?:string)=>void }){
  const { C: theme } = useTheme();
  const [inn, setInn]=useState('');
  const [out, setOut]=useState('');
  const [hub, setHub]=useState(defaultHub);
  const [busy, setBusy]=useState(false);
  const [err, setErr]=useState('');
  const [result, setResult]=useState<ConnResult|null>(null);
  const [quotaUsed, setQuotaUsed]=useState(0);

  useEffect(()=>{
    if(!visible) return;
    setHub('');
    setErr('');
    setOut('');
    setInn(normalizeFlightNumberInput(defaultIncoming) || '');
    loadLastConnectionResult<ConnResult>().then(last=>{
      if(last?.verdict){
        setResult(last);
        if(last.hub) setHub(last.hub);
      }
    }).catch(()=>{});
    canCheckConnection(!!isPro || BETA_MODE).then(q=>setQuotaUsed(q.used)).catch(()=>{});
  },[visible, defaultHub, defaultIncoming, isPro]);

  const isDigitsOnlyFlight=(v:string)=>/^\d+$/.test(v.trim());

  const setFlightInput=(setter:(v:string)=>void)=>(txt:string)=>{
    const raw=String(txt||'').toUpperCase();
    if(/[→]/.test(raw) || /\s(?:TO|→)\s/.test(raw)){
      const left=raw.split(/→|\sTO\s/)[0].trim();
      setter(normalizeFlightNumberInput(left) || '');
      return;
    }
    setter(raw.replace(/[^A-Z0-9\s]/g, '').slice(0, 10));
  };

  const run=async()=>{
    const a=normalizeFlightNumberInput(inn) || inn.trim().toUpperCase();
    const b=normalizeFlightNumberInput(out) || out.trim().toUpperCase();
    if(!a||!b){ setErr(t().enterBothFlights); return; }
    if(!isFlightNumberQuery(a) || !isFlightNumberQuery(b)){
      setErr(t().enterValidFlight);
      return;
    }
    if(isDigitsOnlyFlight(a) || isDigitsOnlyFlight(b)){
      setErr(t().includeAirlineCode);
      return;
    }
    const quota=await canCheckConnection(!!isPro || BETA_MODE);
    if(!quota.ok){
      setQuotaUsed(quota.used);
      setErr(t().freeConnLimit(FREE_CONN_PER_DAY));
      return;
    }
    setBusy(true); setErr('');
    try{
      const r=await checkConnection(a,b);
      await recordConnectionCheck(!!isPro || BETA_MODE);
      await saveLastConnectionResult(r);
      setQuotaUsed(quota.used+1);
      setResult(r);
      setHub(r.hub);
    } catch(e:any){
      setErr(e?.message||t().couldNotCheckConnection);
    } finally {
      setBusy(false);
    }
  };

  const v=result?VERDICT_UI[result.verdict]:null;
  const hubAp=airportByIata(hub);
  const verdictBg=v?.bg;
  const verdictBorder=v?.border;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cx.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={cx.sheetWrap}>
          <View style={cx.sheet}>
            <View style={cx.handle}/>
            <View style={cx.head}>
              <View>
                <Text style={cx.title}>{t().willIMakeConnection}</Text>
                <Text style={cx.sub}>{t().checkLayover}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={cx.close} hitSlop={10}>
                <Text style={cx.closeTxt}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={cx.label}>{t().incomingFlight}</Text>
              <TextInput
                style={cx.input}
                value={inn}
                onChangeText={setFlightInput(setInn)}
                placeholder={t().eGFlight}
                placeholderTextColor="#8896B0"
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                keyboardType="default"
              />
              <FlightAutocomplete
                flush
                query={inn}
                theme={{
                  text: '#F5F0E8',
                  secondary: '#8896B0',
                  muted: '#8896B0',
                  accent: BRAND.gold,
                  border: 'rgba(201,168,76,0.35)',
                  card: '#12233C',
                }}
                onSelect={n => setInn(normalizeFlightNumberInput(n) || n.toUpperCase())}
              />
              {isDigitsOnlyFlight(inn)?(
                <Text style={cx.inlineHint}>{t().includeAirlineCode}</Text>
              ):null}

              <Text style={cx.label}>{t().connectingFlight}</Text>
              <TextInput
                style={cx.input}
                value={out}
                onChangeText={setFlightInput(setOut)}
                placeholder={t().eGFlight2}
                placeholderTextColor="#8896B0"
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
              />
              <FlightAutocomplete
                flush
                query={out}
                theme={{
                  text: '#F5F0E8',
                  secondary: '#8896B0',
                  muted: '#8896B0',
                  accent: BRAND.gold,
                  border: 'rgba(201,168,76,0.35)',
                  card: '#12233C',
                }}
                onSelect={n => setOut(normalizeFlightNumberInput(n) || n.toUpperCase())}
              />
              {isDigitsOnlyFlight(out)?(
                <Text style={cx.inlineHint}>{t().includeAirlineCode}</Text>
              ):null}

              <Text style={cx.label}>{t().connectionAirport}</Text>
              <TextInput
                style={cx.input}
                value={hub}
                onChangeText={txt=>setHub(txt.toUpperCase())}
                placeholder={t().autoDetectedAirport}
                placeholderTextColor={theme.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={3}
                editable={false}
              />
              {hubAp?<Text style={cx.hint}>{hubAp.flag} {hubAp.name}</Text>:null}

              <TouchableOpacity style={[cx.cta, busy&&{opacity:0.7}]} onPress={run} disabled={busy}>
                {busy
                  ?<ActivityIndicator color="#fff"/>
                  :<Text style={cx.ctaTxt}>{t().checkConnection}</Text>}
              </TouchableOpacity>
              {!isPro && !BETA_MODE?(
                <Text style={cx.hint}>
                  {t().checksToday(quotaUsed, FREE_CONN_PER_DAY)}
                </Text>
              ):null}

              {err?(
                <View style={cx.errRow}>
                  <Warning size={14} color={themeMode==='light'?'#b91c1c':'#fca5a5'}/>
                  <View style={{flex:1}}>
                    <Text style={cx.err}>{err}</Text>
                    {!isPro && !BETA_MODE && quotaUsed>=FREE_CONN_PER_DAY?(
                      <TouchableOpacity onPress={()=>onRequirePro?.()} hitSlop={8} style={{marginTop:6}}>
                        <Text style={{color:theme.accent,fontWeight:'800',fontSize:13}}>{t().upgradeUnlimited}</Text>
                      </TouchableOpacity>
                    ):null}
                  </View>
                </View>
              ):null}

              {result&&v?(
                <View style={[cx.result, {backgroundColor:verdictBg, borderColor:verdictBorder}]}>
                  <View style={cx.resultMsgRow}>
                    <View style={[cx.verdictDot,{backgroundColor:v.color}]}/>
                    <Text style={[cx.resultMsg,{color:v.color}]}>
                      {result.message}
                    </Text>
                  </View>

                  <View style={cx.metaRow}>
                    <View style={cx.metaBox}>
                      <Text style={cx.metaLbl}>{t().connection}</Text>
                      <Text style={cx.metaVal}>
                        {Number.isFinite(result.gapMin)?fmtDuration(result.gapMin):'—'}
                      </Text>
                    </View>
                    <View style={cx.metaBox}>
                      <Text style={cx.metaLbl}>{t().walk}</Text>
                      <Text style={cx.metaVal}>{result.walk??result.mct}m</Text>
                      <Text style={cx.metaSub}>{t().gateToGate}</Text>
                    </View>
                    <View style={cx.metaBox}>
                      <Text style={cx.metaLbl}>{t().terminal}</Text>
                      <Text style={cx.metaVal}>
                        {result.sameTerminal===null?'—'
                          :result.sameTerminal?t().same:t().change}
                      </Text>
                      {result.sameTerminal!==null?(
                        <Text style={cx.metaSub}>
                          {(result.incoming.arrTerminal||result.incoming.terminal||'?')}
                          {' → '}
                          {(result.outgoing.depTerminal||result.outgoing.terminal||'?')}
                        </Text>
                      ):null}
                    </View>
                  </View>

                  <View style={cx.leg}>
                    <Text style={cx.legTitle}>{t().incomingDot(result.incoming.number)}</Text>
                    <Text style={cx.legLine}>
                      {result.incoming.origin} → {result.incoming.destination}
                      {' · '}{liveStatusLabel(result.incoming)}
                      {result.incoming.delay>0?` · +${result.incoming.delay}m`:''}
                    </Text>
                    <Text style={cx.legTime}>
                      {fmtArrives(resolveArrivalIso(result.incoming), result.incoming.destination, result.incoming.destCountry)}
                      {result.incoming.status==='delayed'?t().delayedParen:''}
                    </Text>
                  </View>

                  <View style={cx.leg}>
                    <Text style={cx.legTitle}>{t().connectingDot(result.outgoing.number)}</Text>
                    <Text style={cx.legLine}>
                      {result.outgoing.origin} → {result.outgoing.destination}
                      {' · '}{liveStatusLabel(result.outgoing)}
                      {result.outgoing.delay>0?` · +${result.outgoing.delay}m`:''}
                    </Text>
                    <Text style={cx.legTime}>
                      {t().departsAt(fmtLabeled(result.outgoing.departureTime||result.outgoing.revisedTime, result.outgoing.origin, result.outgoing.originCountry))}
                    </Text>
                  </View>

                  <TouchableOpacity style={cx.refresh} onPress={run} disabled={busy}>
                    <Text style={cx.refreshTxt}>{t().recalculate}</Text>
                  </TouchableOpacity>
                </View>
              ):null}

              <View style={{height:40}}/>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const RADAR_JUMPS = [
  { iata:'BKK', lat:13.69, lon:100.75, z:RADAR_MAX_ZOOM },
  { iata:'HKT', lat:8.1132, lon:98.3017, z:RADAR_MAX_ZOOM },
  { iata:'SIN', lat:1.36,  lon:103.99, z:RADAR_MAX_ZOOM },
  { iata:'KUL', lat:2.75,  lon:101.71, z:RADAR_MAX_ZOOM },
  { iata:'DPS', lat:-8.75, lon:115.17, z:RADAR_MAX_ZOOM },
  { iata:'CNX', lat:18.77, lon:98.96,  z:RADAR_MAX_ZOOM },
];

function pickRadarFlight(hits:Flight[]):Flight|null{
  if(!hits.length) return null;
  return hits.find(f=>f.status==='en-route')
    || hits.find(f=>f.status==='boarding')
    || hits[0];
}

/** ADS-B often uses ICAO airline prefix (THA316) while lookup wants IATA (TG316). */
const AIRLINE_ICAO_TO_IATA: Record<string, string> = {
  THA:'TG', SLK:'MI', AXM:'D7', MAS:'MH', AWQ:'QZ', LNI:'JT', GIA:'GA',
  TGW:'TR', JSA:'3K', SEJ:'6E', AIC:'AI', UAE:'EK', ETD:'EY', QTR:'QR',
  SIA:'SQ', PAL:'PR', HVN:'VN', CEB:'5J', BKP:'PG', NOK:'DD', AIQ:'FD',
  KAL:'KE', AAR:'OZ', ANA:'NH', JAL:'JL', CAL:'CI', CPA:'CX', HDA:'HX',
  CSN:'CZ', CCA:'CA', CES:'MU', BAW:'BA', AFR:'AF', DLH:'LH', KLM:'KL',
  RYR:'FR', EZY:'U2', WZZ:'W6', SAS:'SK', FIN:'AY', IBE:'IB', TAP:'TP',
  AUA:'OS', SWR:'LX', BEL:'SN', IAW:'AZ', QFA:'QF', ANZ:'NZ', VIR:'VS',
  AAL:'AA', UAL:'UA', DAL:'DL', ACA:'AC', CXA:'MF', CSC:'3U', NAX:'DY',
  TRA:'HV', TVF:'TO',
};

function radarCallsignToFlightNumber(cs: string): string {
  const clean = String(cs || '').replace(/\s+/g, '').toUpperCase();
  const m = clean.match(/^([A-Z]{3})(\d{1,4}[A-Z]?)$/);
  if (m && AIRLINE_ICAO_TO_IATA[m[1]]) return AIRLINE_ICAO_TO_IATA[m[1]] + m[2];
  return clean;
}

function parseRadarPlaneMessage(raw:string):RadarPick|null{
  try{
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!data || data.type!=='planeSelect') return null;
    const callsign=String(data.callsign||data.icao||'').trim();
    if(!callsign) return null;
    const altitude=data.altitude==null||data.altitude===''?null:Number(data.altitude);
    const speedMs=data.speedMs==null||data.speedMs===''?null:Number(data.speedMs);
    return {
      callsign,
      icao: String(data.icao || '').trim(),
      altitude: Number.isFinite(altitude as number)?(altitude as number):null,
      speedMs: Number.isFinite(speedMs as number)?(speedMs as number):null,
      lat: Number.isFinite(Number(data.lat)) ? Number(data.lat) : null,
      lon: Number.isFinite(Number(data.lon)) ? Number(data.lon) : null,
      heading: Number.isFinite(Number(data.heading)) ? Number(data.heading) : null,
      vertRate: Number.isFinite(Number(data.vertRate)) ? Number(data.vertRate) : null,
      country: String(data.country || '').trim(),
      registration: String(data.registration || '').trim(),
    };
  } catch{
    return null;
  }
}

function RadarModal({
  visible, onClose, airport, isTracked, onToggleTrack, variant='modal', onAircraftCount, bottomInset=SHEET_COLLAPSED_PX, pollsActive=true,
}:{
  visible:boolean;
  onClose:()=>void;
  airport:Airport;
  isTracked:(f:Flight)=>boolean;
  onToggleTrack:(f:Flight)=>void;
  variant?: 'modal' | 'backdrop';
  onAircraftCount?: (total:number, shown?:number)=>void;
  bottomInset?: number;
  pollsActive?: boolean;
}){
  const { C: theme } = useTheme();
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sheetH = Math.round(Dimensions.get('window').height * 0.9);
  const translateY = useRef(new Animated.Value(sheetH)).current;
  const closing = useRef(false);
  const lastAircraft = useRef<RadarAircraft[]>([]);
  const mapReady = useRef(false);
  const radarLoadSeq = useRef(0);

  const [pick, setPick] = useState<RadarPick|null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flightBusy, setFlightBusy] = useState(false);
  const [flightErr, setFlightErr] = useState('');
  const [radarFlight, setRadarFlight] = useState<Flight|null>(null);
  const [radarCount, setRadarCount] = useState(0);
  const [radarShown, setRadarShown] = useState(0);
  const [markersLoading, setMarkersLoading] = useState(false);
  const [radarCached, setRadarCached] = useState(false);
  const [radarClock, setRadarClock] = useState('--:--:--');
  const [nextIn, setNextIn] = useState(15);
  const [radarBusy, setRadarBusy] = useState(false);
  const [jumpCounts, setJumpCounts] = useState<Record<string, number>>({});

  useEffect(()=>{ onAircraftCount?.(radarCount, radarShown); },[radarCount, radarShown, onAircraftCount]);

  const html = useMemo(
    ()=>buildRadarHTML(airport.lat, airport.lon, RADAR_MAX_ZOOM, 'dark', PROXY, airport.iata),
    [airport.iata, airport.lat, airport.lon]
  );

  const pushAircraft = useCallback((list:RadarAircraft[], meta?:{ cached?:boolean; partial?:boolean }, allowEmpty=false)=>{
    console.warn('[Radar] pushing aircraft count:', list.length, 'center', airport.iata, airport.lat, airport.lon);
    console.warn('[Radar] mapReady:', mapReady.current);
    if(!list.length && !allowEmpty) return;
    lastAircraft.current = list;
    const metaObj = { cached: !!meta?.cached, partial: !!meta?.partial };
    if(Platform.OS==='web'){
      const win = iframeRef.current?.contentWindow as (Window & { applyRadarAircraft?:(s:RadarAircraft[], m?:{ cached?:boolean; partial?:boolean })=>void })|null;
      if(win?.applyRadarAircraft){
        win.applyRadarAircraft(list, metaObj);
      } else {
        console.warn('[Radar] iframe not ready — queued', list.length);
      }
      return;
    }
    const wv = webRef.current;
    if(!wv){
      console.warn('[Radar] webview ref not ready — will retry', list.length);
      return;
    }
    const payload = JSON.stringify({ type: 'radarAircraft', list, meta: metaObj });
    wv.injectJavaScript(
      `try{window.applyRadarAircraft&&window.applyRadarAircraft(${JSON.stringify(list)},${JSON.stringify(metaObj)});}catch(e){} true;`,
    );
    wv.postMessage(payload);
  },[airport.iata, airport.lat, airport.lon]);

  useEffect(()=>{
    mapReady.current = false;
  },[html]);

  useEffect(()=>{
    if(!visible){
      setSheetOpen(false);
      setPick(null);
      setRadarFlight(null);
      setFlightErr('');
      setRadarShown(0);
      setMarkersLoading(false);
    }
  },[visible]);

  const openPlaneSheet = useCallback((next:RadarPick)=>{
    setPick(next);
    setSheetOpen(true);
    setFlightBusy(true);
    setFlightErr('');
    const clean=next.callsign.replace(/\s+/g,'').toUpperCase();
    const guessed=radarCallsignToFlightNumber(clean);
    setRadarFlight(stubFlightFromNumber(guessed));
    const tryLookup=(num:string)=>fetchFlightByNumber(num).then(hits=>{
      const f=pickRadarFlight(hits);
      if(!f) throw new Error(t().couldNotFindFlightShort(num));
      return f;
    });
    tryLookup(guessed)
      .catch(()=> guessed!==clean ? tryLookup(clean) : Promise.reject())
      .then(f=>{ setRadarFlight(f); setFlightErr(''); })
      .catch(()=>{ /* keep stub so Track still works */ })
      .finally(()=>setFlightBusy(false));
  },[]);

  const onMapReady = useCallback(()=>{
    mapReady.current = true;
    const push = ()=>{
      if(lastAircraft.current.length) pushAircraft(lastAircraft.current, { cached: radarCached });
    };
    push();
    setTimeout(push, 200);
    setTimeout(push, 700);
    if(visible && pollsActive){
      if(Platform.OS==='web'){
        const win = iframeRef.current?.contentWindow as (Window & { startRadarTick?: () => void }) | null;
        win?.startRadarTick?.();
      } else {
        webRef.current?.injectJavaScript('window.startRadarTick && window.startRadarTick(); true;');
      }
    }
  },[pushAircraft, radarCached, visible, pollsActive]);

  const handleRadarMessage = useCallback((raw:string)=>{
    try{
      const data=JSON.parse(raw);
      if(data?.type==='radarReady'){
        onMapReady();
        return;
      }
      if(data?.type==='radarProgress'){
        setRadarShown(Number(data.shown)||0);
        if(typeof data.total==='number') setRadarCount(data.total);
        setMarkersLoading(!!data.loading);
        return;
      }
    } catch{ /* not json */ }
    const parsed=parseRadarPlaneMessage(raw);
    if(parsed) openPlaneSheet(parsed);
  },[onMapReady, openPlaneSheet]);

  useEffect(()=>{
    if(!visible || Platform.OS!=='web') return;
    const onMsg=(ev:MessageEvent)=>{
      const data=typeof ev.data==='string'?ev.data:null;
      if(!data) return;
      handleRadarMessage(data);
    };
    window.addEventListener('message', onMsg);
    return ()=>window.removeEventListener('message', onMsg);
  },[visible, handleRadarMessage]);

  const onWebViewMessage = useCallback((ev:{ nativeEvent:{ data:string } })=>{
    handleRadarMessage(ev.nativeEvent.data);
  },[handleRadarMessage]);

  const loadRadar = useCallback(async()=>{
    const seq = ++radarLoadSeq.current;
    const alive = () => seq === radarLoadSeq.current;
    const aroundAirport = (list:RadarAircraft[]) =>
      nearestWithin(list, airport.lat, airport.lon, RADAR_KEEP_KM, 500);

    let fullApplied = false;
    const apply = (list:RadarAircraft[], meta?:{ cached?:boolean }, kind?:'cache'|'near'|'full')=>{
      if(!alive()) return;
      list = aroundAirport(list);
      if(kind !== 'full' && lastAircraft.current.length > list.length){
        list = aroundAirport(mergeAircraft(lastAircraft.current, list));
      }
      if(kind === 'near' && !list.length) return;
      lastAircraft.current = list;
      setRadarCount(list.length);
      if(meta?.cached != null) setRadarCached(!!meta.cached);
      pushAircraft(list, { ...meta, partial: kind === 'near' }, kind !== 'near');
    };

    lastAircraft.current = aroundAirport(lastAircraft.current);
    if(lastAircraft.current.length){
      apply(lastAircraft.current, { cached: true }, 'cache');
    }

    setRadarBusy(false);
    setNextIn(15);

    const cacheTask = readRadarCache(airport.iata).then(disk=>{
          if(!alive() || fullApplied || !disk?.aircraft.length) return;
          const had = lastAircraft.current;
          const next = had.length ? mergeAircraft(had, disk.aircraft) : disk.aircraft;
          apply(next, { cached: true }, 'cache');
          if(disk.at){
            setRadarClock(new Date(disk.at).toLocaleTimeString('en-GB', { hour12: false }));
          }
        }).catch(e=>{ console.warn('[Radar] cache read failed', e); });

    const nearTask = fetchRadarNear(airport.lat, airport.lon).then(snap=>{
      if(!alive() || fullApplied) return;
      const first = nearestWithin(snap.aircraft, airport.lat, airport.lon);
      if(!first.length) return;
      const next = lastAircraft.current.length
        ? mergeAircraft(lastAircraft.current, first)
        : first;
      apply(next, { cached: false }, 'near');
    }).catch(e=>{ console.warn('[Radar] near fetch failed', e); });

    const fullTask = fetchRadarSnapshot(airport.lat, airport.lon).then(snap=>{
      if(!alive()) return;
      fullApplied = true;
      const counts: Record<string, number> = {};
      for(const j of RADAR_JUMPS) counts[j.iata] = countNear(snap.aircraft, j.lat, j.lon);
      setJumpCounts(counts);
      setRadarClock(new Date().toLocaleTimeString('en-GB', { hour12: false }));
      apply(snap.aircraft, { cached: snap.cached }, 'full');
      writeRadarCache(airport.iata, snap).catch(()=>{});
    }).catch(e=>{
      console.warn('[Radar] snapshot fetch failed', e);
      if(alive() && lastAircraft.current.length){
        setRadarCached(true);
        pushAircraft(lastAircraft.current, { cached: true });
      }
    });

    await Promise.allSettled([cacheTask, nearTask, fullTask]);
    if(alive() && !lastAircraft.current.length){
      console.warn('[Radar] no aircraft from cache, near, or snapshot for', airport.iata);
    }
  },[airport.iata, airport.lat, airport.lon, pushAircraft]);

  const stopRadarWebView = useCallback(()=>{
    if(Platform.OS==='web'){
      const win = iframeRef.current?.contentWindow as (Window & { stopRadarTick?: () => void }) | null;
      win?.stopRadarTick?.();
    } else {
      webRef.current?.injectJavaScript('window.stopRadarTick && window.stopRadarTick(); true;');
    }
  },[]);

  const startRadarWebView = useCallback(()=>{
    if(Platform.OS==='web'){
      const win = iframeRef.current?.contentWindow as (Window & { startRadarTick?: () => void }) | null;
      win?.startRadarTick?.();
    } else {
      webRef.current?.injectJavaScript('window.startRadarTick && window.startRadarTick(); true;');
    }
  },[]);

  useEffect(()=>{
    if(!visible || !pollsActive){
      if(!visible) mapReady.current = false;
      stopRadarWebView();
      return;
    }
    loadRadar();
    const poll = setInterval(()=>{ loadRadar(); }, 15000);
    const countdown = setInterval(()=>setNextIn(n=>Math.max(0, n-1)), 1000);
    const syncLive = ()=>{
      startRadarWebView();
      if(lastAircraft.current.length){
        pushAircraft(lastAircraft.current, { cached: radarCached });
      }
    };
    syncLive();
    const retries = [400, 1200].map(ms => setTimeout(syncLive, ms));
    return ()=>{
      clearInterval(poll);
      clearInterval(countdown);
      retries.forEach(clearTimeout);
      stopRadarWebView();
    };
  },[visible, pollsActive, loadRadar, stopRadarWebView, startRadarWebView, pushAircraft, radarCached]);

  const dismiss=useCallback(()=>{
    if(closing.current) return;
    closing.current=true;
    setSheetOpen(false);
    Animated.timing(translateY,{
      toValue:sheetH, duration:220, useNativeDriver:true,
    }).start(({finished})=>{
      closing.current=false;
      if(finished) onClose();
    });
  },[onClose, sheetH, translateY]);

  const dismissRef=useRef(dismiss);
  dismissRef.current=dismiss;

  useEffect(()=>{
    if(!visible) return;
    closing.current=false;
    translateY.setValue(sheetH);
    Animated.spring(translateY,{
      toValue:0, useNativeDriver:true, tension:65, friction:11,
    }).start();
  },[visible, sheetH, translateY]);

  const pan=useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:()=>true,
      onMoveShouldSetPanResponder:(_,g)=>g.dy>4,
      onPanResponderMove:(_,g)=>{
        if(g.dy>0) translateY.setValue(g.dy);
      },
      onPanResponderRelease:(_,g)=>{
        if(g.dy>110 || g.vy>1.1){
          dismissRef.current();
        } else {
          Animated.spring(translateY,{
            toValue:0, useNativeDriver:true, tension:65, friction:11,
          }).start();
        }
      },
    })
  ).current;

  const jump=(lat:number, lon:number, z:number)=>{
    if(Platform.OS==='web'){
      const win=iframeRef.current?.contentWindow as (Window & { flyTo?:(a:number,b:number,c:number)=>void })|null;
      win?.flyTo?.(lat, lon, z);
      return;
    }
    webRef.current?.injectJavaScript(`window.flyTo && window.flyTo(${lat},${lon},${z}); true;`);
  };

  const radarMap=(
    <View style={variant==='backdrop'?{flex:1}:rd.map}>
      {Platform.OS==='web'?(
        <iframe
          ref={iframeRef}
          srcDoc={html}
          style={{ width:'100%', height:'100%', border:'none', display:'block' }}
          title={t().radarTitle}
        />
      ):(
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html, headers: { 'Accept-Language': 'en-US,en;q=1.0' } }}
          style={{ flex:1, backgroundColor:theme.bg }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          mixedContentMode="always"
          overScrollMode="never"
          nestedScrollEnabled
          onShouldStartLoadWithRequest={()=>true}
          onMessage={onWebViewMessage}
          onError={()=>{}}
          onHttpError={()=>{}}
        />
      )}
      {(visible && radarCount === 0 && (radarBusy || markersLoading))?(
        <View pointerEvents="none" style={rd.bootCenter}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      ):null}
    </View>
  );

  const radarSheet=(
    <RadarFlightSheet
      visible={sheetOpen}
      pick={pick}
      onClose={()=>setSheetOpen(false)}
      theme={theme}
      busy={flightBusy}
      err={flightErr}
      flight={radarFlight}
      tracked={radarFlight ? isTracked(radarFlight) : false}
      onToggleTrack={()=>{
        if(!radarFlight) return;
        onToggleTrack(radarFlight);
      }}
    />
  );

  if(variant==='backdrop'){
    if(!visible) return null;
    const peek=Math.max(0, Math.round(bottomInset));
    return (
      <View style={peek>0 ? [StyleSheet.absoluteFill, { zIndex:0 }] : { flex:1, minHeight:0 }} pointerEvents="box-none">
        <View
          style={peek>0
            ? { position:'absolute', top:0, left:0, right:0, bottom:peek, overflow:'hidden', backgroundColor:'#05070d' }
            : { flex:1, minHeight:0, overflow:'hidden', backgroundColor:'#05070d' }}
          pointerEvents="auto"
          collapsable={false}
        >
          {radarMap}
        </View>
        {radarSheet}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismiss}>
      <View style={rd.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}/>
        <Animated.View
          style={[
            rd.sheet,
            { height:sheetH, transform:[{ translateY }] },
          ]}
        >
          <View style={rd.grabZone} {...pan.panHandlers}>
            <View style={rd.handle}/>
            <View style={rd.head}>
              <View style={{flex:1,paddingRight:12}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                  <View style={[rd.liveDot, radarCached && { backgroundColor:'#f59e0b' }]}/>
                  <Text style={rd.title}>
                    ✈️ {t().radarAircraft(
                      radarShown>0 && radarCount>0 ? `${radarShown}/${radarCount}` : String(radarCount),
                      radarCached ? t().cachedUpper : t().live,
                      radarClock,
                    )}
                  </Text>
                </View>
                <Text style={rd.sub}>
                  {(radarBusy || markersLoading) && radarShown===0 ? t().loadingAircraft : t().radarNextUpdate(nextIn)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={()=>loadRadar()}
                style={rd.close}
                hitSlop={10}
                accessibilityLabel={t().refreshRadar}
              >
                {radarBusy
                  ? <ActivityIndicator size="small" color={theme.accent}/>
                  : <ArrowsClockwise size={16} color={theme.secondary}/>}
              </TouchableOpacity>
              <TouchableOpacity onPress={dismiss} style={[rd.close,{marginLeft:6}]} hitSlop={10} accessibilityLabel={t().closeRadar}>
                <Text style={rd.closeTxt}>×</Text>
              </TouchableOpacity>
            </View>
          </View>

          {radarMap}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={rd.jumps}
            contentContainerStyle={rd.jumpsInner}
          >
            {RADAR_JUMPS.map(j=>(
              <TouchableOpacity
                key={j.iata}
                style={rd.jumpBtn}
                onPress={()=>jump(j.lat, j.lon, j.z)}
                accessibilityRole="button"
                accessibilityLabel={`${j.iata} ${jumpCounts[j.iata] || 0} aircraft`}
              >
                <Text style={rd.jumpTxt}>
                  {j.iata}{typeof jumpCounts[j.iata]==='number' ? ` · ${jumpCounts[j.iata]}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>

      {radarSheet}
    </Modal>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App(){
  const [themeId, setThemeId] = useState<ThemeId>('classic');
  const [themeReady, setThemeReady] = useState(false);
  const [fadeColor, setFadeColor] = useState(THEMES.classic.bg);
  const themeIdRef = useRef<ThemeId>('classic');
  const lastDarkRef = useRef<ThemeId>('classic');
  const lastLightRef = useRef<ThemeId>('blossom');
  const fadingRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  themeIdRef.current = themeId;

  const persistTheme = useCallback(async(id:ThemeId)=>{
    try{
      await AsyncStorage.setItem(THEME_STORAGE_KEY, id);
    } catch{ /* ignore */ }
  },[]);

  const applyAndSet = useCallback((id:ThemeId)=>{
    applyTheme(id);
    themeIdRef.current = id;
    setThemeId(id);
    if(THEMES[id].isDark) lastDarkRef.current = id;
    else lastLightRef.current = id;
  },[]);

  const commitTheme = useCallback((id:ThemeId, animate:boolean)=>{
    const next = (isProTheme(id) && !isProUnlocked() && !BETA_MODE) ? 'classic' : id;
    if(next===themeIdRef.current && themeReady) return;
    if(!animate || fadingRef.current){
      applyAndSet(next);
      persistTheme(next);
      return;
    }
    fadingRef.current = true;
    setFadeColor(THEMES[next].bg);
    Animated.timing(fadeAnim,{ toValue:1, duration:150, useNativeDriver:true }).start(()=>{
      applyAndSet(next);
      persistTheme(next);
      Animated.timing(fadeAnim,{ toValue:0, duration:150, useNativeDriver:true }).start(()=>{
        fadingRef.current = false;
      });
    });
  },[applyAndSet, fadeAnim, persistTheme, themeReady]);

  useEffect(()=>{
    (async()=>{
      try{
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const legacy = saved ? null : await AsyncStorage.getItem(THEME_STORAGE_KEY_LEGACY);
        const id = parseStoredTheme(saved || legacy);
        applyAndSet(id);
        if(!saved && legacy) persistTheme(id);
      } catch{
        applyAndSet('classic');
      }
      setThemeReady(true);
    })();
  },[applyAndSet, persistTheme]);

  const toggleTheme = useCallback(()=>{
    const current = themeIdRef.current;
    const next = THEMES[current].isDark
      ? lastLightRef.current
      : lastDarkRef.current;
    commitTheme(next, true);
  },[commitTheme]);

  const setTheme = useCallback((id:ThemeId)=>{
    commitTheme(id, true);
  },[commitTheme]);

  // Notification listeners only at app startup (with cleanup) — never re-bind on re-renders
  useEffect(()=>{
    if(Platform.OS==='web') return;
    const received = Notifications.addNotificationReceivedListener(()=>{
      haptics.success();
    });
    return ()=>{ received.remove(); };
  },[]);

  const palette = THEMES[themeId];
  const themeValue = useMemo(()=>({
    themeId,
    mode: palette.isDark ? 'dark' as const : 'light' as const,
    C: palette,
    toggle: toggleTheme,
    setTheme,
  }),[themeId, palette, toggleTheme, setTheme]);

  if(!themeReady){
    return <View style={{flex:1,backgroundColor:THEMES.classic.bg}}/>;
  }

  return (
    <GestureHandlerRootView style={{flex:1}}>
    <ThemeCtx.Provider value={themeValue}>
      <IconContext.Provider value={{ weight: 'light' }}>
        <AppBody/>
        <Animated.View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFill,
            backgroundColor: fadeColor,
            opacity: fadeAnim,
            zIndex: 9999,
          }}
        />
      </IconContext.Provider>
    </ThemeCtx.Provider>
    </GestureHandlerRootView>
  );
}

function AppBody(){
  const { mode, toggle, C: theme, themeId, setTheme } = useTheme();
  const [airport,    setAirport]    = useState(FALLBACK_AIRPORT);
  const [locReady,   setLocReady]   = useState(false);
  const [tab,        setTab]        = useState<AppTab>('arrival');
  const [showRadar,  setShowRadar]  = useState(false);
  const [flights,    setFlights]    = useState<Flight[]>([]);
  const [flightsRevision, setFlightsRevision] = useState(0);
  const [selected,   setSelected]   = useState<Flight>(DEMO[0]);
  const [mapCoordTick, setMapCoordTick] = useState(0);
  const [search, setSearch] = useState('');
  const [globalHits, setGlobalHits] = useState<Flight[]|null>(null);
  const [searchEpoch, setSearchEpoch] = useState(0);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<Airport[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [nearMeBusy, setNearMeBusy] = useState(false);
  const [nearMeResults, setNearMeResults] = useState<Airport[]>([]);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [favorites, setFavorites] = useState<Airport[]>([]);
  const [switchBanner, setSwitchBanner] = useState('');
  const [showConn,   setShowConn]   = useState(false);
  const [connIncoming, setConnIncoming] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const switchTimer = useRef<any>(null);
  const [isLive,     setIsLive]     = useState(false);
  const [boardUpdating, setBoardUpdating] = useState(false);
  const [error,      setError]      = useState('');
  const [offlineCacheAt, setOfflineCacheAt] = useState<number|null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<number|null>(null);
  const [livePulse, setLivePulse] = useState(0);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [prefs, setPrefsState] = useState<AppPrefs>(()=>getPrefs());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingSelectedAirport, setOnboardingSelectedAirport] = useState<OnboardingAirport | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentAirports, setRecentAirports] = useState<Airport[]>([]);
  const [refreshHint, setRefreshHint] = useState('');
  const [tabBarW, setTabBarW] = useState(0);
  const [lastUpd,    setLastUpd]    = useState('');
  const [tracked,    setTracked]    = useState<TrackedFlight[]>([]);
  const [toast,      setToast]      = useState<string|null>(null);
  const [notifyBanner, setNotifyBanner] = useState(false);
  const [gateCloseBannerDismissed, setGateCloseBannerDismissed] = useState<string | null>(null);
  const [gateCloseTick, setGateCloseTick] = useState(0);
  const [landedStampActive, setLandedStampActive] = useState<Record<string, true>>({});
  const triggerLandedStampRef = useRef<(key: string) => void>(() => {});
  const [urgentBoarding, setUrgentBoarding] = useState<UrgentBoardingData | null>(null);
  const triggerUrgentBoardingRef = useRef<(data: UrgentBoardingData) => void>(() => {});
  const [pickupPersonRev, setPickupPersonRev] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [boardDay, setBoardDay] = useState(()=>airportDateKey(FALLBACK_AIRPORT.iata, FALLBACK_AIRPORT.country));
  const [boardOffset, setBoardOffset] = useState< -1 | 0 | 1 >(0);
  const boardOffsetRef = useRef< -1 | 0 | 1 >(0);
  const [isPro, setIsPro] = useState(BETA_MODE);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallHighlight, setPaywallHighlight] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [airport2, setAirport2] = useState<Airport|null>(null);
  const [flights2, setFlights2] = useState<Flight[]>([]);
  const [pickerSlot, setPickerSlot] = useState<'primary'|'secondary'>('primary');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [passportRefresh, setPassportRefresh] = useState(0);
  const [landedWelcome, setLandedWelcome] = useState<LandedWelcome|null>(null);
  const [pendingMemoryCard, setPendingMemoryCard] = useState<MemoryCardData|null>(null);
  const [memoryCardVisible, setMemoryCardVisible] = useState(false);
  const [memoryInPassport, setMemoryInPassport] = useState(false);
  const [passportShareOpen, setPassportShareOpen] = useState(false);
  const [passportCount, setPassportCount] = useState(0);
  const loadSeq = useRef(0);
  const lastBoardDayRef = useRef('');
  const tabSlide = useRef(new Animated.Value(0)).current;
  const tabBounce = useRef([0,1,2,3].map(()=>new Animated.Value(1))).current;
  const livePulseAnim = useRef(new Animated.Value(1)).current;
  const trackedBadgeAnim = useRef(new Animated.Value(1)).current;
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const boardPaintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [boardVisibleCount, setBoardVisibleCount] = useState(BOARD_PAGE_SIZE);
  const [loadingMoreBoard, setLoadingMoreBoard] = useState(false);
  const [revealedPast, setRevealedPast] = useState(false);
  const trackTimer = useRef<any>(null);
  const baggageTimer = useRef<any>(null);
  const boardDayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveActivityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flights2Timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const enRouteTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingMemoryCardRef = useRef<MemoryCardData|null>(null);
  const memoryCardVisibleRef = useRef(false);
  const memoryCardTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const searchTimer = useRef<any>(null);
  const searchSaveTimer = useRef<any>(null);
  const pickerTimer = useRef<any>(null);
  const pickerSeq = useRef(0);
  const searchSeq = useRef(0);
  const prevHubIataRef = useRef(airport.iata);
  const scrollRef = useRef<any>(null);
  const fidsAnchoredKeyRef = useRef('');
  const fidsNowIndexRef = useRef(-1);
  const searchInputRef = useRef<any>(null);
  const listAtBottomRef = useRef(true);
  const [listAtBottom, setListAtBottom] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFocusSection, setDetailFocusSection] = useState<DetailFocusSection | null>(null);
  const detailScrollRef = useRef<ScrollView>(null);
  const detailContentRef = useRef<View>(null);
  const pendingNotifRef = useRef<ParsedNotificationRoute | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const prevAppStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastBackgroundTimeRef = useRef(0);
  const [appPollsActive, setAppPollsActive] = useState(() => AppState.currentState !== 'background');
  const locReadyRef = useRef(false);
  const tabRef = useRef(tab);
  const airportRef = useRef(airport);
  const [shareStory, setShareStory] = useState<NextFlightShareData | null>(null);
  const [routeHits, setRouteHits] = useState<Flight[] | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeHint, setRouteHint] = useState('');
  const skipOffsetReset = useRef(false);
  const [pickupLive, setPickupLive] = useState<PickupLiveData | null>(null);
  const [gateRaceOpen, setGateRaceOpen] = useState(false);
  const [gateRaceDismissed, setGateRaceDismissed] = useState<string | null>(null);
  const [flyTogetherOpen, setFlyTogetherOpen] = useState(false);
  const [flyTogetherCode, setFlyTogetherCode] = useState<string | null>(null);
  const [flyTogetherBusy, setFlyTogetherBusy] = useState(false);
  const [joinTogetherOpen, setJoinTogetherOpen] = useState(false);
  const [joinTogetherCode, setJoinTogetherCode] = useState('');
  const [togetherDeviceId, setTogetherDeviceId] = useState('');
  const [radarAircraftCount, setRadarAircraftCount] = useState(0);
  const [radarShownCount, setRadarShownCount] = useState(0);
  const trackedRef = useRef<TrackedFlight[]>([]);
  const flyTogetherCodeRef = useRef<string | null>(null);
  useEffect(()=>{ flyTogetherCodeRef.current = flyTogetherCode; },[flyTogetherCode]);

  useEffect(()=>{
    return ()=>{
      if(searchSaveTimer.current) clearTimeout(searchSaveTimer.current);
      if(switchTimer.current) clearTimeout(switchTimer.current);
    };
  },[]);

  const clearMemoryCardTimer = useCallback(()=>{
    if(memoryCardTimerRef.current){
      clearTimeout(memoryCardTimerRef.current);
      memoryCardTimerRef.current = null;
    }
  },[]);

  const scheduleMemoryCardFallback = useCallback(()=>{
    clearMemoryCardTimer();
    memoryCardTimerRef.current = setTimeout(()=>{
      if(pendingMemoryCardRef.current && !memoryCardVisibleRef.current){
        setMemoryCardVisible(true);
      }
    }, 5000);
  },[clearMemoryCardTimer]);

  useEffect(()=>{ pendingMemoryCardRef.current = pendingMemoryCard; },[pendingMemoryCard]);
  useEffect(()=>{ memoryCardVisibleRef.current = memoryCardVisible; },[memoryCardVisible]);
  useEffect(()=>()=>clearMemoryCardTimer(),[clearMemoryCardTimer]);

  useEffect(()=>{
    loadPassportEntries().then(entries => setPassportCount(entries.length)).catch(()=>{});
  },[passportRefresh]);

  const devSeedPassport = __DEV__ ? async () => {
    await AsyncStorage.setItem(PASSPORT_STORAGE_KEY, JSON.stringify([{
      id: 'TG205:2026-08-20',
      flightNumber: 'TG205',
      airlineCode: 'TG',
      airline: 'Thai Airways',
      originIata: 'BKK', destIata: 'AMS',
      originCity: 'Bangkok', destCity: 'Amsterdam',
      scheduledTime: '2026-08-20T10:00:00Z',
      depTimeIso: '2026-08-20T10:00:00Z',
      arrTimeIso: '2026-08-20T16:30:00Z',
      landedAt: '2026-08-20T16:35:00Z',
      delayMin: 5, distanceKm: 9180, durationMs: 23400000, altitudeFt: 38000,
    }]));
    setPassportRefresh(n => n + 1);
  } : undefined;

  const syncActiveTogetherProgress = useCallback(async()=>{
    const code=flyTogetherCodeRef.current;
    if(!code) return;
    const t=trackedRef.current[0];
    if(!t?.flight?.number) return;
    const f=t.flight;
    const o=coordsForIata(f.origin, airport);
    const d=coordsForIata(f.destination, airport);
    await syncTogetherParticipant(code, togetherFlightFromTracked({
      number:f.number,
      origin:f.origin,
      destination:f.destination,
      status:f.status,
      scheduledTime:f.scheduledTime,
      arrivalTime:f.arrivalTime||resolveArrivalIso(f),
      revisedTime:f.revisedTime,
      delay:f.delay,
      lat:f.lat,
      lng:f.lng,
      progressPct:flightLiveProgress(f, airport),
    }, o.lat, o.lon, d.lat, d.lon));
  },[airport]);

  const notifyTogetherEvent=useCallback(async(body:string)=>{
    if(Platform.OS==='web') return;
    try{
      await Notifications.scheduleNotificationAsync({
        content:{ title:t().togetherNotifyTitle, body, sound:true },
        trigger:null,
      });
    } catch{ /* ignore */ }
  },[]);
  const flightsRef = useRef<Flight[]>([]);
  const lastPaintRef = useRef('');
  const isProRef = useRef(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastRun = useRef<Animated.CompositeAnimation|null>(null);
  const userSelected = useRef(false);
  const searchRef = useRef(search);
  searchRef.current = search;

  const clearPlaceSearchState = useCallback(()=>{
    searchSeq.current++;
    searchRef.current='';
    if(searchTimer.current){
      clearTimeout(searchTimer.current);
      searchTimer.current=null;
    }
    setSearch('');
    setGlobalHits(null);
    setGlobalBusy(false);
    setRouteHits(null);
    setRouteHint('');
    setRouteBusy(false);
    userSelected.current=false;
  },[]);

  useEffect(()=>{ trackedRef.current=tracked; },[tracked]);
  useEffect(()=>{ flightsRef.current=flights; },[flights]);
  useEffect(()=>{ isProRef.current=isPro; setProOverride(BETA_MODE || isPro); },[isPro]);

  const triggerLandedStamp = useCallback((key: string) => {
    haptics.success();
    setLandedStampActive(prev => ({ ...prev, [key]: true }));
  }, []);

  const dismissLandedStamp = useCallback((key: string) => {
    setLandedStampActive(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    triggerLandedStampRef.current = triggerLandedStamp;
  }, [triggerLandedStamp]);

  const triggerUrgentBoarding = useCallback((data: UrgentBoardingData) => {
    setUrgentBoarding(data);
  }, []);

  const dismissUrgentBoarding = useCallback(() => {
    setUrgentBoarding(null);
  }, []);

  useEffect(() => {
    triggerUrgentBoardingRef.current = triggerUrgentBoarding;
  }, [triggerUrgentBoarding]);

  const resolveNotificationFlight = useCallback((route: ParsedNotificationRoute): Flight | null => {
    const num = route.flightNumber;
    const trackedHit = trackedRef.current.find(t =>
      (route.flightKey && t.key === route.flightKey) ||
      (route.flightId && (t.key === route.flightId || t.flight?.id === route.flightId)) ||
      (num && flightSlug(t.flightNumber) === num),
    );
    if (trackedHit) {
      return flightFromTracked(trackedHit);
    }
    const boardHit = flightsRef.current.find(f =>
      (route.flightId && f.id === route.flightId) ||
      (num && flightSlug(f.number) === num),
    );
    return boardHit || null;
  }, []);

  const applyNotificationRoute = useCallback((raw: unknown) => {
    const route = parseNotificationData(raw);
    if (!route) return;

    setShowRadar(false);
    setTab('myflights');

    const live = resolveNotificationFlight(route);
    if (live) {
      pendingNotifRef.current = null;
      userSelected.current = true;
      setSelected(live);
      setDetailFocusSection(route.focusSection);
      setDetailOpen(true);
      return;
    }

    pendingNotifRef.current = route;
  }, [resolveNotificationFlight]);

  useEffect(() => {
    const pending = pendingNotifRef.current;
    if (!pending) return;
    const live = resolveNotificationFlight(pending);
    if (!live) return;
    pendingNotifRef.current = null;
    userSelected.current = true;
    setSelected(live);
    setDetailFocusSection(pending.focusSection);
    setDetailOpen(true);
  }, [tracked, flights, resolveNotificationFlight]);

  useEffect(()=>{
    if(Platform.OS==='web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(ev => {
      applyNotificationRoute(ev.notification.request.content.data);
    });
    Notifications.getLastNotificationResponseAsync().then(r => {
      if (!r) return;
      const tstamp = r.notification.date as number | Date | undefined;
      const ms = typeof tstamp === 'number' ? tstamp : (tstamp ? new Date(tstamp).getTime() : 0);
      if (!ms || Date.now() - ms > COLD_START_NOTIFICATION_MS) return;
      applyNotificationRoute(r.notification.request.content.data);
    }).catch(() => {});
    return () => sub.remove();
  }, [applyNotificationRoute]);
  useEffect(()=>{
    if(themeId==='platinum' && !BETA_MODE && !isPro){
      setTheme('classic');
    }
  },[isPro, themeId, setTheme]);
  useEffect(()=>subscribePrefs(()=>setPrefsState({ ...getPrefs() })),[]);

  const prevLocaleRef = useRef<string | null>(null);
  useEffect(()=>{
    if(prevLocaleRef.current === null){
      prevLocaleRef.current = prefs.locale;
      return;
    }
    if(prevLocaleRef.current === prefs.locale) return;
    prevLocaleRef.current = prefs.locale;
    setFlightsRevision(r=>r+1);
    setFlights(prev=>[...prev]);
  }, [prefs.locale]);

  useEffect(()=>{
    getTogetherDeviceId().then(setTogetherDeviceId).catch(()=>{});
    getActiveTogetherCode().then(c=>{ if(c) setFlyTogetherCode(c); }).catch(()=>{});
  },[]);

  useEffect(()=>{
    const applyDeepLink=(action:DeepLinkAction)=>{
      setShowRadar(false);
      if(action.kind==='together'){
        setJoinTogetherCode(action.code);
        setJoinTogetherOpen(true);
        setTab('myflights');
        return;
      }
      if(action.kind==='myflights'){
        setTab('myflights');
        return;
      }
      if(action.kind==='scan'){
        setTab('myflights');
        setShowScanner(true);
        return;
      }
      if(action.kind==='departures'){
        setTab('departure');
        return;
      }
      setTab('departure');
      setTimeout(()=>searchInputRef.current?.focus?.(), 400);
    };
    const onUrl=(url?:string|null)=>{
      const parsed=parseWaiAirLink(url);
      if(parsed) applyDeepLink(parsed);
      else {
        const code=parseTogetherCodeFromUrl(url);
        if(code){
          applyDeepLink({ kind:'together', code });
        }
      }
    };
    Linking.getInitialURL().then(onUrl).catch(()=>{});
    const sub=Linking.addEventListener('url', e=>onUrl(e.url));
    let unsubQa=()=>{};
    registerQuickActions(applyDeepLink).then(fn=>{ unsubQa=fn; }).catch(()=>{});
    return ()=>{ sub.remove(); unsubQa(); };
  },[]);

  useEffect(()=>{
    livePulseAnim.setValue(1.18);
    Animated.spring(livePulseAnim,{ toValue:1, friction:5, useNativeDriver:true }).start();
  },[livePulse, livePulseAnim]);

  useEffect(()=>{
    Animated.sequence([
      Animated.timing(trackedBadgeAnim,{ toValue:1.2, duration:90, useNativeDriver:true }),
      Animated.spring(trackedBadgeAnim,{ toValue:1, friction:4, useNativeDriver:true }),
    ]).start();
  },[tracked.length, trackedBadgeAnim]);

  useEffect(()=>{
    if(!loading){ setLoadTimedOut(false); return; }
    const id=setTimeout(()=>setLoadTimedOut(true), boardOffset!==0 ? 22000 : 10000);
    return ()=>clearTimeout(id);
  },[loading, boardOffset]);

  const showToast=useCallback((msg:string)=>{
    toastRun.current?.stop();
    setToast(msg);
    toastAnim.setValue(0);
    toastRun.current=Animated.sequence([
      Animated.timing(toastAnim,{toValue:1,duration:180,useNativeDriver:true}),
      Animated.delay(2000),
      Animated.timing(toastAnim,{toValue:0,duration:280,useNativeDriver:true}),
    ]);
    toastRun.current.start(({finished})=>{ if(finished) setToast(null); });
  },[toastAnim]);

  const offerTrackUpgrade=useCallback(async()=>{
    if(BETA_MODE) return;
    const travelling=trackedRef.current.some(t=>{
      const s=t.lastStatus||t.flight?.status;
      return s==='boarding'||s==='en-route';
    });
    if(travelling){
      showToast(t().freePlan3);
      return;
    }
    if(await shouldShowUpgradePrompt()){
      setShowUpgradePrompt(true);
      return;
    }
    showToast(t().freePlan3);
  },[showToast]);

  // Load tracked flights + favorites; notification permission + Expo push token
  useEffect(()=>{
    checkForUpdate().catch(()=>{});
    loadPrefs().then(async p=>{
      setPrefsState({ ...p });
      setShowOnboarding(!p.hasSeenOnboarding);
      const pinned=p.defaultAirport;
      if(pinned?.iata){
        setAirport(pinned as Airport);
      }
      const iata=(pinned?.iata || FALLBACK_AIRPORT.iata);
      const cached=await loadFidsCache(iata, 'arrival', { allowStale:true });
      if(cached?.flights?.length){
        const tz=knownTimeZone(iata, (pinned as Airport)?.country) ?? 'UTC';
        const s=sortFlights(cached.flights, 'arrival', tz);
        if(s.length){
          setFlights(s);
          setBoardVisibleCount(BOARD_PAGE_SIZE);
          setSelected(s[0]);
          setLastFetchAt(cached.ts);
          setLoading(false);
          setIsLive(!isLiveStale(cached.ts));
          if(isLiveStale(cached.ts)) setOfflineCacheAt(cached.ts);
        }
      }
    }).catch(()=>{});
    loadRecentSearches().then(setRecentSearches).catch(()=>{});
    loadRecentAirports().then(list=>setRecentAirports(list as Airport[])).catch(()=>{});
    registerTrackedBackgroundTask().catch(()=>{});
    Promise.all([recordAppOpen(), loadTracked()]).then(([n, list])=>{
      setTracked(list);
      syncAlertBadge(list);
      syncHomeScreenWidget().catch(e=>{
        console.warn('[WaiAir] Widget sync on load failed', e);
      });
      if(n>=3){
        const boardingActive=list.some(t=>t.lastStatus==='boarding'||t.flight?.status==='boarding');
        maybeRequestReview({ reason:'opens', boardingActive }).catch(()=>{});
      }
    }).catch(()=>{});
    initPurchases()
      .then(()=>checkProStatus())
      .then(pro=>setIsPro(BETA_MODE || pro))
      .catch(()=>setIsPro(BETA_MODE));
    const unsubPro=subscribeProStatus((pro)=>setIsPro(BETA_MODE || pro));
    AsyncStorage.getItem(AIRPORT2_KEY).then(raw=>{
      if(!raw) return;
      try{
        const a=JSON.parse(raw) as Airport;
        if(a?.iata) setAirport2(a);
      } catch{ /* ignore */ }
    }).catch(()=>{});
    loadFavorites().then(setFavorites);

    (async()=>{
      if(Platform.OS==='web') return;
      const status=await getNotifyPermissionStatus();
      if(status==='undetermined'){
        try{
          const { status:next }=await Notifications.requestPermissionsAsync();
          if(next==='granted'){
            setNotifyBanner(false);
            registerExpoPushToken().catch(()=>{});
          } else if(next==='denied'){
            setNotifyBanner(true);
          }
        } catch{
          setNotifyBanner(true);
        }
      } else if(status==='denied'){
        setNotifyBanner(true);
      } else if(status==='granted'){
        setNotifyBanner(false);
        registerExpoPushToken().catch(()=>{});
      }
    })();

    return ()=>{ unsubPro(); };
  },[]);

  // Re-check notification permission whenever the app returns to foreground
  // (full resume handler is registered after load/pollTracked — see below)

  // Show the board immediately; GPS may hang on iOS until a tap, so never block first paint on it.
  useEffect(()=>{
    let cancelled=false;
    const pinned=getPrefs().defaultAirport;
    if(pinned?.iata) setAirport(pinned as Airport);
    else setAirport(FALLBACK_AIRPORT);
    setLocReady(true);
    if(!pinned?.iata && !__DEV__){
      (async()=>{
        try{
          const nearest=await detectNearestAirport();
          if(cancelled) return;
          if(getPrefs().defaultAirport?.iata) return;
          if(nearest?.iata) setAirport(nearest);
        } catch{ /* keep fallback board */ }
      })();
    }
    return ()=>{ cancelled=true; };
  },[]);

  // Airport picker search (300ms debounce)
  useEffect(()=>{
    if(!showPicker && !showOnboarding) return;
    const q=pickerQuery.trim();
    if(pickerTimer.current) clearTimeout(pickerTimer.current);
    if(!q){
      setPickerResults([]);
      setPickerBusy(false);
      return;
    }
    const seq=++pickerSeq.current;
    setPickerBusy(true);
    pickerTimer.current=setTimeout(async()=>{
      try{
        const hits=await searchAirports(q);
        if(seq!==pickerSeq.current) return;
        setPickerResults(hits);
      } catch{
        if(seq!==pickerSeq.current) return;
        setPickerResults([]);
      } finally {
        if(seq===pickerSeq.current) setPickerBusy(false);
      }
    },300);
    return ()=>{ if(pickerTimer.current) clearTimeout(pickerTimer.current); };
  },[pickerQuery, showPicker, showOnboarding]);

  useEffect(()=>{
    if(!showOnboarding || !locReady) return;
    setOnboardingSelectedAirport(prev => prev ?? airport);
  },[showOnboarding, locReady, airport]);

  const applyLiveUpdates=useCallback(async(lives:Flight[])=>{
    if(!lives.length || !trackedRef.current.length) return;
    const copy=t();
    let dirty=false;
    const updated:TrackedFlight[]=[];
    for(const t of trackedRef.current){
      const live=matchTrackedHit(t, lives);
      if(!live){ updated.push(t); continue; }
      const { next: diffNext, events }=diffTracked(t, live);
      let next=diffNext;
      if(t.lastStatus!=='landed' && next.lastStatus==='landed'){
        if(!next.landedStampShown){
          triggerLandedStampRef.current(next.key);
          next={ ...next, landedStampShown:true };
        }
        const dest=live.destination||'';
        const destAp=airportByIata(dest);
        const city=live.destCity||destAp?.city||dest;
        const local=localTimeSnapshot(dest, destAp?.country||live.destCountry);
        const originAp=airportByIata(live.origin||'');
        const landedAtIso=live.actualArrival || resolveArrivalIso(live) || new Date().toISOString();
        const welcomeMsg=copy.memoryWelcomeCity(city, destAp?.flag||'');
        const passportEntry=buildPassportEntry(live, airport, iata=>airportByIata(iata), {
          welcomeMessage: welcomeMsg,
          landedAt: landedAtIso,
        });
        void savePassportEntry(passportEntry).then(()=>{
          const mem = passportEntryToMemoryCard(passportEntry);
          pendingMemoryCardRef.current = mem;
          startTransition(()=>{
            setPassportRefresh(x=>x+1);
            setPendingMemoryCard(mem);
            setMemoryInPassport(true);
          });
        });
        Promise.all([
          destAp?fetchWeatherSnapshot(destAp.lat, destAp.lon, city, resolveArrivalIso(live)):Promise.resolve(null),
          fetchFxSnapshot(live.origin, originAp?.country||live.originCountry, dest, destAp?.country||live.destCountry),
        ]).then(([wx, fx])=>{
          startTransition(()=>{
            setLandedWelcome({
              flightNumber:next.flightNumber,
              city,
              flag: destAp?.flag||'',
              iata: dest,
              localTime: local.time,
              weather: wx,
              fx,
              belt: live.baggage||'',
              taxiMin: taxiMinutes(dest),
            });
          });
        }).catch(()=>{});
        if(isProRef.current){
          await saveLandedToHistory({
            flightNumber:next.flightNumber,
            route:`${live.origin||'—'} → ${live.destination||'—'}`,
            scheduledTime:live.scheduledTime||'',
            actualTime:live.actualTime||live.revisedTime||'',
            delay:live.delay||0,
            gate:live.gate||'',
            landedAt: live.actualArrival || resolveArrivalIso(live) || new Date().toISOString(),
          });
          startTransition(()=>{ setHistoryRefresh(x=>x+1); });
        }
      }
      if(events.length){
        if(events.some(e=>e.kind==='boarding') && !t.urgentBoardingOverlayShown){
          triggerUrgentBoardingRef.current({
            key: next.key,
            flightNumber: next.flightNumber || live.number,
            gate: live.gate || next.lastGate || '',
            destination: live.destCity || live.destination || '',
            phase: 'boarding',
          });
          next={ ...next, urgentBoardingOverlayShown:true };
        }
        if(events.some(e=>e.kind==='lastCall') && !t.urgentLastCallOverlayShown){
          triggerUrgentBoardingRef.current({
            key: next.key,
            flightNumber: next.flightNumber || live.number,
            gate: live.gate || next.lastGate || '',
            destination: live.destCity || live.destination || '',
            phase: 'lastCall',
          });
          next={ ...next, urgentLastCallOverlayShown:true };
        }
        if(events.some(e=>e.kind==='lastCall')){
          void haptics.lastCallBurst();
        } else {
          if(events.some(e=>e.kind==='gate')) void haptics.warning();
          if(events.some(e=>e.kind==='boarding')) void haptics.success();
        }
        for(const event of events){
          if(event.smart && !isProRef.current) continue;
          if(event.kind==='gate' && next.type==='arrival') continue;
          await notifyFlight(next.flightNumber, event, {
            flightKey: next.key,
            flightId: next.flight?.id || next.key,
          });
        }
        if(await isPickupEnabled(next.key)){
          if(events.some(e=>e.kind==='landed')){
            await notifyPickupLanding({
              flightKey: next.key,
              flightNumber: next.flightNumber,
              destIata: live.destination || next.airportIata,
              terminal: live.arrTerminal || live.terminal,
            });
          }
          if(next.type!=='arrival' && events.some(e=>e.kind==='gate') && next.lastGate){
            await notifyPickupGate(next.key, next.flightNumber, next.lastGate);
          }
          await refreshPickupEta(
            next.key,
            live.arrivalTime || resolveArrivalIso(live),
            live.arrTerminal || live.terminal,
          );
        }
        if(events.some(e=>e.kind==='boarding'||e.kind==='gateClose'||e.kind==='lastCall')){
          await startOrUpdateLiveActivity(next.key, live);
        }
        dirty=true;
      } else if(
        next.lastStatus!==t.lastStatus ||
        next.lastGate!==t.lastGate ||
        next.lastDelay!==t.lastDelay ||
        next.lastRevisedTime!==t.lastRevisedTime ||
        next.lastBaggage!==t.lastBaggage ||
        next.notifiedGateClose!==t.notifiedGateClose ||
        next.notifiedLastCall!==t.notifiedLastCall ||
        next.notifiedBaggageClaim!==t.notifiedBaggageClaim ||
        next.landedAtMs!==t.landedAtMs ||
        next.flight.id!==t.flight.id
      ){
        dirty=true;
      }
      if(await isPickupEnabled(next.key)){
        if(next.type==='arrival' && next.lastGate && next.lastGate!==t.lastGate){
          await notifyPickupGate(next.key, next.flightNumber, next.lastGate, { arrivalsBoard:true });
        }
        await refreshPickupEta(
          next.key,
          live.arrivalTime || resolveArrivalIso(live),
          live.arrTerminal || live.terminal,
        );
      }
      updated.push(next);
    }
    if(!dirty) return;
    const dedup=[...new Map(updated.map(t=>[t.key,t])).values()];
    startTransition(()=>{ setTracked(dedup); });
    await saveTracked(dedup);
    await syncAlertBadge(dedup);
    await syncAllLiveActivities(dedup.map(t=>({key:t.key, flight:t.flight})));
    await syncHomeScreenWidget();
  },[]);

  const pollTracked=useCallback(async()=>{
    const list=trackedRef.current;
    if(!list.length) return;

    const lives:Flight[]=[];
    for(const t of list){
      const done=t.lastStatus==='landed'||t.flight?.status==='landed';
      if(done) continue;
      try{
        const hits=await fetchFlightByNumber(t.flightNumber);
        const hit=matchTrackedHit(t, hits)||hits[0];
        if(!hit) continue;
        lives.push(hit.premium ? { ...t.flight, ...hit, premium:true } : hit);
      } catch{ /* keep previous snapshot */ }
    }
    if(lives.length) await applyLiveUpdates(lives);
    await syncAllLiveActivities(
      trackedRef.current.map(t=>({key:t.key, flight:t.flight})),
    );
    await syncHomeScreenWidget();
    await syncActiveTogetherProgress();
  },[applyLiveUpdates, syncActiveTogetherProgress]);

  const pollBaggageForLanded=useCallback(async()=>{
    const list=trackedRef.current;
    const targets=list.filter(t=>needsBaggagePoll(t));
    if(!targets.length) return;

    const lives:Flight[]=[];
    for(const t of targets){
      try{
        const hits=await fetchFlightByNumber(t.flightNumber);
        let hit=matchTrackedHit(t, hits)||hits[0];
        if(!hit) continue;
        hit=hit.premium ? { ...t.flight, ...hit, premium:true } : hit;
        const dest=trackedArrivalIata(t);
        if(!cleanBaggageBelt(hit.baggage) && dest){
          hit=await enrichBaggageFromFids(hit, dest);
        }
        lives.push(hit);
      } catch{ /* retry on next interval */ }
    }
    if(lives.length) await applyLiveUpdates(lives);
  },[applyLiveUpdates]);

  const baggagePollActive=useMemo(
    ()=>tracked.some(t=>needsBaggagePoll(t)),
    [tracked],
  );

  useEffect(()=>{
    if(baggageTimer.current) clearInterval(baggageTimer.current);
    if(!baggagePollActive || !appPollsActive) return;
    const tick=()=>{
      if(appStateRef.current!=='active') return;
      pollBaggageForLanded();
    };
    InteractionManager.runAfterInteractions(()=>{
      if(appStateRef.current==='active') tick();
    });
    baggageTimer.current=setInterval(tick, BAGGAGE_POLL_MS);
    return ()=>clearInterval(baggageTimer.current);
  },[baggagePollActive, pollBaggageForLanded, appPollsActive]);

  const trackPollMs=useMemo(()=>{
    const list=tracked;
    if(!list.length) return 0;
    const active=list.filter(t=>t.lastStatus!=='landed' && t.flight?.status!=='landed');
    if(!active.length) return 0;
    if(!isPro && !BETA_MODE) return 60*1000;
    const hot=active.some(t=>t.lastStatus==='boarding'||t.lastStatus==='en-route'
      || t.flight?.status==='boarding'||t.flight?.status==='en-route');
    return hot ? 20*1000 : 30*1000;
  },[tracked, isPro]);

  useEffect(()=>{
    if(trackTimer.current) clearInterval(trackTimer.current);
    if(!tracked.length || !trackPollMs || !appPollsActive) return;
    const tick=()=>{
      if(appStateRef.current!=='active') return;
      pollTracked();
    };
    InteractionManager.runAfterInteractions(()=>{
      if(appStateRef.current==='active') tick();
    });
    trackTimer.current=setInterval(tick, trackPollMs);
    return ()=>clearInterval(trackTimer.current);
  },[tracked.length, pollTracked, trackPollMs, appPollsActive]);

  useEffect(()=>{
    if(!appPollsActive || !tracked.length) return;
    const hasGateCloseCandidate=tracked.some(t=>{
      if(t.type!=='departure') return false;
      const mins=minutesUntilGateClose(t.flight);
      return mins!==null && mins>=0 && mins<15;
    });
    if(!hasGateCloseCandidate) return;
    const id=setInterval(()=>{
      if(appStateRef.current==='active') setGateCloseTick(x=>x+1);
    }, 30000);
    return ()=>clearInterval(id);
  },[tracked, appPollsActive]);

  const flightTab: FidsTab = tab==='departure' ? 'departure' : 'arrival';

  const toggleTrack=useCallback(async(f:Flight)=>{
    const key=flightTrackKey(f);
    const exists=trackedRef.current.find(t=>sameTrackedFlight(t, f));
    if(exists){
      haptics.light();
      const next=trackedRef.current.filter(t=>!sameTrackedFlight(t, f));
      setTracked(next);
      await saveTracked(next);
      await syncAlertBadge(next);
      await endLiveActivity(exists.key, toFlightActivityProps(f));
      await syncHomeScreenWidget();
      showToast(t().trackingStopped);
      const journeyComplete=exists.lastStatus==='landed'||exists.flight?.status==='landed';
      const boardingActive=next.some(t=>t.lastStatus==='boarding'||t.flight?.status==='boarding');
      if(journeyComplete) maybeRequestReview({ reason:'untrack', boardingActive }).catch(()=>{});
      return;
    }
    haptics.medium();
    if(!BETA_MODE && !isProRef.current && trackedRef.current.length >= FREE_TRACK_LIMIT){
      await offerTrackUpgrade();
      return;
    }
    await ensureNotifyPermission();
    const existingType=trackedRef.current.find(t=>t.key===key)?.type;
    const dir: FidsTab = existingType
      ?? (tab==='departure' ? 'departure' : tab==='arrival' ? 'arrival' : 'departure');
    const entry=toTracked(f, airport.iata, dir);
    const next=[...trackedRef.current.filter(t=>t.key!==key), entry];
    setTracked(next);
    await saveTracked(next);
    await syncAlertBadge(next);
    await startOrUpdateLiveActivity(key, f);
    await syncHomeScreenWidget();
    showToast(t().nowTracking(f.number));
    maybeRequestReview({
      reason:'second_track',
      trackedCount: next.length,
      boardingActive: next.some(t=>t.lastStatus==='boarding'||t.flight?.status==='boarding'),
    }).catch(()=>{});
  },[airport.iata,tab,showToast,offerTrackUpgrade]);

  const addTrackByNumber=useCallback(async(flightNumber:string, dateIso?:string, pass?:BoardingPassInfo, opts?:{ skipNavigate?:boolean })=>{
    const clean=normalizeFlightNumberInput(flightNumber);
    if(!clean){
      showToast(t().enterValidFlight);
      return;
    }
    setAddBusy(true);
    try{
      await ensureNotifyPermission();
      let flight:Flight|undefined;
      try{
        const hits=await fetchFlightByNumber(clean);
        flight=pickFlightForTrack(hits, dateIso);
      } catch{ /* fall through to stub */ }
      if(!flight) flight=stubFlightFromNumber(clean, dateIso, pass?.from, pass?.to);
      if(flight && pass?.from && !flight.origin) flight={...flight, origin:pass.from, originCity:pass.from};
      if(flight && pass?.to && !flight.destination) flight={...flight, destination:pass.to, destCity:pass.to};

      const key=flightTrackKey(flight);
      const already=trackedRef.current.some(t=>t.key===key || flightSlug(t.flightNumber)===clean);
      if(already){
        const existing=trackedRef.current.find(t=>t.key===key || flightSlug(t.flightNumber)===clean);
        if(pass){
          const next=trackedRef.current.map(t=>{
            if(!(t.key===key || flightSlug(t.flightNumber)===clean)) return t;
            return { ...t, boardingPass:{ ...t.boardingPass, ...pass } };
          });
          setTracked(next);
          await saveTracked(next);
          await syncHomeScreenWidget();
        }
        if(!opts?.skipNavigate){
          if(existing) setSelected(existing.flight);
          setTab('myflights');
        }
        showToast(t().addedTracking(clean));
        return;
      }

      if(!BETA_MODE && !isProRef.current && trackedRef.current.length >= FREE_TRACK_LIMIT){
        await offerTrackUpgrade();
        return;
      }

      const dir: FidsTab =
        flight.origin && flight.origin===airport.iata ? 'departure'
        : flight.destination && flight.destination===airport.iata ? 'arrival'
        : 'departure';
      const entry=toTracked(flight, airport.iata, dir, pass);
      const next=[...trackedRef.current, entry];
      setTracked(next);
      await saveTracked(next);
      await syncAlertBadge(next);
      await startOrUpdateLiveActivity(key, flight);
      await syncHomeScreenWidget();
      if(!opts?.skipNavigate){
        setSelected(flight);
        setTab('myflights');
      }
      applyLiveUpdates([flight]);
      showToast(t().addedTracking(clean));
      maybeRequestReview({
        reason:'second_track',
        trackedCount: next.length,
        boardingActive: next.some(t=>t.lastStatus==='boarding'||t.flight?.status==='boarding'),
      }).catch(()=>{});
    } catch(e:any){
      showToast(e?.message || t().couldNotAdd(clean));
    } finally {
      setAddBusy(false);
    }
  },[airport.iata, showToast, applyLiveUpdates, offerTrackUpgrade]);

  const onBoardingPassParsed=useCallback((result:BoardingPassInfo)=>{
    setShowScanner(false);
    setShowRadar(false);
    const clean=normalizeFlightNumberInput(result.flightNumber) || flightSlug(result.flightNumber);
    if(!clean){
      showToast(t().couldNotReadFlight);
      return;
    }

    const boardHit=flightsRef.current.find(f=>flightSlug(f.number)===clean);
    const trackedHit=trackedRef.current.find(t=>flightSlug(t.flightNumber)===clean)?.flight;

    addTrackByNumber(result.flightNumber, result.dateIso, result, { skipNavigate:true }).catch(()=>{});

    const hub=String(airport.iata||'').toUpperCase();
    const preferTab:FidsTab =
      String(result.from||'').toUpperCase()===hub ? 'departure'
      : String(result.to||'').toUpperCase()===hub ? 'arrival'
      : boardHit && String(boardHit.origin||'').toUpperCase()===hub ? 'departure'
      : boardHit && String(boardHit.destination||'').toUpperCase()===hub ? 'arrival'
      : tab==='departure' ? 'departure' : 'arrival';

    const openFlight=(f:Flight)=>{
      userSelected.current = true;
      setSelected(f);
      setDetailOpen(true);
    };

    if(boardHit){
      setSearch('');
      setGlobalHits(null);
      setTab(preferTab);
      openFlight(boardHit);
      return;
    }

    if(trackedHit){
      setSearch(clean);
      openFlight(trackedHit);
      return;
    }

    // Not on the current board — show global search results for this flight number
    setTab(preferTab);
    setSearch(clean);
  },[addTrackByNumber, airport.iata, showToast, tab]);

  const isTracked=(f:Flight)=>tracked.some(t=>sameTrackedFlight(t, f));

  const selectFlight=useCallback((f:Flight)=>{
    userSelected.current = true;
    setSelected(f);
    setDetailOpen(true);
  },[]);

  const load=useCallback(async(iata:string,type:'arrival'|'departure',silent=false, offsetDays = boardOffsetRef.current)=>{
    const seq=++loadSeq.current;
    if(boardPaintTimerRef.current){
      clearTimeout(boardPaintTimerRef.current);
      boardPaintTimerRef.current=null;
    }
    boardOffsetRef.current=offsetDays;
    let cachePaintTimer: ReturnType<typeof setTimeout> | null = null;
    let livePainted = false;

    const paint=(list:Flight[], live:boolean, cacheTs:number|null)=>{
      const tz=knownTimeZone(iata, airportCache.get(iata)?.country || airport.country) ?? 'UTC';
      const s=sortFlights(list, type, tz);
      const ids=s.map(f=>`${f.id}${f.status}${f.gate||''}`).join('');
      if(ids===lastPaintRef.current) return;
      lastPaintRef.current=ids;
      const apply=()=>{
        setFlights(s);
        setBoardVisibleCount(BOARD_PAGE_SIZE);
        setIsLive(live && offsetDays===0 && !isLiveStale(cacheTs || Date.now()));
        setOfflineCacheAt(live?null:cacheTs);
        setSelected(prev=>{
          if(userSelected.current) return prev;
          if(isGlobalBoardSearch(searchRef.current)) return prev;
          const hit=s.find(f=>f.id===prev.id);
          return hit??s[0]??prev;
        });
        if(live) applyLiveUpdates(s);
      };
      if(silent) startTransition(apply);
      else apply();
    };

    // Cache-first for today only — other dates must not reuse today's board
    const cached=offsetDays===0 ? await loadFidsCache(iata, type, { allowStale:true }) : null;
    if(seq!==loadSeq.current) return;
    if(cached?.flights?.length){
      if(boardPaintTimerRef.current) clearTimeout(boardPaintTimerRef.current);
      cachePaintTimer=setTimeout(()=>{
        if(seq!==loadSeq.current || livePainted) return;
        paint(cached.flights, Date.now()-cached.ts < FIDS_CACHE_TTL_MS, cached.ts);
      }, BOARD_PAINT_COALESCE_MS);
      boardPaintTimerRef.current=cachePaintTimer;
      startTransition(()=>{
        setLastFetchAt(cached.ts);
        setLoading(false);
      });
    } else if(!silent){
      startTransition(()=>{
        if(offsetDays!==0) setFlights([]);
        setLoading(true);
      });
    }
    startTransition(()=>{
      setError('');
      setBoardUpdating(true);
    });

    try{
      const result=await fetchFIDS(iata,type,offsetDays);
      let data=result.flights;
      if(seq!==loadSeq.current) return;
      if(cachePaintTimer){
        clearTimeout(cachePaintTimer);
        cachePaintTimer=null;
      }
      if(data.length>0){
        const live=result.source==='live';
        livePainted=true;
        paint(data, live, live?Date.now():(cached?.ts||Date.now()));
        startTransition(()=>{
          setLastFetchAt(Date.now());
          setLivePulse(n=>n+1);
          setIsLive(live);
          setOfflineCacheAt(live?null:(cached?.ts||Date.now()));
        });
        if(live && getPrefs().offlineEnabled && offsetDays===0) saveFidsCache(iata, type, data).catch(()=>{});
      } else if(offsetDays!==0){
        startTransition(()=>{
          setFlights([]);
          setError('');
          setIsLive(false);
        });
      } else if(!cached?.flights?.length){
        startTransition(()=>{
          setError(t().noFlightsInApi);
          setIsLive(false);
        });
      } else if(!livePainted){
        paint(cached.flights, false, cached.ts);
      }
    } catch{
      if(seq!==loadSeq.current) return;
      if(cachePaintTimer){
        clearTimeout(cachePaintTimer);
        cachePaintTimer=null;
      }
      if(offsetDays!==0){
        startTransition(()=>{
          setFlights([]);
          setError('');
          setIsLive(false);
        });
      } else if(cached?.flights?.length){
        if(!livePainted) paint(cached.flights, false, cached.ts);
        else {
          startTransition(()=>{
            setOfflineCacheAt(cached.ts);
            setIsLive(false);
          });
        }
      } else {
        startTransition(()=>{
          setError(t().loadTimeout);
          setIsLive(false);
        });
      }
    } finally {
      if(seq===loadSeq.current){
        startTransition(()=>{
          setLoading(false);
          setRefreshing(false);
          setLoadTimedOut(false);
          setBoardUpdating(false);
        });
      }
    }
  },[applyLiveUpdates, airport.country]);

  useEffect(()=>{ locReadyRef.current=locReady; },[locReady]);
  useEffect(()=>{ tabRef.current=tab; },[tab]);
  useEffect(()=>{ airportRef.current=airport; },[airport]);

  // Defer all foreground resume work until after transitions/animations finish
  useEffect(()=>{
    if(Platform.OS==='web') return;
    appStateRef.current=AppState.currentState;
    prevAppStateRef.current=AppState.currentState;
    let resumePollEnableTimer: ReturnType<typeof setTimeout> | null = null;
    let resumeFetchTimer: ReturnType<typeof setTimeout> | null = null;
    const clearResumeWork=()=>{
      try{
        if(resumePollEnableTimer){
          clearTimeout(resumePollEnableTimer);
          resumePollEnableTimer=null;
        }
        if(resumeFetchTimer){
          clearTimeout(resumeFetchTimer);
          resumeFetchTimer=null;
        }
      }catch(e){
        console.warn('[cleanup error]', e);
      }
    };
    const clearAllPollTimers=()=>{
      try{
        if(refreshTimer.current){
          clearInterval(refreshTimer.current);
          refreshTimer.current=null;
        }
        if(trackTimer.current){
          clearInterval(trackTimer.current);
          trackTimer.current=null;
        }
        if(baggageTimer.current){
          clearInterval(baggageTimer.current);
          baggageTimer.current=null;
        }
        if(boardDayTimer.current){
          clearInterval(boardDayTimer.current);
          boardDayTimer.current=null;
        }
        if(liveActivityTimer.current){
          clearInterval(liveActivityTimer.current);
          liveActivityTimer.current=null;
        }
        if(flights2Timer.current){
          clearInterval(flights2Timer.current);
          flights2Timer.current=null;
        }
        if(enRouteTimer.current){
          clearInterval(enRouteTimer.current);
          enRouteTimer.current=null;
        }
        console.warn('[Timers] cleared');
      }catch(e){
        console.warn('[cleanup error]', e);
      }
    };
    const onChange=(next:AppStateStatus)=>{
      try{
        const prev=prevAppStateRef.current;
        appStateRef.current=next;
        prevAppStateRef.current=next;
        if(next==='background'){
          lastBackgroundTimeRef.current=Date.now();
          clearResumeWork();
          clearAllPollTimers();
          setAppPollsActive(false);
          return;
        }
        if(next==='inactive'){
          // iOS fires inactive during cold start / permission sheets. Pause polls
          // but do not cancel an in-flight first paint.
          if(prev==='active') setAppPollsActive(false);
          return;
        }
        if(next!=='active') return;
        if(prev==='inactive' || prev==='unknown'){
          setAppPollsActive(true);
          return;
        }
        const awayMs=lastBackgroundTimeRef.current>0
          ? Date.now()-lastBackgroundTimeRef.current
          : Number.POSITIVE_INFINITY;
        const quickReturn=awayMs<3000;
        clearResumeWork();
        if(quickReturn){
          setAppPollsActive(true);
          return;
        }
        InteractionManager.runAfterInteractions(()=>{
          resumePollEnableTimer=setTimeout(()=>{
            setAppPollsActive(true);
            InteractionManager.runAfterInteractions(()=>{
              resumeFetchTimer=setTimeout(()=>{
                void (async()=>{
                  if(appStateRef.current!=='active') return;
                  try{
                    const status=await getNotifyPermissionStatus();
                    startTransition(()=>{
                      if(status==='granted') setNotifyBanner(false);
                      else if(status==='denied') setNotifyBanner(true);
                    });
                    if(status==='granted'){
                      registerExpoPushToken().catch(()=>{});
                    }
                    if(trackedRef.current.length){
                      await pollTracked();
                    }else{
                      await syncHomeScreenWidget();
                    }
                    const currentTab=tabRef.current;
                    const iata=airportRef.current?.iata;
                    if(locReadyRef.current && currentTab!=='myflights' && iata){
                      if(!isGlobalBoardSearch(searchRef.current)){
                        await load(iata, currentTab==='departure'?'departure':'arrival', true);
                      }
                    }
                  }catch{ /* ignore resume refresh errors */ }
                })();
              }, 300);
            });
          }, 500);
        });
      }catch(e){
        console.warn('[AppState] onChange error', e);
        try{ setAppPollsActive(true); }catch{ /* ignore */ }
      }
    };
    const sub=AppState.addEventListener('change', onChange);
    return ()=>{
      try{
        sub.remove();
        clearResumeWork();
      }catch(e){
        console.warn('[cleanup error]', e);
      }
    };
  },[load, pollTracked]);

  const runRouteSearch=useCallback(async(fromIata:string, toIata:string, offset:-1|0|1)=>{
    const from=String(fromIata||'').toUpperCase();
    const to=String(toIata||'').toUpperCase();
    if(!from || !to || from===to) return;
    setRouteBusy(true);
    setGlobalHits(null);
    setSearch('');
    setRouteHits([]);
    setTab('departure');
    const origin=airportCache.get(from);
    if(origin && origin.iata!==airport.iata){
      skipOffsetReset.current=true;
      setAirport(origin);
    }
    boardOffsetRef.current=offset;
    setBoardOffset(offset);
    const day=offset===-1?t().yesterday:offset===1?t().tomorrow:t().today;
    try{
      const { flights:hits }=await fetchFIDS(from,'departure',offset,to);
      const sortedHits=[...hits].sort((a,b)=>{
        const ta=flightClockUtcMs(resolveDepartureIso(a), a.origin, a.originCountry)||0;
        const tb=flightClockUtcMs(resolveDepartureIso(b), b.origin, b.originCountry)||0;
        return ta-tb;
      });
      setRouteHits(sortedHits);
      setBoardVisibleCount(BOARD_PAGE_SIZE);
      setRouteHint(`${from} → ${to} · ${day}`);
      if(sortedHits[0]) setSelected(sortedHits[0]);
      const fromCity=airportCache.get(from)?.city || from;
      const toCity=airportCache.get(to)?.city || to;
      pushRecentSearch(`${fromCity} → ${toCity}`).then(setRecentSearches).catch(()=>{});
    }catch{
      setRouteHits([]);
      setRouteHint(`${from} → ${to} · ${day}`);
    }finally{
      setRouteBusy(false);
    }
  },[airport.iata]);

  useEffect(()=>{
    boardOffsetRef.current=boardOffset;
  },[boardOffset]);

  useEffect(()=>{
    if(skipOffsetReset.current){
      skipOffsetReset.current=false;
      return;
    }
    setBoardOffset(0);
  },[airport.iata]);

  useEffect(()=>{
    setFlightsRevision(r=>r+1);
  },[flights]);

  useEffect(()=>{
    if(!locReady) return;
    if(tab==='myflights') return;
    const hubChanged=prevHubIataRef.current!==airport.iata;
    prevHubIataRef.current=airport.iata;
    if(hubChanged){
      clearPlaceSearchState();
    } else if(isGlobalBoardSearch(searchRef.current)){
      return;
    }
    load(airport.iata, tab==='departure' ? 'departure' : 'arrival', false, boardOffset);
  },[airport.iata,tab,locReady,load,boardOffset,clearPlaceSearchState]);

  const fidsMs=useMemo(()=>{
    const tz=knownTimeZone(airport.iata, airport.country) ?? undefined;
    const adaptive=fidsPollIntervalMs(flights, Date.now(), tz);
    const user=prefs.refreshIntervalMs || 60*1000;
    return Math.min(user, adaptive);
  },[prefs.refreshIntervalMs, flights, airport.iata, airport.country]);

  useEffect(()=>{
    if(!locReady) return;
    if(tab==='myflights') return;
    if(!appPollsActive) return;
    const tick=()=>{
      if(appStateRef.current!=='active') return;
      if(isGlobalBoardSearch(searchRef.current)) return;
      load(airport.iata, tab==='departure' ? 'departure' : 'arrival', true);
    };
    refreshTimer.current=setInterval(tick, fidsMs);
    return ()=>{
      if(refreshTimer.current) clearInterval(refreshTimer.current);
      refreshTimer.current=null;
      if(boardPaintTimerRef.current) clearTimeout(boardPaintTimerRef.current);
      boardPaintTimerRef.current=null;
    };
  },[airport.iata,tab,locReady,load,fidsMs,appPollsActive]);

  const airportTz = useMemo(
    () => knownTimeZone(airport.iata, airport.country) ?? 'UTC',
    [airport.iata, airport.country],
  );

  const airportTodayKey = useMemo(
    () => airportDateKey(airport.iata, airport.country),
    [airport.iata, airport.country, boardDay],
  );

  /** Tab label date (Yesterday/Today/Tomorrow) — display only; board data comes from API offset. */
  const viewDay = useMemo(
    () => shiftDateKey(airportTodayKey, boardOffset),
    [airportTodayKey, boardOffset],
  );

  useEffect(()=>{
    setBoardDay(airportDateKey(airport.iata, airport.country));
  },[airport.iata, airport.country]);

  useEffect(()=>{
    if(!appPollsActive) return;
    const sync=()=>{
      if(appStateRef.current!=='active') return;
      startTransition(()=>{ setBoardDay(airportDateKey(airport.iata, airport.country)); });
    };
    InteractionManager.runAfterInteractions(sync);
    if(boardDayTimer.current) clearInterval(boardDayTimer.current);
    boardDayTimer.current=setInterval(sync, 15000);
    return ()=>{
      if(boardDayTimer.current) clearInterval(boardDayTimer.current);
      boardDayTimer.current=null;
    };
  },[airport.iata, airport.country, appPollsActive]);

  // Midnight / calendar-day rollover: wipe stale board and fetch today
  useEffect(()=>{
    if(!boardDay) return;
    const prev=lastBoardDayRef.current;
    lastBoardDayRef.current=boardDay;
    AsyncStorage.getItem(LAST_BOARD_DAY_KEY).then(stored=>{
      if((stored && stored!==boardDay) || (prev && prev!==boardDay)){
        clearFidsCaches().then(()=>{
          setFlights([]);
          if(locReady && tab!=='myflights' && !isGlobalBoardSearch(searchRef.current)){
            load(airport.iata, tab==='departure'?'departure':'arrival');
          }
        }).catch(()=>{});
      }
      AsyncStorage.setItem(LAST_BOARD_DAY_KEY, boardDay).catch(()=>{});
    }).catch(()=>{});
  },[boardDay, airport.iata, tab, locReady, load]);

  // Live Activity lockscreen tick every 2 minutes (boarding updates immediately in applyLiveUpdates)
  useEffect(()=>{
    if(!appPollsActive) return;
    if(liveActivityTimer.current) clearInterval(liveActivityTimer.current);
    liveActivityTimer.current=setInterval(()=>{
      if(appStateRef.current!=='active') return;
      const list=trackedRef.current;
      if(!list.length) return;
      syncAllLiveActivities(list.map(t=>({key:t.key, flight:t.flight}))).catch(()=>{});
    }, LIVE_ACTIVITY_TICK_MS);
    return ()=>{
      if(liveActivityTimer.current) clearInterval(liveActivityTimer.current);
      liveActivityTimer.current=null;
    };
  },[appPollsActive]);

  useEffect(()=>{
    const f=selected;
    if(!f?.number) return;
    let cancelled=false;
    enrichFlightRoute(f).then(next=>{
      if(cancelled) return;
      if(
        next.origin===f.origin &&
        next.destination===f.destination &&
        next.destCity===f.destCity &&
        next.originCity===f.originCity
      ) return;
      setSelected(prev=>prev.id===f.id?next:prev);
      setFlights(list=>list.map(x=>x.id!==f.id?x:{
        ...x,
        origin:next.origin,
        originCity:next.originCity,
        originCountry:next.originCountry,
        destination:next.destination,
        destCity:next.destCity,
        destCountry:next.destCountry,
        departureTime:next.departureTime,
        arrivalTime:next.arrivalTime,
      }));
    });
    return ()=>{ cancelled=true; };
  },[selected.id, selected.number, selected.origin, selected.destination]);

  useEffect(()=>{
    const f=selected;
    if(!f?.number) return;
    const rr=resolveRoute(f, flightTab, airport);
    if(
      !isAmsAirport(rr.origin) &&
      !isAmsAirport(rr.destination) &&
      !isAmsAirport(f.origin) &&
      !isAmsAirport(f.destination)
    ) return;
    let cancelled=false;
    const probe:Flight={
      ...f,
      origin: usableAirportCode(f.origin) || usableAirportCode(rr.origin) || f.origin,
      destination: usableAirportCode(f.destination) || usableAirportCode(rr.destination) || f.destination,
    };
    enrichFlightWithSchiphol(probe).then(next=>{
      if(cancelled) return;
      if(
        next.gate===f.gate &&
        next.terminal===f.terminal &&
        next.depTerminal===f.depTerminal &&
        next.arrTerminal===f.arrTerminal &&
        next.baggage===f.baggage
      ) return;
      const patch={
        gate: next.gate,
        terminal: next.terminal,
        depTerminal: next.depTerminal,
        arrTerminal: next.arrTerminal,
        baggage: next.baggage,
      };
      setSelected(prev=>prev.id===f.id?{ ...prev, ...patch }:prev);
      setFlights(list=>list.map(x=>x.id!==f.id?x:{ ...x, ...patch }));
      setTracked(list=>list.map(t=>{
        if(t.flight.id!==f.id && !sameTrackedFlight(t, f)) return t;
        return { ...t, flight:{ ...t.flight, ...patch } };
      }));
    }).catch(()=>{});
    return ()=>{ cancelled=true; };
  },[selected.id, selected.number, selected.origin, selected.destination, selected.scheduledTime, flightTab, airport.iata]);

  useEffect(()=>{
    const rr=resolveRoute(selected, flightTab, airport);
    const missing=!hasGeo(coordsForIata(rr.origin, airport).lat, coordsForIata(rr.origin, airport).lon)
      || !hasGeo(coordsForIata(rr.destination, airport).lat, coordsForIata(rr.destination, airport).lon);
    if(!missing) return;
    let cancelled=false;
    Promise.all([ensureAirportCoords(rr.origin), ensureAirportCoords(rr.destination)]).then(()=>{
      if(!cancelled) setMapCoordTick(n=>n+1);
    });
    return ()=>{ cancelled=true; };
  },[selected.id, selected.origin, selected.destination, airport.iata, flightTab]);

  useEffect(()=>{
    if(!isPro || selected.status!=='en-route' || !selected.number || !appPollsActive) return;
    const flightId=selected.id;
    const ident=flightSlug(selected.number);
    let cancelled=false;
    const tick=async()=>{
      if(appStateRef.current!=='active') return;
      try{
        const bundle=await getFlightDetail(ident);
        if(cancelled) return;
        if(!bundle.premium || !bundle.data || Array.isArray(bundle.data)) return;
        const d=bundle.data as FAFlightDetail;
        const lat=d.lat ?? undefined;
        const lng=d.lng ?? undefined;
        if(lat==null || lng==null) return;
        const patch=(f:Flight):Flight=>({
          ...f,
          lat,
          lng,
          headingDeg: d.heading ?? f.headingDeg,
          altitudeFt: d.altitude ?? f.altitudeFt,
          speedKts: d.speed ?? f.speedKts,
          premium:true,
        });
        setSelected(prev=>prev.id===flightId?patch(prev):prev);
        setFlights(list=>list.map(x=>x.id===flightId?patch(x):x));
        setTracked(list=>list.map(t=>{
          if(t.flight.id===flightId || flightSlug(t.flightNumber)===ident){
            return { ...t, flight: patch(t.flight) };
          }
          return t;
        }));
      } catch{ /* ignore */ }
    };
    tick();
    if(enRouteTimer.current) clearInterval(enRouteTimer.current);
    enRouteTimer.current=setInterval(tick, 30000);
    return ()=>{
      cancelled=true;
      if(enRouteTimer.current){
        clearInterval(enRouteTimer.current);
        enRouteTimer.current=null;
      }
    };
  },[isPro, selected.id, selected.number, selected.status, appPollsActive]);

  // Second airport arrivals (Pro multi-airport)
  useEffect(()=>{
    if(!locReady || !isPro || !airport2 || tab!=='arrival' || showRadar || !appPollsActive){
      if(flights2Timer.current){
        clearInterval(flights2Timer.current);
        flights2Timer.current=null;
      }
      if(!airport2) setFlights2([]);
      return;
    }
    let cancelled=false;
    const pull=async(silent=false)=>{
      try{
        const result=await fetchFIDS(airport2.iata,'arrival');
        if(cancelled) return;
        startTransition(()=>{
          setFlights2(sortFlights(
            result.flights.length ? result.flights : [],
            'arrival',
            knownTimeZone(airport2.iata, airport2.country) ?? 'UTC',
          ));
        });
      } catch{
        if(!cancelled && !silent){
          startTransition(()=>{ setFlights2([]); });
        }
      }
    };
    InteractionManager.runAfterInteractions(()=>{
      if(!cancelled && appStateRef.current==='active') pull();
    });
    if(flights2Timer.current) clearInterval(flights2Timer.current);
    flights2Timer.current=setInterval(()=>{
      if(appStateRef.current!=='active') return;
      pull(true);
    }, FIDS_POLL_FREE_MS);
    return ()=>{
      cancelled=true;
      if(flights2Timer.current) clearInterval(flights2Timer.current);
      flights2Timer.current=null;
    };
  },[airport2, isPro, tab, locReady, showRadar, appPollsActive]);

  // Global search: flight number anywhere, or all flights from/to an airport/city.
  useEffect(()=>{
    const q=search.trim();
    if(searchTimer.current) clearTimeout(searchTimer.current);
    if(!q){
      searchSeq.current++;
      setGlobalHits(null);
      setGlobalBusy(false);
      return;
    }

    if(isFlightNumberQuery(q)){
      const seq=++searchSeq.current;
      setGlobalBusy(true);
      searchTimer.current=setTimeout(async()=>{
        try{
          const hits=await fetchFlightByNumber(q);
          if(seq!==searchSeq.current) return;
          setGlobalHits(hits);
          setBoardVisibleCount(BOARD_PAGE_SIZE);
          if(hits.length>0){
            setSelected(hits[0]);
            setIsLive(true);
            setError('');
            applyLiveUpdates(hits);
          }
        } catch{
          if(seq!==searchSeq.current) return;
          setGlobalHits([]);
        } finally {
          if(seq===searchSeq.current) setGlobalBusy(false);
        }
      },450);
      return ()=>{ if(searchTimer.current) clearTimeout(searchTimer.current); };
    }

    const placeIata=resolveSearchAirport(q);
    if(!placeIata){
      searchSeq.current++;
      setGlobalHits(null);
      setGlobalBusy(false);
      return;
    }

    const seq=++searchSeq.current;
    setGlobalBusy(true);
    setGlobalHits(null);
    searchTimer.current=setTimeout(async()=>{
      try{
        const offset=boardOffsetRef.current;
        const [dep, arr]=await Promise.all([
          fetchFIDS(placeIata, 'departure', offset),
          fetchFIDS(placeIata, 'arrival', offset),
        ]);
        if(seq!==searchSeq.current) return;
        const seen=new Set<string>();
        const hits:Flight[]=[];
        const take=(list:Flight[], side:'arrival'|'departure')=>{
          for(const f of list){
            const stamped:Flight={ ...f, boardSide: f.boardSide || side };
            const key=`${side}|${stamped.id || `${stamped.number}|${stamped.scheduledTime}|${stamped.origin}|${stamped.destination}`}`;
            if(seen.has(key)) continue;
            seen.add(key);
            hits.push(stamped);
          }
        };
        take(dep.flights, 'departure');
        take(arr.flights, 'arrival');
        setGlobalHits(hits);
        setBoardVisibleCount(BOARD_PAGE_SIZE);
        const tabType=tabRef.current==='departure'?'departure':'arrival';
        const forTab=hits.filter(f=>flightMatchesPlaceTab(f, tabType, placeIata));
        const pick=forTab[0]||hits[0];
        if(pick){
          setSelected(pick);
          setIsLive(true);
          setError('');
        }
      } catch{
        if(seq!==searchSeq.current) return;
        setGlobalHits([]);
      } finally {
        if(seq===searchSeq.current) setGlobalBusy(false);
      }
    },280);
    return ()=>{ if(searchTimer.current) clearTimeout(searchTimer.current); };
  },[search, applyLiveUpdates, boardOffset, searchEpoch]);

  const query=cleanQuery(search);
  const flightNumberQuery=isFlightNumberQuery(search.trim());
  const placeSearchIata=resolveSearchAirport(search);
  const placeSearch=!!placeSearchIata;
  const emptyCopy=useMemo(
    ()=>emptySearchCopy(search, placeSearchIata || '', { global: true }),
    [search, placeSearchIata],
  );
  /** Airport/city or flight-number search is never limited to the selected hub. */
  const globalMode=flightNumberQuery || placeSearch;
  const routeMode=routeHits!==null || routeBusy;

  useEffect(()=>{
    setBoardVisibleCount(BOARD_PAGE_SIZE);
    setRevealedPast(false);
    fidsAnchoredKeyRef.current = '';
  },[airport.iata, tab, boardOffset, statusFilter, globalMode, routeMode]);

  const smartBoardFlights=useMemo(()=>flights.map(f=>({
    number:f.number,
    origin:f.origin,
    destination:f.destination,
    scheduledTime:resolveDepartureIso(f)||f.scheduledTime,
  })),[flights]);

  /** Full Arrivals/Departures pool (before status + text filter) */
  const poolSorted=useMemo(()=>{
    const raw=routeMode
      ? (routeHits || [])
      : (flightNumberQuery || placeSearch)
        ? (globalHits || [])
        : flights;
    const placeFiltered=placeSearch && placeSearchIata && !routeMode
      ? raw.filter(f=>flightMatchesPlaceTab(f, flightTab, placeSearchIata))
      : raw;
    const sortTz=(()=>{
      if(placeSearch && placeSearchIata){
        const ap=airportByIata(placeSearchIata);
        if(ap) return knownTimeZone(ap.iata, ap.country) ?? airportTz;
      }
      return airportTz;
    })();
    const sorted=routeMode ? [...placeFiltered].sort((a,b)=>{
      const ta=flightClockUtcMs(resolveDepartureIso(a), a.origin, a.originCountry)||0;
      const tb=flightClockUtcMs(resolveDepartureIso(b), b.origin, b.originCountry)||0;
      return ta-tb;
    }) : sortFlights(placeFiltered, flightTab, sortTz);
    return sorted;
  },[flights, globalHits, flightNumberQuery, placeSearch, placeSearchIata, flightTab, routeHits, routeMode, airportTz]);

  const popularDests=useMemo(
    ()=>popularFromFlights(poolSorted as SearchableFlight[], placeSearchIata || airport.iata, flightTab),
    [poolSorted, airport.iata, placeSearchIata, flightTab],
  );

  const statusCounts=useMemo(()=>{
    const counts:Record<StatusFilter, number>={
      all:poolSorted.length,
      boarding:0, delayed:0, scheduled:0, landed:0, cancelled:0,
    };
    for(const f of poolSorted){
      if(f.status==='boarding') counts.boarding++;
      else if(f.status==='delayed') counts.delayed++;
      else if(f.status==='scheduled') counts.scheduled++;
      else if(f.status==='landed') counts.landed++;
      else if(f.status==='cancelled') counts.cancelled++;
    }
    return counts;
  },[poolSorted]);

  /** Status tab first, then search within that tab */
  const sorted=useMemo(()=>{
    let list=poolSorted;
    if(statusFilter!=='all'){
      list=list.filter(f=>f.status===statusFilter);
    }
    if(search.trim() && !globalMode && !routeMode){
      list=searchFlights(list.map(f=>toSearchableFlight(f, flightTab, airport)), search, airport.iata);
    }
    return list;
  },[poolSorted, statusFilter, search, globalMode, routeMode, flightTab, airport]);

  // Keep detail card in sync with filtered list (including CDG Arrives/Departs/Boarding)
  useEffect(()=>{
    if(sorted.length===0) return;
    if(sorted.some(f=>f.id===selected.id)) return;
    if(userSelected.current && !placeSearch && !flightNumberQuery) return;
    userSelected.current=false;
    setSelected(sorted[0]);
  },[sorted, selected.id, placeSearch, flightNumberQuery]);

  const clearSearch=()=>{ setSearch(''); setGlobalHits(null); setRouteHits(null); setRouteHint(''); };

  /** Search box must never hold debug / status strings (e.g. leaked "IATA646"). */
  const onSearchChange=useCallback((text:string)=>{
    const next=String(text ?? '');
    if(/^IATA\d+$/i.test(next.trim()) || /^with[_\s]?iata/i.test(next.trim())){
      setSearch('');
      return;
    }
    setSearch(next);
    if(next.trim()) setRouteHits(null);
    const label=prettySearchLabel(next);
    if(searchSaveTimer.current) clearTimeout(searchSaveTimer.current);
    if(cleanQuery(next).length>=3){
      searchSaveTimer.current=setTimeout(()=>{
        pushRecentSearch(label).then(setRecentSearches).catch(()=>{});
      },900);
    }
  },[]);

  const onStatusFilter=useCallback((key:StatusFilter)=>{
    if(key==='boarding' && tab!=='departure'){
      haptics.light();
      setShowRadar(false);
      setRouteHits(null);
      setRouteHint('');
      Animated.sequence([
        Animated.timing(tabBounce[1],{ toValue:1.18, duration:80, useNativeDriver:true }),
        Animated.spring(tabBounce[1],{ toValue:1, friction:4, useNativeDriver:true }),
      ]).start();
      setTab('departure');
    }
    setStatusFilter(key);
  },[tab, tabBounce]);

  const onBoardOffset=useCallback((off:-1|0|1)=>{
    haptics.light();
    boardOffsetRef.current=off;
    setBoardOffset(off);
    setRouteHits(null);
    setRouteHint('');
    if(isGlobalBoardSearch(searchRef.current)) return;
    if(off!==0){
      setFlights([]);
      setLoading(true);
    }
  },[]);

  const onSmartApplyQuery=useCallback((q:string)=>{
    setSearch(q);
    setRouteHits(null);
    setRouteHint('');
    pushRecentSearch(q).then(setRecentSearches).catch(()=>{});
  },[]);

  const onSmartSelectFlightNumber=useCallback((n:string)=>{
    setSearch(n);
    setRouteHits(null);
    setRouteHint('');
    pushRecentSearch(n).then(setRecentSearches).catch(()=>{});
  },[]);

  const onBrowseFlights=useCallback(()=>{
    setShowRadar(false);
    setTab('departure');
  },[]);

  const flashAirportChange=useCallback((a:Airport)=>{
    if(switchTimer.current) clearTimeout(switchTimer.current);
    setSwitchBanner(t().loadingIata(a.iata));
    switchTimer.current=setTimeout(()=>setSwitchBanner(''),1000);
    pillAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pillAnim,{toValue:1,duration:180,useNativeDriver:false}),
      Animated.timing(pillAnim,{toValue:0,duration:700,useNativeDriver:false}),
    ]).start();
  },[pillAnim]);

  const requirePro=useCallback(async(highlight?:string)=>{
    if(BETA_MODE){
      setIsPro(true);
      return;
    }
    if(await checkProStatus()){
      setIsPro(true);
      return;
    }
    setPaywallHighlight(highlight||'');
    setShowPaywall(true);
  },[]);

  // When Pro unlocks, push Live Activities + home widget for current tracked flights
  useEffect(()=>{
    const list=trackedRef.current;
    if(!list.length){
      syncHomeScreenWidget().catch(()=>{});
      return;
    }
    reconcileLiveActivities(list.map(t=>({key:t.key, flight:t.flight}))).catch(()=>{});
    syncHomeScreenWidget().catch(()=>{});
  },[isPro, tracked.length]);

  const selectAirport=useCallback((a:Airport)=>{
    haptics.light();
    if(a.iata!==airport.iata){
      flashAirportChange(a);
      clearPlaceSearchState();
    }
    setAirport(a);
    setRouteHits(null);
    setRouteHint('');
    pushRecentAirport(a).then(list=>setRecentAirports(list as Airport[])).catch(()=>{});
    savePrefs({ defaultAirport: getPrefs().defaultAirport }).catch(()=>{});
    setShowPicker(false);
    setPickerQuery('');
    setPickerResults([]);
    setNearMeResults([]);
    setNearMeActive(false);
  },[airport.iata, flashAirportChange, clearPlaceSearchState]);

  const toggleFavouriteAirport=useCallback((a:Airport)=>{
    setFavorites(prev=>{
      const exists=prev.some(x=>x.iata===a.iata);
      let next:Airport[];
      if(exists){
        next=prev.filter(x=>x.iata!==a.iata);
      } else {
        if(prev.length>=FAV_MAX){
          showToast(t().maxFavourites(FAV_MAX));
          return prev;
        }
        next=[a, ...prev.filter(x=>x.iata!==a.iata)].slice(0,FAV_MAX);
      }
      saveFavorites(next).catch(()=>{});
      return next;
    });
  },[showToast]);

  const isFavouriteAirport=useCallback((iata:string)=>
    favorites.some(x=>x.iata===iata)
  ,[favorites]);

  const findNearMe=useCallback(async()=>{
    if(nearMeBusy) return;
    setNearMeBusy(true);
    setNearMeActive(false);
    try{
      const { status }=await Location.requestForegroundPermissionsAsync();
      if(status!=='granted'){
        showToast(t().locationPermissionNeeded);
        haptics.error();
        return;
      }
      const pos=await Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.Balanced });
      const hits=await nearestAirportsApi(pos.coords.latitude, pos.coords.longitude);
      if(!hits.length){
        showToast(t().couldNotFindNearby);
        haptics.error();
        return;
      }
      AsyncStorage.setItem('waiair.nearMe.v1', JSON.stringify({
        at:Date.now(),
        hits,
      })).catch(()=>{});
      const withinAuto = hits.filter(a =>
        typeof a.distanceKm === 'number' && a.distanceKm <= NEAR_ME_AUTO_KM,
      );
      if(withinAuto.length === 1){
        selectAirport(withinAuto[0]);
        haptics.success();
        return;
      }
      const closest = hits[0];
      setNearMeResults(hits);
      setPickerQuery(airportPickerQueryLabel(closest));
      setNearMeActive(true);
      haptics.success();
    } catch{
      showToast(t().couldNotFindNearby);
      haptics.error();
    } finally {
      setNearMeBusy(false);
    }
  },[nearMeBusy, showToast, selectAirport]);

  const onboardingNearMe=useCallback(async()=>{
    if(nearMeBusy) return;
    setNearMeBusy(true);
    setNearMeActive(false);
    try{
      const { status }=await Location.requestForegroundPermissionsAsync();
      if(status!=='granted'){
        showToast(t().locationPermissionNeeded);
        haptics.error();
        return;
      }
      const pos=await Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.Balanced });
      const hits=await nearestAirportsApi(pos.coords.latitude, pos.coords.longitude);
      if(!hits.length){
        showToast(t().couldNotFindNearby);
        haptics.error();
        return;
      }
      AsyncStorage.setItem('waiair.nearMe.v1', JSON.stringify({
        at:Date.now(),
        hits,
      })).catch(()=>{});
      const withinAuto = hits.filter(a =>
        typeof a.distanceKm === 'number' && a.distanceKm <= NEAR_ME_AUTO_KM,
      );
      if(withinAuto.length === 1){
        setOnboardingSelectedAirport(withinAuto[0]);
        haptics.success();
        return;
      }
      const closest = hits[0];
      setNearMeResults(hits);
      setPickerQuery(airportPickerQueryLabel(closest));
      setNearMeActive(true);
      haptics.success();
    } catch{
      showToast(t().couldNotFindNearby);
      haptics.error();
    } finally {
      setNearMeBusy(false);
    }
  },[nearMeBusy, showToast]);

  const clearAirport2=useCallback(()=>{
    setAirport2(null);
    setFlights2([]);
    AsyncStorage.removeItem(AIRPORT2_KEY).catch(()=>{});
  },[]);

  const pillBorder=pillAnim.interpolate({
    inputRange:[0,1],
    outputRange:[theme.fieldBorder, theme.accent],
  });
  const pillBg=pillAnim.interpolate({
    inputRange:[0,1],
    outputRange:[theme.accentDim, mode==='dark'?'#1A3858':'#E4DDD0'],
  });
  const bounceTab=(i:number)=>{
    Animated.sequence([
      Animated.timing(tabBounce[i],{ toValue:1.18, duration:80, useNativeDriver:true }),
      Animated.spring(tabBounce[i],{ toValue:1, friction:4, useNativeDriver:true }),
    ]).start();
  };
  const activeTabIndex=showRadar?3:tab==='arrival'?0:tab==='departure'?1:2;
  useEffect(()=>{
    Animated.spring(tabSlide,{ toValue:activeTabIndex, friction:7, useNativeDriver:true }).start();
  },[activeTabIndex, tabSlide]);
  const apChevronColor='#8E8E93';

  const favFiltered=useMemo(()=>{
    const needle=pickerQuery.trim().toLowerCase();
    if(!needle) return favorites;
    return favorites.filter(a=>
      a.iata.toLowerCase().includes(needle) ||
      a.name.toLowerCase().includes(needle) ||
      a.city.toLowerCase().includes(needle) ||
      a.country.toLowerCase().includes(needle)
    );
  },[favorites, pickerQuery]);

  const showSearchResults=pickerQuery.trim().length>0;
  const showNearMeList=nearMeActive && nearMeResults.length>0;
  const showPickerSearchResults=showSearchResults && !nearMeActive;

  // My Flights: always use /flights/number snapshot on tracked entry (FIDS board can lag)
  const myFlights=useMemo(()=>{
    return tracked.map(flightFromTracked).filter((f): f is Flight => !!f).map(f=>({
      ...f,
      origin: /^[A-Z]{3}$/.test(String(f.origin || '').trim().toUpperCase()) ? String(f.origin).trim().toUpperCase() : f.origin,
      destination: /^[A-Z]{3}$/.test(String(f.destination || '').trim().toUpperCase()) ? String(f.destination).trim().toUpperCase() : f.destination,
    }));
  },[tracked]);

  const myConnections=useMemo(()=>findTightConnections(myFlights),[myFlights]);
  const gateRacePair=useMemo(()=>findGateRacePair(myFlights),[myFlights]);
  const selectedGateRacePair=useMemo(()=>{
    if(!selected) return null;
    return gateRacePairForFlight(myFlights, selected.number);
  },[myFlights, selected?.number]);
  const [raceNow, setRaceNow] = useState(Date.now());
  const gateRaceDelayRef=useRef<number>(0);
  useEffect(()=>{
    if(!gateRacePair) return;
    return runWhileAppActive(()=>{
      const id=setInterval(()=>setRaceNow(Date.now()), 1000);
      return ()=>clearInterval(id);
    });
  },[gateRacePair?.key]);
  useEffect(()=>{
    if(!gateRacePair) return;
    let cancelled=false;
    (async()=>{
      if(cancelled) return;
      const now=Date.now();
      if(isIncomingLanded(gateRacePair, now)){
        await notifyGateRaceLanding(gateRacePair, now);
      }
      if(shouldNotifyGateRaceMissed(gateRacePair, now)){
        await notifyGateRaceMissed(gateRacePair);
        return;
      }
      const delay=gateRacePair.incoming.delay||0;
      if(delay>gateRaceDelayRef.current && delay>0){
        const remain=(gateRacePair.departMs-now)/60000;
        if(remain>0 && remain<45){
          await notifyGateRaceDelayRisk(gateRacePair, remain);
        }
      }
      gateRaceDelayRef.current=delay;
    })();
    return ()=>{ cancelled=true; };
  },[
    gateRacePair?.key,
    gateRacePair?.incoming.status,
    gateRacePair?.incoming.delay,
    gateRacePair?.departMs,
    raceNow,
  ]);
  const showGateRaceBanner=!!gateRacePair
    && isIncomingLanded(gateRacePair, raceNow)
    && gateRaceDismissed!==gateRacePair.key;

  // Critical connection push (< 30 min layover) — once per pair
  useEffect(()=>{
    if(!myConnections.length) return;
    let cancelled=false;
    (async()=>{
      const notified=await loadConnNotified();
      for(const c of myConnections){
        if(cancelled) return;
        if(c.gapMin>=30) continue;
        if(notified.has(c.key)) continue;
        const inn=flightSlug(c.incoming.number);
        const out=flightSlug(c.outgoing.number);
        const arrive=fmtLabeled(resolveArrivalIso(c.incoming), c.incoming.destination, c.incoming.destCountry);
        const depart=fmtLabeled(resolveDepartureIso(c.outgoing), c.outgoing.origin, c.outgoing.originCountry);
        await notifyFlight(inn, {
          kind:'connection',
        title:t().tightConnection,
        body:t().tightConnectionBody(inn, arrive, out, depart, Math.round(c.gapMin)),
          urgent:true,
        }, {
          flightKey: flightTrackKey(c.incoming),
          flightId: c.incoming.id,
        });
        await markConnNotified(c.key);
      }
    })();
    return ()=>{ cancelled=true; };
  },[myConnections]);

  const iconTint = theme.isDark ? '#fff' : theme.text;
  const headerActions = (
    <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
      <TouchableOpacity
        style={s.headerIcon}
        onPress={()=>setShowScanner(true)}
        activeOpacity={0.8}
        hitSlop={6}
        accessibilityLabel={t().scanBoardingPass}
      >
        <Barcode size={16} color={iconTint}/>
      </TouchableOpacity>
      <TouchableOpacity
        style={s.headerIcon}
        onPress={toggle}
        activeOpacity={0.8}
        hitSlop={6}
        accessibilityLabel={mode==='dark'?t().darkMode:t().lightMode}
      >
        {mode==='dark' ? <Moon size={16} color={iconTint}/> : <Sun size={16} color={iconTint}/>}
      </TouchableOpacity>
      <TouchableOpacity
        style={s.headerIcon}
        onPress={()=>setShowSettings(true)}
        activeOpacity={0.8}
        hitSlop={6}
        accessibilityLabel={t().settings}
      >
        <Gear size={16} color={iconTint}/>
      </TouchableOpacity>
    </View>
  );

  const onBoardScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } })=>{
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;
    if(atBottom !== listAtBottomRef.current){
      listAtBottomRef.current = atBottom;
      setListAtBottom(atBottom);
    }
  },[]);

  const boardPaginated = tab==='myflights' && !globalMode && !routeMode;
  const fidsTimeMode = tab!=='myflights' && !globalMode && !routeMode && boardOffset===0 && !query.trim() && statusFilter==='all';

  const fidsBoard = useMemo(()=>{
    const keep = (f: Flight | undefined | null): f is Flight => !!(f && f.id);
    if (boardPaginated) {
      return { list: myFlights.filter(keep), nowIndex: -1, nowLeadIndex: -1, canRevealPast: false, hasMore: false };
    }
    if (!fidsTimeMode) {
      const list = sorted.slice(0, Math.min(boardVisibleCount, sorted.length)).filter(keep);
      return { list, nowIndex: -1, nowLeadIndex: -1, canRevealPast: false, hasMore: boardVisibleCount < sorted.length };
    }
    const now = Date.now();
    const twoHIdx = firstIndexAtOrAfter(sorted, flightTab, now - FIDS_PAST_HIDE_MS);
    const thirtyIdx = firstIndexAtOrAfter(sorted, flightTab, now - FIDS_NOW_LEAD_MS);
    const exactIdx = firstIndexAtOrAfter(sorted, flightTab, now);
    const start = revealedPast ? 0 : twoHIdx;
    const lead = Math.max(0, thirtyIdx - start);
    const end = Math.min(sorted.length, start + lead + boardVisibleCount);
    const list = sorted.slice(start, end).filter(keep);
    const nowLeadIndex = Math.min(Math.max(0, thirtyIdx - start), Math.max(0, list.length - 1));
    const nowIndex = Math.min(Math.max(0, exactIdx - start), Math.max(0, list.length - 1));
    return {
      list,
      nowIndex: list.length ? nowIndex : -1,
      nowLeadIndex: list.length ? nowLeadIndex : -1,
      canRevealPast: !revealedPast && twoHIdx > 0,
      hasMore: end < sorted.length,
    };
  },[boardPaginated, myFlights, sorted, boardVisibleCount, fidsTimeMode, flightTab, revealedPast]);

  const boardList = fidsBoard.list;
  const showBoardPromos = tab === 'arrival' || tab === 'departure';
  const promoFrom = fidsTimeMode && fidsBoard.nowLeadIndex >= 0 ? fidsBoard.nowLeadIndex : 0;
  const mergedFlights = useMemo(
    () => insertBoardPromos(boardList, showBoardPromos, promoFrom),
    [boardList, showBoardPromos, promoFrom],
  );
  fidsNowIndexRef.current = fidsIndexWithPromos(fidsBoard.nowIndex, promoFrom, boardList.length, showBoardPromos);

  const hasMoreBoardFlights = !boardPaginated && fidsBoard.hasMore;

  const loadMoreBoardFlights = useCallback(()=>{
    if(!hasMoreBoardFlights || loadingMoreBoard) return;
    setLoadingMoreBoard(true);
    InteractionManager.runAfterInteractions(()=>{
      setBoardVisibleCount(c=>c + BOARD_PAGE_SIZE);
      setLoadingMoreBoard(false);
    });
  },[hasMoreBoardFlights, loadingMoreBoard]);

  const fidsAnchorKey = `${airport.iata}|${tab}|${boardOffset}|${fidsTimeMode ? 1 : 0}`;

  const scrollToFidsIndex = useCallback((index: number, animated: boolean)=>{
    if (index < 0) return;
    try {
      scrollRef.current?.scrollToIndex({ index, animated, viewPosition: 0 });
    } catch {
      /* FlashList not ready */
    }
  },[]);

  const scrollToFidsNow = useCallback(()=>{
    haptics.light();
    const idx = fidsNowIndexRef.current;
    if (idx < 0) return;
    scrollToFidsIndex(idx, true);
  },[scrollToFidsIndex]);

  const onFidsStartReached = useCallback(()=>{
    if (!fidsBoard.canRevealPast) return;
    if (fidsAnchoredKeyRef.current !== fidsAnchorKey) return;
    setRevealedPast(true);
  },[fidsBoard.canRevealPast, fidsAnchorKey]);

  const shareTypeFor = (f:Flight):'arrival'|'departure' => (
    tab==='myflights'
      ? (tracked.find(t=>sameTrackedFlight(t, f))?.type ?? 'departure')
      : flightTab
  );

  const openShareStory = useCallback((f:Flight, type?:'arrival'|'departure')=>{
    haptics.light();
    setShareStory(toNextFlightShareData(f, type ?? shareTypeFor(f), airport));
  },[tab, tracked, flightTab, airport]);

  const gateCloseAlert = useMemo(()=>{
    if(!appPollsActive || showRadar || showOnboarding) return null;
    let best: { dismissKey: string; gate: string; mins: number } | null = null;
    for(const tr of tracked){
      if(tr.type!=='departure') continue;
      const f=tr.flight;
      const mins=minutesUntilGateClose(f);
      if(mins===null || mins<0 || mins>=15) continue;
      const dismissKey=`${tr.key}:${f.gate||''}`;
      if(gateCloseBannerDismissed===dismissKey) continue;
      if(!best || mins<best.mins){
        best={ dismissKey, gate: displayGate(f.gate), mins };
      }
    }
    return best;
  },[tracked, appPollsActive, showRadar, showOnboarding, gateCloseBannerDismissed, gateCloseTick]);

  const renderBoardItem = useCallback(({ item, index: i }: { item: BoardListItem; index: number }) => {
    if (isPromoItem(item) && item.type === 'promo-ssf') return <PromoCard type="ssf" colors={C} />;
    if (isPromoItem(item) && item.type === 'promo-allesis') return <PromoCard type="allesis" colors={C} />;
    if (isPromoItem(item)) return null;
    const f = item;
    const fKey=flightTrackKey(f);
    return (
    <BoardListRow
      f={f}
      index={i}
      tab={tab}
      globalMode={!!globalMode}
      flightTab={flightTab}
      tracked={tracked}
      airport={airport}
      selectedId={selected.id}
      query={query}
      boardOffset={boardOffset}
      locale={prefs.locale}
      onSelect={selectFlight}
      onToggleTrack={toggleTrack}
      onShare={openShareStory}
      showLandedStamp={!!landedStampActive[fKey]}
      onLandedStampDone={()=>dismissLandedStamp(fKey)}
    />
  ); }, [tab, globalMode, flightTab, tracked, airport, selected.id, query, boardOffset, prefs.locale, selectFlight, toggleTrack, openShareStory, landedStampActive, dismissLandedStamp]);

  useEffect(()=>{
    listAtBottomRef.current = boardList.length === 0;
    setListAtBottom(boardList.length === 0);
  }, [boardList.length, tab, airport.iata, statusFilter, query]);

  const loadingBoard = !showRadar && (((!locReady && flights.length===0)||(loading&&tab!=='myflights'&&!globalMode&&!routeMode&&flights.length===0)));

  useEffect(()=>{
    if (!fidsTimeMode || loadingBoard || boardList.length===0) return;
    if (fidsBoard.nowLeadIndex < 0) return;
    if (fidsAnchoredKeyRef.current === fidsAnchorKey) return;
    fidsAnchoredKeyRef.current = fidsAnchorKey;
    const idx = fidsIndexWithPromos(fidsBoard.nowLeadIndex, promoFrom, boardList.length, showBoardPromos);
    const id = requestAnimationFrame(()=>{
      scrollToFidsIndex(idx, false);
    });
    return ()=>cancelAnimationFrame(id);
  },[fidsTimeMode, loadingBoard, boardList.length, fidsAnchorKey, fidsBoard.nowLeadIndex, scrollToFidsIndex, showBoardPromos, promoFrom]);

  const startFlyTogether = useCallback(async ()=>{
    if(!shareStory || flyTogetherBusy) return;
    const flight=shareDataToTogetherFlight(shareStory);
    setFlyTogetherBusy(true);
    haptics.medium();
    try{
      const displayName=(await getTogetherDisplayName())||'Traveler';
      const group=await createTogetherGroup(displayName, flight);
      if(!group){
        showToast(t().togetherStartFailed);
        haptics.error();
        return;
      }
      haptics.success();
      setShareStory(null);
      setFlyTogetherCode(group.code);
      setFlyTogetherOpen(true);
    } catch(err){
      const msg=err instanceof Error ? err.message : '';
      showToast(msg.includes('timed out') ? t().togetherCreateTimeout : t().togetherStartFailed);
      haptics.error();
    } finally {
      setFlyTogetherBusy(false);
    }
  },[shareStory, flyTogetherBusy, showToast]);

  const togetherJoinFlight = useMemo(()=>{
    if(shareStory) return shareDataToTogetherFlight(shareStory);
    const tr=tracked[0];
    if(!tr?.flight) return null;
    const f=tr.flight;
    const o=coordsForIata(f.origin, airport);
    const d=coordsForIata(f.destination, airport);
    return togetherFlightFromTracked({
      number:f.number,
      origin:f.origin,
      destination:f.destination,
      status:f.status,
      scheduledTime:f.scheduledTime,
      arrivalTime:f.arrivalTime,
      revisedTime:f.revisedTime,
      delay:f.delay,
      lat:f.lat,
      lng:f.lng,
      progressPct:flightLiveProgress(f, airport),
    }, o.lat, o.lon, d.lat, d.lon);
  },[shareStory, tracked, airport]);

  const openShareMyFlight = ()=>{
    if(!userSelected.current || !selected?.number){
      showToast(t().selectFlightToShare);
      return;
    }
    openShareStory(selected, shareTypeFor(selected));
  };

  const compactAirportHeader = (
    <AirportHeroBackdrop
      iata={airport.iata}
      name={airport.name}
      city={airport.city}
      country={airport.country}
      flag={airport.flag}
      lat={airport.lat}
      lon={airport.lon}
      flightCount={(globalMode||routeMode)?sorted.length:poolSorted.length}
      delayedCount={statusCounts.delayed}
      onPressAirport={()=>{ setPickerSlot('primary'); setShowPicker(true); }}
      rightSlot={headerActions}
      textColor={theme.text}
      secondaryColor={theme.secondary}
      mutedColor={theme.muted}
      accentColor={theme.accent}
      themeId={themeId}
    />
  );

  const boardTabs = (
      <View
        style={[s.tabs, { position:'relative' }]}
        onLayout={e=>setTabBarW(e.nativeEvent.layout.width)}
        collapsable={false}
        pointerEvents="box-none"
      >
        {tabBarW>0?(
          <Animated.View
            pointerEvents="none"
            style={{
              position:'absolute',
              bottom:0,
              left:0,
              height:2,
              width:tabBarW/4,
              backgroundColor:C.accent,
              transform:[{ translateX: tabSlide.interpolate({
                inputRange:[0,1,2,3],
                outputRange:[0, tabBarW/4, tabBarW/2, tabBarW*3/4],
              }) }],
            }}
          />
        ):null}
        <View style={s.tabSlot}>
        <Pressable
          style={[s.tab, tab==='arrival'&&!showRadar&&s.tabOn]}
          onPress={()=>{ haptics.light(); bounceTab(0); setShowRadar(false); setRouteHits(null); setRouteHint(''); if(statusFilter==='boarding') setStatusFilter('all'); setTab('arrival'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab==='arrival'&&!showRadar }}
          accessibilityLabel={t().arrives}
        >
          <View style={{ alignItems:'center', gap:2 }}>
            <AirplaneLanding size={18} color={tab==='arrival'&&!showRadar?C.accent:C.muted}/>
            <Text style={[s.tabTxt,tab==='arrival'&&!showRadar&&s.tabTxtOn]} numberOfLines={1} allowFontScaling={false}>{t().arrives}</Text>
          </View>
        </Pressable>
        </View>
        <View style={s.tabSlot}>
        <Pressable
          style={[s.tab, tab==='departure'&&!showRadar&&s.tabOn]}
          onPress={()=>{ haptics.light(); bounceTab(1); setShowRadar(false); setRouteHits(null); setRouteHint(''); setTab('departure'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab==='departure'&&!showRadar }}
          accessibilityLabel={t().departs}
        >
          <View style={{ alignItems:'center', gap:2 }}>
            <AirplaneTakeoff size={18} color={tab==='departure'&&!showRadar?C.accent:C.muted}/>
            <Text style={[s.tabTxt,tab==='departure'&&!showRadar&&s.tabTxtOn]} numberOfLines={1} allowFontScaling={false}>{t().departs}</Text>
          </View>
        </Pressable>
        </View>
        <View style={s.tabSlot}>
        <Pressable
          style={[s.tab, tab==='myflights'&&!showRadar&&s.tabOn]}
          onPress={()=>{
            haptics.light();
            bounceTab(2);
            setShowRadar(false);
            setRouteHits(null);
            setRouteHint('');
            setTab('myflights');
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab==='myflights'&&!showRadar }}
          accessibilityLabel={t().trackedCountA11y(tracked.length)}
        >
          <View style={{ alignItems:'center', gap:2 }}>
            <View>
              <BellRinging size={18} color={tab==='myflights'&&!showRadar?C.accent:C.muted}/>
              {tracked.length>0?(
                <Animated.View style={{
                  position:'absolute', top:-4, right:-8, minWidth:16, height:16, borderRadius:8,
                  backgroundColor:C.accent, alignItems:'center', justifyContent:'center', paddingHorizontal:4,
                  transform:[{ scale: trackedBadgeAnim }],
                }}>
                  <Text style={{ color:'#fff', fontSize:9, fontWeight:'800' }}>{tracked.length}</Text>
                </Animated.View>
              ):null}
            </View>
            <Text style={[s.tabTxt, tab==='myflights'&&!showRadar&&s.tabTxtOn]} numberOfLines={1} allowFontScaling={false}>{t().tracked}</Text>
          </View>
        </Pressable>
        </View>
        <View style={s.tabSlot}>
        <Pressable
          style={[s.tab, showRadar&&s.tabOn]}
          onPress={()=>{ haptics.light(); bounceTab(3); setShowRadar(true); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: !!showRadar }}
          accessibilityLabel={t().radar}
        >
          <View style={{ alignItems:'center', gap:2 }}>
            <WaveSawtooth size={18} color={showRadar?C.accent:C.muted}/>
            <Text style={[s.tabTxt, showRadar&&s.tabTxtOn]} numberOfLines={1} allowFontScaling={false}>{t().radar}</Text>
          </View>
        </Pressable>
        </View>
      </View>
  );

  return (
    <View style={[s.screen,{ backgroundColor: theme.bg }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'}/>

      {gateCloseAlert ? (
        <GateClosingBanner
          gate={gateCloseAlert.gate}
          mins={gateCloseAlert.mins}
          onDismiss={()=>setGateCloseBannerDismissed(gateCloseAlert.dismissKey)}
        />
      ) : null}

      {!showRadar && theme.isDark ? (
        <LiveMapBackdrop lat={airport.lat} lon={airport.lon} />
      ) : null}

      <OnboardingScreen
        visible={showOnboarding}
        pickerQuery={pickerQuery}
        onPickerQueryChange={setPickerQuery}
        pickerResults={pickerResults}
        pickerBusy={pickerBusy}
        recentAirports={recentAirports}
        favorites={favFiltered}
        nearMeResults={nearMeResults}
        nearMeActive={nearMeActive}
        nearMeBusy={nearMeBusy}
        onNearMe={onboardingNearMe}
        selectedAirport={onboardingSelectedAirport}
        onSelectAirport={setOnboardingSelectedAirport}
        onComplete={(a)=>{
          savePrefs({ hasSeenOnboarding:true });
          selectAirport(a as Airport);
          setShowOnboarding(false);
          setOnboardingSelectedAirport(null);
        }}
      />

      {notifyBanner?(
        <View style={s.notifyBanner} accessibilityRole="alert">
          <BellSimple size={18} color="#92400e" style={{marginTop:2}}/>
          <View style={s.notifyBannerBody}>
            <Text style={s.notifyBannerTitle}>{t().notificationsDisabled}</Text>
            <Text style={s.notifyBannerMsg}>
              {t().notifyBannerBody}
            </Text>
            <View style={s.notifyBannerActions}>
              <TouchableOpacity
                style={s.notifyBannerCta}
                onPress={()=>Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel={t().openSettings}
              >
                <Text style={s.notifyBannerCtaTxt}>{t().openSettings}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={()=>setNotifyBanner(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t().later}
              >
                <Text style={s.notifyBannerLater}>{t().later}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            onPress={()=>setNotifyBanner(false)}
            hitSlop={10}
            style={s.notifyBannerClose}
            accessibilityRole="button"
            accessibilityLabel={t().dismissBanner}
          >
            <X size={16} color="#92400e"/>
          </TouchableOpacity>
        </View>
      ):null}

      {showGateRaceBanner && gateRacePair?(
        <GateRaceBanner
          pair={gateRacePair}
          onOpen={()=>{ haptics.light(); setGateRaceOpen(true); }}
          onDismiss={()=>setGateRaceDismissed(gateRacePair.key)}
          text={theme.text}
          bg={theme.card}
        />
      ):null}

      {switchBanner?(
        <View style={s.switchBanner}>
          <ActivityIndicator size="small" color={C.accent}/>
          <Text style={s.switchBannerTxt} numberOfLines={1} ellipsizeMode="tail">{switchBanner}</Text>
          <Text style={s.switchBannerSub} numberOfLines={1} ellipsizeMode="tail">{airport.flag} {airport.name}</Text>
        </View>
      ):null}

      {/* Picker */}
      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={()=>{
          setShowPicker(false);
          setPickerQuery('');
          setPickerResults([]);
          setNearMeResults([]);
          setNearMeActive(false);
          setPickerSlot('primary');
        }}
      >
        <View style={[s.picker,{ flex:1, maxHeight:undefined, borderRadius:0, margin:0, paddingTop: Platform.OS==='web'?20:54 }]}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingBottom:8 }}>
            <Text style={{ fontSize:20, fontWeight:'800', color:C.text }}>{t().chooseAirport}</Text>
            <TouchableOpacity
              onPress={()=>{
                setShowPicker(false);
                setPickerQuery('');
                setPickerResults([]);
                setNearMeResults([]);
                setNearMeActive(false);
                setPickerSlot('primary');
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t().closeAirportPicker}
            >
              <X size={22} color={C.text}/>
            </TouchableOpacity>
          </View>
          <View style={s.pickerSearch}>
            <MagnifyingGlass size={16} color={C.muted}/>
            <TextInput
              style={s.pickerSearchInput}
              value={pickerQuery}
              onChangeText={(text)=>{
                setPickerQuery(text);
                if(nearMeActive) setNearMeActive(false);
              }}
              placeholder={t().searchCityAirport}
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              autoFocus
            />
            {pickerQuery.length>0&&(
              <TouchableOpacity onPress={()=>{ setPickerQuery(''); setNearMeActive(false); }} hitSlop={8}>
                <X size={16} color={C.secondary}/>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={s.nearMeBtn}
              onPress={findNearMe}
              activeOpacity={0.8}
              disabled={nearMeBusy}
            >
              {nearMeBusy
                ? <ActivityIndicator size="small" color={C.accent}/>
                : <MapPin size={16} color={C.accent}/>}
              <Text style={[s.nearMeTxt,{color:C.accent}]}>{t().nearMe}</Text>
            </TouchableOpacity>

            {recentAirports.length>0&&!showSearchResults?(
              <View>
                <View style={s.pCountry}>
                  <Text style={s.pCountryTxt}>{t().recentAirports}</Text>
                </View>
                {recentAirports.map(a=>(
                  <TouchableOpacity
                    key={`recent-${a.iata}`}
                    style={s.pRow}
                    onPress={()=>selectAirport(a)}
                    accessibilityRole="button"
                    accessibilityLabel={t().airportA11y(a.iata, a.name, a.country)}
                  >
                    <Text style={s.pFlag}>{a.flag}</Text>
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={s.pIata} numberOfLines={1} ellipsizeMode="tail">{a.iata}
                        <Text style={s.pName}>  {a.name}</Text>
                      </Text>
                      <Text style={s.pCity} numberOfLines={1} ellipsizeMode="tail">{a.city}{a.country?` · ${a.country}`:''}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ):null}

            {nearMeResults.length>0&&showNearMeList?(
              <View>
                <View style={s.pCountry}>
                  <Text style={s.pCountryTxt}>{t().nearby}</Text>
                </View>
                {nearMeResults.map(a=>(
                  <TouchableOpacity key={`near-${a.iata}`} style={s.pRow} onPress={()=>selectAirport(a)}>
                    <Text style={s.pFlag}>{a.flag}</Text>
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={s.pIata} numberOfLines={1} ellipsizeMode="tail">{a.iata}
                        <Text style={s.pName}>  {a.name}</Text>
                      </Text>
                      <Text style={s.pCity} numberOfLines={1} ellipsizeMode="tail">
                        {typeof a.distanceKm==='number'
                          ?`${a.distanceKm} km away`
                          :`${a.city}${a.country?` · ${a.country}`:''}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ):null}

            {!showSearchResults&&favFiltered.length>0&&(
              <View>
                <View style={s.pCountry}>
                  <View style={s.pCountryRow}>
                    <Star size={12} color={C.gold} weight="fill"/>
                    <Text style={s.pCountryTxt}>{t().favourites}</Text>
                  </View>
                </View>
                {favFiltered.map(a=>(
                  <View key={`fav-${a.iata}`} style={s.pRow}>
                    <TouchableOpacity
                      style={{flex:1,flexDirection:'row',alignItems:'center',gap:10}}
                      onPress={()=>selectAirport(a)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.pFlag}>{a.flag}</Text>
                      <View style={{flex:1,minWidth:0}}>
                        <Text style={s.pIata} numberOfLines={1} ellipsizeMode="tail">{a.iata}
                          <Text style={s.pName}>  {a.name}</Text>
                        </Text>
                        <Text style={s.pCity} numberOfLines={1} ellipsizeMode="tail">{a.city}{a.country?` · ${a.country}`:''}</Text>
                      </View>
                      {(a.iata===airport.iata)&&<Check size={16} color="#22c55e"/>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={()=>toggleFavouriteAirport(a)}
                      hitSlop={{top:8,bottom:8,left:8,right:8}}
                      accessibilityRole="button"
                      accessibilityLabel={t().removeFavourite(a.iata)}
                    >
                      <Text style={{fontSize:18,color:C.gold}}>★</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {showPickerSearchResults&&(
              <View>
                <View style={s.pCountry}>
                  <Text style={s.pCountryTxt}>
                    {pickerBusy?t().searching:t().results}
                  </Text>
                </View>
                {groupAirportsByRegion(pickerResults).map(group=> (
                  <View key={group.region}>
                    <View style={s.pCountry}>
                      <Text style={s.pCountryTxt}>{group.region}</Text>
                    </View>
                    {group.items.map(a=>{
                  const fav=isFavouriteAirport(a.iata);
                  return (
                    <View key={a.iata} style={s.pRow}>
                      <TouchableOpacity
                        style={{flex:1,flexDirection:'row',alignItems:'center',gap:10}}
                        onPress={()=>selectAirport(a)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={t().airportA11y(a.iata, a.name, a.country)}
                      >
                        <Text style={s.pFlag}>{a.flag}</Text>
                        <View style={{flex:1,minWidth:0}}>
                          <Text style={s.pIata} numberOfLines={1} ellipsizeMode="tail">{a.iata}
                            <Text style={s.pName}>  {a.name}</Text>
                          </Text>
                          <Text style={s.pCity} numberOfLines={1} ellipsizeMode="tail">{a.city}{a.country?` · ${a.country}`:''}</Text>
                        </View>
                        {(a.iata===airport.iata)&&<Check size={16} color="#22c55e"/>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={()=>toggleFavouriteAirport(a)}
                        hitSlop={{top:8,bottom:8,left:8,right:8}}
                        accessibilityRole="button"
                        accessibilityLabel={fav?t().removeFavourite(a.iata):t().saveFavourite(a.iata)}
                      >
                        <Text style={{fontSize:18,color:fav?C.gold:C.muted}}>{fav?'★':'☆'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                    </View>
                ))}
                {!pickerBusy&&pickerResults.length===0&&(
                  <View style={s.pickerEmpty}>
                    <Text style={s.pickerEmptyTxt}>{t().noAirportsMatch(pickerQuery.trim())}</Text>
                  </View>
                )}
              </View>
            )}

            {!showSearchResults&&favFiltered.length===0&&(
              <View style={s.pickerEmpty}>
                <Text style={s.pickerEmptyTxt}>{t().airportsWorldwide}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {showRadar ? (
        <View style={{ flex:1, minHeight:0 }}>
          {compactAirportHeader}
          {boardTabs}
          <View style={{ paddingHorizontal:16, paddingBottom:8 }}>
            <Text style={{ color:C.text, fontSize:13, fontWeight:'700' }} numberOfLines={1}>
              {radarShownCount>0 && radarAircraftCount>0
                ? `${radarShownCount}/${radarAircraftCount} aircraft`
                : `${radarAircraftCount} aircraft`}
              {` · ${airport.iata}`}
            </Text>
          </View>
          <RadarModal
            variant="backdrop"
            visible={showRadar}
            pollsActive={appPollsActive}
            onClose={()=>setShowRadar(false)}
            airport={airport}
            isTracked={isTracked}
            onToggleTrack={toggleTrack}
            onAircraftCount={(total, shown)=>{
              setRadarAircraftCount(total);
              if(typeof shown==='number') setRadarShownCount(shown);
            }}
            bottomInset={0}
          />
        </View>
      ) : (
      <View style={{ flex:1, minHeight:0 }}>
      <View style={{ backgroundColor: theme.bg, zIndex: 20, paddingBottom: 6, flexShrink: 0 }}>
        {compactAirportHeader}
        {boardTabs}
        <BoardHeader
          openShareMyFlight={openShareMyFlight}
          searchInputRef={searchInputRef}
          search={search}
          onSearchChange={onSearchChange}
          clearSearch={clearSearch}
          themeSearchPlaceholder={theme.searchPlaceholder}
          C={C}
          themeAccent={theme.accent}
          globalBusy={globalBusy}
          routeBusy={routeBusy}
          recentSearches={recentSearches}
          smartBoardFlights={smartBoardFlights}
          viewDay={viewDay}
          onApplyQuery={onSmartApplyQuery}
          onRemoveRecent={(q)=>{ removeRecentSearch(q).then(setRecentSearches).catch(()=>{}); }}
          onSelectFlightNumber={onSmartSelectFlightNumber}
          runRouteSearch={runRouteSearch}
          routeMode={routeMode}
          globalMode={globalMode}
          routeHint={routeHint}
          sortedLength={sorted.length}
          tab={tab}
          statusFilter={statusFilter}
          onStatusFilter={onStatusFilter}
          statusCounts={statusCounts}
          mode={mode}
          showRadar={showRadar}
          boardOffset={boardOffset}
          boardDay={airportTodayKey}
          onBoardOffset={onBoardOffset}
        />
      </View>
      <AnimatedFlashList
        ref={scrollRef as any}
        key={loadingBoard ? `loading-${fidsAnchorKey}` : fidsAnchorKey}
        style={{ flex:1 }}
        data={loadingBoard ? [] : mergedFlights}
        keyExtractor={(item: BoardListItem) => item.id}
        getItemType={(item: BoardListItem) => isPromoItem(item) ? item.type : 'flight'}
        // @ts-expect-error FlashList v2 types omit deprecated estimatedItemSize
        estimatedItemSize={120}
        initialNumToRender={BOARD_INITIAL_NUM_TO_RENDER}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        bounces
        overScrollMode="always"
        scrollEventThrottle={16}
        onScroll={onBoardScroll}
        contentContainerStyle={{ paddingBottom: 48, paddingTop: 0 }}
        extraData={`${flightsRevision}:${prefs.locale}:${search}:${revealedPast}:${tab}:${mergedFlights.length}`}
        onStartReached={fidsTimeMode && !loadingBoard ? onFidsStartReached : undefined}
        onStartReachedThreshold={0.05}
        maintainVisibleContentPosition={fidsTimeMode && !loadingBoard ? { autoscrollToTopThreshold: -1 } : undefined}
        onLoad={()=>{
          if (!fidsTimeMode || fidsBoard.nowLeadIndex < 0) return;
          if (fidsAnchoredKeyRef.current === fidsAnchorKey) return;
          fidsAnchoredKeyRef.current = fidsAnchorKey;
          scrollToFidsIndex(fidsIndexWithPromos(fidsBoard.nowLeadIndex, promoFrom, boardList.length, showBoardPromos), false);
        }}
        ListHeaderComponent={
          <>
          <BoardListIntro
            C={C}
            offlineCacheAt={offlineCacheAt}
            error={error}
            onRetry={()=>{
              if(isGlobalBoardSearch(search)){
                setSearchEpoch(n=>n+1);
                return;
              }
              load(airport.iata, flightTab);
            }}
            loadingBoard={loadingBoard}
            loadTimedOut={loadTimedOut}
            locReady={locReady}
            airport={airport}
            viewDay={viewDay}
            boardOffset={boardOffset}
            tab={tab}
            addBusy={addBusy}
            onAddTrack={addTrackByNumber}
            onOpenScanner={()=>setShowScanner(true)}
            myFlightsEmpty={myFlights.length===0}
            onBrowseFlights={onBrowseFlights}
            refreshing={refreshing}
            tracked={tracked}
            onOpenTrackedFlight={selectFlight}
            pickupPersonRev={pickupPersonRev}
            globalMode={globalMode}
            sortedLength={sorted.length}
            globalBusy={globalBusy}
          />
          {tab==='myflights'&&!globalMode?(
            <PassportTabCover
              refreshKey={passportRefresh}
              onPress={()=>setPassportShareOpen(true)}
            />
          ):null}
          </>
        }
        renderItem={renderBoardItem}
        onEndReached={boardPaginated ? undefined : loadMoreBoardFlights}
        onEndReachedThreshold={BOARD_END_REACHED_THRESHOLD}
          refreshControl={<RefreshControl
            refreshing={refreshing}
            onRefresh={async()=>{
              haptics.light();
              setRefreshing(true);
              setRefreshHint(t().refreshing);
              try{
                if(tab==='myflights'){
                  await pollTracked();
                } else if(isGlobalBoardSearch(searchRef.current)){
                  setSearchEpoch(n=>n+1);
                } else {
                  await load(airport.iata,flightTab);
                }
                showToast(t().updatedJustNow);
                setRefreshHint(t().updated);
                setTimeout(()=>setRefreshHint(''), 1200);
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={C.accent}
          />}
          ListFooterComponent={
            tab==='myflights'&&!globalMode ? (
            <>
              <FlightHistorySection
                isPro={isPro}
                colors={C}
                refreshKey={historyRefresh}
                onRequirePro={requirePro}
              />
              <Text style={s.foot}>{t().pullToRefreshInterval}</Text>
              <View style={{height:50}}/>
            </>
            ) : (
            <>
          {loadingMoreBoard ? (
            <View style={s.loadMoreFoot}>
              <ActivityIndicator size="small" color={C.accent}/>
              <Text style={[s.loadMoreTxt, { color: C.muted }]}>{t().loadingMoreFlights}</Text>
            </View>
          ) : null}
          {tab!=='myflights'?(
            <TouchableOpacity
              style={s.connLink}
              onPress={()=>{ setConnIncoming(normalizeFlightNumberInput(search) || ''); setShowConn(true); }}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={t().checkConnection}
            >
              <ArrowsLeftRight size={12} color={C.muted}/>
              <Text style={s.connLinkTxt}>{t().checkConnectionLink}</Text>
            </TouchableOpacity>
          ):null}
          {sorted.length===0&&(
            <View style={s.center}>
              <ActivityIndicator size="large" color={C.accent} />
              {routeMode?(
                <>
                  <Text style={[s.emptyTxt,{ textAlign:'center', color:C.text, fontWeight:'700' }]}>
                    {routeBusy ? t().routeSearchingShort : t().routeNoFlights(routeHint)}
                  </Text>
                  <Text style={[s.emptyTxt,{ marginTop:10 }]}>
                    Probeer een andere datum of andere luchthavens
                  </Text>
                </>
              ):query?(
                <>
                  <Text style={[s.emptyTxt,{ textAlign:'center', color:C.text, fontWeight:'700' }]}>
                    {globalBusy ? t().globalSearching : emptyCopy.title}
                  </Text>
                  {!globalMode && popularDests.length>0?(
                    <View style={{ marginTop:16, alignItems:'center', gap:8 }}>
                      <Text style={{ fontSize:12, fontWeight:'700', color:C.muted }}>{t().popularFrom(airport.iata)}</Text>
                      {popularDests.map(p=>(
                        <TouchableOpacity
                          key={p.iata}
                          onPress={()=>{ haptics.light(); setSearch(p.city || p.iata); }}
                          style={{ backgroundColor:C.list, borderRadius:12, paddingHorizontal:14, paddingVertical:8, borderWidth:1, borderColor:C.border }}
                          accessibilityRole="button"
                          accessibilityLabel={`${p.iata} ${p.city}`}
                        >
                          <Text style={{ color:C.text, fontSize:14, fontWeight:'700' }}>→ {p.iata} {p.city}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ):null}
                  {emptyCopy.tryHints?(
                    <Text style={[s.emptyTxt,{ marginTop:10, color:C.accent }]}>
                      {emptyCopy.tryHints}
                    </Text>
                  ):null}
                  <Text style={[s.emptyTxt,{ marginTop:10 }]}>
                    {emptyCopy.hint}
                  </Text>
                </>
              ):(
                <>
                <Text style={[s.emptyTxt, { textAlign:'center', color:C.text, fontWeight:'700' }]}>
                  {boardOffset!==0
                    ? t().noFlightsThisDate
                    : statusFilter!=='all'
                    ? t().noStatusFlights(statusFilterLabel(statusFilter).toLowerCase())
                    : t().noFlights}
                </Text>
                </>
              )}
            </View>
          )}

          <Text style={s.foot}>
            {routeMode
              ? (routeBusy ? t().routeSearchingShort : t().routeResults(routeHint, sorted.length))
              : globalMode
              ? t().worldwideSearch(sorted.length)
              : sorted.length===0
                ? t().pullToRefresh
                : t().flightsLiveRefresh(sorted.length)}
          </Text>
          <View style={{height:50}}/>
            </>
            )
          }
        />
      <ListScrollFade visible={!listAtBottom && boardList.length > 0} bg={theme.bg} />
      {fidsTimeMode && !loadingBoard && boardList.length > 0 ? (
        <TouchableOpacity
          style={s.nowFab}
          onPress={scrollToFidsNow}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t().fidsNow}
        >
          <Clock size={14} color={theme.text} weight="bold" />
          <Text style={s.nowFabTxt}>{t().fidsNow}</Text>
        </TouchableOpacity>
      ) : null}
      </View>
      )}

      <Modal
        visible={detailOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={()=>{ setDetailOpen(false); setDetailFocusSection(null); }}
      >
        <View style={{ flex:1, backgroundColor: theme.bg, paddingTop: Platform.OS==='web'?20:54 }}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingBottom:8 }}>
            <Text style={{ fontSize:18, fontWeight:'800', color: theme.text }} numberOfLines={1}>
              {selected.number}
            </Text>
            <TouchableOpacity
              onPress={()=>{ setDetailOpen(false); setDetailFocusSection(null); }}
              style={s.themeBtn}
              accessibilityRole="button"
              accessibilityLabel={t().closeFlightDetails}
            >
              <X size={18} color={theme.text}/>
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={detailScrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View ref={detailContentRef} collapsable={false}>
            <FlightRouteMap
              key={mapCoordTick}
              flight={selected}
              type={tab==='myflights'
                ? (tracked.find(t=>sameTrackedFlight(t, selected))?.type ?? 'departure')
                : flightTab}
              airport={airport}
              animated={isPro}
            />
            <DetailCard
              key={detailFlightOpenKey(
                selected,
                tab==='myflights'
                  ? (tracked.find(t=>sameTrackedFlight(t, selected))?.type ?? 'departure')
                  : flightTab,
              )}
              f={selected}
              type={tab==='myflights'
                ? (tracked.find(t=>sameTrackedFlight(t, selected))?.type ?? 'departure')
                : flightTab}
              airport={airport}
              tracked={isTracked(selected)}
              landedAtMs={tracked.find(t=>sameTrackedFlight(t, selected))?.landedAtMs}
              onToggleTrack={()=>toggleTrack(selected)}
              onToast={showToast}
              isPro={isPro}
              onRequirePro={requirePro}
              onOpenScanner={()=>setShowScanner(true)}
              previousGate={tracked.find(t=>sameTrackedFlight(t, selected))?.previousGate}
              boardingPass={tracked.find(t=>sameTrackedFlight(t, selected))?.boardingPass}
              onOpenPickup={()=>setPickupLive(toPickupLiveData(
                selected,
                tab==='myflights'
                  ? (tracked.find(t=>sameTrackedFlight(t, selected))?.type ?? 'arrival')
                  : flightTab,
                airport,
              ))}
              onOpenPassport={pendingMemoryCard?.flightNumber === selected.number ? ()=>{
                haptics.light();
                setDetailOpen(false);
                setDetailFocusSection(null);
                setPassportShareOpen(true);
              } : undefined}
              gateRacePair={selectedGateRacePair}
              onOpenGateRace={()=>{ haptics.light(); setGateRaceOpen(true); }}
              focusSection={detailFocusSection}
              onFocusHandled={()=>setDetailFocusSection(null)}
              detailScrollRef={detailScrollRef}
              onPickupPersonSaved={()=>setPickupPersonRev(n=>n+1)}
            />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <MyNextFlightShare
        visible={!!shareStory}
        data={shareStory}
        onClose={()=>setShareStory(null)}
        onStartFlyTogether={startFlyTogether}
        flyTogetherBusy={flyTogetherBusy}
      />

      {togetherJoinFlight ? (
        <JoinTogetherSheet
          visible={joinTogetherOpen}
          initialCode={joinTogetherCode}
          flight={togetherJoinFlight}
          onClose={()=>setJoinTogetherOpen(false)}
          onJoined={code=>{
            setFlyTogetherCode(code);
            setFlyTogetherOpen(true);
          }}
        />
      ) : null}

      <FlyTogetherScreen
        visible={flyTogetherOpen && !!flyTogetherCode}
        code={flyTogetherCode || ''}
        selfDeviceId={togetherDeviceId}
        onClose={()=>setFlyTogetherOpen(false)}
        onNotify={(_kind, body)=>{ notifyTogetherEvent(body); }}
        onCopied={()=>showToast(t().togetherLinkCopied)}
      />

      <PickupLiveScreen
        visible={!!pickupLive}
        data={pickupLive}
        onClose={()=>setPickupLive(null)}
        bg={theme.bg}
        text={theme.text}
        secondary={theme.secondary}
        isDark={!!theme.isDark}
      />

      <GateRaceScreen
        visible={gateRaceOpen && !!gateRacePair}
        pair={gateRacePair}
        onClose={()=>setGateRaceOpen(false)}
        bg={theme.bg}
        text={theme.text}
        secondary={theme.secondary}
        isDark={!!theme.isDark}
        airportName={airport.name || airport.city || airport.iata}
      />

      <ConnectionModal
        visible={showConn}
        onClose={()=>setShowConn(false)}
        defaultHub={airport.iata}
        defaultIncoming={connIncoming}
        isPro={isPro}
        onRequirePro={requirePro}
      />

      <BoardingPassScanner
        visible={showScanner}
        onClose={()=>setShowScanner(false)}
        onParsed={onBoardingPassParsed}
        theme={{ bg:C.bg, text:C.text, secondary:C.secondary, accent:C.accent, list:C.list, muted:C.muted }}
      />

      <AfterLandingCard
        data={landedWelcome}
        onDismiss={()=>{
          setLandedWelcome(null);
          clearMemoryCardTimer();
        }}
      />

      <UrgentBoardingOverlay
        data={urgentBoarding}
        onDismiss={dismissUrgentBoarding}
      />

      <FlightMemoryCard
        visible={memoryCardVisible}
        data={pendingMemoryCard}
        inPassport={memoryInPassport}
        onDismiss={()=>{
          clearMemoryCardTimer();
          setMemoryCardVisible(false);
          setPendingMemoryCard(null);
          pendingMemoryCardRef.current = null;
        }}
        onPassportChange={()=>setPassportRefresh(x=>x+1)}
        onViewPassport={()=>{
          clearMemoryCardTimer();
          setMemoryCardVisible(false);
          setPendingMemoryCard(null);
          pendingMemoryCardRef.current = null;
          setTab('myflights');
          setPassportShareOpen(true);
        }}
      />

      <FlightPassportShare
        visible={passportShareOpen}
        refreshKey={passportRefresh}
        onClose={()=>setPassportShareOpen(false)}
      />

      <UpgradeLimitPrompt
        visible={showUpgradePrompt && !BETA_MODE}
        onUpgrade={()=>{
          setShowUpgradePrompt(false);
          setPaywallHighlight('');
          setShowPaywall(true);
        }}
        onNotNow={()=>{
          dismissUpgradePrompt().catch(()=>{});
          setShowUpgradePrompt(false);
        }}
      />

      <ProPaywallScreen
        visible={showPaywall && !BETA_MODE}
        onClose={()=>{ setShowPaywall(false); setPaywallHighlight(''); }}
        onProUnlocked={()=>setIsPro(true)}
        highlight={paywallHighlight || undefined}
      />

      <SettingsScreen
        visible={showSettings}
        onClose={()=>setShowSettings(false)}
        isPro={isPro}
        colors={C}
        themeId={themeId}
        onSelectTheme={(id)=>{
          if(isProTheme(id) && !isPro && !BETA_MODE){
            setShowSettings(false);
            requirePro('platinum');
            return;
          }
          setTheme(id);
        }}
        onOpenPaywall={()=>{ requirePro(); }}
        onProUnlocked={()=>setIsPro(true)}
        onToast={showToast}
        prefs={prefs}
        currentAirport={airport}
        onOpenAirportPicker={()=>{ setPickerSlot('primary'); setShowPicker(true); }}
        onRequirePro={(h)=>requirePro(h)}
        onCacheCleared={() => {
          loadRecentSearches().then(setRecentSearches).catch(() => {});
          loadRecentAirports().then(setRecentAirports).catch(() => {});
        }}
        trackedCount={tracked.length}
        trackLimit={FREE_TRACK_LIMIT}
        betaMode={BETA_MODE}
        onOpenPassport={passportCount > 0 ? ()=>{
          setShowSettings(false);
          setPassportShareOpen(true);
        } : undefined}
        onDevSeedPassport={devSeedPassport}
      />

      {toast?(
        <Animated.View
          pointerEvents="none"
          style={[s.toast,{opacity:toastAnim,transform:[{translateY:toastAnim.interpolate({
            inputRange:[0,1],outputRange:[12,0],
          })}]}]}
        >
          <Text style={s.toastTxt}>{toast}</Text>
        </Animated.View>
      ):null}
    </View>
  );
}

// ── Styles (factories — rebuilt on theme change via applyTheme) ────────────────
function makeS(C:ThemeColors){return StyleSheet.create({
  screen:      {flex:1,backgroundColor:C.bg,overflow:'hidden'},
  nowFab:      {position:'absolute',right:16,bottom:24,zIndex:30,flexDirection:'row',alignItems:'center',
                gap:6,backgroundColor:C.card,borderRadius:999,paddingVertical:8,paddingHorizontal:14,
                borderWidth:1,borderColor:C.border,
                shadowColor:'#000',shadowOpacity:0.2,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:4},
  nowFabTxt:   {fontSize:13,fontWeight:'800',color:C.text,letterSpacing:0.2},
  header:      {flexDirection:'row',justifyContent:'space-between',alignItems:'center',
                paddingHorizontal:20,paddingTop:Platform.OS==='web'?20:54,paddingBottom:16,backgroundColor:C.bg,gap:12},
  headerLeft:  {flexShrink:0},
  headerRight: {flexDirection:'row',alignItems:'center',gap:10,flexShrink:0},
  headerIcon:  {width:28,height:28,borderRadius:8,backgroundColor:C.isDark?'rgba(255,255,255,0.08)':C.list,borderWidth:1,
                borderColor:C.isDark?'rgba(255,255,255,0.12)':C.border,alignItems:'center',justifyContent:'center',flexShrink:0},
  themeBtn:    {width:36,height:36,borderRadius:10,backgroundColor:C.list,borderWidth:1,
                borderColor:C.border,alignItems:'center',justifyContent:'center',flexShrink:0},
  logoRow:     {flexDirection:'row',alignItems:'center',gap:8},
  logo:        {fontSize:fs(20),fontWeight:'700',color:C.text,letterSpacing:-0.4,flexShrink:0},
  proPill:     {backgroundColor:'rgba(201,168,76,0.16)',borderRadius:7,paddingHorizontal:7,paddingVertical:2,
                borderWidth:1,borderColor:BRAND.gold},
  proPillSm:   {flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(201,168,76,0.16)',
                borderRadius:7,paddingHorizontal:6,paddingVertical:2,borderWidth:1,borderColor:BRAND.gold},
  proPillTxt:  {color:BRAND.gold,fontSize:10,fontWeight:'800',letterSpacing:0.3},
  dualSlots:   {flexDirection:'row',gap:8,paddingHorizontal:16,paddingTop:8,paddingBottom:10},
  nearMeBtn:   {flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:16,marginBottom:8,
                paddingVertical:10,paddingHorizontal:12,borderRadius:12,borderWidth:1,
                borderColor:C.fieldBorder,backgroundColor:C.accentDim},
  nearMeTxt:   {fontSize:14,fontWeight:'800'},
  dualSlot:    {flex:1,backgroundColor:C.card,borderRadius:14,padding:12,borderWidth:1,borderColor:C.border},
  dualSlotOn:  {borderColor:BRAND.gold,backgroundColor:C.accentDim},
  dualSlotTop: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4},
  dualSlotLabel:{fontSize:10,fontWeight:'700',color:C.muted,letterSpacing:1.0},
  dualSlotVal: {fontSize:14,fontWeight:'700',color:C.text,marginTop:2},
  splitBlock:  {marginTop:18},
  apPill:      {flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.accentDim,
                borderRadius:10,paddingHorizontal:12,paddingVertical:8,borderWidth:StyleSheet.hairlineWidth,
                borderColor:C.fieldBorder,flexShrink:0,minWidth:88,height:36,flexWrap:'nowrap'},
  apPillPressed:{opacity:0.72},
  apIata:      {fontSize:16,fontWeight:'700',color:C.accent,letterSpacing:0.2,flexShrink:0},
  seaCard:     {marginHorizontal:16,marginTop:4,marginBottom:6,backgroundColor:'transparent',
                paddingHorizontal:4,paddingVertical:2,minWidth:0,overflow:'hidden'},
  seaCardLbl:  {fontSize:11,fontWeight:'700',color:C.muted,letterSpacing:0.8,textTransform:'uppercase',marginBottom:4},
  seaCardVal:  {fontSize:12,fontWeight:'600',color:C.muted,flexShrink:1,minWidth:0},
  apChevron:   {flexShrink:0},
  switchBanner:{marginHorizontal:16,marginBottom:12,paddingVertical:12,paddingHorizontal:14,
                backgroundColor:themeMode==='light'?'rgba(201,168,76,0.08)':'rgba(201,168,76,0.12)',
                borderRadius:12,borderLeftWidth:3,borderLeftColor:BRAND.gold,
                flexDirection:'row',alignItems:'center',gap:10},
  switchBannerTxt:{color:C.text,fontSize:14,fontWeight:'700'},
  switchBannerSub:{color:C.secondary,fontSize:11,flex:1,textAlign:'right',minWidth:0},
  notifyBanner:   {marginHorizontal:16,marginBottom:12,paddingVertical:12,paddingHorizontal:12,
                   backgroundColor:'rgba(245,158,11,0.08)',
                   borderRadius:12,borderLeftWidth:3,borderLeftColor:'#F59E0B',
                   flexDirection:'row',alignItems:'flex-start',gap:10},
  notifyBannerBody:{flex:1,gap:6,minWidth:0},
  notifyBannerTitle:{fontSize:13,fontWeight:'700',color:themeMode==='light'?'#92400e':'#fde68a'},
  notifyBannerMsg:  {fontSize:12,lineHeight:17,fontWeight:'500',
                     color:themeMode==='light'?'#a16207':'#fcd34d'},
  notifyBannerActions:{flexDirection:'row',alignItems:'center',gap:14,marginTop:4,flexWrap:'wrap'},
  notifyBannerCta:  {backgroundColor:themeMode==='light'?'#d97706':'#b45309',
                     borderRadius:10,paddingHorizontal:12,paddingVertical:8},
  notifyBannerCtaTxt:{color:'#fff',fontSize:12,fontWeight:'700'},
  notifyBannerLater:{fontSize:12,fontWeight:'700',color:themeMode==='light'?'#92400e':'#fde68a'},
  notifyBannerClose:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},
  picker:      {backgroundColor:C.bg,borderBottomWidth:1,borderColor:C.border},
  pickerSearch:{flexDirection:'row',alignItems:'center',marginHorizontal:16,marginTop:4,marginBottom:8,
                backgroundColor:C.card,borderRadius:16,...cardShadow,
                paddingHorizontal:12,gap:8},
  pickerSearchInput:{flex:1,color:C.text,fontSize:14,fontWeight:'500',
                     paddingVertical:Platform.OS==='ios'?11:8},
  pickerEmpty: {paddingVertical:28,alignItems:'center'},
  pickerEmptyTxt:{color:C.muted,fontSize:13},
  pCountry:    {paddingHorizontal:20,paddingTop:12,paddingBottom:6,backgroundColor:C.list,
                borderTopWidth:1,borderColor:C.border},
  pCountryRow: {flexDirection:'row',alignItems:'center',gap:6},
  pCountryTxt: {fontSize:12,fontWeight:'700',color:C.text,letterSpacing:0.2},
  pCountryCodes:{fontSize:10,color:C.muted,marginTop:3,fontWeight:'600'},
  pRow:        {flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:12,
                gap:12,borderBottomWidth:1,borderColor:C.border},
  pFlag:       {fontSize:18},
  pIata:       {fontSize:14,fontWeight:'700',color:C.accent,flexShrink:0},
  pName:       {fontSize:12,fontWeight:'400',color:C.secondary,flex:1,minWidth:0},
  pCity:       {fontSize:11,color:C.muted,marginTop:2,minWidth:0},
  tabs:        {flexDirection:'row',marginHorizontal:C.tabBar?0:8,marginBottom:0,
                backgroundColor:C.tabBar||'transparent',
                height:44,alignItems:'stretch',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border,
                paddingHorizontal:C.tabBar?8:0},
  tabSlot:     {flex:1, minWidth:0, height:44},
  tab:         {flex:1,height:44,paddingHorizontal:2,alignItems:'center',
                flexDirection:'column',justifyContent:'center',gap:2,borderBottomWidth:2,borderBottomColor:'transparent'},
  tabOn:       {borderBottomColor:C.accent,backgroundColor:'transparent'},
  tabTxt:      {color:C.secondary,fontSize:fs(11),lineHeight:fs(14),fontWeight:'600',textAlign:'center'},
  tabTxtOn:    {color:C.accent,fontWeight:'700'},
  shareMyFlightBtn:{flexDirection:'row',alignItems:'center',gap:4,flexShrink:0,
                paddingVertical:8,paddingHorizontal:10,borderRadius:999,borderWidth:1,
                borderColor:C.accent,backgroundColor:C.accent,height:40},
  shareMyFlightTxt:{color:'#0A0E1A',fontSize:12,fontWeight:'700'},
  myWrap:      {paddingBottom:8},
  myEmpty:     {marginHorizontal:16,marginTop:24,padding:28,alignItems:'center',gap:10,
                backgroundColor:C.card,borderRadius:16,...cardShadow},
  myEmptyTitle:{fontSize:16,fontWeight:'700',color:C.text},
  myEmptySub:  {fontSize:13,color:C.secondary,textAlign:'center',lineHeight:18},
  browseBtn:   {marginTop:10,backgroundColor:C.accent,borderRadius:12,paddingHorizontal:18,paddingVertical:12},
  browseBtnTxt:{color:themeMode==='dark'?BRAND.deep:'#fff',fontSize:14,fontWeight:'800'},
  untrackSwipe:{backgroundColor:LIVE.cancelled,justifyContent:'center',alignItems:'center',minWidth:100,paddingHorizontal:14,borderRadius:16,marginBottom:10},
  untrackSwipeTxt:{color:'#fff',fontWeight:'800',fontSize:12},
  boardSwipeAction:{width:100,justifyContent:'center',alignItems:'center',paddingHorizontal:8,
    borderRadius:16,marginBottom:14,gap:4},
  boardSwipeActionTxt:{color:'#fff',fontWeight:'800',fontSize:12},
  miniTrack:   {height:2,borderRadius:1,backgroundColor:C.border,marginTop:8,marginBottom:6,overflow:'hidden'},
  miniFill:    {height:2,borderRadius:1},
  datePills:   {flexDirection:'row',gap:8,paddingHorizontal:16,marginTop:6,marginBottom:0},
  datePill:    {flex:1,alignItems:'center',justifyContent:'center',paddingVertical:6,paddingHorizontal:4,minHeight:36,borderRadius:12,borderWidth:1,borderColor:C.border,backgroundColor:C.list},
  datePillOn:  C.datePillOutline
                 ? {backgroundColor:'transparent',borderColor:C.accent}
                 : {backgroundColor:C.accent,borderColor:C.accent},
  datePillToday:{backgroundColor:C.accent,borderColor:C.accent,borderWidth:1.5},
  datePillTxt: {fontSize:12,fontWeight:'700',color:C.text,textAlign:'center'},
  datePillTxtOn:{color:C.datePillOutline?C.accent:C.tabOn,fontWeight:'800'},
  datePillSub: {fontSize:10,fontWeight:'600',color:C.muted,marginTop:2,textAlign:'center'},
  datePillSubOn:{color:C.datePillOutline?C.accent:C.tabOn,opacity:0.85},
  addPanel:    {marginHorizontal:16,marginTop:8,marginBottom:12,padding:16,
                backgroundColor:C.card,borderRadius:16,...cardShadow,gap:10},
  addTitle:    {fontSize:16,fontWeight:'800',color:C.text},
  addSub:      {fontSize:12,color:C.secondary,fontWeight:'500',marginTop:-4},
  scanBtn:     {marginTop:4,backgroundColor:C.accent,borderRadius:12,paddingVertical:13,
                flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  scanBtnTxt:  {color:themeMode==='dark'?BRAND.deep:'#fff',fontSize:14,fontWeight:'700'},
  addInputRow: {flexDirection:'row',alignItems:'center',gap:8,marginTop:2},
  addInput:    {flex:1,backgroundColor:C.field,borderRadius:12,borderWidth:1,borderColor:C.fieldBorder,
                color:C.text,fontSize:14,fontWeight:'600',paddingHorizontal:14,
                paddingVertical:Platform.OS==='ios'?12:10},
  addBtn:      {backgroundColor:C.accent,borderRadius:12,paddingHorizontal:18,paddingVertical:12,
                minWidth:64,alignItems:'center',justifyContent:'center'},
  addBtnTxt:   {color:themeMode==='dark'?BRAND.deep:'#fff',fontSize:14,fontWeight:'700'},
  addErr:      {fontSize:12,fontWeight:'600',color:themeMode==='light'?'#b91c1c':'#fca5a5'},
  myRowWrap:   {flexDirection:'row',paddingHorizontal:16,gap:10},
  myRail:      {width:16,alignItems:'center'},
  myDot:       {width:10,height:10,borderRadius:5,marginTop:22},
  myLine:      {flex:1,width:2,backgroundColor:C.border,marginTop:4,marginBottom:0},
  myCard:      {flex:1,backgroundColor:C.card,borderRadius:16,...cardShadow,
                padding:14,marginBottom:10,borderWidth:1,borderColor:C.cardOutline},
  myCardOn:    {borderWidth:1,borderColor:C.accent,backgroundColor:C.accentDim},
  myCardTop:   {flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},
  myCardTopMain:{flex:1,flexDirection:'row',alignItems:'center',gap:8,minWidth:0},
  myNum:       {fontSize:fs(15),fontWeight:'800',color:C.flightNumberColor,flexShrink:0,
                fontFamily:C.flightNumberFont},
  myStatusWrap:{alignSelf:'flex-start',flexShrink:0,marginBottom:6},
  myPill:      {borderRadius:12,borderWidth:1,paddingHorizontal:12,paddingVertical:6,flexShrink:0},
  myPillTxt:   {fontSize:11,fontWeight:'700',flexShrink:0},
  myTrash:     {marginLeft:'auto',width:32,height:32,borderRadius:8,alignItems:'center',justifyContent:'center',
                backgroundColor:C.list},
  myRoute:     {fontSize:14,fontWeight:'700',color:C.text},
  myAirline:   {fontSize:12,color:C.secondary,marginTop:2},
  myBagRow:    {flexDirection:'row',alignItems:'center',gap:6,marginTop:6},
  myBagTxt:    {fontSize:12,fontWeight:'700',color:C.text},
  myCd:        {fontSize:13,fontWeight:'700',marginTop:8},
  connCard:    {flex:1,flexDirection:'row',alignItems:'center',gap:10,borderRadius:16,
                borderLeftWidth:3,padding:12,marginBottom:10,...cardShadow,backgroundColor:C.card},
  connCardTight:{backgroundColor:'rgba(245,158,11,0.08)',borderLeftColor:'#F59E0B'},
  connCardCritical:{backgroundColor:'rgba(239,68,68,0.08)',borderLeftColor:'#EF4444'},
  connCardTitle:{fontSize:13,fontWeight:'800'},
  connCardSub: {fontSize:11,fontWeight:'500',color:C.secondary,marginTop:3},
  offlineBanner:{marginHorizontal:16,marginBottom:10,paddingVertical:10,paddingHorizontal:12,
                 backgroundColor:'rgba(136,150,176,0.08)',
                 borderRadius:12,borderLeftWidth:3,borderLeftColor:C.secondary,
                 flexDirection:'row',alignItems:'center',gap:8},
  offlineBannerTxt:{flex:1,fontSize:12,fontWeight:'600',color:C.secondary},
  searchRow:   {flexDirection:'row',alignItems:'center',marginHorizontal:16,marginTop:6,marginBottom:6,gap:8},
  searchWrap:  {flex:1,flexDirection:'row',alignItems:'center',minWidth:0,
                backgroundColor:C.field,borderRadius:12,
                borderWidth:1,borderColor:C.fieldBorder,
                paddingHorizontal:12,paddingVertical:Platform.OS==='ios'?2:0,gap:8,height:40},
  searchInput: {flex:1,color:C.text,fontSize:16,paddingVertical:Platform.OS==='ios'?10:8,
                fontWeight:'400'},
  searchClear: {width:28,height:28,borderRadius:14,backgroundColor:C.list,
                alignItems:'center',justifyContent:'center'},
  recentBlock: {marginBottom:6},
  recentLabel: {paddingHorizontal:16,marginBottom:6,fontSize:11,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase'},
  recentPills: {flexDirection:'row',flexWrap:'nowrap',alignItems:'center',gap:8,paddingHorizontal:16},
  recentPill:  {flexDirection:'row',alignItems:'center',flexGrow:0,flexShrink:1,maxWidth:148,
                borderRadius:999,paddingLeft:10,paddingRight:4,paddingVertical:4,
                backgroundColor:'rgba(10,14,26,0.42)'},
  recentPillHit:{flexShrink:1,minWidth:0,paddingVertical:1},
  recentPillTxt:{fontSize:11,fontWeight:'700',color:'#F4F7FB'},
  recentPillClear:{width:18,height:18,borderRadius:9,alignItems:'center',justifyContent:'center'},
  searchHint:  {marginHorizontal:20,marginBottom:10,fontSize:12,color:C.accent,fontWeight:'600'},
  connLink:    {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:20,paddingTop:4,paddingBottom:12,alignSelf:'flex-start'},
  loadMoreFoot:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:16 },
  loadMoreTxt: { fontSize:13, fontWeight:'600' },
  connLinkTxt: {fontSize:12,fontWeight:'600',color:C.muted},
  errBanner:   {marginHorizontal:16,marginBottom:10,padding:12,
                backgroundColor:'rgba(239,68,68,0.08)',
                borderRadius:12,borderLeftWidth:3,borderLeftColor:'#EF4444',
                flexDirection:'row',alignItems:'center',gap:8},
  errTxt:      {color:themeMode==='light'?'#b91c1c':'#fca5a5',fontSize:12,flex:1,fontWeight:'500'},
  center:      {justifyContent:'center',alignItems:'center',paddingVertical:60,gap:12},
  loadTxt:     {color:C.secondary,fontSize:14},
  emptyTxt:    {color:C.secondary,fontSize:14},
  listHead:    {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',
                paddingHorizontal:20,paddingTop:12,paddingBottom:10,marginTop:4},
  listTitleRow:{flexDirection:'row',alignItems:'center',gap:8},
  listTitle:   {fontSize:16,fontWeight:'700',color:C.text,flexShrink:1,minWidth:0},
  listCount:   {minWidth:40,paddingHorizontal:8,paddingVertical:2,borderRadius:12,
                fontSize:12,fontWeight:'700',
                color:themeMode==='dark'?'#ffffff':'#0f1117',
                backgroundColor:themeMode==='dark'?'#1a1d27':'#e2e8f0',
                overflow:'hidden',textAlign:'center',flexShrink:0},
  listAirport: {fontSize:13,fontWeight:'600',color:C.accent,marginTop:4,minWidth:0,flexShrink:1},
  listMeta:    {flexDirection:'row',alignItems:'center',gap:8,paddingTop:2},
  statusFilters:{flexGrow:0,marginBottom:0,marginTop:2},
  statusFiltersInner:{paddingHorizontal:16,paddingBottom:0,gap:8,alignItems:'center'},
  statusPill:  {flexDirection:'row',alignItems:'center',flexShrink:0,gap:6,paddingVertical:6,paddingHorizontal:12,
                borderRadius:20,borderWidth:1,
                borderColor:C.isDark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.12)',
                backgroundColor:'transparent'},
  statusPillOn:{backgroundColor:C.accent,borderWidth:1,borderColor:C.accent,opacity:1},
  statusPillEmpty:{opacity:0.5},
  statusPillActive:{borderColor:'#FFFFFF',opacity:0.85},
  statusPillTxt:{fontSize:12,fontWeight:'600',color:C.isDark?'rgba(255,255,255,0.6)':C.secondary,flexShrink:0},
  statusPillTxtOn:{color:'#0A0E1A',fontWeight:'800'},
  statusPillTxtActive:{color:'#FFFFFF',fontWeight:'600'},
  statusPillTxtEmpty:{color:C.muted},
  statusPillBadge:{minWidth:20,paddingHorizontal:6,paddingVertical:2,borderRadius:10,
                backgroundColor:themeMode==='dark'?'#1a1d27':'#e2e8f0'},
  statusPillBadgeOn:{backgroundColor:'rgba(10,14,26,0.12)'},
  statusPillBadgeTxt:{fontSize:10,fontWeight:'800',
                color:themeMode==='dark'?'#ffffff':'#0f1117',textAlign:'center'},
  statusPillBadgeTxtOn:{color:'#ffffff'},
  livePill:    {backgroundColor:themeMode==='light'?'rgba(201,168,76,0.15)':'rgba(201,168,76,0.2)',
                borderRadius:10,paddingHorizontal:8,paddingVertical:3},
  liveTxt:     {fontSize:10,fontWeight:'700',color:BRAND.gold,letterSpacing:0.6},
  demoTxt:     {fontSize:10,color:C.muted,fontWeight:'600'},
  updTxt:      {fontSize:10,color:C.muted},
  secHead:     {flexDirection:'row',justifyContent:'space-between',alignItems:'center',
                paddingHorizontal:20,paddingTop:18,paddingBottom:8},
  secLabelRow: {flexDirection:'row',alignItems:'center',gap:8},
  secDot:      {width:8,height:8,borderRadius:4},
  secLabel:    {fontSize:12,fontWeight:'700',color:C.secondary,letterSpacing:0.4},
  secCount:    {fontSize:11,fontWeight:'700',
                color:themeMode==='dark'?'#ffffff':'#0f1117',
                backgroundColor:themeMode==='dark'?'#1a1d27':'#e2e8f0',
                paddingHorizontal:8,paddingVertical:2,borderRadius:10},
  colHead:     {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:6,
                borderTopWidth:1,borderBottomWidth:1,borderColor:C.border},
  colTxt:      {fontSize:10,color:C.muted,fontWeight:'700',letterSpacing:1.2,textTransform:'uppercase'},
  list:        {marginHorizontal:16,borderRadius:16,backgroundColor:C.card,
                ...cardShadow,marginBottom:8,overflow:'hidden'},
  flightCards: {paddingHorizontal:16,gap:12,marginBottom:8},
  sep:         {height:1,backgroundColor:C.border,marginLeft:48},
  foot:        {textAlign:'center',color:C.muted,fontSize:11,marginTop:24},
  toast:       {position:'absolute',left:20,right:20,bottom:Platform.OS==='ios'?36:24,
                backgroundColor:C.card,borderRadius:16,paddingVertical:14,paddingHorizontal:16,
                ...cardShadow,alignItems:'center'},
  toastTxt:    {color:C.text,fontSize:14,fontWeight:'700',textAlign:'center'},
});}
let s=makeS(C);

function makeMap(C:ThemeColors){return StyleSheet.create({
  wrap:      {marginHorizontal:16,marginBottom:10,backgroundColor:C.card,
              borderRadius:16,...cardShadow,
              paddingHorizontal:16,paddingTop:14,paddingBottom:12,
              flexDirection:'column'},
  textRow:   {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  col:       {flex:1,flexDirection:'column'},
  colRight:  {alignItems:'flex-end'},
  iataRow:   {flexDirection:'row',alignItems:'center',gap:6},
  flag:      {fontSize:16},
  iata:      {fontSize:18,fontWeight:'800',color:C.text,lineHeight:22},
  city:      {fontSize:11,color:C.secondary,marginTop:3,lineHeight:14},
  lineRow:   {flexDirection:'row',alignItems:'center',marginTop:10,width:'100%'},
  dot:       {width:10,height:10,borderRadius:5,flexShrink:0},
  track:     {flex:1,height:16,marginHorizontal:6,justifyContent:'center',position:'relative'},
  trackBg:   {height:2,backgroundColor:C.border,borderRadius:1,width:'100%'},
  trackFg:   {position:'absolute',left:0,height:2,borderRadius:1},
  plane:     {position:'absolute',top:-8,marginLeft:-8},
  statusTxt: {fontSize:11,fontWeight:'600',textAlign:'center',marginTop:8},
});}
let map=makeMap(C);

function makeDc(C:ThemeColors){return StyleSheet.create({
  card:        {marginTop:8,marginHorizontal:16,marginBottom:14,backgroundColor:C.card,
                borderRadius:24, borderWidth:1, borderColor:C.cardOutline,
                paddingHorizontal:20,paddingTop:12,paddingBottom:22,
                shadowColor:'#000',shadowOpacity:0.08,shadowRadius:24,
                shadowOffset:{width:0,height:4},elevation:8},
  handle:      {alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:C.handle||C.muted,
                opacity:0.35,marginBottom:16},
  headRow:     {flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},
  headMain:    {flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:8},
  headGate:    {alignItems:'flex-end',flexShrink:0},
  headTrack:   {flexDirection:'row',alignItems:'center',gap:4,paddingVertical:6,paddingHorizontal:10,
                borderRadius:999,borderWidth:1,borderColor:C.border,backgroundColor:'transparent',flexShrink:0},
  headTrackTxt:{fontSize:12,fontWeight:'800',color:C.text},
  headBook:    {flexDirection:'row',alignItems:'center',flexWrap:'nowrap',gap:4,paddingVertical:6,paddingHorizontal:12,
                borderRadius:999,backgroundColor:BRAND.navy,borderWidth:1,borderColor:BRAND.gold,flexShrink:0},
  headBookTxt: {fontSize:11,fontWeight:'800',color:'#FFFFFF',flexShrink:0},
  headTrackedBell:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',flexShrink:0},
  logo:        {width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},
  logoTxt:     {color:'#fff',fontSize:10,fontWeight:'800',letterSpacing:0.4},
  flNum:       {fontSize:fs(22),fontWeight:'800',color:C.flightNumberColor,minWidth:0,flexShrink:1,
                fontFamily:C.flightNumberFont},
  dateTxt:     {fontSize:13,fontWeight:'500',color:C.secondary},
  routeTitle:  {fontSize:22,fontWeight:'800',color:C.text,letterSpacing:-0.4,marginBottom:12,minWidth:0},
  statusLine:  {fontSize:15,fontWeight:'700',marginBottom:4},
  statusBar:   {fontSize:14,fontWeight:'700',marginBottom:6,flexShrink:0},
  nonEuCompHint:{fontSize:13,fontWeight:'600',color:C.secondary,marginBottom:12,lineHeight:18},
  progressWrap:{marginTop:12,marginBottom:10},
  progressEnds:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  progressIata:{fontSize:11,fontWeight:'800',letterSpacing:1.2},
  progressTrack:{height:4,marginTop:8,marginBottom:6,position:'relative',overflow:'visible',justifyContent:'center'},
  progressPlane:{
    position:'absolute',
    top:-8,
    width:20,
    height:20,
    alignItems:'center',
    justifyContent:'center',
    shadowColor:'#F5A623',
    shadowOffset:{ width:0, height:1 },
    shadowOpacity:0.55,
    shadowRadius:5,
    elevation:4,
  },
  progressStatus:{fontSize:11,fontWeight:'700',letterSpacing:0.2},
  progressRemain:{fontSize:12,fontWeight:'600',marginTop:6,textAlign:'center'},
  livePos:     {fontSize:13,fontWeight:'700',color:C.gold,marginBottom:8},
  wasGate:     {fontSize:11,fontWeight:'600',color:C.muted,marginTop:4,textAlign:'center'},
  inbound:     {fontSize:13,fontWeight:'500',color:C.secondary,marginBottom:16},
  passCard:    {backgroundColor:C.list,borderRadius:12,padding:12,marginBottom:12,gap:4},
  passLine:    {fontSize:13,fontWeight:'700',color:C.text},
  leg:         {paddingVertical:16},
  legTop:      {flexDirection:'row',alignItems:'flex-start'},
  legIata:     {fontSize:13,fontWeight:'600',color:C.secondary,marginBottom:8,minWidth:0},
  heroTime:    {fontSize:40,fontWeight:'800',letterSpacing:-0.8,lineHeight:44,maxHeight:48},
  timeSuffix:  {fontSize:12,fontWeight:'600',color:C.muted,marginTop:2},
  heroRow:     {flexDirection:'row',alignItems:'flex-end',gap:10},
  strike:      {fontSize:40,fontWeight:'800',color:STRIKE_TIME_COLOR,letterSpacing:-0.8,
                lineHeight:44,marginTop:2,opacity:1},
  strikeBig:   {fontSize:40,fontWeight:'800',color:STRIKE_TIME_COLOR,letterSpacing:-0.8,
                lineHeight:44,marginBottom:8,opacity:1},
  legSub:      {fontSize:13,fontWeight:'600',marginTop:6},
  divider:     {height:StyleSheet.hairlineWidth,backgroundColor:C.border},
  bottomRow:   {flexDirection:'row',alignItems:'center',gap:8,marginTop:8,paddingTop:16,
                borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border},
  iconBtn:     {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:10,
                borderRadius:12,backgroundColor:themeMode==='dark'?'rgba(255,255,255,0.06)':C.list},
  detailsBtnTxt:{fontSize:13,fontWeight:'700',color:C.text},
  regChip:     {fontSize:11,fontWeight:'700',color:C.secondary,maxWidth:72},
  untrackBtn:  {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:12,
                borderRadius:12,borderWidth:1,borderColor:C.border,backgroundColor:'transparent',marginLeft:'auto'},
  untrackBtnTxt:{fontSize:13,fontWeight:'700',color:C.secondary},
  bookBtn:     {marginTop:10,backgroundColor:BRAND.navy,borderRadius:14,paddingVertical:13,paddingHorizontal:16,
                borderWidth:1,borderColor:BRAND.gold,flexDirection:'row',flexWrap:'nowrap',alignItems:'center',
                justifyContent:'center',gap:8,alignSelf:'stretch'},
  bookBtnTxt:  {color:'#FFFFFF',fontSize:15,fontWeight:'800',letterSpacing:0.2,flexShrink:0},
  shareBtn:    {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:14,
                borderRadius:20,backgroundColor:LIVE.share,marginLeft:'auto'},
  shareTxt:    {color:'#fff',fontSize:13,fontWeight:'700'},
  shareApps:   {flexDirection:'row',alignItems:'center',gap:8,marginTop:10},
  shareStoryBtn:{marginTop:12,backgroundColor:'#F5A623',borderRadius:14,paddingVertical:13,
                alignItems:'center',justifyContent:'center'},
  shareStoryTxt:{color:'#0A0E1A',fontSize:15,fontWeight:'800',letterSpacing:0.2},
  passportBanner:{marginTop:12,backgroundColor:'#F5A623',borderRadius:14,paddingVertical:12,
                  paddingHorizontal:14,alignItems:'center',justifyContent:'center'},
  passportBannerTxt:{color:'#0A0E1A',fontSize:14,fontWeight:'800',letterSpacing:0.1},
  pickupLiveBtn:{marginTop:10,backgroundColor:'rgba(245,166,35,0.12)',borderRadius:14,paddingVertical:13,
                alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#F5A623'},
  pickupLiveTxt:{color:'#F5A623',fontSize:15,fontWeight:'800',letterSpacing:0.2},
  moreWrap:    {marginTop:8},
  fold:        {marginTop:4,paddingTop:10,borderTopWidth:1,borderColor:C.border},
  foldHead:    {flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:36},
  foldTitle:   {fontSize:12,fontWeight:'700',color:C.secondary,letterSpacing:0.3,flex:1},
  foldBody:    {paddingTop:8,paddingBottom:4},
  weatherRow:  {flexDirection:'row',alignItems:'center',gap:8},
  weatherTxt:  {fontSize:13,fontWeight:'600',color:C.text,flex:1},
  transportOpts:{gap:8},
  transportOptRow:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:C.list,
                   borderRadius:16,...cardShadow,paddingVertical:12,paddingHorizontal:14,
                   borderLeftWidth:3,borderLeftColor:C.border},
  transportIconWrap:{width:28,height:28,borderRadius:8,
                     alignItems:'center',justifyContent:'center'},
  transportOptTxt:{flex:1,fontSize:14,fontWeight:'600',color:C.text},
  transportOptPrice:{fontSize:16,fontWeight:'700',color:C.text,textAlign:'right'},
  boardCd:     {flexDirection:'row',alignItems:'center',gap:10,borderRadius:12,
                borderLeftWidth:3,paddingHorizontal:14,paddingVertical:12,marginBottom:16,
                backgroundColor:'rgba(59,130,246,0.08)'},
  boardCdDot:  {width:10,height:10,borderRadius:5},
  boardCdLabel:{fontSize:17,fontWeight:'800',letterSpacing:0.2},
  boardCdSub:  {fontSize:11,color:C.muted,marginTop:3,fontWeight:'500'},
  gateClose:   {flexDirection:'row',alignItems:'center',gap:10,borderRadius:12,
                borderLeftWidth:3,borderLeftColor:'#F59E0B',
                backgroundColor:'rgba(245,158,11,0.08)',
                paddingHorizontal:14,paddingVertical:11,marginBottom:16},
  gateCloseTxt:{fontSize:15,fontWeight:'800',letterSpacing:0.1,flex:1},
  boardNow:    {flexDirection:'row',alignItems:'center',flexWrap:'wrap',borderWidth:1.5,borderRadius:12,paddingHorizontal:12,paddingVertical:6,marginBottom:14,alignSelf:'flex-start'},
  boardNowCompact:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',borderWidth:1,borderRadius:8,paddingHorizontal:12,paddingVertical:6,marginTop:6,alignSelf:'flex-start'},
  boardNowTxt: {fontSize:16,fontWeight:'800',letterSpacing:0.1,flexShrink:0},
  boardNowTxtSm:{fontSize:11,fontWeight:'800',letterSpacing:0.1,flexShrink:0},
});}
let dc=makeDc(C);
function makeFr(C:ThemeColors){return StyleSheet.create({
  row:    {flexDirection:'row',alignItems:'flex-start',paddingHorizontal:14,paddingVertical:16,gap:8,
           backgroundColor:C.gateSkin==='spotter'?C.card:C.list,borderRadius:16,
           borderWidth:0.5,
           borderColor:C.isDark?'rgba(170,190,220,0.18)':'rgba(0,0,0,0.06)',
           overflow:'hidden',
           shadowColor:'#000',shadowOpacity:0.25,shadowRadius:8,shadowOffset:{width:0,height:2},
           elevation:C.isDark?3:2},
  rowPress:{flex:1,flexDirection:'column',alignItems:'stretch',minWidth:0},
  rowMain: {flexDirection:'row',alignItems:'flex-start',gap:8,minWidth:0,width:'100%'},
  active: {borderWidth:0.5,borderColor:LIVE.onTime+'55'},
  rowBoard:{zIndex:2,shadowOpacity:0.32,elevation:8},
  cancel: {opacity:0.7},
  liveDot: {width:8,height:8,borderRadius:4,backgroundColor:LIVE.boarding,flexShrink:0},
  stampWrap:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center'},
  stamp:  {fontSize:fs(22),fontWeight:'800',letterSpacing:2,color:LIVE.cancelled,opacity:0.55,
           transform:[{rotate:'-12deg'}]},
  cancelledText:{opacity:1,color:'#FFFFFF'},
  delayChip:{alignSelf:'flex-start',backgroundColor:'rgba(255,179,0,0.16)',
             borderRadius:8,paddingHorizontal:7,paddingVertical:3,marginBottom:6},
  delayChipTxt:{fontSize:fs(10),fontWeight:'700',color:LIVE.delayed},
  logoWrap:{width:AIRLINE_LOGO_SIZE,height:AIRLINE_LOGO_SIZE,flexShrink:0,alignSelf:'flex-start',
            position:'relative',overflow:'visible',marginRight:8},
  logoTap:{width:AIRLINE_LOGO_SIZE,height:AIRLINE_LOGO_SIZE,flexShrink:0,zIndex:1},
  reliabilityBadge:{position:'absolute',right:-6,bottom:-6,width:14,height:14,borderRadius:7,
                  alignItems:'center',justifyContent:'center',borderWidth:1.5,
                  borderColor:'rgba(255,255,255,0.4)',zIndex:3},
  reliabilityBadgeTxt:{color:'#fff',fontSize:9,fontWeight:'700',lineHeight:11},
  logo:   {width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',flexShrink:0},
  logoTxt:{color:'#fff',fontSize:12,fontWeight:'800',letterSpacing:0.3},
  mid:    {flex:1,minWidth:0,marginRight:4,overflow:'hidden'},
  numRow: {flexDirection:'row',alignItems:'center',gap:6,flexShrink:1,overflow:'hidden'},
  num:    {fontSize:fs(14),fontWeight:'800',color:C.isDark?'#FFFFFF':C.flightNumberColor,letterSpacing:-0.2,
           fontFamily:C.flightNumberFont,flexShrink:1},
  route:  {fontSize:fs(12),color:C.isDark?'rgba(232,240,252,0.92)':C.secondary,marginTop:4,fontWeight:'500',
           flexShrink:1},
  dur:    {fontSize:fs(10),color:C.isDark?'rgba(200,214,232,0.82)':C.muted,marginTop:3,fontWeight:'400',flexShrink:0},
  aircraft:{fontSize:10,color:C.isDark?'rgba(200,214,232,0.82)':C.muted,marginTop:4,fontWeight:'400',flexShrink:0},
  gateClose:{fontSize:fs(11),color:LIVE.delayed,marginTop:3,fontWeight:'700'},
  subRow: {flexDirection:'row',alignItems:'center',flexWrap:'wrap',marginTop:8,gap:6},
  statusRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8,marginTop:8,alignSelf:'flex-start',flexShrink:0},
  sub:    {fontSize:fs(12),color:C.muted,marginTop:3,fontWeight:'500',flexShrink:0},
  right:  {alignItems:'flex-end',flexShrink:0,flexGrow:0,zIndex:2,maxWidth:130},
  bookBtn:{width:28,height:28,alignItems:'center',justifyContent:'center',flexShrink:0,alignSelf:'center'},
  gateSlot:{marginBottom:8,alignItems:'flex-end',gap:4},
  gateCountdown:{fontSize:fs(11),fontWeight:'600',letterSpacing:0.2,marginTop:2},
  gateCountdownUrgent:{fontWeight:'800'},
  timeBlock:{alignItems:'flex-end'},
  timeRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6,justifyContent:'flex-end'},
  time:   {fontSize:fs(15),fontWeight:'400',letterSpacing:0.5,fontVariant:['tabular-nums'],
           color:C.isDark?'rgba(255,255,255,0.9)':C.secondary},
  timeMeta:{fontSize:10,fontWeight:'400',color:C.isDark?'rgba(200,214,232,0.8)':C.muted,marginTop:2},
  clockMeta:{fontSize:fs(10),fontWeight:'700',color:C.muted,marginTop:1,letterSpacing:0.4},
  localLbl:{fontSize:fs(10),fontWeight:'600',color:C.muted,marginTop:1},
  oldWrap:{alignSelf:'flex-end',marginBottom:3,flexShrink:1,maxWidth:130},
  old:    {fontSize:fs(15),color:C.muted,fontWeight:'400',letterSpacing:0.5,
           fontVariant:['tabular-nums'],opacity:0.9,flexShrink:1},
  delayPill:{backgroundColor:'rgba(255,59,48,0.18)',borderRadius:10,paddingHorizontal:7,paddingVertical:3,
             borderWidth:0.5,borderColor:'rgba(255,59,48,0.45)',flexShrink:0,alignSelf:'flex-end',marginTop:4},
  delayPillTxt:{fontSize:fs(10),fontWeight:'700',color:'#FF453A',letterSpacing:0.2,flexShrink:0},
  badge:  {paddingHorizontal:10,paddingVertical:5,borderRadius:20,borderWidth:0.5,flexShrink:0},
  badgeTxt:{fontSize:fs(10),fontWeight:'600',flexShrink:0},
});}
let fr=makeFr(C);

function makeCx(C:ThemeColors){return StyleSheet.create({
  backdrop:   {flex:1,backgroundColor:'#0A1628',justifyContent:'flex-end'},
  sheetWrap:  {maxHeight:'92%',backgroundColor:'#0A1628'},
  sheet:      {backgroundColor:'#0A1628',borderTopLeftRadius:22,borderTopRightRadius:22,
               paddingHorizontal:20,paddingTop:10,paddingBottom:Platform.OS==='ios'?28:16,
               ...cardShadow},
  handle:     {alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:'rgba(201,168,76,0.45)',marginBottom:14},
  head:       {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18},
  title:      {fontSize:18,fontWeight:'800',color:'#F5F0E8'},
  sub:        {fontSize:12,color:'#8896B0',marginTop:4},
  close:      {width:32,height:32,borderRadius:16,backgroundColor:'#12233C',alignItems:'center',justifyContent:'center'},
  closeTxt:   {color:'#C9A84C',fontWeight:'700'},
  label:      {fontSize:10,fontWeight:'700',color:'#8896B0',letterSpacing:1.2,marginBottom:6,marginTop:4},
  input:      {backgroundColor:'#12233C',borderWidth:1,borderColor:'rgba(201,168,76,0.35)',borderRadius:12,
               color:'#F5F0E8',fontSize:16,fontWeight:'700',paddingHorizontal:14,
               paddingVertical:Platform.OS==='ios'?13:10,marginBottom:12,letterSpacing:1},
  inlineHint: {fontSize:11,color:'#f59e0b',marginTop:-8,marginBottom:10,fontWeight:'600'},
  hint:       {fontSize:11,color:'#8896B0',marginTop:-6,marginBottom:10},
  cta:        {backgroundColor:'#C9A84C',borderRadius:12,paddingVertical:14,alignItems:'center',marginBottom:12},
  ctaTxt:     {color:'#0A1628',fontSize:15,fontWeight:'800'},
  errRow:     {flexDirection:'row',alignItems:'center',gap:8,marginBottom:10},
  err:        {color:'#fca5a5',fontSize:12,flex:1},
  result:     {borderRadius:12,borderWidth:1,padding:16,marginTop:4},
  resultMsgRow:{flexDirection:'row',alignItems:'flex-start',gap:10,marginBottom:14},
  verdictDot: {width:10,height:10,borderRadius:5,marginTop:6},
  resultMsg:  {fontSize:15,fontWeight:'700',lineHeight:22,flex:1},
  metaRow:    {flexDirection:'row',gap:10,marginBottom:14},
  metaBox:    {flex:1,backgroundColor:'#12233C',borderRadius:10,padding:10},
  metaLbl:    {fontSize:9,color:'#8896B0',fontWeight:'700',letterSpacing:0.8,marginBottom:4},
  metaVal:    {fontSize:15,fontWeight:'800',color:'#F5F0E8'},
  metaSub:    {fontSize:10,color:'#8896B0',marginTop:2},
  leg:        {backgroundColor:'#12233C',borderRadius:12,padding:12,marginBottom:8},
  legTitle:   {fontSize:13,fontWeight:'700',color:'#F5F0E8',marginBottom:4},
  legLine:    {fontSize:12,color:'#8896B0'},
  legTime:    {fontSize:13,fontWeight:'700',color:'#C9A84C',marginTop:4},
  refresh:    {marginTop:8,alignItems:'center',paddingVertical:10},
  refreshTxt: {color:'#C9A84C',fontSize:13,fontWeight:'600'},
});}
let cx=makeCx(C);

function makeRd(C:ThemeColors){return StyleSheet.create({
  backdrop:   {flex:1,backgroundColor:'rgba(0,0,0,0.45)',justifyContent:'flex-end'},
  sheet:      {backgroundColor:C.bg,borderTopLeftRadius:22,borderTopRightRadius:22,
               borderWidth:1,borderColor:C.border,overflow:'hidden',
               paddingBottom:Platform.OS==='ios'?8:4},
  grabZone:   {paddingTop:10,paddingBottom:4},
  handle:     {alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:C.handle||C.muted,marginBottom:12},
  head:       {flexDirection:'row',alignItems:'flex-start',paddingHorizontal:16,paddingBottom:8},
  title:      {fontSize:13,fontWeight:'800',color:C.text,flexShrink:1},
  sub:        {fontSize:11,color:C.secondary,marginTop:2},
  liveDot:    {width:8,height:8,borderRadius:4,backgroundColor:'#22c55e'},
  close:      {width:32,height:32,borderRadius:16,backgroundColor:C.list,alignItems:'center',justifyContent:'center'},
  closeTxt:   {color:C.secondary,fontWeight:'700',fontSize:14},
  jumps:      {maxHeight:44,marginBottom:8,flexGrow:0,flexShrink:0},
  jumpsInner: {paddingHorizontal:16,gap:8,alignItems:'center'},
  jumpBtn:    {backgroundColor:C.field,borderWidth:1,borderColor:C.fieldBorder,borderRadius:10,
               paddingHorizontal:12,paddingVertical:8},
  jumpTxt:    {color:C.text,fontWeight:'700',fontSize:12},
  map:        {flex:1, minHeight:0, width:'100%', backgroundColor:C.bg,borderTopWidth:1,borderColor:C.border},
  boot:       {position:'absolute',left:12,bottom:12,backgroundColor:'rgba(10,15,30,0.82)',
               borderRadius:999,paddingHorizontal:10,paddingVertical:7,borderWidth:1,
               borderColor:'rgba(201,168,76,0.3)'},
  bootCenter: { ...StyleSheet.absoluteFill, alignItems:'center', justifyContent:'center' },
});}
let rd=makeRd(C);

function applyTheme(id:ThemeId){
  activeThemeId=id;
  C=THEMES[id];
  themeMode=C.isDark?'dark':'light';
  s=makeS(C);
  map=makeMap(C);
  dc=makeDc(C);
  fr=makeFr(C);
  cx=makeCx(C);
  rd=makeRd(C);
  tb=makeTb(C);
}
