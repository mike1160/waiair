import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, TextInput, Modal, Share, Linking, Animated,
  ScrollView, ActivityIndicator, RefreshControl, Platform, KeyboardAvoidingView, Pressable,
  Dimensions, PanResponder, AppState, Alert, LayoutAnimation, UIManager, Keyboard, type AppStateStatus,
} from 'react-native';
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
  Door,
  DoorOpen,
  DotsThree,
  Gear,
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
  WhatsappLogo,
  WifiSlash,
  X,
  XCircle,
  type Icon,
} from 'phosphor-react-native';
import { useState, useEffect, useRef, useCallback, useMemo, Fragment, createContext, useContext, type ReactNode } from 'react';
import RadarFlightSheet, { type RadarPick } from './RadarFlightSheet';
import { buildRadarHTML } from './radarHtml';
import { countNear, fetchRadarSnapshot, type RadarAircraft } from './lib/radar';
import {
  boardingCountdownLabel,
  boardingTargetIso,
  formatDurationMs,
  getBoardingPhase,
  isLastCall,
  minutesUntilDeparture,
  minutesUntilGateClose,
  shouldShowGateClose,
} from './boardingCountdown';
import {
  endLiveActivity,
  reconcileLiveActivities,
  startOrUpdateLiveActivity,
  syncAllLiveActivities,
  toFlightActivityProps,
} from './liveActivitySync';
import { syncHomeScreenWidget } from './widgetSync';
import { initPurchases, checkProStatus, subscribeProStatus } from './lib/purchases';
import { saveLandedToHistory } from './lib/proStorage';
import ProPaywallScreen from './ProPaywallScreen';
import UpgradeLimitPrompt from './UpgradeLimitPrompt';
import SettingsScreen from './SettingsScreen';
import FlightHistorySection from './FlightHistorySection';
import FlightStageTimeline from './FlightStageTimeline';
import AirportInfoCard from './AirportInfoCard';
import LoungePanel from './LoungePanel';
import BoardingPassScanner from './BoardingPassScanner';
import { type BoardingPassInfo } from './lib/bcbp';
import GateBadge, { compactTerminal, hasRealGate } from './GateBadge';
import RouteHero from './RouteHero';
import FlightAutocomplete from './FlightAutocomplete';
import ShareFlightCardBtn from './ShareFlightCard';
import { haptics } from './lib/haptics';
import WakeUpControl from './WakeUpControl';
import LuxuryInfoPanel from './LuxuryInfoPanel';
import AfterLandingCard, { type LandedWelcome } from './AfterLandingCard';
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
import { setProOverride } from './services/SubscriptionManager';
import type { FAFlightDetail } from './services/FlightAwareService';
import {
  isLiveStale,
  shouldShowOnBoard,
  LIVE_ACTIVITY_TICK_MS,
} from './lib/boardFilter';
import {
  getPrefs,
  loadPrefs,
  savePrefs,
  subscribePrefs,
  clearFidsCaches,
  LAST_BOARD_DAY_KEY,
  type AppPrefs,
} from './lib/prefs';
import { t } from './lib/i18n';
import { loadRecentSearches, pushRecentSearch, removeRecentSearch, loadRecentAirports, pushRecentAirport } from './lib/recents';
import { groupAirportsByRegion } from './lib/airportRegions';
import { HighlightText } from './lib/highlight';
import {
  SEARCH_PLACEHOLDERS,
  cleanQuery,
  emptySearchCopy,
  prettySearchLabel,
  searchFlights,
  searchSuggestions,
  type SearchableFlight,
} from './lib/smartSearch';
import { shouldShowUpgradePrompt, dismissUpgradePrompt } from './lib/upgradePrompt';
import { registerTrackedBackgroundTask } from './lib/backgroundRefresh';
import { maybeRequestReview, recordAppOpen } from './lib/storeReview';
import OnboardingScreen from './OnboardingScreen';
import SkeletonCards from './SkeletonCards';
import RefreshOverlay from './RefreshOverlay';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
/** TestFlight beta: unlimited tracking, no paywall anywhere. */
const BETA_MODE = true;
const TRACK_STORAGE_KEY = 'waiair.tracked.v1';
const THEME_STORAGE_KEY = 'waiair.theme.v1';
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
  cancelled: '#D32F2F',
  boarding: '#00C853',
  gateDep: '#FF8A00',
  gateArr: '#3b82f6',
  share: '#2563EB',
} as const;
const boardingHapticKeys = new Set<string>();

const AIRLINE_HUES = ['#003366','#C8102E','#0B3D91','#E31837','#0033A0','#006644','#5C0F2E','#1B4E8C','#007A33','#0A1628'];

function airlineColor(code:string):string{
  const s=String(code||'XX').replace(/[^A-Za-z]/g,'').toUpperCase()||'XX';
  let h=0;
  for(let i=0;i<s.length;i++) h=(h*33+s.charCodeAt(i))>>>0;
  return AIRLINE_HUES[h%AIRLINE_HUES.length];
}

function airlineInitials(code:string, name:string):string{
  const c=String(code||'').replace(/[^A-Za-z]/g,'').toUpperCase();
  if(c.length>=2) return c.slice(0,2);
  const parts=String(name||'').split(/\s+/).filter(Boolean);
  if(parts.length>=2) return (parts[0][0]+parts[1][0]).toUpperCase();
  return (c||'FL').slice(0,2);
}

type ThemeMode = 'dark'|'light';
type ThemeColors = {
  bg:string; card:string; list:string; border:string; text:string;
  secondary:string; muted:string; accent:string; accentDim:string;
  tabOn:string; field:string; fieldBorder:string; gold:string; icon:string;
};

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

const THEMES:Record<ThemeMode, ThemeColors> = {
  dark: {
    bg:'#0a0f1e', card:'#111827', list:'#1A2235', border:'rgba(255,255,255,0.08)',
    text:'#F0F4FF', secondary:'#8896B0', muted:'#8896B0',
    accent:'#C9A84C', accentDim:'#1A2235', tabOn:'#FFFFFF',
    field:'#111827', fieldBorder:'#1E2D45', gold:'#C9A84C', icon:'#C9A84C',
  },
  light: {
    bg:'#f0f4ff', card:'#FFFFFF', list:'#FFFFFF', border:'#E5EAF5',
    text:'#1C1917', secondary:'#6B7280', muted:'#8896B0',
    accent:'#1A2F5A', accentDim:'#EEF1F6', tabOn:'#FFFFFF',
    field:'#FFFFFF', fieldBorder:'#E5E7EB', gold:'#C9A84C', icon:'#1A2F5A',
  },
};

/** Active palette — reassigned on theme change; styles rebuilt via applyTheme() */
let C:ThemeColors = THEMES.light;
let themeMode:ThemeMode = 'light';

type ThemeCtxValue = { mode:ThemeMode; C:ThemeColors; toggle:()=>void };
const ThemeCtx = createContext<ThemeCtxValue>({
  mode:'light', C:THEMES.light, toggle:()=>{},
});
function useTheme(){ return useContext(ThemeCtx); }

type AppTab = 'arrival'|'departure'|'myflights';
type FidsTab = 'arrival'|'departure';
type StatusFilter = 'all'|'boarding'|'delayed'|'scheduled'|'landed'|'cancelled';

const STATUS_FILTER_TABS:{
  key:StatusFilter;
  label:string;
  Icon:Icon;
}[] = [
  { key:'all',       label:'All',       Icon:Stack },
  { key:'boarding',  label:'Boarding',  Icon:DoorOpen },
  { key:'delayed',   label:'Delayed',   Icon:Clock },
  { key:'scheduled', label:'On Time',   Icon:CheckCircle },
  { key:'landed',    label:'Landed',    Icon:AirplaneLanding },
  { key:'cancelled', label:'Cancelled', Icon:XCircle },
];

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

async function searchAirports(q:string):Promise<Airport[]>{
  const res=await fetch(`${PROXY}/airports/search?q=${encodeURIComponent(q.trim())}`);
  if(!res.ok) throw new Error('Airport search failed');
  const data=await res.json();
  return (Array.isArray(data)?data:[]).map(fromApiAirport);
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

type TransportKind = 'rail'|'grab'|'taxi'|'bolt'|'bus';
type TransportOption = { kind:TransportKind; name:string; price:string };
type TransportInfo = {
  options:TransportOption[];
  name:string;         // airport name for Maps directions
  city:string;         // city-center destination
  railDest?:string;    // dedicated rail/transit station when known
  grabCountry:string;  // grab.com/{country}/
  lat:number;
  lng:number;
  bolt:string|null;    // unused — Bolt opens via bolt:// deeplink
};

const TRANSPORT_INFO:Record<string, TransportInfo> = {
  BKK: { options:[
    { kind:'rail', name:'Rail Link', price:'45฿' },
    { kind:'grab', name:'Grab', price:'~350฿' },
    { kind:'taxi', name:'Taxi', price:'~500฿' },
  ], name:'Suvarnabhumi Airport', city:'Bangkok', railDest:'Phaya Thai Station',
    grabCountry:'th', lat:13.6811, lng:100.7475, bolt:null },
  DMK: { options:[
    { kind:'bus', name:'Bus A1', price:'30฿' },
    { kind:'grab', name:'Grab', price:'~280฿' },
    { kind:'taxi', name:'Taxi', price:'~400฿' },
  ], name:'Don Mueang Airport', city:'Bangkok',
    grabCountry:'th', lat:13.9126, lng:100.6067, bolt:null },
  HKT: { options:[
    { kind:'grab', name:'Grab Patong', price:'~600฿' },
    { kind:'bolt', name:'Bolt', price:'~500฿' },
    { kind:'taxi', name:'Taxi', price:'~650฿' },
  ], name:'Phuket Airport', city:'Phuket',
    grabCountry:'th', lat:8.1132, lng:98.3169, bolt:null },
  CNX: { options:[
    { kind:'grab', name:'Grab', price:'~120฿' },
    { kind:'bolt', name:'Bolt', price:'~100฿' },
    { kind:'taxi', name:'Taxi', price:'~150฿' },
  ], name:'Chiang Mai Airport', city:'Chiang Mai',
    grabCountry:'th', lat:18.7668, lng:98.9628, bolt:null },
  SIN: { options:[
    { kind:'rail', name:'MRT', price:'$2.50' },
    { kind:'grab', name:'Grab', price:'~$25' },
    { kind:'taxi', name:'Taxi', price:'~$30' },
  ], name:'Changi Airport', city:'Singapore', railDest:'City Hall MRT Station',
    grabCountry:'sg', lat:1.3644, lng:103.9915, bolt:null },
  KUL: { options:[
    { kind:'rail', name:'KLIA Ekspres', price:'RM55' },
    { kind:'grab', name:'Grab', price:'~RM45' },
  ], name:'Kuala Lumpur International Airport', city:'Kuala Lumpur', railDest:'KL Sentral',
    grabCountry:'my', lat:2.7456, lng:101.7099, bolt:null },
  SGN: { options:[
    { kind:'bus', name:'Bus 109', price:'20k₫' },
    { kind:'grab', name:'Grab', price:'~150k₫' },
  ], name:'Tan Son Nhat Airport', city:'Ho Chi Minh City',
    grabCountry:'vn', lat:10.8188, lng:106.6520, bolt:null },
  HAN: { options:[
    { kind:'bus', name:'Bus 86', price:'9k₫' },
    { kind:'grab', name:'Grab', price:'~200k₫' },
  ], name:'Noi Bai Airport', city:'Hanoi',
    grabCountry:'vn', lat:21.2212, lng:105.8072, bolt:null },
  CGK: { options:[
    { kind:'rail', name:'Railink', price:'Rp70k' },
    { kind:'grab', name:'Grab', price:'~Rp150k' },
  ], name:'Soekarno-Hatta Airport', city:'Jakarta', railDest:'Manggarai Station',
    grabCountry:'id', lat:-6.1256, lng:106.6559, bolt:null },
  DPS: { options:[
    { kind:'grab', name:'Grab', price:'~Rp120k' },
    { kind:'taxi', name:'Taxi Kuta', price:'~Rp150k' },
  ], name:'Ngurah Rai Airport', city:'Kuta',
    grabCountry:'id', lat:-8.7481, lng:115.1670, bolt:null },
  MNL: { options:[
    { kind:'grab', name:'Grab', price:'~₱400' },
    { kind:'taxi', name:'Taxi', price:'~₱500' },
  ], name:'Ninoy Aquino Airport', city:'Manila',
    grabCountry:'ph', lat:14.5086, lng:121.0194, bolt:null },
};

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

async function openUrl(url:string){
  try{ await Linking.openURL(url); } catch{ /* ignore */ }
}

/** Open Grab app; fallback to App Store */
async function openGrab(){
  const grabUrl='grab://open';
  const grabFallback='https://apps.apple.com/app/grab/id647268330';
  try{
    const canOpen=await Linking.canOpenURL(grabUrl);
    if(canOpen){
      await Linking.openURL(grabUrl);
      return;
    }
  } catch{ /* fall through */ }
  try{
    await Linking.openURL(grabUrl);
  } catch{
    await Linking.openURL(grabFallback);
  }
}

async function openBolt(){
  const boltUrl='bolt://';
  try{
    if(await Linking.canOpenURL(boltUrl)){
      await Linking.openURL(boltUrl);
      return;
    }
  } catch{
    try{
      await Linking.openURL(boltUrl);
      return;
    } catch{ /* show alert below */ }
  }
  Alert.alert('Bolt', 'Download Bolt in the App Store');
}

/** Google Maps dir: airport → destination, centered on airport lat/lng */
function mapsDirUrl(airportName:string, destination:string, lat:number, lng:number, zoom=11){
  return `https://www.google.com/maps/dir/${encodeURIComponent(airportName)}/${encodeURIComponent(destination)}/@${lat},${lng},${zoom}z`;
}

async function openTransportOption(opt:TransportOption, info:TransportInfo){
  const { name:airportName, city, lat, lng } = info;
  if(opt.kind==='grab'){
    await openGrab();
    return;
  }
  if(opt.kind==='bolt'){
    await openBolt();
    return;
  }
  if(opt.kind==='taxi'){
    await openUrl(mapsDirUrl(airportName, city, lat, lng, 11));
    return;
  }
  // rail / bus → station when known, else city center; prefer transit mode
  const dest=info.railDest ?? city;
  const zoom=info.railDest ? 12 : 11;
  if(info.railDest){
    await openUrl(mapsDirUrl(airportName, dest, lat, lng, zoom));
    return;
  }
  await openUrl(
    `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(airportName)}&destination=${encodeURIComponent(dest)}&travelmode=transit`,
  );
}

async function detectNearestAirport():Promise<Airport>{
  // Dev / no-GPS: always start at BKK (Bangkok Suvarnabhumi)
  if(__DEV__) return FALLBACK_AIRPORT;
  try{
    const { status }=await Location.requestForegroundPermissionsAsync();
    if(status!=='granted') return FALLBACK_AIRPORT;
    const pos=await Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.Balanced });
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
  id:string; number:string; airline:string; airlineCode:string;
  origin:string; originCity:string; originCountry:string;
  destination:string; destCity:string; destCountry:string;
  scheduledTime:string; revisedTime:string; actualTime:string;
  arrivalTime:string; departureTime:string;
  gate:string; terminal:string; baggage:string; runway:string;
  arrTerminal:string; depTerminal:string;
  status:FlightStatus; delay:number; aircraft:string;
  aircraftReg:string; callSign:string; progress:number;
  premium?:boolean;
  lat?:number; lng?:number;
  altitudeFt?:number; speedKts?:number; headingDeg?:number;
}

const STATUS_CFG:Record<FlightStatus,{label:string;color:string;bg:string;desc:string;priority:number}> = {
  boarding:   {label:'Boarding',  color:'#3B82F6', bg:'#172554', desc:'Head to your gate now',    priority:0},
  'en-route': {label:'En Route',  color:'#3B82F6', bg:'#172554', desc:'Flight is in the air',     priority:1},
  scheduled:  {label:'Scheduled', color:'#8896B0', bg:'#0f172a', desc:'On time as planned',        priority:2},
  delayed:    {label:'Delayed',   color:'#F59E0B', bg:'#451a03', desc:'Departure pushed back',    priority:3},
  landed:     {label:'Landed',    color:'#22C55E', bg:'#052e16', desc:'Aircraft has arrived',      priority:4},
  unknown:    {label:'Unknown',   color:'#8896B0', bg:'#0f172a', desc:'Status unavailable',        priority:5},
  cancelled:  {label:'Cancelled', color:'#EF4444', bg:'#450a0a', desc:'Flight has been cancelled',priority:6},
};

const TRANSPORT_ACCENT:Record<TransportKind, string> = {
  rail:'#3B82F6',
  grab:'#22C55E',
  bolt:'#22C55E',
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

function fmt(iso:string){
  if(!iso) return '--:--';
  const hour12=getPrefs().timeFormat==='12h';
  // AeroDataBox local times: "2026-08-12 13:25+02:00" — show airport-local clock (don't convert to device TZ)
  const s=String(iso).trim();
  if(/[+-]\d{2}:?\d{2}$/.test(s) && !/Z$/i.test(s)){
    const m=s.match(/[ T](\d{2}):(\d{2})/);
    if(m){
      const h=Number(m[1]); const min=Number(m[2]);
      if(!hour12) return `${m[1]}:${m[2]}`;
      const am=h<12;
      return `${h%12||12}:${String(min).padStart(2,'0')} ${am?'AM':'PM'}`;
    }
  }
  try{
    const normalized=s.includes('T')?s:s.replace(' ','T');
    return new Date(normalized).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12});
  }
  catch{ return '--:--'; }
}

function fmtLocal(iso:string){
  const clock=fmt(iso);
  return clock==='--:--'?clock:`${clock} local`;
}

function fmtAtCity(iso:string, city:string, iata:string, otherIata:string){
  const clock=fmt(iso);
  if(clock==='--:--') return clock;
  const a=timezoneForIata(iata);
  const b=timezoneForIata(otherIata);
  if(a!==b && city) return `${clock} ${city} time`;
  return `${clock} local`;
}

function clockSuffix(city?:string, iata?:string, otherIata?:string):string{
  if(city && iata && otherIata){
    const a=timezoneForIata(iata);
    const b=timezoneForIata(otherIata);
    if(a!==b) return `${city} time`;
  }
  return 'local';
}

function anyFlightClock(f:Flight, side:'departure'|'arrival'):string{
  if(side==='departure'){
    return f.departureTime || f.revisedTime || f.scheduledTime || f.actualTime || '';
  }
  return f.arrivalTime || f.revisedTime || f.scheduledTime || f.actualTime || f.departureTime || '';
}

function HeroClock({
  iso, color, city, iata, otherIata,
}:{
  iso:string;
  color:string;
  city?:string;
  iata?:string;
  otherIata?:string;
}){
  const clock=fmt(iso);
  const suffix=clock==='--:--' ? '' : clockSuffix(city, iata, otherIata);
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

/** Display clock: always actualTime > estimated/revised > scheduled (never hide an earlier actual). */
function bestDisplayTime(f:Flight, type?:'arrival'|'departure'):string{
  if(type==='arrival'){
    return f.actualTime || f.arrivalTime || f.revisedTime || f.scheduledTime || '';
  }
  if(type==='departure'){
    return f.actualTime || f.departureTime || f.revisedTime || f.scheduledTime || '';
  }
  return f.actualTime || f.departureTime || f.arrivalTime || f.revisedTime || f.scheduledTime || '';
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
    if(!ap?.iata && !ap?.icao) continue;
    const k=keyOf(d);
    if(!bestByKey.has(k)) bestByKey.set(k, ap);
  }
  for(const d of items){
    const ap=d?.movement?.airport;
    if(!ap) continue;
    const name=String(ap.name||'').toLowerCase();
    if(ap.iata || ap.icao) continue;
    if(name && name!=='unknown') continue;
    const donor=bestByKey.get(keyOf(d));
    if(donor) d.movement.airport={ ...donor };
  }
}

function fmtDate(iso:string){
  if(!iso) return '';
  try{
    const d=new Date(iso);
    const today=new Date();
    const isToday=d.toDateString()===today.toDateString();
    if(isToday) return 'Today';
    const tomorrow=new Date(today); tomorrow.setDate(today.getDate()+1);
    if(d.toDateString()===tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'});
  } catch{ return ''; }
}

function countdown(iso:string){
  if(!iso) return null;
  const raw=String(iso).includes('T')?iso:String(iso).replace(' ','T');
  const diff=Math.floor((new Date(raw).getTime()-Date.now())/60000);
  if(diff<=0) return null;
  if(diff<60) return `${diff}m`;
  return `${Math.floor(diff/60)}h ${diff%60}m`;
}

function fmtDateLong(iso:string){
  if(!iso) return '';
  try{
    const s=String(iso).trim();
    const m=s.match(/(\d{4})-(\d{2})-(\d{2})/);
    const d=m?new Date(Number(m[1]), Number(m[2])-1, Number(m[3])):new Date(s);
    if(Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  } catch{ return ''; }
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

/** Live boarding countdown hero for the flight detail card */
function BoardingCountdownBanner({f}:{f:Flight}){
  const [, setTick]=useState(0);
  const pulse=useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    const id=setInterval(()=>setTick(t=>t+1),1000);
    return ()=>clearInterval(id);
  },[]);

  const phase=getBoardingPhase(f);
  const label=boardingCountdownLabel(f);

  useEffect(()=>{
    if(phase!=='boarding'){
      pulse.setValue(1);
      return;
    }
    const anim=Animated.loop(
      Animated.sequence([
        Animated.timing(pulse,{toValue:0.35,duration:700,useNativeDriver:true}),
        Animated.timing(pulse,{toValue:1,duration:700,useNativeDriver:true}),
      ]),
    );
    anim.start();
    return ()=>anim.stop();
  },[phase,pulse]);

  if(!label) return null;

  const isBoard=phase==='boarding';
  const isDeparted=phase==='departed';
  const color=isBoard?'#3B82F6':isDeparted?'#8896B0':phase==='landed'?'#22C55E':BRAND.gold;

  return (
    <View style={[dc.boardCd,{borderLeftColor:color,backgroundColor:color+'14'}]}>
      <Animated.View style={{opacity:isBoard?pulse:1}}>
        <View style={[dc.boardCdDot,{backgroundColor:color}]}/>
      </Animated.View>
      <View style={{flex:1}}>
        <Text style={[dc.boardCdLabel,{color}]}>{label}</Text>
        {phase==='upcoming'&&boardingTargetIso(f)?(
          <Text style={dc.boardCdSub}>Boarding target · {fmt(boardingTargetIso(f))}</Text>
        ):null}
      </View>
      <Clock size={16} color={color}/>
    </View>
  );
}

/** Red gate-close countdown — boarding + under 20 min to departure */
function GateCloseBanner({f}:{f:Flight}){
  const [, setTick]=useState(0);
  useEffect(()=>{
    const id=setInterval(()=>setTick(t=>t+1),1000);
    return ()=>clearInterval(id);
  },[]);

  if(!shouldShowGateClose(f)) return null;
  const mins=minutesUntilGateClose(f);
  if(mins===null) return null;

  const closed=mins<=0;
  const urgent=!closed && mins<5;
  const color='#EF4444';
  const Icon=closed||urgent?Door:DoorOpen;
  const label=closed
    ?'Gate closed'
    :`Gate closes in ${mins} min`;

  return (
    <View style={[dc.gateClose,{borderLeftColor:color,backgroundColor:'rgba(239,68,68,0.08)'}]}>
      <Icon size={18} color={color}/>
      <Text style={[dc.gateCloseTxt,{color}]}>{label}</Text>
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
    mov.scheduledTimeLocal,
    raw.scheduledTime,
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
  const local=usableAirportCode(localIata);
  const airline=raw.airline??{};
  const gateRaw = raw.movement?.gate ?? null;
  const best=actual||revised||sched;

  const remoteCode=usableAirportCode(remote.code)||usableAirportCode(type==='departure'?arrAp.code:depAp.code);
  const remoteCity=remote.city||(type==='departure'?arrAp.city:depAp.city)||'';
  const remoteCountry=remote.country||(type==='departure'?arrAp.country:depAp.country)||'';
  const remoteIsLocal=!!local && remoteCode===local;

  return {
    id:          String(raw.number??Math.random()),
    number:      raw.number??'—',
    airline:     airline.name||airline.iata||'—',
    airlineCode: airline.iata||'—',
    origin:      type==='arrival'  ?(remoteIsLocal?'':remoteCode):local,
    originCity:  type==='arrival'  ?(remoteIsLocal?'':remoteCity):'',
    originCountry:type==='arrival' ?(remoteIsLocal?'':remoteCountry):'',
    destination: type==='departure'?(remoteIsLocal?'':remoteCode):local,
    destCity:    type==='departure'?(remoteIsLocal?'':remoteCity):'',
    destCountry: type==='departure'?(remoteIsLocal?'':remoteCountry):'',
    scheduledTime:sched,
    revisedTime:  revised,
    actualTime:   actual,
    arrivalTime:  type==='arrival'? best : extractAdbTime(
      raw.arrival?.movement?.scheduledTime,
      raw.arrival?.movement?.revisedTime,
      raw.arrival?.scheduledTime,
    ),
    departureTime:type==='departure'? best : extractAdbTime(
      raw.departure?.movement?.scheduledTime,
      raw.departure?.movement?.revisedTime,
      raw.departure?.scheduledTime,
    ),
    gate:         gateRaw != null && gateRaw !== '' ? String(gateRaw) : '',
    terminal:     mov.terminal??'',
    baggage:      mov.baggage??mov.baggageBelt??'',
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

/** Best available airport code from AeroDataBox airport object (never invent ???). */
function pickAirportCode(ap:any):string{
  if(!ap||typeof ap!=='object') return '';
  const iata=String(ap.iata||ap.iataCode||ap.localCode||'').trim().toUpperCase();
  if(iata.length===3 && iata!=='UNK') return iata;
  const icao=String(ap.icao||ap.icaoCode||'').trim().toUpperCase();
  if(icao.length===4) return icao;
  return iata.length===3?iata:'';
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
  if(!c || c==='—' || c==='-' || c==='–' || c==='???' || c==='UNK' || c==='NULL') return '';
  return c;
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

function localDateKey(d:Date, timeZone:string):string{
  try{
    return new Intl.DateTimeFormat('en-CA',{ timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
  } catch{
    return d.toISOString().slice(0,10);
  }
}

function flightBoardDate(f:Flight):string{
  const iso=f.scheduledTime||f.revisedTime||f.departureTime||f.arrivalTime||'';
  const m=String(iso).match(/(\d{4}-\d{2}-\d{2})/);
  return m?m[1]:'';
}

function isTodayBoardFlight(f:Flight, iata:string, dayKey:string, type:'arrival'|'departure'='departure'):boolean{
  return shouldShowOnBoard(f, dayKey, type);
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
  if(s==='boarding'||s==='departing'||s==='gate closed'||s==='last call') return 'boarding';
  if(s==='delayed') return 'delayed';
  if(s==='expected'||s==='scheduled'||s==='on time'||s==='ontime'||!s){
    return delayMin>5 ? 'delayed' : 'scheduled';
  }
  // Unknown raw label: only mark delayed while still pre-departure
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
  return {
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
    scheduledTime: d.scheduledDeparture || d.scheduledArrival || base?.scheduledTime || '',
    revisedTime: d.estimatedDeparture || d.estimatedArrival || base?.revisedTime || '',
    actualTime: d.actualDeparture || d.actualArrival || base?.actualTime || '',
    departureTime: d.actualDeparture || d.estimatedDeparture || d.scheduledDeparture || base?.departureTime || '',
    arrivalTime: d.actualArrival || d.estimatedArrival || d.scheduledArrival || base?.arrivalTime || '',
    gate: depGate || arrGate || base?.gate || '',
    terminal: d.departureTerminal || d.arrivalTerminal || base?.terminal || '',
    baggage: d.baggageBelt || base?.baggage || '',
    runway: base?.runway || '',
    arrTerminal: d.arrivalTerminal || base?.arrTerminal || '',
    depTerminal: d.departureTerminal || base?.depTerminal || '',
    status,
    delay: delay || base?.delay || 0,
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
}

const RATE_LIMIT_MSG='Too many requests — please wait a moment and try again';

function sleep(ms:number){
  return new Promise<void>(r=>setTimeout(r, ms));
}

async function fetchProxyJson(url:string, _debugLabel=''):Promise<any>{
  return fetchJsonRetry(url, 8000);
}

async function fetchFIDS(iata:string, type:'arrival'|'departure'):Promise<{ flights:Flight[]; source:'live'|'cached' }>{
  const bundle = type==='arrival' ? await getArrivals(iata) : await getDepartures(iata);
  const items = Array.isArray(bundle.data) ? bundle.data : [];
  if(bundle.normalized){
    return { flights: items as Flight[], source: bundle.source };
  }
  if(!items.length) return { flights: [], source: bundle.source };
  enrichFidsRemoteAirports(items);
  return { flights: items.map((i:any) => parseFIDS(i, type, iata)), source: bundle.source };
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
  const gate=(dep.gate??arr.gate??'')+'';
  return {
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
    gate:         gate,
    terminal:     (dep.terminal??arr.terminal??'')+'',
    baggage:      arr.baggage??arr.baggageBelt??'',
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
}

function flightLookupError(number:string):string{
  const clean=number.replace(/\s+/g,'').toUpperCase();
  return `Could not find flight ${clean}. Please check the flight number and try again.`;
}

async function fetchFlightByNumber(number:string):Promise<Flight[]>{
  const clean=number.replace(/\s+/g,'').toUpperCase();
  try{
    const bundle=await getFlightDetail(clean);
    if(bundle.premium && bundle.data && !Array.isArray(bundle.data)){
      return [faDetailToFlight(bundle.data as FAFlightDetail)];
    }
    const items=Array.isArray(bundle.data) ? bundle.data : [];
    if(!items.length){
      throw new Error(flightLookupError(clean));
    }
    if(items[0]?._normalized || (typeof items[0]?.status==='string' && items[0]?.number && items[0]?.id)){
      return items as Flight[];
    }
    return items.map(parseFlightStatus);
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
  };
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

function timeMs(iso:string):number{
  if(!iso) return 0;
  const t=new Date(iso).getTime();
  return Number.isFinite(t)?t:0;
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
  const arriveMs=timeMs(incoming.arrivalTime||incoming.actualTime||incoming.revisedTime||incoming.scheduledTime);
  const departMs=timeMs(outgoing.departureTime||outgoing.revisedTime||outgoing.scheduledTime);
  const gapMin=arriveMs&&departMs?(departMs-arriveMs)/60000:NaN;
  const domestic=isDomesticHub(hub, incoming, outgoing);

  const innTerm=(incoming.arrTerminal||incoming.terminal||'').trim();
  const outTerm=(outgoing.depTerminal||outgoing.terminal||'').trim();
  const sameTerminal=innTerm&&outTerm?innTerm===outTerm:null;

  const walk=walkMinutes(hub, sameTerminal);
  const buffer=Number.isFinite(gapMin)?gapMin-walk:NaN;

  let verdict:ConnVerdict='unknown';
  let message='Unable to calculate connection time';

  if(incoming.status==='cancelled'||outgoing.status==='cancelled'){
    verdict='miss';
    message=incoming.status==='cancelled'
      ?'Incoming flight is cancelled'
      :'Connecting flight is cancelled';
  } else if(!Number.isFinite(gapMin)){
    verdict='unknown';
    message='Missing arrival or departure time';
  } else if(gapMin<0 || buffer<0){
    verdict='miss';
    message=`❌ You'll miss it — contact airline now`;
  } else if(gapMin>24*60){
    verdict='miss';
    message='These flights are not on the same day — connection unlikely';
  } else if(buffer<12){
    verdict='tight';
    message=`⚠️ Very tight — ${Math.round(buffer)} min. Ask airline for help`;
  } else {
    verdict='good';
    message=`✅ You'll make it — ${Math.round(buffer)} min buffer`;
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
  if(!hub) throw new Error('Could not auto-detect connection airport from these flights.');
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

/** Resolve origin→destination using flight data + selected airport for FIDS one-sided responses */
function resolveRoute(f:Flight, type:'arrival'|'departure', airport:Airport){
  const local=usableAirportCode(airport.iata);
  let origin=usableAirportCode(f.origin);
  let dest=usableAirportCode(f.destination);
  let originCity=f.originCity||'';
  let destCity=f.destCity||'';

  if(type==='departure' && !origin){
    origin=local;
    originCity=originCity||airport.city;
  }
  if(type==='arrival' && !dest){
    dest=local;
    destCity=destCity||airport.city;
  }
  if(origin===local) originCity=originCity||airport.city;
  if(dest===local) destCity=destCity||airport.city;

  // Never clone the selected airport onto the missing remote side (AMS → AMS).
  if(type==='departure' && dest && dest===origin){
    dest='';
    if(cleanAirportName(destCity).toLowerCase()===cleanAirportName(airport.city).toLowerCase()) destCity='';
  }
  if(type==='arrival' && origin && origin===dest){
    origin='';
    if(cleanAirportName(originCity).toLowerCase()===cleanAirportName(airport.city).toLowerCase()) originCity='';
  }

  const o=displayAirport(origin, originCity, f.originCountry);
  const d=displayAirport(dest, destCity, f.destCountry);
  return {
    origin:o.code, originCity:routePlaceLabel(o.city, o.code), originFlag:o.flag,
    destination:d.code, destCity:routePlaceLabel(d.city, d.code), destFlag:d.flag,
  };
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
  /** Gate-close push at T-15 before departure — once */
  notifiedGateClose:boolean;
  /** Baggage belt ready push — once per flight */
  notifiedBaggageClaim:boolean;
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

function stubFlightFromNumber(number:string, dateIso?:string, from?:string, to?:string):Flight{
  const clean=flightSlug(number);
  const scheduled=dateIso
    ? `${dateIso}T12:00:00.000Z`
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

function sameTrackedFlight(t:TrackedFlight, f:Pick<Flight,'number'|'scheduledTime'>):boolean{
  const slug=flightSlug(f.number);
  return t.key===flightTrackKey(f) || flightSlug(t.flightNumber)===slug;
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
    notifiedBaggageClaim:false,
    activeAlert,
    airportIata,
    type,
    flight:f,
    boardingPass,
  };
}

type NotifyKind = 'delay'|'gate'|'boarding'|'cancelled'|'landed'|'baggage'|'gateClose'|'connection'|'t24'|'t3h'|'t1h'|'t30m'|'departed'|'early';
type NotifyEvent = { kind:NotifyKind; title:string; body:string; urgent:boolean; smart?:boolean };

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
        notifiedBaggageClaim: !!t?.notifiedBaggageClaim,
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
      const arriveMs=timeMs(inn.arrivalTime||inn.actualTime||inn.revisedTime||inn.scheduledTime);
      const departMs=timeMs(dep.departureTime||dep.revisedTime||dep.scheduledTime);
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
    name:'Flight updates',
    importance:Notifications.AndroidImportance.DEFAULT,
    vibrationPattern:[0,120],
    lightColor:'#0B1F3A',
  });
  await Notifications.setNotificationChannelAsync('flights-urgent',{
    name:'Urgent flight updates',
    importance:Notifications.AndroidImportance.HIGH,
    vibrationPattern:[0,250,250,250],
    lightColor:'#0B1F3A',
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

function notificationDedupeKey(flightNumber:string, eventType:string):string{
  const date = new Date().toISOString().slice(0, 10);
  return `${flightSlug(flightNumber)}-${eventType}-${date}`;
}

async function notifyLocal(flightNumber:string, event:NotifyEvent){
  if(Platform.OS==='web') return;
  const key = notificationDedupeKey(flightNumber, event.kind);
  if(sentNotifications.has(key)) return;
  sentNotifications.add(key);
  try{
    const clean=flightSlug(flightNumber);
    await Notifications.scheduleNotificationAsync({
      content:{
        title:event.title,
        body:event.body,
        sound:true,
        categoryIdentifier:`flight-${clean}`,
        data:{ thread:`flight-${clean}`, flightNumber:clean },
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
  } catch{ /* ignore on unsupported platforms */ }
}

/** Local notification only — self-push + local previously caused duplicates. */
async function notifyFlight(flightNumber:string, event:NotifyEvent){
  const prefs=getPrefs().notify;
  const kind=event.kind;
  if((kind==='delay'||kind==='early'||kind==='t24'||kind==='t3h'||kind==='t1h'||kind==='t30m') && !prefs.delay) return;
  if((kind==='gate'||kind==='gateClose') && !prefs.gate) return;
  if(kind==='boarding' && !prefs.boarding) return;
  if((kind==='landed'||kind==='baggage') && !prefs.landed) return;
  await notifyLocal(flightNumber, event);
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
  const baggage=live.baggage||'';
  let notifiedDelay=prev.notifiedDelay ?? prev.lastDelay;
  let notifiedGate=prev.notifiedGate ?? prev.lastGate;
  let notifiedStatus=prev.notifiedStatus ?? prev.lastStatus;
  let notifiedGateClose=!!prev.notifiedGateClose;
  let notifiedBaggageClaim=!!prev.notifiedBaggageClaim;

  if(gate && gate!==prev.lastGate && gate!==notifiedGate){
    events.push({
      kind:'gate',
      title:'Gate changed',
      body: `⚠️ Gate changed · ${num} · Now Gate ${gate}`,
      urgent:true,
    });
    notifiedGate=gate;
  }
  if(status==='boarding' && prev.lastStatus!=='boarding' && notifiedStatus!=='boarding'){
    events.push({
      kind:'boarding',
      title:'Boarding now',
      body: gate
        ? `🟢 Boarding now · ${num} · Gate ${gate}`
        : `🟢 Boarding now · ${num}`,
      urgent:true,
    });
    notifiedStatus='boarding';
  }
  if(delay>=(notifiedDelay+10) && delay>0){
    events.push({
      kind:'delay',
      title:`${num} delayed`,
      body:`${num} running ${delay} min late · New: ${fmt(revised)} · ☕ You have time`,
      urgent:false,
    });
    notifiedDelay=delay;
  }
  if(status==='cancelled' && prev.lastStatus!=='cancelled' && notifiedStatus!=='cancelled'){
    events.push({
      kind:'cancelled',
      title:'Flight cancelled',
      body:`${num} has been cancelled`,
      urgent:true,
    });
    notifiedStatus='cancelled';
  }
  if(status==='landed' && prev.lastStatus!=='landed' && notifiedStatus!=='landed'){
    const city=live.destCity || live.destination || '';
    const flagEmoji=destFlagEmoji(live);
    events.push({
      kind:'landed',
      title:'Landed',
      body: baggage
        ? `Landed in ${city} ${flagEmoji} · Baggage belt ${baggage}`.replace(/\s+·/,' ·').replace(/\s{2,}/g,' ').trim()
        : `Landed in ${city} ${flagEmoji}`.trim(),
      urgent:false,
    });
    notifiedStatus='landed';
  }

  if(
    status==='landed' &&
    baggage &&
    !notifiedBaggageClaim &&
    (prev.lastStatus!=='landed' || !prev.lastBaggage)
  ){
    events.push({
      kind:'baggage',
      title:`${num} landed`,
      body:`Landed in ${live.destCity || live.destination || ''} ${destFlagEmoji(live)} · Baggage belt ${baggage}`.replace(/\s{2,}/g,' ').trim(),
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

  if(minsDep!==null && status!=='cancelled' && status!=='landed' && status!=='en-route'){
    if(!notifiedT24 && minsDep<=24*60 && minsDep>3*60){
      events.push({
        kind:'t24', smart:true,
        title:'Tomorrow',
        body:`Tomorrow: ${route} ${fmt(live.departureTime||live.revisedTime||live.scheduledTime)}. Check-in opens soon`,
        urgent:false,
      });
      notifiedT24=true;
    }
    if(!notifiedT3h && minsDep<=3*60 && minsDep>60){
      events.push({
        kind:'t3h', smart:true,
        title:`${num} in 3 hours`,
        body:`Your flight in 3 hours. Gate usually announced soon`,
        urgent:false,
      });
      notifiedT3h=true;
    }
    if(!notifiedT1h && minsDep<=60 && minsDep>30){
      const term=compactTerminal(live.depTerminal||live.terminal);
      const onTime=delay<=0;
      events.push({
        kind:'t1h', smart:true,
        title:`${num} in 1 hour`,
        body: [
          'Your flight in 1 hour',
          gate ? `Gate ${gate}` : null,
          term || null,
          onTime ? 'On time ✓' : `${delay} min late`,
        ].filter(Boolean).join(' · '),
        urgent:false,
      });
      notifiedT1h=true;
    }
    if(!notifiedT30m && minsDep<=30 && minsDep>0 && status!=='boarding'){
      events.push({
        kind:'t30m', smart:true,
        title:'Boarding starts soon',
        body: gate ? `Boarding starts soon at Gate ${gate}` : `Boarding starts soon · ${num}`,
        urgent:true,
      });
      notifiedT30m=true;
    }
  }

  if(
    !notifiedGateClose &&
    minsDep!==null &&
    minsDep<=15 &&
    minsDep>=0 &&
    (status==='boarding' || status==='scheduled' || status==='delayed')
  ){
    events.push({
      kind:'gateClose', smart:true,
      title:'Boarding Now',
      body: gate
        ? `Boarding Now · Gate ${gate} · 20 min before close`
        : `Boarding Now · ${num} · 20 min before close`,
      urgent:true,
    });
    notifiedGateClose=true;
  }

  if(!notifiedDeparted && (status==='en-route' || !!live.actualTime) && prev.lastStatus!=='en-route' && prev.lastStatus!=='landed'){
    const city=live.destCity || live.destination || '';
    const arr=fmt(live.arrivalTime||live.revisedTime||'');
    events.push({
      kind:'departed', smart:true,
      title:`${num} departed`,
      body: arr && arr!=='--:--'
        ? `${num} departed ✈️ Arrives ${arr}${city ? ` ${city} time` : ''}`
        : `${num} departed ✈️`,
      urgent:false,
    });
    notifiedDeparted=true;
  }

  if(!notifiedEarly && (status==='en-route' || status==='landed')){
    const skew=arrivalSkewMin(live);
    if(skew!==null){
      events.push({
        kind:'early',
        title:`${num} arriving early`,
        body:`${num} arriving ${Math.abs(skew)} min early · New: ${fmt(live.arrivalTime||live.revisedTime)}`,
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
      notifiedDelay,
      notifiedGate,
      notifiedStatus,
      notifiedGateClose,
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
  const t=new Date(String(iso).includes('T')?iso:String(iso).replace(' ','T')).getTime();
  return Number.isFinite(t)?t:Number.POSITIVE_INFINITY;
}

function minutesUntilFlight(f:Flight, type:'arrival'|'departure', now=Date.now()):number|null{
  const iso=bestDisplayTime(f, type);
  if(!iso) return null;
  const t=new Date(String(iso).includes('T')?iso:String(iso).replace(' ','T')).getTime();
  if(!Number.isFinite(t)) return null;
  return Math.floor((t-now)/60000);
}

function isGateClosing(f:Flight):boolean{
  if(f.status==='cancelled' || f.status==='landed' || f.status==='en-route') return false;
  if(shouldShowGateClose(f)) return true;
  const close=minutesUntilGateClose(f);
  const dep=minutesUntilDeparture(f);
  return f.status==='boarding' && close!==null && close<=0 && dep!==null && dep>=0;
}

/** Passenger urgency: 1 boarding … 7 cancelled. Lower = higher on the list. */
function passengerUrgency(f:Flight, type:'arrival'|'departure'):number{
  if(f.status==='cancelled') return 7;

  const mins=minutesUntilFlight(f, type);
  const delayed=f.status==='delayed';
  const lastCall=isLastCall(f);

  if(type==='arrival'){
    if(f.status==='en-route' && mins!==null && mins>=0 && mins<10) return 2;
    if(f.status==='en-route' && mins!==null && mins>=0 && mins<=60) return 1;
    if(f.status==='en-route') return 4;
    if(!delayed && f.status!=='landed' && mins!==null && mins>=0 && mins<=60) return 3;
    if(delayed) return 6;
    return 5;
  }

  if(f.status==='boarding' || isGateClosing(f)) return 1;
  if(lastCall) return 2;
  const gone=f.status==='en-route' || f.status==='landed' || !!f.actualTime;
  if(!gone && !delayed && mins!==null && mins>=0 && mins<=60) return 3;
  if(f.status==='en-route' || f.status==='landed') return 4;
  if(delayed) return 6;
  return 5;
}

function sortFlights(list:Flight[], type:'arrival'|'departure'):Flight[]{
  return [...list].sort((a,b)=>{
    const ua=passengerUrgency(a, type);
    const ub=passengerUrgency(b, type);
    if(ua!==ub) return ua-ub;
    return flightSortMs(a, type)-flightSortMs(b, type);
  });
}

function flightLiveProgress(f:Flight):number{
  if(f.status==='landed') return 1;
  if(f.status==='cancelled') return 0;
  if(f.premium && typeof f.progress==='number' && f.progress>0){
    return Math.min(0.98, f.progress>1 ? f.progress/100 : f.progress);
  }
  if(f.status==='en-route'){
    const dep=f.departureTime||f.revisedTime||f.scheduledTime||f.actualTime;
    const arr=f.arrivalTime;
    if(dep && arr){
      const a=new Date(String(dep).includes('T')?dep:String(dep).replace(' ','T')).getTime();
      const b=new Date(String(arr).includes('T')?arr:String(arr).replace(' ','T')).getTime();
      if(b>a){
        return Math.min(0.96, Math.max(0.04, (Date.now()-a)/(b-a)));
      }
    }
    if(typeof f.progress==='number' && f.progress>0) return Math.min(0.96, f.progress);
    return 0.5;
  }
  return 0.03;
}

function flightDurationLabel(f:Flight):string{
  const dep=f.departureTime||f.revisedTime||f.scheduledTime;
  const arr=f.arrivalTime;
  if(!dep || !arr) return '';
  const a=new Date(String(dep).includes('T')?dep:String(dep).replace(' ','T')).getTime();
  const b=new Date(String(arr).includes('T')?arr:String(arr).replace(' ','T')).getTime();
  if(!(b>a)) return '';
  return formatDurationMs(b-a);
}

function gateToneFor(f:Flight):'normal'|'boarding'|'lastCall'{
  if(isLastCall(f)) return 'lastCall';
  if(f.status==='boarding' || isGateClosing(f)) return 'boarding';
  return 'normal';
}

function FlightProgressLine({ f, remainIso }:{ f:Flight; remainIso:string }){
  const { C: theme } = useTheme();
  const pct=flightLiveProgress(f);
  const left=countdown(remainIso);
  const depIso=f.actualTime || f.departureTime || f.revisedTime || f.scheduledTime;
  const arrIso=f.arrivalTime || (f.status==='landed' ? f.actualTime : '');
  const departed=f.status==='en-route' || f.status==='landed' || !!f.actualTime;
  let label='';
  if(f.status==='landed'){
    label='Arrived';
  } else if(!departed){
    const cd=countdown(depIso);
    label=cd?`Departs in ${cd}`:'';
  } else {
    const bits=[
      depIso?`Departed ${fmt(depIso)}`:'',
      arrIso?`Arrives ${fmt(arrIso)}`:'',
      left?`${left} remaining`:'',
    ].filter(Boolean);
    label=bits.join(' · ');
  }
  const planeLeft=Math.min(96, Math.max(2, Math.round(pct*100)));
  return (
    <View style={dc.progressWrap}>
      <View style={dc.progressTrack}>
        <View style={[dc.progressFill,{ width:`${Math.round(pct*100)}%` as any }]}/>
        <View style={[dc.progressPlane,{ left:`${planeLeft}%` as any }]}>
          <Airplane size={14} color={LIVE.onTime} weight="fill"/>
        </View>
      </View>
      {label?<Text style={[dc.progressRemain,{ color: theme.secondary }]}>{label}</Text>:null}
    </View>
  );
}

function SeaCoverageCard({ count, iata }:{ count:number; iata:string }){
  return (
    <View style={s.seaCard}>
      <Text style={s.seaCardLbl}>SEA Coverage</Text>
      <Text style={s.seaCardVal}>{count} flights · {iata}</Text>
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
  const startIso=f.departureTime
    || (type==='departure'?f.scheduledTime:'')
    || f.scheduledTime
    || f.revisedTime;
  const endIso=f.arrivalTime
    || (type==='arrival'?f.scheduledTime:'')
    || '';
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
    throw new Error('Calendar export is available in the iOS and Android apps.');
  }
  const granted=await ensureCalendarPermission();
  if(!granted){
    throw new Error('Calendar permission is required to add this flight.');
  }
  const cal=await getWritableCalendar();
  if(!cal){
    throw new Error('No writable calendar found on this device.');
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
        accessibilityLabel="Unlock unlimited tracking with Pro"
      >
        <Lock size={large?16:13} color={BRAND.gold}/>
        <Text style={[tb.txt, large&&tb.txtLg, { color: BRAND.gold }]}>Pro</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[tb.btn, large&&tb.btnLg, on&&tb.btnOn]}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityLabel={on?'Untrack flight':'Track flight'}
      accessibilityState={{checked:on}}
    >
      {on
        ?<Check size={large?16:13} color={mode==='dark'?BRAND.deep:'#fff'}/>
        :<BellSimple size={large?16:13} color={theme.icon}/>}
      <Text style={[tb.txt, large&&tb.txtLg, on&&tb.txtOn]}>{on?'Untrack':'Track'}</Text>
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
      accessibilityLabel="Share"
    >
      <ShareNetwork size={13} color={theme.icon}/>
      <Text style={tb.txt}>Share</Text>
    </TouchableOpacity>
  );
}

const WA_GREEN = '#25D366';

function WhatsAppShareBtn({flightNumber}:{flightNumber:string}){
  const shareWhatsApp=async()=>{
    const slug=flightSlug(flightNumber);
    const text=`Track ${slug} live on WaiAir 🛩\nhttps://waiair.app/flight/${slug}`;
    const encoded=encodeURIComponent(text);
    const appUrl=`whatsapp://send?text=${encoded}`;
    const webUrl=`https://wa.me/?text=${encoded}`;
    try{
      const can=await Linking.canOpenURL(appUrl);
      if(can){
        await Linking.openURL(appUrl);
        return;
      }
    } catch{ /* fall through */ }
    try{
      await Linking.openURL(webUrl);
    } catch{ /* ignore */ }
  };
  return (
    <TouchableOpacity
      onPress={shareWhatsApp}
      style={tb.btn}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Share on WhatsApp"
    >
      <WhatsappLogo size={13} color={WA_GREEN}/>
      <Text style={[tb.txt,{color:WA_GREEN}]}>WhatsApp</Text>
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

function DetailCard({f,type,airport,tracked,onToggleTrack,onToast,isPro,onRequirePro,onOpenScanner,previousGate,boardingPass}:{
  f:Flight; type:'arrival'|'departure'; airport:Airport;
  tracked:boolean; onToggleTrack:()=>void; onToast:(msg:string)=>void;
  isPro:boolean; onRequirePro:(highlight?:string)=>void;
  onOpenScanner?:()=>void;
  previousGate?:string;
  boardingPass?:BoardingPassInfo;
}){
  const { mode, C: theme } = useTheme();
  const r=resolveRoute(f,type,airport);
  const destAp=airportByIata(r.destination);
  const originAp=airportByIata(r.origin);
  const transport=TRANSPORT_INFO[r.destination];
  const [showMore, setShowMore]=useState(false);
  const [, setTick]=useState(0);

  useEffect(()=>{
    const id=setInterval(()=>setTick(t=>t+1),30000);
    return ()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    if(!isPro) return;
    if(!previousGate || !hasRealGate(previousGate) || !hasRealGate(f.gate)) return;
    const a=String(previousGate).replace(/^gate\s+/i,'').toUpperCase();
    const b=String(f.gate).replace(/^gate\s+/i,'').toUpperCase();
    if(a===b) return;
    haptics.heavy();
  },[isPro, previousGate, f.gate]);

  const shareFlight=async()=>{
    const slug=flightSlug(f.number);
    const url=flightShareUrl(slug);
    const line=`Track ${slug} live on WaiAir`;
    try{
      if(Platform.OS==='ios'){
        await Share.share({ message:line, url });
      } else {
        await Share.share({ message:`${line}\n${url}`, url });
      }
    } catch{ /* user dismissed */ }
  };

  const depIso = (type==='departure' && f.actualTime)
    ? f.actualTime
    : anyFlightClock(f, 'departure');
  const arrIso = (type==='arrival' && f.actualTime)
    ? f.actualTime
    : anyFlightClock(f, 'arrival');
  const depSched = type==='departure' ? f.scheduledTime : '';
  const arrSched = type==='arrival' ? f.scheduledTime : '';
  const showDepSched = !!(depSched && depIso && fmt(depSched)!==fmt(depIso));
  const showArrSched = !!(arrSched && arrIso && fmt(arrSched)!==fmt(arrIso));
  const delayed = f.status==='delayed' || (f.delay>0 && !f.actualTime && f.status!=='en-route' && f.status!=='landed' && f.status!=='cancelled');
  const depColor = f.status==='cancelled' ? LIVE.cancelled : delayed ? LIVE.delayed : LIVE.onTime;
  const arrColor = f.status==='cancelled' ? LIVE.cancelled : LIVE.onTime;
  const cdDep = countdown(depIso);
  const cdArr = countdown(arrIso);
  const initials = airlineInitials(f.airlineCode, f.airline);
  const logoBg = airlineColor(f.airlineCode);
  const dateLabel = fmtDateLong(depIso || arrIso || f.scheduledTime);
  const originName = airportTitle(r.origin, r.originCity) || r.origin;
  const destName = airportTitle(r.destination, r.destCity) || r.destination;
  const fromLabel = routePlaceLabel(r.originCity, r.origin) || r.origin;
  const toLabel = routePlaceLabel(r.destCity, r.destination) || r.destination;
  const routeTitle = fromLabel && toLabel && fromLabel!==toLabel
    ? `${fromLabel} to ${toLabel}`
    : (toLabel || fromLabel);
  const originCode = r.origin;
  const destCode = r.destination && r.destination!==r.origin ? r.destination : (r.destCity && r.destCity!==r.origin ? r.destCity : '');
  const routeArrow = originCode && destCode && originCode!==destCode
    ? `${originCode}  ——→  ${destCode}`
    : '';
  const depGate = type==='departure' ? displayGate(f.gate) : '—';
  const arrGate = type==='arrival' ? displayGate(f.gate) : '—';
  const depTerm = f.depTerminal || (type==='departure' ? f.terminal : '');
  const arrTerm = f.arrTerminal || (type==='arrival' ? f.terminal : '');

  let statusText = '';
  let statusColor: string = LIVE.onTime;
  if(f.status==='cancelled'){
    statusText='Cancelled';
    statusColor=LIVE.cancelled;
  } else if(f.status==='landed'){
    statusText='Arrived';
  } else if(f.status==='en-route'){
    statusText=cdArr ? `En Route · Arrives in ${cdArr}` : 'En Route';
  } else if(f.status==='boarding'){
    statusText=boardingCountdownLabel(f) || 'Boarding now';
    statusColor=LIVE.boarding;
  } else if(delayed){
    statusText=`Delayed ${f.delay} min · New departure: ${fmt(f.revisedTime||depIso)}`;
    statusColor=LIVE.delayed;
  } else {
    statusText=cdDep ? `Gate Departure in ${cdDep}` : (cdArr ? `Arrives in ${cdArr}` : (STATUS_CFG[f.status]?.label||'Scheduled'));
  }

  const depSub = f.status==='cancelled'
    ? 'Cancelled'
    : f.actualTime && type==='departure'
      ? 'Departed'
      : delayed
        ? `${f.delay}m Delay · New: ${fmt(f.revisedTime||depIso)}`
        : (cdDep ? `On Time · Departs in ${cdDep}` : 'On Time');

  let arrSub = cdArr ? `Arrives in ${cdArr}` : (f.status==='landed' ? 'Landed' : 'Scheduled');
  if(showArrSched && arrSched && arrIso){
    const a=new Date(String(arrSched).replace(' ','T')).getTime();
    const b=new Date(String(arrIso).replace(' ','T')).getTime();
    if(Number.isFinite(a)&&Number.isFinite(b)){
      const mins=Math.round((b-a)/60000);
      if(mins<0) arrSub=`${Math.abs(mins)}m Early · ${cdArr?`Arrives in ${cdArr}`:'Arrived'}`;
      else if(mins>0) arrSub=`${mins}m Delay · ${cdArr?`Arrives in ${cdArr}`:'Scheduled'}`;
    }
  }

  return (
    <View style={[
      dc.card,
      delayed&&{borderLeftWidth:4,borderLeftColor:LIVE.delayed},
      f.status==='cancelled'&&{borderLeftWidth:4,borderLeftColor:LIVE.cancelled,opacity:0.7},
      f.status==='boarding'&&{borderLeftWidth:4,borderLeftColor:LIVE.boarding},
    ]}>
      <View style={dc.handle}/>

      <View style={dc.headRow}>
        <View style={[dc.logo, { backgroundColor: logoBg }]}>
          <Text style={dc.logoTxt}>{initials}</Text>
        </View>
        <Text style={dc.flNum} numberOfLines={1} ellipsizeMode="tail">{f.number}</Text>
        {dateLabel?<Text style={dc.dateTxt} numberOfLines={1}>· {dateLabel}</Text>:null}
      </View>
      <Text style={dc.routeTitle} numberOfLines={1} ellipsizeMode="tail">{routeTitle}</Text>

      <Text style={[dc.statusBar, { color: statusColor }]} numberOfLines={2} ellipsizeMode="tail">
        {[
          statusText,
          hasRealGate(type==='departure'?depGate:arrGate)?`Gate ${type==='departure'?depGate:arrGate}`:null,
          compactTerminal(type==='departure'?depTerm:arrTerm),
          fmt(type==='departure'?depIso:arrIso),
        ].filter(Boolean).join(' · ')}
      </Text>
      <FlightProgressLine f={f} remainIso={arrIso || depIso}/>
      {isPro && (f.altitudeFt || f.speedKts)?(
        <Text style={dc.livePos}>
          {[
            f.altitudeFt ? `${Math.round(f.altitudeFt).toLocaleString('en-US')} ft` : null,
            f.speedKts ? `${Math.round(f.speedKts)} kts` : null,
          ].filter(Boolean).join(' · ')}
        </Text>
      ):null}
      {(f.aircraft||f.aircraftReg)?(
        <Text style={dc.inbound}>{[f.aircraft, f.airline].filter(Boolean).join('  ·  ')}{f.aircraftReg?`\nRegistration: ${f.aircraftReg}`:''}</Text>
      ):null}

      {boardingPass && (boardingPass.seat || boardingPass.sequence || boardingPass.pnr)?(
        <View style={dc.passCard}>
          {boardingPass.seat?<Text style={dc.passLine}>Seat {boardingPass.seat}</Text>:null}
          {boardingPass.sequence?<Text style={dc.passLine}>Check-in sequence {boardingPass.sequence.padStart(3,'0')}</Text>:null}
          {boardingPass.pnr?<Text style={dc.passLine}>Booking reference {boardingPass.pnr}</Text>:null}
        </View>
      ):null}

      <LuxuryInfoPanel
        originIata={originCode || r.origin}
        destIata={destCode || r.destination}
        originCity={r.originCity}
        destCity={r.destCity}
        destCountry={destAp?.country || f.destCountry}
        originLat={originAp?.lat}
        originLon={originAp?.lon}
        destLat={destAp?.lat}
        destLon={destAp?.lon}
        arrivalIso={arrIso}
        status={f.status}
        baggage={f.baggage}
        terminal={arrTerm || f.terminal}
        premium={isPro}
        theme={{
          text: theme.text,
          secondary: theme.secondary,
          muted: theme.muted,
          accent: theme.accent,
          border: theme.border,
          list: theme.list,
        }}
      />

      <View style={dc.leg}>
        <View style={dc.legTop}>
          <View style={{flex:1,paddingRight:12}}>
            <Text style={dc.legIata} numberOfLines={1} ellipsizeMode="tail">●  {originCode || r.origin}  ·  {originName}  ›</Text>
            <HeroClock iso={depIso} color={depColor} />
            {showDepSched?<Text style={dc.strike} numberOfLines={1}>{fmt(depSched)}</Text>:null}
            <Text style={[dc.legSub, { color: depColor }]} numberOfLines={1} ellipsizeMode="tail">{depSub}</Text>
          </View>
          {hasRealGate(depGate)?(
            <View style={{alignItems:'center'}}>
              <GateBadge
                type="departure"
                gate={depGate}
                terminal={depTerm}
                previousGate={type==='departure'?previousGate:undefined}
                secondary={theme.secondary}
                tone={gateToneFor(f)}
              />
              {type==='departure' && previousGate && hasRealGate(previousGate) && previousGate!==depGate?(
                <Text style={dc.wasGate}>was {previousGate}</Text>
              ):null}
            </View>
          ):null}
        </View>
      </View>

      {routeArrow?(
        <View style={dc.routeArrow}>
          <Text style={dc.routeArrowTxt} numberOfLines={1}>{routeArrow}</Text>
        </View>
      ):null}

      <View style={dc.leg}>
        <View style={dc.legTop}>
          <View style={{flex:1,paddingRight:12}}>
            <Text style={dc.legIata} numberOfLines={1} ellipsizeMode="tail">●  {destCode || r.destination}  ·  {destName}  ›</Text>
            <View style={dc.heroRow}>
              <HeroClock iso={arrIso} color={arrColor} city={destName} iata={destCode||r.destination} otherIata={originCode||r.origin} />
              {showArrSched?<Text style={dc.strikeBig} numberOfLines={1}>{fmt(arrSched)}</Text>:null}
            </View>
            <Text style={[dc.legSub, { color: arrColor }]} numberOfLines={1} ellipsizeMode="tail">{arrSub}</Text>
          </View>
          {hasRealGate(arrGate)?(
            <View style={{alignItems:'center'}}>
              <GateBadge
                type="arrival"
                gate={arrGate}
                terminal={arrTerm}
                previousGate={type==='arrival'?previousGate:undefined}
                secondary={theme.secondary}
                tone={gateToneFor(f)}
              />
              {type==='arrival' && previousGate && hasRealGate(previousGate) && previousGate!==arrGate?(
                <Text style={dc.wasGate}>was {previousGate}</Text>
              ):null}
            </View>
          ):null}
        </View>
      </View>

      <View style={dc.bottomRow}>
        <TouchableOpacity
          style={dc.iconBtn}
          onPress={()=> onOpenScanner ? onOpenScanner() : onToast('Scan a boarding pass from My Flights')}
          accessibilityLabel="Scan boarding pass"
        >
          <Barcode size={18} color={theme.icon}/>
          {f.aircraftReg?<Text style={dc.regChip} numberOfLines={1}>{f.aircraftReg}</Text>:null}
        </TouchableOpacity>
        <TouchableOpacity style={dc.iconBtn} onPress={()=>setShowMore(v=>!v)} accessibilityLabel="More">
          <DotsThree size={18} color={theme.icon}/>
        </TouchableOpacity>
        <TouchableOpacity
          style={[dc.trackBtn, tracked&&dc.trackBtnOn]}
          onPress={()=>{
            onToggleTrack();
          }}
          accessibilityLabel={tracked?'Untrack flight':'Track flight'}
        >
          <BellSimple size={15} color={tracked?'#fff':theme.icon}/>
          <Text style={[dc.trackBtnTxt, tracked&&{color:'#fff'}]}>{tracked?'Untrack':'Track'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={dc.shareBtn} onPress={shareFlight} accessibilityLabel="Share">
          <ShareNetwork size={14} color="#fff"/>
          <Text style={dc.shareTxt}>Share</Text>
          <ArrowRight size={13} color="#fff"/>
        </TouchableOpacity>
      </View>
      <View style={{marginTop:10,alignItems:'flex-start'}}>
        <ShareFlightCardBtn
          flightNumber={f.number}
          origin={originCode || r.origin}
          destination={destCode || r.destination}
          status={statusText || STATUS_CFG[f.status]?.label || f.status}
          depTime={fmtLocal(depIso)}
          arrTime={fmtAtCity(arrIso, destName, destCode||r.destination, originCode||r.origin)}
          gate={displayGate(type==='departure'?depGate:arrGate)}
          terminal={compactTerminal(type==='departure'?depTerm:arrTerm)}
          shareUrl={flightShareUrl(flightSlug(f.number))}
          theme={{
            text: theme.text,
            secondary: theme.secondary,
            muted: theme.muted,
            accent: theme.accent,
            border: theme.border,
            list: theme.list,
            icon: theme.icon,
          }}
          onToast={onToast}
        />
      </View>

      {showMore?(
        <View style={dc.moreWrap}>
          <FlightStageTimeline
            flight={f}
            theme={{
              text: theme.text,
              secondary: theme.secondary,
              muted: theme.muted,
              accent: theme.accent,
              border: theme.border,
              list: theme.list,
            }}
          />
          {transport?(
            <DetailFold title={`Get into town · ${r.destination}`}>
              <View style={dc.transportOpts}>
                {transport.options.map((opt, i)=>(
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
          ):null}
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
          {[type==='departure' ? (originCode || r.origin) : '', destCode || r.destination]
            .filter((code, i, arr)=>!!code && arr.indexOf(code)===i)
            .map(code=>(
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
          {tracked?(
            <WakeUpControl
              flightKey={flightTrackKey(f)}
              flightNumber={f.number}
              landAtIso={f.arrivalTime||(type==='arrival'?(f.revisedTime||f.scheduledTime):f.arrivalTime)||''}
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
    </View>
  );
}

// ── Flight Row ─────────────────────────────────────────────────────────────────
function FlightRow({f,type,airport,active,onPress,tracked,previousGate,index=0,highlightQuery}:{
  f:Flight; type:'arrival'|'departure'; airport:Airport; active:boolean; onPress:()=>void;
  tracked?:boolean;
  previousGate?:string;
  index?:number;
  highlightQuery?:string;
}){
  const { C: theme } = useTheme();
  const delayed=f.status==='delayed' || (f.delay>0 && f.status!=='en-route' && f.status!=='landed' && f.status!=='cancelled' && !f.actualTime);
  const boarding=f.status==='boarding' || isGateClosing(f);
  const cancelled=f.status==='cancelled';
  const timeColor=cancelled?LIVE.cancelled:delayed?LIVE.delayed:f.status==='landed'?LIVE.onTime:theme.text;
  const badgeColor=cancelled?LIVE.cancelled:boarding?LIVE.boarding:delayed?LIVE.delayed:LIVE.onTime;
  const initials=airlineInitials(f.airlineCode, f.airline);
  const logoBg=airlineColor(f.airlineCode);
  const resolved=resolveRoute(f,type,airport);
  const originCode=resolved.origin;
  const destCode=resolved.destination && resolved.destination!==resolved.origin
    ? resolved.destination
    : (resolved.destCity && resolved.destCity!==resolved.originCity ? resolved.destCity : '');
  const r=originCode && destCode && originCode!==destCode
    ? `${originCode}  →  ${destCode}`
    : [originCode, destCode].filter(Boolean).join('  →  ');
  const gate=displayGate(f.gate);
  const sub=STATUS_CFG[f.status]?.label||'Scheduled';
  const pulse=useRef(new Animated.Value(0.45)).current;
  const enter=useRef(new Animated.Value(0)).current;
  const flash=useRef(new Animated.Value(0)).current;
  const shake=useRef(new Animated.Value(0)).current;
  const bleed=useRef(new Animated.Value(delayed?1:0)).current;
  const prevStatus=useRef(f.status);

  useEffect(()=>{
    Animated.timing(enter,{
      toValue:1, duration:280, delay:Math.min(index,12)*40, useNativeDriver:true,
    }).start();
  },[enter, index]);

  useEffect(()=>{
    if(!boarding) return;
    const loop=Animated.loop(
      Animated.sequence([
        Animated.timing(pulse,{toValue:1,duration:900,useNativeDriver:true}),
        Animated.timing(pulse,{toValue:0.45,duration:900,useNativeDriver:true}),
      ])
    );
    loop.start();
    return ()=>loop.stop();
  },[boarding, pulse]);
  useEffect(()=>{
    if(!boarding || cancelled) return;
    const key=flightTrackKey(f);
    if(boardingHapticKeys.has(key)) return;
    boardingHapticKeys.add(key);
    haptics.medium();
    flash.setValue(1);
    Animated.timing(flash,{toValue:0,duration:900,useNativeDriver:false}).start();
  },[boarding, cancelled, f.number, f.scheduledTime, flash]);

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
      Animated.timing(bleed,{toValue:1,duration:420,useNativeDriver:false}).start();
    }
    if(f.status==='cancelled'){
      Animated.timing(bleed,{toValue:1,duration:300,useNativeDriver:false}).start();
    }
  },[f.status, delayed, shake, bleed]);

  const showStrike=!!(f.scheduledTime && fmt(bestDisplayTime(f,type))!==fmt(f.scheduledTime) && (delayed||!!f.actualTime));
  const accent=cancelled?LIVE.cancelled:delayed?LIVE.delayed:boarding?LIVE.boarding:'transparent';
  const q=highlightQuery||'';

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [
        { translateY: enter.interpolate({ inputRange:[0,1], outputRange:[14,0] }) },
        { translateX: shake.interpolate({ inputRange:[-1,1], outputRange:[-4,4] }) },
      ],
    }}>
    <TouchableOpacity
      style={[
        fr.row,
        active&&fr.active,
        { borderLeftWidth:4, borderLeftColor:accent, overflow:'hidden' },
        boarding&&fr.rowBoard,
        delayed&&{ paddingTop:26 },
        cancelled&&{ opacity:0.6 },
      ]}
      onPress={onPress} activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${f.number}, ${r}, ${fmtLocal(bestDisplayTime(f, type))}, ${sub}`}
    >
      {delayed?(
        <Animated.View pointerEvents="none" style={{
          position:'absolute', left:0, top:0, bottom:0, width: bleed.interpolate({ inputRange:[0,1], outputRange:[0, 28] }),
          backgroundColor:'rgba(255,179,0,0.22)',
        }}/>
      ):null}
      {cancelled?(
        <View pointerEvents="none" style={[fr.stampWrap,{ backgroundColor:'rgba(211,47,47,0.12)' }]}>
          <Text style={fr.stamp}>CANCELLED</Text>
        </View>
      ):null}
      {boarding?(
        <Animated.View pointerEvents="none" style={{
          ...StyleSheet.absoluteFill,
          borderWidth:2, borderColor:LIVE.boarding, borderRadius:16, opacity: flash,
        }}/>
      ):null}
      {delayed && f.delay>0?(
        <View style={fr.delayChip}>
          <Text style={fr.delayChipTxt}>⚠ {f.delay} min delay</Text>
        </View>
      ):null}
      <View style={[fr.logo,{backgroundColor:logoBg}]}>
        <Text style={fr.logoTxt}>{initials}</Text>
      </View>
      <View style={fr.mid}>
        <View style={fr.numRow}>
          <HighlightText text={f.number} query={q} color={theme.text} highlightColor={theme.accent} style={fr.num} numberOfLines={1}/>
          {tracked ? <BellSimple size={12} color={theme.accent}/> : null}
          {boarding?(
            <Animated.View style={[fr.liveDot,{ opacity: pulse }]}/>
          ):null}
        </View>
        <HighlightText text={r || '—'} query={q} color={theme.secondary} highlightColor={theme.accent} style={fr.route} numberOfLines={1}/>
        <View style={fr.subRow}>
          <Animated.View style={[
            fr.badge,
            { backgroundColor: badgeColor+'22', borderColor: badgeColor+'66', opacity: boarding?pulse:1 },
          ]}>
            <Text style={[fr.badgeTxt,{color:badgeColor}]} numberOfLines={1}>{sub}</Text>
          </Animated.View>
        </View>
      </View>
      <View style={fr.right}>
        {showStrike?<Text style={fr.old} numberOfLines={1}>{fmt(f.scheduledTime)}</Text>:null}
        <Text
          style={[fr.time,{color:timeColor}]}
          numberOfLines={1}
          ellipsizeMode="clip"
          allowFontScaling={false}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >{fmt(bestDisplayTime(f, type) || f.revisedTime || f.scheduledTime || f.departureTime || f.arrivalTime)}</Text>
        <Text style={fr.localLbl} numberOfLines={1} allowFontScaling={false}>local</Text>
        {hasRealGate(gate)?(
          <View style={{marginTop:6}}>
            <GateBadge
              type={type}
              gate={gate}
              terminal={f.terminal}
              previousGate={previousGate}
              secondary={theme.secondary}
              tone={gateToneFor(f)}
              compact
            />
          </View>
        ):null}
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

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
      setLocalErr('Enter a valid flight number, e.g. TG202');
      return;
    }
    setLocalErr('');
    onSubmit(clean);
  };

  return (
    <View style={s.addPanel}>
      <Text style={s.addTitle}>Scan boarding pass</Text>
      <Text style={s.addSub}>Point the camera at the barcode, or type the flight number</Text>

      {Platform.OS!=='web'?(
        <TouchableOpacity
          style={s.scanBtn}
          onPress={onOpenScanner}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Scan boarding pass barcode"
        >
          <Barcode size={18} color="#fff"/>
          <Text style={s.scanBtnTxt}>Scan boarding pass</Text>
        </TouchableOpacity>
      ):null}

      <View style={s.addInputRow}>
        <TextInput
          style={s.addInput}
          value={value}
          onChangeText={t=>{ setValue(t.toUpperCase()); setLocalErr(''); }}
          placeholder="Enter flight number (e.g. TG202)"
          placeholderTextColor={theme.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!busy}
          accessibilityLabel="Flight number"
        />
        <TouchableOpacity
          style={[s.addBtn, busy&&{opacity:0.65}]}
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Add flight to tracking"
        >
          {busy
            ?<ActivityIndicator color="#fff" size="small"/>
            :<Text style={s.addBtnTxt}>Add</Text>}
        </TouchableOpacity>
      </View>
      {localErr?<Text style={s.addErr}>{localErr}</Text>:null}
    </View>
  );
}

function MyFlightsTimeline({
  flights, selectedId, onSelect, onUntrack, connections,
}:{
  flights:Flight[];
  selectedId:string;
  onSelect:(f:Flight)=>void;
  onUntrack:(f:Flight)=>void;
  connections:TightConnection[];
}){
  const { C: theme } = useTheme();
  const [, setTick]=useState(0);
  useEffect(()=>{
    const id=setInterval(()=>setTick(t=>t+1),1000);
    return ()=>clearInterval(id);
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
        <BellSimple size={28} color={theme.muted}/>
        <Text style={s.myEmptyTitle}>No tracked flights</Text>
        <Text style={s.myEmptySub}>
          Scan a boarding pass or enter a flight number below to start tracking.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.myWrap}>
      <View style={s.secHead}>
        <View style={s.secLabelRow}>
          <BellSimple size={14} color={theme.accent}/>
          <Text style={[s.secLabel,{color:theme.accent}]}>Timeline</Text>
        </View>
        <Text style={[s.secCount,{color:theme.text,backgroundColor:theme.accentDim}]}>{sorted.length}</Text>
      </View>
      {sorted.map((f,i)=>{
        const cfg=STATUS_CFG[f.status]??STATUS_CFG.unknown;
        const label=boardingCountdownLabel(f);
        const phase=getBoardingPhase(f);
        const active=selectedId===f.id;
        const o=usableAirportCode(f.origin)||f.originCity;
        const d=usableAirportCode(f.destination)||f.destCity;
        const route=o && d && o!==d ? `${o} → ${d}` : [o,d].filter(Boolean).join(' → ');
        const conn=connAfter.get(flightTrackKey(f));
        const critical=conn?conn.gapMin<30:false;
        return (
          <Fragment key={flightTrackKey(f)}>
            <View style={s.myRowWrap}>
              <View style={s.myRail}>
                <View style={[s.myDot,{backgroundColor:cfg.color}]}/>
                {i<sorted.length-1||conn?<View style={s.myLine}/>:null}
              </View>
              <TouchableOpacity
                style={[s.myCard, active&&s.myCardOn]}
                onPress={()=>onSelect(f)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${f.number}, open flight details`}
              >
                <View style={s.myCardTop}>
                  <Text style={s.myNum} numberOfLines={1}>{f.number}</Text>
                  <View style={[s.myPill,{borderColor:cfg.color+'60',backgroundColor:cfg.color+'18'}]}>
                    <Text style={[s.myPillTxt,{color:cfg.color}]}>{cfg.label}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={()=>onUntrack(f)}
                    hitSlop={10}
                    style={s.myTrash}
                    accessibilityRole="button"
                    accessibilityLabel={`Untrack ${f.number}`}
                  >
                    <Trash size={16} color={theme.muted}/>
                  </TouchableOpacity>
                </View>
                <Text style={s.myRoute} numberOfLines={1} ellipsizeMode="tail">{route}</Text>
                <Text style={s.myAirline} numberOfLines={1}>{f.airline}</Text>
                {f.baggage?(
                  <View style={s.myBagRow}>
                    <Briefcase size={13} color={theme.icon}/>
                    <Text style={s.myBagTxt}>Belt {f.baggage}</Text>
                  </View>
                ):null}
                <Text style={[s.myCd,{
                  color:phase==='boarding'?'#22c55e':phase==='departed'?'#94a3b8':theme.accent,
                }]} numberOfLines={1} ellipsizeMode="tail">
                  {label||fmt(anyFlightClock(f, 'departure') || f.revisedTime || f.scheduledTime)}
                </Text>
              </TouchableOpacity>
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
                        ?`Critical connection — only ${Math.round(conn.gapMin)} min`
                        :`Tight connection — only ${Math.round(conn.gapMin)} min`}
                    </Text>
                    <Text style={s.connCardSub}>
                      {flightSlug(conn.incoming.number)} → {flightSlug(conn.outgoing.number)} · {conn.hub}
                    </Text>
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
  const { mode, C: theme } = useTheme();
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
    setInn(defaultIncoming.trim().toUpperCase());
    loadLastConnectionResult<ConnResult>().then(last=>{
      if(last?.verdict){
        setResult(last);
        if(last.hub) setHub(last.hub);
      }
    }).catch(()=>{});
    canCheckConnection(!!isPro || BETA_MODE).then(q=>setQuotaUsed(q.used)).catch(()=>{});
  },[visible, defaultHub, defaultIncoming, isPro]);

  const isDigitsOnlyFlight=(v:string)=>/^\d+$/.test(v.trim());

  const run=async()=>{
    const a=inn.trim(), b=out.trim();
    if(!a||!b){ setErr('Enter both flight numbers'); return; }
    if(isDigitsOnlyFlight(a) || isDigitsOnlyFlight(b)){
      setErr('Please include airline code, e.g. PR404');
      return;
    }
    const quota=await canCheckConnection(!!isPro || BETA_MODE);
    if(!quota.ok){
      setQuotaUsed(quota.used);
      setErr(`Free plan: ${FREE_CONN_PER_DAY} checks per day. Your last result stays visible.`);
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
      setErr(e?.message||'Could not check connection');
    } finally {
      setBusy(false);
    }
  };

  const v=result?VERDICT_UI[result.verdict]:null;
  const hubAp=airportByIata(hub);
  const verdictBg=v?(mode==='light'?v.bgLight:v.bg):undefined;
  const verdictBorder=v?(mode==='light'?v.borderLight:v.border):undefined;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cx.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={cx.sheetWrap}>
          <View style={cx.sheet}>
            <View style={cx.handle}/>
            <View style={cx.head}>
              <View>
                <Text style={cx.title}>Will I make my connection?</Text>
                <Text style={cx.sub}>Check layover time between two flights</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={cx.close} hitSlop={10}>
                <Text style={cx.closeTxt}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={cx.label}>INCOMING FLIGHT</Text>
              <TextInput
                style={cx.input}
                value={inn}
                onChangeText={setInn}
                placeholder="e.g. TG937"
                placeholderTextColor={theme.muted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {isDigitsOnlyFlight(inn)?(
                <Text style={cx.inlineHint}>Please include airline code, e.g. PR404</Text>
              ):null}

              <Text style={cx.label}>CONNECTING FLIGHT</Text>
              <TextInput
                style={cx.input}
                value={out}
                onChangeText={setOut}
                placeholder="e.g. TG205"
                placeholderTextColor={theme.muted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {isDigitsOnlyFlight(out)?(
                <Text style={cx.inlineHint}>Please include airline code, e.g. PR404</Text>
              ):null}

              <Text style={cx.label}>CONNECTION AIRPORT</Text>
              <TextInput
                style={cx.input}
                value={hub}
                onChangeText={t=>setHub(t.toUpperCase())}
                placeholder="Auto-detected from flights"
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
                  :<Text style={cx.ctaTxt}>Check Connection</Text>}
              </TouchableOpacity>
              {!isPro && !BETA_MODE?(
                <Text style={cx.hint}>
                  {quotaUsed} of {FREE_CONN_PER_DAY} checks today
                </Text>
              ):null}

              {err?(
                <View style={cx.errRow}>
                  <Warning size={14} color={themeMode==='light'?'#b91c1c':'#fca5a5'}/>
                  <View style={{flex:1}}>
                    <Text style={cx.err}>{err}</Text>
                    {!isPro && !BETA_MODE && quotaUsed>=FREE_CONN_PER_DAY?(
                      <TouchableOpacity onPress={()=>onRequirePro?.()} hitSlop={8} style={{marginTop:6}}>
                        <Text style={{color:theme.accent,fontWeight:'800',fontSize:13}}>Upgrade for unlimited →</Text>
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
                      <Text style={cx.metaLbl}>CONNECTION</Text>
                      <Text style={cx.metaVal}>
                        {Number.isFinite(result.gapMin)?fmtDuration(result.gapMin):'—'}
                      </Text>
                    </View>
                    <View style={cx.metaBox}>
                      <Text style={cx.metaLbl}>WALK</Text>
                      <Text style={cx.metaVal}>{result.walk??result.mct}m</Text>
                      <Text style={cx.metaSub}>Gate to gate</Text>
                    </View>
                    <View style={cx.metaBox}>
                      <Text style={cx.metaLbl}>TERMINAL</Text>
                      <Text style={cx.metaVal}>
                        {result.sameTerminal===null?'—'
                          :result.sameTerminal?'Same':'Change'}
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
                    <Text style={cx.legTitle}>Incoming · {result.incoming.number}</Text>
                    <Text style={cx.legLine}>
                      {result.incoming.origin} → {result.incoming.destination}
                      {' · '}{STATUS_CFG[result.incoming.status]?.label}
                      {result.incoming.delay>0?` · +${result.incoming.delay}m`:''}
                    </Text>
                    <Text style={cx.legTime}>
                      Arrives {fmt(result.incoming.arrivalTime||result.incoming.revisedTime)}
                      {result.incoming.status==='delayed'?' (delayed)':''}
                    </Text>
                  </View>

                  <View style={cx.leg}>
                    <Text style={cx.legTitle}>Connecting · {result.outgoing.number}</Text>
                    <Text style={cx.legLine}>
                      {result.outgoing.origin} → {result.outgoing.destination}
                      {' · '}{STATUS_CFG[result.outgoing.status]?.label}
                      {result.outgoing.delay>0?` · +${result.outgoing.delay}m`:''}
                    </Text>
                    <Text style={cx.legTime}>
                      Departs {fmt(result.outgoing.departureTime||result.outgoing.revisedTime)}
                    </Text>
                  </View>

                  <TouchableOpacity style={cx.refresh} onPress={run} disabled={busy}>
                    <Text style={cx.refreshTxt}>↻  Recalculate with latest times</Text>
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
  { iata:'BKK', lat:13.69, lon:100.75, z:9 },
  { iata:'HKT', lat:8.11,  lon:98.31,  z:9 },
  { iata:'SIN', lat:1.36,  lon:103.99, z:9 },
  { iata:'KUL', lat:2.75,  lon:101.71, z:9 },
  { iata:'DPS', lat:-8.75, lon:115.17, z:9 },
  { iata:'CNX', lat:18.77, lon:98.96,  z:9 },
];

function pickRadarFlight(hits:Flight[]):Flight|null{
  if(!hits.length) return null;
  return hits.find(f=>f.status==='en-route')
    || hits.find(f=>f.status==='boarding')
    || hits[0];
}

function parseRadarPlaneMessage(raw:string):RadarPick|null{
  try{
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!data || data.type!=='planeSelect') return null;
    const callsign=String(data.callsign||'').trim();
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
  visible, onClose, airport, isTracked, onToggleTrack,
}:{
  visible:boolean;
  onClose:()=>void;
  airport:Airport;
  isTracked:(f:Flight)=>boolean;
  onToggleTrack:(f:Flight)=>void;
}){
  const { C: theme } = useTheme();
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sheetH = Math.round(Dimensions.get('window').height * 0.9);
  const translateY = useRef(new Animated.Value(sheetH)).current;
  const closing = useRef(false);
  const lastAircraft = useRef<RadarAircraft[]>([]);
  const mapReady = useRef(false);

  const [pick, setPick] = useState<RadarPick|null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flightBusy, setFlightBusy] = useState(false);
  const [flightErr, setFlightErr] = useState('');
  const [radarFlight, setRadarFlight] = useState<Flight|null>(null);
  const [radarCount, setRadarCount] = useState(0);
  const [radarCached, setRadarCached] = useState(false);
  const [radarClock, setRadarClock] = useState('--:--:--');
  const [nextIn, setNextIn] = useState(15);
  const [radarBusy, setRadarBusy] = useState(false);
  const [jumpCounts, setJumpCounts] = useState<Record<string, number>>({});

  const html = useMemo(
    ()=>buildRadarHTML(airport.lat, airport.lon, 7, 'dark', PROXY),
    [airport.iata]
  );

  const pushAircraft = useCallback((list:RadarAircraft[], meta?:{ cached?:boolean })=>{
    lastAircraft.current = list;
    const payload = JSON.stringify(list);
    const metaJson = JSON.stringify({ cached: !!meta?.cached });
    if(Platform.OS==='web'){
      const win = iframeRef.current?.contentWindow as (Window & { applyRadarAircraft?:(s:RadarAircraft[], m?:any)=>void })|null;
      win?.applyRadarAircraft?.(list, { cached: !!meta?.cached });
      return;
    }
    webRef.current?.injectJavaScript(
      `window.applyRadarAircraft && window.applyRadarAircraft(${payload}, ${metaJson}); true;`
    );
  },[]);

  useEffect(()=>{
    if(!visible){
      setSheetOpen(false);
      setPick(null);
      setRadarFlight(null);
      setFlightErr('');
    }
  },[visible]);

  const openPlaneSheet = useCallback((next:RadarPick)=>{
    setPick(next);
    setSheetOpen(true);
    setFlightBusy(true);
    setFlightErr('');
    setRadarFlight(null);
    const clean=next.callsign.replace(/\s+/g,'').toUpperCase();
    fetchFlightByNumber(clean)
      .then(hits=>{
        const f=pickRadarFlight(hits);
        if(!f) setFlightErr(`Could not find flight ${clean}`);
        else setRadarFlight(f);
      })
      .catch((e:any)=>{
        setFlightErr(e?.message || `Could not find flight ${clean}`);
      })
      .finally(()=>setFlightBusy(false));
  },[]);

  useEffect(()=>{
    if(!visible || Platform.OS!=='web') return;
    const onMsg=(ev:MessageEvent)=>{
      const data=typeof ev.data==='string'?ev.data:null;
      if(!data || !data.includes('planeSelect')) return;
      const parsed=parseRadarPlaneMessage(data);
      if(parsed) openPlaneSheet(parsed);
    };
    window.addEventListener('message', onMsg);
    return ()=>window.removeEventListener('message', onMsg);
  },[visible, openPlaneSheet]);

  const onWebViewMessage = useCallback((ev:{ nativeEvent:{ data:string } })=>{
    const parsed=parseRadarPlaneMessage(ev.nativeEvent.data);
    if(parsed) openPlaneSheet(parsed);
  },[openPlaneSheet]);

  const onMapReady = useCallback(()=>{
    mapReady.current = true;
    if(lastAircraft.current.length) pushAircraft(lastAircraft.current, { cached: radarCached });
  },[pushAircraft, radarCached]);

  const loadRadar = useCallback(async()=>{
    setRadarBusy(true);
    try{
      const snap = await fetchRadarSnapshot(airport.lat, airport.lon);
      const counts: Record<string, number> = {};
      for(const j of RADAR_JUMPS) counts[j.iata] = countNear(snap.aircraft, j.lat, j.lon);
      setJumpCounts(counts);
      setRadarCount(snap.aircraft.length);
      setRadarCached(snap.cached);
      setRadarClock(new Date().toLocaleTimeString('en-GB', { hour12: false }));
      setNextIn(15);
      pushAircraft(snap.aircraft, { cached: snap.cached });
    } catch{
      if(lastAircraft.current.length){
        setRadarCached(true);
        pushAircraft(lastAircraft.current, { cached: true });
      }
    } finally {
      setRadarBusy(false);
    }
  },[airport.lat, airport.lon, pushAircraft]);

  useEffect(()=>{
    if(!visible){
      mapReady.current = false;
      return;
    }
    loadRadar();
    const poll = setInterval(()=>{ loadRadar(); }, 15000);
    const tick = setInterval(()=>setNextIn(n=>Math.max(0, n-1)), 1000);
    return ()=>{
      clearInterval(poll);
      clearInterval(tick);
    };
  },[visible, loadRadar]);

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
                    ✈️ {radarCount} aircraft · SEA · {radarCached ? 'CACHED' : 'Live'} {radarClock}
                  </Text>
                </View>
                <Text style={rd.sub}>
                  {radarBusy ? 'Updating…' : `Next update in ${nextIn}s`} · tap a plane
                </Text>
              </View>
              <TouchableOpacity
                onPress={()=>loadRadar()}
                style={rd.close}
                hitSlop={10}
                accessibilityLabel="Refresh radar"
              >
                {radarBusy
                  ? <ActivityIndicator size="small" color={theme.accent}/>
                  : <ArrowsClockwise size={16} color={theme.secondary}/>}
              </TouchableOpacity>
              <TouchableOpacity onPress={dismiss} style={[rd.close,{marginLeft:6}]} hitSlop={10} accessibilityLabel="Close radar">
                <Text style={rd.closeTxt}>×</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={rd.map}>
            {Platform.OS==='web'?(
              <iframe
                ref={iframeRef}
                srcDoc={html}
                style={{ width:'100%', height:'100%', border:'none', display:'block' }}
                title="WaiAir Radar"
                onLoad={onMapReady}
              />
            ):(
              <WebView
                ref={webRef}
                originWhitelist={['*']}
                source={{ html }}
                style={{ flex:1, backgroundColor:theme.bg }}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                setSupportMultipleWindows={false}
                mixedContentMode="always"
                onShouldStartLoadWithRequest={()=>true}
                onLoadEnd={onMapReady}
                onMessage={onWebViewMessage}
              />
            )}
          </View>

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

      <RadarFlightSheet
        visible={sheetOpen}
        pick={pick}
        onClose={()=>setSheetOpen(false)}
        theme={theme}
        busy={flightBusy}
        err={flightErr}
        flight={radarFlight}
        tracked={radarFlight ? isTracked(radarFlight) : false}
        onToggleTrack={()=>{ if(radarFlight) onToggleTrack(radarFlight); }}
      />
    </Modal>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App(){
  const [mode, setMode] = useState<ThemeMode>('light');
  const [themeReady, setThemeReady] = useState(false);
  const modeRef = useRef<ThemeMode>('light');
  modeRef.current = mode;

  useEffect(()=>{
    (async()=>{
      try{
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if(saved==='light'||saved==='dark'){
          applyTheme(saved);
          setMode(saved);
          modeRef.current = saved;
        } else {
          applyTheme('light');
        }
      } catch{
        applyTheme('light');
      }
      setThemeReady(true);
    })();
  },[]);

  const toggleTheme = useCallback(async()=>{
    const isDark = modeRef.current==='dark';
    const newTheme:ThemeMode = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    modeRef.current = newTheme;
    setMode(newTheme);
    try{
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch{ /* ignore */ }
  },[]);

  // Notification listeners only at app startup (with cleanup) — never re-bind on re-renders
  useEffect(()=>{
    if(Platform.OS==='web') return;
    const received = Notifications.addNotificationReceivedListener(()=>{
      haptics.success();
    });
    const response = Notifications.addNotificationResponseReceivedListener(()=>{ /* tap opens app; deep-link handled elsewhere */ });
    return ()=>{
      received.remove();
      response.remove();
    };
  },[]);

  const themeValue = useMemo(()=>({
    mode, C: THEMES[mode], toggle: toggleTheme,
  }),[mode, toggleTheme]);

  if(!themeReady){
    return <View style={{flex:1,backgroundColor:THEMES.light.bg}}/>;
  }

  return (
    <ThemeCtx.Provider value={themeValue}>
      <IconContext.Provider value={{ weight: 'light' }}>
        <AppBody/>
      </IconContext.Provider>
    </ThemeCtx.Provider>
  );
}

function AppBody(){
  const { mode, toggle, C: theme } = useTheme();
  const [airport,    setAirport]    = useState(FALLBACK_AIRPORT);
  const [locReady,   setLocReady]   = useState(false);
  const [tab,        setTab]        = useState<AppTab>('arrival');
  const [showRadar,  setShowRadar]  = useState(false);
  const [flights,    setFlights]    = useState<Flight[]>([]);
  const [selected,   setSelected]   = useState<Flight>(DEMO[0]);
  const [search, setSearch] = useState('');
  const [searchPh, setSearchPh] = useState(SEARCH_PLACEHOLDERS[0]);
  const [globalHits, setGlobalHits] = useState<Flight[]|null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<Airport[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [nearMeBusy, setNearMeBusy] = useState(false);
  const [nearMeResults, setNearMeResults] = useState<Airport[]>([]);
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
  const [clockNow, setClockNow] = useState(()=>new Date());
  const [prefs, setPrefsState] = useState<AppPrefs>(()=>getPrefs());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentAirports, setRecentAirports] = useState<Airport[]>([]);
  const [refreshHint, setRefreshHint] = useState('');
  const [tabBarW, setTabBarW] = useState(0);
  const [lastUpd,    setLastUpd]    = useState('');
  const [tracked,    setTracked]    = useState<TrackedFlight[]>([]);
  const [toast,      setToast]      = useState<string|null>(null);
  const [notifyBanner, setNotifyBanner] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [boardDay, setBoardDay] = useState(()=>localDateKey(new Date(), timezoneForIata(FALLBACK_AIRPORT.iata)));
  const [isPro, setIsPro] = useState(BETA_MODE);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallHighlight, setPaywallHighlight] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [airport2, setAirport2] = useState<Airport|null>(null);
  const [flights2, setFlights2] = useState<Flight[]>([]);
  const [pickerSlot, setPickerSlot] = useState<'primary'|'secondary'>('primary');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [landedWelcome, setLandedWelcome] = useState<LandedWelcome|null>(null);
  const loadSeq = useRef(0);
  const lastBoardDayRef = useRef('');
  const tabSlide = useRef(new Animated.Value(0)).current;
  const tabBounce = useRef([0,1,2,3].map(()=>new Animated.Value(1))).current;
  const livePulseAnim = useRef(new Animated.Value(1)).current;
  const trackedBadgeAnim = useRef(new Animated.Value(1)).current;
  const timer = useRef<any>(null);
  const trackTimer = useRef<any>(null);
  const searchTimer = useRef<any>(null);
  const searchSaveTimer = useRef<any>(null);
  const pickerTimer = useRef<any>(null);
  const pickerSeq = useRef(0);
  const searchSeq = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const trackedRef = useRef<TrackedFlight[]>([]);
  const isProRef = useRef(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastRun = useRef<Animated.CompositeAnimation|null>(null);

  useEffect(()=>{ trackedRef.current=tracked; },[tracked]);
  useEffect(()=>{ isProRef.current=isPro; setProOverride(BETA_MODE || isPro); },[isPro]);
  useEffect(()=>subscribePrefs(()=>setPrefsState({ ...getPrefs() })),[]);

  useEffect(()=>{
    const id=setInterval(()=>setClockNow(new Date()),1000);
    return ()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    Keyboard.dismiss();
  },[]);

  useEffect(()=>{
    if(search.trim()) return;
    let i=0;
    const id=setInterval(()=>{
      i=(i+1)%SEARCH_PLACEHOLDERS.length;
      setSearchPh(SEARCH_PLACEHOLDERS[i]);
    },3000);
    return ()=>clearInterval(id);
  },[search]);

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
    const id=setTimeout(()=>setLoadTimedOut(true),10000);
    return ()=>clearTimeout(id);
  },[loading]);

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
      showToast('Free plan includes 3 flights');
      return;
    }
    if(await shouldShowUpgradePrompt()){
      setShowUpgradePrompt(true);
      return;
    }
    showToast('Free plan includes 3 flights');
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
        const day=localDateKey(new Date(), timezoneForIata(iata));
        const s=sortFlights(cached.flights.filter(f=>shouldShowOnBoard(f, day, 'arrival')), 'arrival');
        if(s.length){
          setFlights(s);
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
  useEffect(()=>{
    if(Platform.OS==='web') return;
    const onChange=async(next:AppStateStatus)=>{
      if(next!=='active') return;
      const status=await getNotifyPermissionStatus();
      if(status==='granted'){
        setNotifyBanner(false);
        registerExpoPushToken().catch(()=>{});
      } else if(status==='denied'){
        setNotifyBanner(true);
      }
    };
    const sub=AppState.addEventListener('change', onChange);
    return ()=>sub.remove();
  },[]);

  // Auto-select nearest airport from device location (unless user pinned a default)
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const nearest=await detectNearestAirport();
      if(cancelled) return;
      const pinned=getPrefs().defaultAirport;
      setAirport(pinned?.iata ? pinned as Airport : nearest);
      setLocReady(true);
    })();
    return ()=>{ cancelled=true; };
  },[]);

  // Airport picker search (300ms debounce)
  useEffect(()=>{
    if(!showPicker) return;
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
  },[pickerQuery, showPicker]);

  const applyLiveUpdates=useCallback(async(lives:Flight[])=>{
    if(!lives.length || !trackedRef.current.length) return;
    let dirty=false;
    const updated:TrackedFlight[]=[];
    for(const t of trackedRef.current){
      const live=matchTrackedHit(t, lives);
      if(!live){ updated.push(t); continue; }
      const { next, events }=diffTracked(t, live);
      if(t.lastStatus!=='landed' && next.lastStatus==='landed'){
        const dest=live.destination||'';
        const destAp=airportByIata(dest);
        const city=live.destCity||destAp?.city||dest;
        const local=localTimeSnapshot(dest, destAp?.country||live.destCountry);
        Promise.all([
          destAp?fetchWeatherSnapshot(destAp.lat, destAp.lon, city, live.arrivalTime||live.actualTime):Promise.resolve(null),
          fetchFxSnapshot(destAp?.country||live.destCountry),
        ]).then(([wx, fx])=>{
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
        }).catch(()=>{});
        if(isProRef.current){
          await saveLandedToHistory({
            flightNumber:next.flightNumber,
            route:`${live.origin||'—'} → ${live.destination||'—'}`,
            scheduledTime:live.scheduledTime||'',
            actualTime:live.actualTime||live.revisedTime||'',
            delay:live.delay||0,
            gate:live.gate||'',
            landedAt:live.actualTime||live.revisedTime||new Date().toISOString(),
          });
          setHistoryRefresh(x=>x+1);
        }
      }
      if(events.length){
        const bump=events.some(e=>e.kind==='gate'||e.kind==='boarding'||e.kind==='delay');
        if(bump) haptics.medium();
        for(const event of events){
          if(event.smart && !isProRef.current) continue;
          await notifyFlight(next.flightNumber, event);
        }
        if(events.some(e=>e.kind==='boarding')){
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
        next.notifiedBaggageClaim!==t.notifiedBaggageClaim ||
        next.flight.id!==t.flight.id
      ){
        dirty=true;
      }
      updated.push(next);
    }
    if(!dirty) return;
    const dedup=[...new Map(updated.map(t=>[t.key,t])).values()];
    setTracked(dedup);
    await saveTracked(dedup);
    await syncAlertBadge(dedup);
    await syncAllLiveActivities(dedup.map(t=>({key:t.key, flight:t.flight})));
    syncHomeScreenWidget(dedup).catch(()=>{});
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
    await syncHomeScreenWidget(trackedRef.current);
  },[applyLiveUpdates]);

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
    if(!tracked.length || !trackPollMs) return;
    pollTracked();
    trackTimer.current=setInterval(()=>{ pollTracked(); }, trackPollMs);
    return ()=>clearInterval(trackTimer.current);
  },[tracked.length, pollTracked, trackPollMs]);

  const flightTab: FidsTab = tab==='departure' ? 'departure' : 'arrival';

  const toggleTrack=useCallback(async(f:Flight)=>{
    haptics.medium();
    const key=flightTrackKey(f);
    const exists=trackedRef.current.find(t=>sameTrackedFlight(t, f));
    if(exists){
      const next=trackedRef.current.filter(t=>!sameTrackedFlight(t, f));
      setTracked(next);
      await saveTracked(next);
      await syncAlertBadge(next);
      await endLiveActivity(exists.key, toFlightActivityProps(f));
      syncHomeScreenWidget(next).catch(()=>{});
      showToast('Tracking gestopt');
      const journeyComplete=exists.lastStatus==='landed'||exists.flight?.status==='landed';
      const boardingActive=next.some(t=>t.lastStatus==='boarding'||t.flight?.status==='boarding');
      if(journeyComplete) maybeRequestReview({ reason:'untrack', boardingActive }).catch(()=>{});
      return;
    }
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
    syncHomeScreenWidget(next).catch(()=>{});
    showToast(`${f.number} wordt gevolgd`);
    maybeRequestReview({
      reason:'second_track',
      trackedCount: next.length,
      boardingActive: next.some(t=>t.lastStatus==='boarding'||t.flight?.status==='boarding'),
    }).catch(()=>{});
  },[airport.iata,tab,showToast,offerTrackUpgrade]);

  const addTrackByNumber=useCallback(async(flightNumber:string, dateIso?:string, pass?:BoardingPassInfo)=>{
    const clean=normalizeFlightNumberInput(flightNumber);
    if(!clean){
      showToast('Enter a valid flight number, e.g. TG202');
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
        }
        if(existing) setSelected(existing.flight);
        setTab('myflights');
        showToast(`${clean} added — tracking now`);
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
      syncHomeScreenWidget(next).catch(()=>{});
      setSelected(flight);
      setTab('myflights');
      applyLiveUpdates([flight]);
      showToast(`${clean} added — tracking now`);
      maybeRequestReview({
        reason:'second_track',
        trackedCount: next.length,
        boardingActive: next.some(t=>t.lastStatus==='boarding'||t.flight?.status==='boarding'),
      }).catch(()=>{});
    } catch(e:any){
      showToast(e?.message || `Could not add ${clean}`);
    } finally {
      setAddBusy(false);
    }
  },[airport.iata, showToast, applyLiveUpdates, offerTrackUpgrade]);

  const onBoardingPassParsed=useCallback((result:BoardingPassInfo)=>{
    setShowScanner(false);
    setTab('myflights');
    addTrackByNumber(result.flightNumber, result.dateIso, result).catch(()=>{});
  },[addTrackByNumber]);

  const isTracked=(f:Flight)=>tracked.some(t=>sameTrackedFlight(t, f));

  const selectFlight=useCallback((f:Flight)=>{
    setSelected(f);
    scrollRef.current?.scrollTo({ y:0, animated:true });
  },[]);

  const load=useCallback(async(iata:string,type:'arrival'|'departure',silent=false)=>{
    const seq=++loadSeq.current;
    const tz=timezoneForIata(iata);
    const day=localDateKey(new Date(), tz);
    const paint=(list:Flight[], live:boolean, cacheTs:number|null)=>{
      const filtered=list.filter(f=>shouldShowOnBoard(f, day, type));
      const s=sortFlights(filtered.length?filtered:list.filter(f=>shouldShowOnBoard(f, day, type)), type);
      setFlights(s);
      setIsLive(live && !isLiveStale(cacheTs || Date.now()));
      setOfflineCacheAt(live?null:cacheTs);
      setSelected(prev=>{
        const hit=s.find(f=>f.id===prev.id);
        return hit??s[0]??prev;
      });
      if(live) applyLiveUpdates(s);
    };

    // Cache-first: paint immediately, no spinner flicker
    const cached=await loadFidsCache(iata, type, { allowStale:true });
    if(seq!==loadSeq.current) return;
    if(cached?.flights?.length){
      paint(cached.flights, Date.now()-cached.ts < FIDS_CACHE_TTL_MS, cached.ts);
      setLastFetchAt(cached.ts);
      setLoading(false);
    } else if(!silent){
      setLoading(true);
    }
    setError('');
    setBoardUpdating(true);

    try{
      const result=await fetchFIDS(iata,type);
      const data=result.flights;
      if(seq!==loadSeq.current) return;
      if(data.length>0){
        const live=result.source==='live';
        paint(data, live, live?Date.now():(cached?.ts||Date.now()));
        setLastFetchAt(Date.now());
        setLivePulse(n=>n+1);
        setIsLive(live);
        setOfflineCacheAt(live?null:(cached?.ts||Date.now()));
        if(live && getPrefs().offlineEnabled) saveFidsCache(iata, type, data).catch(()=>{});
      } else if(!cached?.flights?.length){
        setError('No flights in API response');
        setIsLive(false);
      }
    } catch{
      if(seq!==loadSeq.current) return;
      if(cached?.flights?.length){
        setOfflineCacheAt(cached.ts);
        setIsLive(false);
      } else {
        setError(t().loadTimeout);
        setIsLive(false);
      }
    } finally {
      if(seq===loadSeq.current){
        setLoading(false);
        setRefreshing(false);
        setLoadTimedOut(false);
        setBoardUpdating(false);
      }
    }
  },[applyLiveUpdates]);

  useEffect(()=>{
    if(!locReady) return;
    if(tab==='myflights') return;
    setSearch('');
    setGlobalHits(null);
    load(airport.iata, tab==='departure' ? 'departure' : 'arrival');
  },[airport.iata,tab,locReady,load]);

  const fidsMs=useMemo(()=>{
    const user=prefs.refreshIntervalMs || 60*1000;
    return Math.max(60*1000, user);
  },[prefs.refreshIntervalMs]);

  useEffect(()=>{
    if(!locReady) return;
    if(tab==='myflights') return;
    timer.current=setInterval(
      ()=>load(airport.iata, tab==='departure' ? 'departure' : 'arrival', true),
      fidsMs,
    );
    return ()=>clearInterval(timer.current);
  },[airport.iata,tab,locReady,load,fidsMs]);

  useEffect(()=>{
    const tz=timezoneForIata(airport.iata);
    const sync=()=>setBoardDay(localDateKey(new Date(), tz));
    sync();
    const id=setInterval(sync, 15000);
    return ()=>clearInterval(id);
  },[airport.iata]);

  // Midnight / calendar-day rollover: wipe stale board and fetch today
  useEffect(()=>{
    if(!boardDay) return;
    const prev=lastBoardDayRef.current;
    lastBoardDayRef.current=boardDay;
    AsyncStorage.getItem(LAST_BOARD_DAY_KEY).then(stored=>{
      if((stored && stored!==boardDay) || (prev && prev!==boardDay)){
        clearFidsCaches().then(()=>{
          setFlights([]);
          if(locReady && tab!=='myflights'){
            load(airport.iata, tab==='departure'?'departure':'arrival');
          }
        }).catch(()=>{});
      }
      AsyncStorage.setItem(LAST_BOARD_DAY_KEY, boardDay).catch(()=>{});
    }).catch(()=>{});
  },[boardDay, airport.iata, tab, locReady, load]);

  // Live Activity lockscreen tick every 2 minutes (boarding updates immediately in applyLiveUpdates)
  useEffect(()=>{
    const id=setInterval(()=>{
      const list=trackedRef.current;
      if(!list.length) return;
      syncAllLiveActivities(list.map(t=>({key:t.key, flight:t.flight}))).catch(()=>{});
    }, LIVE_ACTIVITY_TICK_MS);
    return ()=>clearInterval(id);
  },[]);

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

  // Second airport arrivals (Pro multi-airport)
  useEffect(()=>{
    if(!locReady || !isPro || !airport2 || tab!=='arrival' || showRadar){
      if(!airport2) setFlights2([]);
      return;
    }
    let cancelled=false;
    const pull=async(silent=false)=>{
      try{
        const result=await fetchFIDS(airport2.iata,'arrival');
        if(cancelled) return;
        setFlights2(sortFlights(result.flights.length?result.flights:[], 'arrival'));
      } catch{
        if(!cancelled && !silent) setFlights2([]);
      }
    };
    pull();
    const id=setInterval(()=>pull(true), FIDS_POLL_FREE_MS);
    return ()=>{ cancelled=true; clearInterval(id); };
  },[airport2, isPro, tab, locReady, showRadar]);

  // Global flight-number search (any airport)
  useEffect(()=>{
    const q=search.trim();
    if(searchTimer.current) clearTimeout(searchTimer.current);
    if(!q || !isFlightNumberQuery(q)){
      setGlobalHits(null);
      setGlobalBusy(false);
      return;
    }
    const seq=++searchSeq.current;
    searchTimer.current=setTimeout(async()=>{
      setGlobalBusy(true);
      try{
        const hits=await fetchFlightByNumber(q);
        if(seq!==searchSeq.current) return;
        setGlobalHits(hits);
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
  },[search,applyLiveUpdates]);

  const query=cleanQuery(search);
  const flightNumberQuery=isFlightNumberQuery(search.trim());
  const destSuggestions=(!flightNumberQuery && query.length>=2) ? searchSuggestions(search) : [];
  const emptyCopy=useMemo(()=>emptySearchCopy(search, airport.iata),[search, airport.iata]);
  /** Global mode once a flight-number lookup is in flight or finished (any airport). */
  const globalMode=flightNumberQuery && (globalBusy || globalHits!==null);

  /** Full Arrivals/Departures pool (before status + text filter) */
  const poolSorted=useMemo(()=>{
    const raw=flightNumberQuery && globalHits && globalHits.length>0
      ? globalHits
      : flightNumberQuery && globalHits!==null
        ? []
        : flights;
    const list=(!flightNumberQuery && boardDay)
      ? raw.filter(f=>isTodayBoardFlight(f, airport.iata, boardDay, flightTab))
      : raw;
    return sortFlights(list, flightTab);
  },[flights, globalHits, flightNumberQuery, flightTab, boardDay, airport.iata]);

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
    if(search.trim() && !globalMode){
      list=searchFlights(list.map(f=>toSearchableFlight(f, flightTab, airport)), search, airport.iata);
    }
    return list;
  },[poolSorted, statusFilter, search, globalMode, flightTab, airport]);

  // Keep detail card in sync with filtered list
  useEffect(()=>{
    if(sorted.length===0) return;
    if(!sorted.some(f=>f.id===selected.id)) setSelected(sorted[0]);
  },[sorted,selected.id]);

  const clearSearch=()=>{ setSearch(''); setGlobalHits(null); };

  /** Search box must never hold debug / status strings (e.g. leaked "IATA646"). */
  const onSearchChange=useCallback((text:string)=>{
    const next=String(text ?? '');
    if(/^IATA\d+$/i.test(next.trim()) || /^with[_\s]?iata/i.test(next.trim())){
      setSearch('');
      return;
    }
    setSearch(next);
    const label=prettySearchLabel(next);
    if(searchSaveTimer.current) clearTimeout(searchSaveTimer.current);
    if(cleanQuery(next).length>=3){
      searchSaveTimer.current=setTimeout(()=>{
        pushRecentSearch(label).then(setRecentSearches).catch(()=>{});
      },900);
    }
  },[]);

  const flashAirportChange=useCallback((a:Airport)=>{
    if(switchTimer.current) clearTimeout(switchTimer.current);
    setSwitchBanner(`Loading ${a.iata}…`);
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
      syncHomeScreenWidget([]).catch(()=>{});
      return;
    }
    reconcileLiveActivities(list.map(t=>({key:t.key, flight:t.flight}))).catch(()=>{});
    syncHomeScreenWidget(list).catch(()=>{});
  },[isPro, tracked.length]);

  const selectAirport=useCallback((a:Airport)=>{
    haptics.light();
    if(pickerSlot==='secondary'){
      if(!isPro){
        requirePro();
        return;
      }
      if(a.iata===airport.iata){
        showToast('Pick a different airport for the second slot');
        return;
      }
      setAirport2(a);
      AsyncStorage.setItem(AIRPORT2_KEY, JSON.stringify(a)).catch(()=>{});
      setShowPicker(false);
      setPickerQuery('');
      setPickerResults([]);
      return;
    }
    if(a.iata!==airport.iata) flashAirportChange(a);
    setAirport(a);
    pushRecentAirport(a).then(list=>setRecentAirports(list as Airport[])).catch(()=>{});
    savePrefs({ defaultAirport: getPrefs().defaultAirport }).catch(()=>{});
    if(airport2?.iata===a.iata){
      setAirport2(null);
      AsyncStorage.removeItem(AIRPORT2_KEY).catch(()=>{});
    }
    setShowPicker(false);
    setPickerQuery('');
    setPickerResults([]);
  },[airport.iata, airport2?.iata, flashAirportChange, isPro, pickerSlot, showToast, requirePro]);

  const toggleFavouriteAirport=useCallback((a:Airport)=>{
    setFavorites(prev=>{
      const exists=prev.some(x=>x.iata===a.iata);
      let next:Airport[];
      if(exists){
        next=prev.filter(x=>x.iata!==a.iata);
      } else {
        if(prev.length>=FAV_MAX){
          showToast(`Max ${FAV_MAX} favourite airports`);
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
    try{
      const { status }=await Location.requestForegroundPermissionsAsync();
      if(status!=='granted'){
        showToast('Location permission needed');
        haptics.error();
        return;
      }
      const pos=await Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.Balanced });
      const hits=await nearestAirportsApi(pos.coords.latitude, pos.coords.longitude);
      setNearMeResults(hits);
      AsyncStorage.setItem('waiair.nearMe.v1', JSON.stringify({
        at:Date.now(),
        hits,
      })).catch(()=>{});
      haptics.success();
    } catch{
      showToast('Could not find nearby airports');
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

  // My Flights: always use /flights/number snapshot on tracked entry (FIDS board can lag)
  const myFlights=useMemo(()=>{
    return tracked.map(t=>t.flight).filter(Boolean) as Flight[];
  },[tracked]);

  const myConnections=useMemo(()=>findTightConnections(myFlights),[myFlights]);

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
        const arrive=fmt(c.incoming.arrivalTime||c.incoming.revisedTime||c.incoming.scheduledTime);
        const depart=fmt(c.outgoing.departureTime||c.outgoing.revisedTime||c.outgoing.scheduledTime);
        await notifyFlight(inn, {
          kind:'connection',
          title:'Tight connection',
          body:`${inn} lands ${arrive}, ${out} departs ${depart} — only ${Math.round(c.gapMin)} min`,
          urgent:true,
        });
        await markConnNotified(c.key);
      }
    })();
    return ()=>{ cancelled=true; };
  },[myConnections]);

  return (
    <View style={s.screen} key={mode}>
      <StatusBar style={mode==='dark'?'light':'dark'}/>

      <OnboardingScreen
        visible={showOnboarding}
        colors={{ bg:C.bg, text:C.text, secondary:C.secondary, muted:C.muted, accent:C.accent, card:C.card }}
        onSkip={()=>{ savePrefs({ hasSeenOnboarding:true }); setShowOnboarding(false); }}
        onDone={()=>{
          savePrefs({ hasSeenOnboarding:true });
          setShowOnboarding(false);
          setPickerSlot('primary');
          setShowPicker(true);
        }}
      />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoRow}>
            <Image
              source={require('./assets/images/waiair-logo.png')}
              style={{ width: 36, height: 36, borderRadius: 8 }}
            />
            <Text style={s.logo} numberOfLines={1}>WaiAir</Text>
            {isPro?(
              <View style={s.proPill}>
                <Text style={s.proPillTxt}>Pro</Text>
              </View>
            ):null}
          </View>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.themeBtn}
            onPress={()=>setShowScanner(true)}
            activeOpacity={0.8}
            hitSlop={6}
            accessibilityLabel="Scan boarding pass"
          >
            <Barcode size={18} color={C.icon}/>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.themeBtn}
            onPress={toggle}
            activeOpacity={0.8}
            hitSlop={{ top:10, bottom:10, left:10, right:10 }}
            accessibilityLabel="Toggle theme"
          >
            {mode==='dark'
              ? <Sun size={18} color={C.icon}/>
              : <Moon size={18} color={C.icon}/>}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.themeBtn}
            onPress={()=>setShowSettings(true)}
            activeOpacity={0.8}
            hitSlop={6}
            accessibilityLabel="Settings"
          >
            <Gear size={18} color={C.icon}/>
          </TouchableOpacity>
          <Pressable
            style={{flexShrink:0}}
            onPress={()=>{
              setShowPicker(v=>{
                if(v){ setPickerQuery(''); setPickerResults([]); setPickerSlot('primary'); }
                else { setPickerSlot('primary'); }
                return !v;
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${airport.iata}, ${airport.city}`}
            accessibilityHint="Double tap to change airport"
            accessibilityState={{expanded:showPicker}}
          >
            {({pressed})=>(
              <Animated.View style={[
                s.apPill,
                {backgroundColor:pillBg,borderColor:pillBorder},
                pressed&&s.apPillPressed,
              ]}>
                <Text
                  style={s.apIata}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                  allowFontScaling={false}
                >
                  {airport.flag} {airport.iata}{isPro&&airport2?`·${airport2.iata}`:''}
                </Text>
                {showPicker
                  ? <CaretUp size={15} color={apChevronColor} style={s.apChevron}/>
                  : <CaretDown size={15} color={apChevronColor} style={s.apChevron}/>}
              </Animated.View>
            )}
          </Pressable>
        </View>
      </View>

      {notifyBanner?(
        <View style={s.notifyBanner} accessibilityRole="alert">
          <BellSimple size={18} color="#92400e" style={{marginTop:2}}/>
          <View style={s.notifyBannerBody}>
            <Text style={s.notifyBannerTitle}>Meldingen uitgeschakeld</Text>
            <Text style={s.notifyBannerMsg}>
              Om vlucht-alerts te ontvangen als de app gesloten is, zet meldingen aan via: Instellingen → Meldingen → WaiAir → Sta meldingen toe
            </Text>
            <View style={s.notifyBannerActions}>
              <TouchableOpacity
                style={s.notifyBannerCta}
                onPress={()=>Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel="Open instellingen"
              >
                <Text style={s.notifyBannerCtaTxt}>Open instellingen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={()=>setNotifyBanner(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Later"
              >
                <Text style={s.notifyBannerLater}>Later</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            onPress={()=>setNotifyBanner(false)}
            hitSlop={10}
            style={s.notifyBannerClose}
            accessibilityRole="button"
            accessibilityLabel="Sluit melding"
          >
            <X size={16} color="#92400e"/>
          </TouchableOpacity>
        </View>
      ):null}

      {switchBanner?(
        <View style={s.switchBanner}>
          <ActivityIndicator size="small" color={C.accent}/>
          <Text style={s.switchBannerTxt}>{switchBanner}</Text>
          <Text style={s.switchBannerSub}>{airport.flag} {airport.name}</Text>
        </View>
      ):null}

      {/* Picker */}
      {showPicker&&(
        <View style={s.picker}>
          <View style={s.pickerSearch}>
            <MagnifyingGlass size={16} color={C.muted}/>
            <TextInput
              style={s.pickerSearchInput}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search city, airport or code…"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              autoFocus
            />
            {pickerQuery.length>0&&(
              <TouchableOpacity onPress={()=>setPickerQuery('')} hitSlop={8}>
                <X size={16} color={C.secondary}/>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{maxHeight:320}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.dualSlots}>
              <TouchableOpacity
                style={[s.dualSlot, pickerSlot==='primary'&&s.dualSlotOn]}
                onPress={()=>setPickerSlot('primary')}
                activeOpacity={0.8}
              >
                <Text style={s.dualSlotLabel}>Airport 1</Text>
                <Text style={s.dualSlotVal}>{airport.flag} {airport.iata}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.dualSlot, pickerSlot==='secondary'&&s.dualSlotOn]}
                onPress={()=>{
                  if(!isPro){ requirePro(); return; }
                  setPickerSlot('secondary');
                }}
                activeOpacity={0.8}
              >
                <View style={s.dualSlotTop}>
                  <Text style={s.dualSlotLabel}>Airport 2</Text>
                  {!isPro?(
                    <View style={s.proPillSm}>
                      <Lock size={10} color={BRAND.gold}/>
                      <Text style={s.proPillTxt}>Pro</Text>
                    </View>
                  ):null}
                </View>
                <Text style={s.dualSlotVal}>
                  {isPro&&airport2?`${airport2.flag} ${airport2.iata}`:'Add second airport'}
                </Text>
                {isPro&&airport2?(
                  <TouchableOpacity onPress={clearAirport2} hitSlop={8} style={{marginTop:4}}>
                    <Text style={{color:C.muted,fontSize:11,fontWeight:'700'}}>Clear</Text>
                  </TouchableOpacity>
                ):null}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.nearMeBtn}
              onPress={findNearMe}
              activeOpacity={0.8}
              disabled={nearMeBusy}
            >
              {nearMeBusy
                ? <ActivityIndicator size="small" color={C.accent}/>
                : <MapPin size={16} color={C.accent}/>}
              <Text style={[s.nearMeTxt,{color:C.accent}]}>Near me</Text>
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
                    accessibilityLabel={`${a.iata}, ${a.name}, ${a.country}`}
                  >
                    <Text style={s.pFlag}>{a.flag}</Text>
                    <View style={{flex:1}}>
                      <Text style={s.pIata}>{a.iata}
                        <Text style={s.pName}>  {a.name}</Text>
                      </Text>
                      <Text style={s.pCity}>{a.city}{a.country?` · ${a.country}`:''}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ):null}

            {nearMeResults.length>0&&!showSearchResults?(
              <View>
                <View style={s.pCountry}>
                  <Text style={s.pCountryTxt}>Nearby</Text>
                </View>
                {nearMeResults.map(a=>(
                  <TouchableOpacity key={`near-${a.iata}`} style={s.pRow} onPress={()=>selectAirport(a)}>
                    <Text style={s.pFlag}>{a.flag}</Text>
                    <View style={{flex:1}}>
                      <Text style={s.pIata}>{a.iata}
                        <Text style={s.pName}>  {a.name}</Text>
                      </Text>
                      <Text style={s.pCity}>
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
                    <Text style={s.pCountryTxt}>Favourites</Text>
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
                      <View style={{flex:1}}>
                        <Text style={s.pIata}>{a.iata}
                          <Text style={s.pName}>  {a.name}</Text>
                        </Text>
                        <Text style={s.pCity}>{a.city}{a.country?` · ${a.country}`:''}</Text>
                      </View>
                      {(pickerSlot==='secondary'?a.iata===airport2?.iata:a.iata===airport.iata)&&<Check size={16} color="#22c55e"/>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={()=>toggleFavouriteAirport(a)}
                      hitSlop={{top:8,bottom:8,left:8,right:8}}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${a.iata} from favourites`}
                    >
                      <Text style={{fontSize:18,color:C.gold}}>★</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {showSearchResults&&(
              <View>
                <View style={s.pCountry}>
                  <Text style={s.pCountryTxt}>
                    {pickerBusy?'Searching…':'Results'}
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
                        accessibilityLabel={`${a.iata}, ${a.name}, ${a.country}`}
                      >
                        <Text style={s.pFlag}>{a.flag}</Text>
                        <View style={{flex:1}}>
                          <Text style={s.pIata}>{a.iata}
                            <Text style={s.pName}>  {a.name}</Text>
                          </Text>
                          <Text style={s.pCity}>{a.city}{a.country?` · ${a.country}`:''}</Text>
                        </View>
                        {(pickerSlot==='secondary'?a.iata===airport2?.iata:a.iata===airport.iata)&&<Check size={16} color="#22c55e"/>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={()=>toggleFavouriteAirport(a)}
                        hitSlop={{top:8,bottom:8,left:8,right:8}}
                        accessibilityRole="button"
                        accessibilityLabel={fav?`Remove ${a.iata} from favourites`:`Save ${a.iata} as favourite`}
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
                    <Text style={s.pickerEmptyTxt}>No airports match “{pickerQuery.trim()}”</Text>
                  </View>
                )}
              </View>
            )}

            {!showSearchResults&&favFiltered.length===0&&(
              <View style={s.pickerEmpty}>
                <Text style={s.pickerEmptyTxt}>10,000+ Airports worldwide — search any code or city</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Tabs */}
      <View
        style={[s.tabs, { position:'relative' }]}
        onLayout={e=>setTabBarW(e.nativeEvent.layout.width)}
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
        <TouchableOpacity
          style={s.tab}
          onPress={()=>{ haptics.light(); bounceTab(0); setShowRadar(false); setTab('arrival'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab==='arrival'&&!showRadar }}
          accessibilityLabel="Arrives"
        >
          <Animated.View style={{ transform:[{ scale: tabBounce[0] }], alignItems:'center', gap:2 }}>
            <AirplaneLanding size={24} color={tab==='arrival'&&!showRadar?C.accent:C.muted}/>
            <Text style={[s.tabTxt,tab==='arrival'&&!showRadar&&s.tabTxtOn]} numberOfLines={1}>Arrives</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.tab}
          onPress={()=>{ haptics.light(); bounceTab(1); setShowRadar(false); setTab('departure'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab==='departure'&&!showRadar }}
          accessibilityLabel="Departs"
        >
          <Animated.View style={{ transform:[{ scale: tabBounce[1] }], alignItems:'center', gap:2 }}>
            <AirplaneTakeoff size={24} color={tab==='departure'&&!showRadar?C.accent:C.muted}/>
            <Text style={[s.tabTxt,tab==='departure'&&!showRadar&&s.tabTxtOn]} numberOfLines={1}>Departs</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.tab}
          onPress={()=>{ haptics.light(); bounceTab(2); setShowRadar(false); setTab('myflights'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab==='myflights'&&!showRadar }}
          accessibilityLabel={`Tracked, ${tracked.length} flights`}
        >
          <Animated.View style={{ transform:[{ scale: tabBounce[2] }], alignItems:'center', gap:2 }}>
            <View>
              <BellRinging size={24} color={tab==='myflights'&&!showRadar?C.accent:C.muted}/>
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
            <Text style={[s.tabTxt, tab==='myflights'&&!showRadar&&s.tabTxtOn]} numberOfLines={1}>Tracked</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.tab}
          onPress={()=>{ haptics.light(); bounceTab(3); setShowRadar(true); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: !!showRadar }}
          accessibilityLabel="Radar"
        >
          <Animated.View style={{ transform:[{ scale: tabBounce[3] }], alignItems:'center', gap:2 }}>
            <WaveSawtooth size={24} color={showRadar?C.accent:C.muted}/>
            <Text style={[s.tabTxt, showRadar&&s.tabTxtOn]} numberOfLines={1}>Radar</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Search — available on every tab for local filter + global flight-number lookup */}
      <Pressable
        style={s.searchWrap}
        onPress={()=>searchInputRef.current?.focus()}
      >
        <MagnifyingGlass size={16} color={C.muted}/>
        <TextInput
          ref={searchInputRef}
          style={s.searchInput}
          value={search}
          onChangeText={onSearchChange}
          placeholder={searchPh}
          placeholderTextColor={theme.muted}
          autoFocus={false}
          autoCapitalize="none"
          autoCorrect={false}
          allowFontScaling={false}
          clearButtonMode="never"
          returnKeyType="search"
          accessibilityLabel="Search flights"
        />
        {globalBusy&&<ActivityIndicator size="small" color={theme.accent}/>}
        {search.length>0&&(
          <TouchableOpacity style={s.searchClear} onPress={clearSearch} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <X size={14} color={C.text}/>
          </TouchableOpacity>
        )}
      </Pressable>
      <FlightAutocomplete
        query={flightNumberQuery ? search : ''}
        theme={{
          text: C.text,
          secondary: C.secondary,
          muted: C.muted,
          accent: C.accent,
          border: C.border,
          card: C.card,
        }}
        onSelect={(num)=>{
          haptics.light();
          setSearch(num);
          pushRecentSearch(num).then(setRecentSearches).catch(()=>{});
        }}
      />
      {!search.trim() && recentSearches.length>0?(
        <View style={{ paddingHorizontal:16, marginBottom:10, gap:8 }}>
          <Text style={{ fontSize:11, fontWeight:'700', color:C.muted }}>Recent</Text>
          {recentSearches.map(q=>(
            <View key={q} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <TouchableOpacity
                onPress={()=>{ haptics.light(); setSearch(q); }}
                style={{ flex:1, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.list, borderRadius:12, paddingHorizontal:12, paddingVertical:8 }}
                accessibilityRole="button"
                accessibilityLabel={`Search ${q}`}
              >
                <Clock size={14} color={C.muted}/>
                <Text style={{ color:C.text, fontSize:13, fontWeight:'600' }}>{q}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={()=>{ removeRecentSearch(q).then(setRecentSearches).catch(()=>{}); }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${q}`}
              >
                <X size={14} color={C.muted}/>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ):null}
      {search.trim() && destSuggestions.length>0 && !flightNumberQuery?(
        <View style={{ marginHorizontal:16, marginBottom:10, backgroundColor:C.card, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, overflow:'hidden' }}>
          {destSuggestions.map((s,i)=>(
            <TouchableOpacity
              key={s.id}
              onPress={()=>{
                haptics.light();
                setSearch(s.apply);
                pushRecentSearch(s.apply).then(setRecentSearches).catch(()=>{});
              }}
              style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:12, paddingVertical:11, borderTopWidth:i?StyleSheet.hairlineWidth:0, borderTopColor:C.border }}
              accessibilityRole="button"
              accessibilityLabel={s.label}
            >
              <MagnifyingGlass size={14} color={C.muted}/>
              <Text style={{ color:C.text, fontSize:13, fontWeight:'600' }}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ):null}
      {globalMode?(
        <Text style={s.searchHint}>
          {globalBusy
            ?'Global · searching...'
            :`Global · ${sorted.length} result${sorted.length===1?'':'s'} for ${search.trim().toUpperCase()}`}
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
          {STATUS_FILTER_TABS.map(({key, label, Icon})=>{
            const on=statusFilter===key;
            const count=statusCounts[key];
            const tint = !on && count>0 && key==='cancelled' ? LIVE.cancelled
              : !on && count>0 && key==='delayed' ? LIVE.delayed
              : undefined;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.statusPill,
                  on&&s.statusPillOn,
                  tint && { borderColor: tint+'88', backgroundColor: tint+'14' },
                ]}
                onPress={()=>{
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setStatusFilter(key);
                }}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{selected:on}}
                accessibilityLabel={`${label}, ${count} flights`}
              >
                <Icon size={14} color={on?'#fff':(tint||C.muted)}/>
                <Text style={[s.statusPillTxt, on&&s.statusPillTxtOn, tint&&{ color:tint }]}>{label}</Text>
                <View style={[
                  s.statusPillBadge,
                  on&&s.statusPillBadgeOn,
                  !on&&{ backgroundColor:badgePalette(mode).backgroundColor },
                ]}>
                  <Text style={{
                    fontSize:10,
                    fontWeight:'800',
                    textAlign:'center',
                    color: on ? BADGE_ACTIVE_TXT : badgePalette(mode).color,
                  }}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ):null}

      {tab!=='myflights'?(
        <TouchableOpacity
          style={s.connLink}
          onPress={()=>{ setConnIncoming(search); setShowConn(true); }}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Check connection"
        >
          <ArrowsLeftRight size={12} color={C.muted}/>
          <Text style={s.connLinkTxt}>Check connection</Text>
        </TouchableOpacity>
      ):null}

      <ConnectionModal
        visible={showConn}
        onClose={()=>setShowConn(false)}
        defaultHub={airport.iata}
        defaultIncoming={connIncoming}
        isPro={isPro}
        onRequirePro={requirePro}
      />

      <RadarModal
        visible={showRadar}
        onClose={()=>setShowRadar(false)}
        airport={airport}
        isTracked={isTracked}
        onToggleTrack={toggleTrack}
      />

      <BoardingPassScanner
        visible={showScanner}
        onClose={()=>setShowScanner(false)}
        onParsed={onBoardingPassParsed}
        theme={{ bg:C.bg, text:C.text, secondary:C.secondary, accent:C.accent, list:C.list, muted:C.muted }}
      />

      <AfterLandingCard data={landedWelcome} onDismiss={()=>setLandedWelcome(null)} />

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
        onOpenPaywall={()=>{ requirePro(); }}
        onProUnlocked={()=>setIsPro(true)}
        onToast={showToast}
        prefs={prefs}
        currentAirport={airport}
        onOpenAirportPicker={()=>{ setPickerSlot('primary'); setShowPicker(true); }}
        onRequirePro={(h)=>requirePro(h)}
        trackedCount={tracked.length}
        trackLimit={FREE_TRACK_LIMIT}
        betaMode={BETA_MODE}
      />

      {offlineCacheAt?(
        <View style={s.offlineBanner} accessibilityRole="text">
          <WifiSlash size={14} color={themeMode==='light'?'#6b7280':'#94a3b8'}/>
          <Text style={s.offlineBannerTxt}>
            {t().noConnection}
          </Text>
        </View>
      ):null}

      {/* Error */}
      {error?(
        <View style={s.errBanner}>
          <Warning size={14} color={themeMode==='light'?'#b91c1c':'#fca5a5'}/>
          <Text style={s.errTxt}>{error}</Text>
          <TouchableOpacity onPress={()=>load(airport.iata, flightTab)} accessibilityRole="button" accessibilityLabel={t().retry}>
            <Text style={[s.errTxt,{ fontWeight:'800' }]}>{t().retry}</Text>
          </TouchableOpacity>
        </View>
      ):null}

      {((!locReady && flights.length===0)||(loading&&tab!=='myflights'&&!globalMode&&flights.length===0))?(
        <View style={{flex:1}}>
          {loadTimedOut?(
            <View style={s.center}>
              <Text style={s.emptyTxt}>{t().loadTimeout}</Text>
              <TouchableOpacity
                onPress={()=>load(airport.iata, flightTab)}
                style={{ marginTop:12, backgroundColor:C.accent, borderRadius:12, paddingHorizontal:18, paddingVertical:10 }}
                accessibilityRole="button"
                accessibilityLabel={t().retry}
              >
                <Text style={{ color:'#fff', fontWeight:'800' }}>{t().retry}</Text>
              </TouchableOpacity>
            </View>
          ):(
            <>
              <Text style={[s.loadTxt,{ textAlign:'center', marginTop:12 }]}>
                {!locReady?`Finding nearest airport…`:`Loading ${airport.iata} · ${airport.name}`}
              </Text>
              <SkeletonCards/>
            </>
          )}
        </View>
      ):(
        <ScrollView
          ref={scrollRef}
          style={{flex:1}}
          contentContainerStyle={{flexGrow:1, paddingBottom: 48}}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          refreshControl={<RefreshControl
            refreshing={refreshing}
            onRefresh={async()=>{
              haptics.medium();
              setRefreshing(true);
              setRefreshHint(t().refreshing);
              try{
                if(tab==='myflights'){
                  await pollTracked();
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
        >
          <RefreshOverlay active={refreshing} accent={C.accent}/>
          {tab==='myflights'&&!globalMode?(
            <>
              <AddTrackedFlightPanel
                busy={addBusy}
                onSubmit={(n)=>addTrackByNumber(n)}
                onOpenScanner={()=>setShowScanner(true)}
              />
              {(() => {
                const detail = myFlights.find(f=>f.id===selected.id) ?? myFlights[0];
                if(!detail) return null;
                const detailType = tracked.find(t=>t.key===flightTrackKey(detail))?.type ?? flightTab;
                const rr=resolveRoute(detail, detailType, airport);
                const prevGate=tracked.find(t=>sameTrackedFlight(t, detail))?.previousGate;
                return (
                  <>
                    <RouteHero
                      origin={rr.origin}
                      destination={rr.destination}
                      originCity={rr.originCity}
                      destCity={rr.destCity}
                      progress={flightLiveProgress(detail)}
                      duration={flightDurationLabel(detail)}
                      status={detail.status}
                      animated={isPro}
                    />
                    <DetailCard
                      f={detail}
                      type={detailType}
                      airport={airport}
                      tracked={isTracked(detail)}
                      onToggleTrack={()=>toggleTrack(detail)}
                      onToast={showToast}
                      isPro={isPro}
                      onRequirePro={requirePro}
                      onOpenScanner={()=>setShowScanner(true)}
                      previousGate={prevGate}
                      boardingPass={tracked.find(t=>sameTrackedFlight(t, detail))?.boardingPass}
                    />
                  </>
                );
              })()}
              <MyFlightsTimeline
                flights={myFlights}
                selectedId={selected.id}
                onSelect={selectFlight}
                onUntrack={f=>toggleTrack(f)}
                connections={myConnections}
              />
              <FlightHistorySection
                isPro={isPro}
                colors={C}
                refreshKey={historyRefresh}
                onRequirePro={requirePro}
              />
              <Text style={s.foot}>Pull to refresh · Updates every 60s</Text>
              <View style={{height:50}}/>
            </>
          ):(
            <>
          {tab==='myflights'&&globalMode?(
            <View style={{paddingHorizontal:16,paddingTop:8,paddingBottom:4}}>
              <Text style={s.listAirport} numberOfLines={1} ellipsizeMode="tail">Global flight search</Text>
            </View>
          ):null}
          {globalBusy&&sorted.length===0?(
            <View style={s.center}>
              <ActivityIndicator size="large" color={C.accent}/>
              <Text style={s.loadTxt}>Global · searching...</Text>
            </View>
          ):null}
          {sorted.length>0?(
            <>
              {(() => {
                const rr=resolveRoute(selected, flightTab, airport);
                const prevGate=tracked.find(t=>sameTrackedFlight(t, selected))?.previousGate;
                return (
                  <>
                    <RouteHero
                      origin={rr.origin}
                      destination={rr.destination}
                      originCity={rr.originCity}
                      destCity={rr.destCity}
                      progress={flightLiveProgress(selected)}
                      duration={flightDurationLabel(selected)}
                      status={selected.status}
                      animated={isPro}
                    />
                    <DetailCard
                      f={selected}
                      type={flightTab}
                      airport={airport}
                      tracked={isTracked(selected)}
                      onToggleTrack={()=>toggleTrack(selected)}
                      onToast={showToast}
                      isPro={isPro}
                      onRequirePro={requirePro}
                      onOpenScanner={()=>setShowScanner(true)}
                      previousGate={prevGate}
                      boardingPass={tracked.find(t=>sameTrackedFlight(t, selected))?.boardingPass}
                    />
                  </>
                );
              })()}
            </>
          ):null}

          {tab!=='myflights'?(
            <SeaCoverageCard
              count={globalMode?sorted.length:poolSorted.length}
              iata={airport.iata}
            />
          ):null}

          {/* List header */}
          <View style={s.listHead}>
            <View style={{flex:1,paddingRight:12}}>
              <View style={s.listTitleRow}>
                <Text style={s.listTitle} numberOfLines={1} ellipsizeMode="tail">
                  {globalMode
                    ?`Global search · ${search.trim().toUpperCase()}`
                    :`${flightTab==='arrival'?'Arrivals':'Departures'} · ${airport.iata}`}
                </Text>
                <Text
                  style={[
                    s.listCount,
                    {
                      color: badgePalette(mode).color,
                      backgroundColor: badgePalette(mode).backgroundColor,
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >{sorted.length}</Text>
              </View>
              {!globalMode?(
                <Text style={s.listAirport} numberOfLines={1} ellipsizeMode="tail">
                  {airport.flag}  {airportShortLabel(airport)}
                </Text>
              ):null}
            </View>
            <View style={s.listMeta}>
              {(isLive || lastFetchAt || boardUpdating || refreshing)?(
                <Animated.View
                  style={[
                    s.livePill,
                    {
                      backgroundColor: (boardUpdating||refreshing)
                        ? 'rgba(255,179,0,0.18)'
                        : (offlineCacheAt || isLiveStale(lastFetchAt))
                          ? 'rgba(148,163,184,0.18)'
                          : 'rgba(0,200,83,0.16)',
                      transform:[{ scale: livePulseAnim }],
                      flexDirection:'row',
                      alignItems:'center',
                      gap:6,
                    },
                  ]}
                  accessibilityLabel={
                    (boardUpdating||refreshing) ? t().updating
                    : (offlineCacheAt || isLiveStale(lastFetchAt))
                      ? `${t().cached} ${fmtCacheAge(offlineCacheAt || lastFetchAt || Date.now())}`
                      : t().live
                  }
                >
                  <View style={{
                    width:7,height:7,borderRadius:4,
                    backgroundColor: (boardUpdating||refreshing)
                      ? LIVE.delayed
                      : (offlineCacheAt || isLiveStale(lastFetchAt))
                        ? C.muted
                        : LIVE.onTime,
                  }}/>
                  <Text style={[s.liveTxt, {
                    color: (boardUpdating||refreshing)
                      ? LIVE.delayed
                      : (offlineCacheAt || isLiveStale(lastFetchAt))
                        ? C.muted
                        : LIVE.onTime,
                  }]}>
                    {(boardUpdating||refreshing)
                      ? t().updating
                      : (offlineCacheAt || isLiveStale(lastFetchAt))
                        ? `${t().cached} ${fmtCacheAge(offlineCacheAt || lastFetchAt || Date.now())}`
                        : t().live}
                  </Text>
                </Animated.View>
              ):(
                <Text style={s.demoTxt}>{t().demo}</Text>
              )}
              <Text style={s.updTxt} numberOfLines={1} allowFontScaling={false} accessibilityLabel={`Local time ${clockNow.toLocaleTimeString('en-GB')}`}>
                {clockNow.toLocaleTimeString('en-GB', {
                  hour:'2-digit', minute:'2-digit', second:'2-digit',
                  hour12: prefs.timeFormat==='12h',
                })}
              </Text>
            </View>
          </View>

          <View style={s.flightCards}>
            {sorted.map((f,i)=>(
              <FlightRow
                key={`${f.id}-${i}`}
                f={f}
                type={flightTab}
                airport={airport}
                active={selected.id===f.id}
                onPress={()=>selectFlight(f)}
                tracked={isTracked(f)}
                previousGate={tracked.find(t=>sameTrackedFlight(t, f))?.previousGate}
                index={i}
                highlightQuery={query}
              />
            ))}
          </View>

          {sorted.length===0&&(
            <View style={s.center}>
              <Airplane size={36} color={C.muted}/>
              {query?(
                <>
                  <Text style={[s.emptyTxt,{ textAlign:'center' }]}>
                    {emptyCopy.title}
                  </Text>
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
                <Text style={s.emptyTxt}>
                  {statusFilter!=='all'
                    ?`No ${STATUS_FILTER_TABS.find(tab=>tab.key===statusFilter)?.label.toLowerCase()} flights`
                    : t().noFlights}
                </Text>
              )}
            </View>
          )}

          {isPro&&airport2&&flightTab==='arrival'&&!globalMode?(
            <View style={s.splitBlock}>
              <View style={s.listHead}>
                <View style={{flex:1}}>
                  <View style={s.listTitleRow}>
                    <SquaresFour size={14} color={BRAND.gold}/>
                    <Text style={s.listTitle} numberOfLines={1} ellipsizeMode="tail">Arrivals · {airport2.iata}</Text>
                    <Text
                      style={[
                        s.listCount,
                        {
                          color: badgePalette(mode).color,
                          backgroundColor: badgePalette(mode).backgroundColor,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >{flights2.length}</Text>
                  </View>
                  <Text style={s.listAirport} numberOfLines={1} ellipsizeMode="tail">
                    {airport2.flag}  {airportShortLabel(airport2)}
                  </Text>
                </View>
              </View>
              <View style={s.flightCards}>
                {flights2.filter(f=>{
                  const today=isTodayBoardFlight(f, airport2.iata, localDateKey(new Date(), timezoneForIata(airport2.iata)), 'arrival');
                  if(!today) return false;
                  if(!search.trim()) return true;
                  return searchFlights([toSearchableFlight(f, 'arrival', airport2)], search, airport2.iata).length>0;
                }).slice(0,40).map((f,i)=>(
                  <FlightRow
                    key={`a2-${f.id}-${i}`}
                    f={f}
                    type="arrival"
                    airport={airport2}
                    active={selected.id===f.id}
                    onPress={()=>selectFlight(f)}
                    tracked={isTracked(f)}
                    previousGate={tracked.find(t=>sameTrackedFlight(t, f))?.previousGate}
                    index={i}
                    highlightQuery={query}
                  />
                ))}
                {flights2.length===0?(
                  <View style={{padding:20}}>
                    <Text style={s.emptyTxt}>No arrivals for {airport2.iata}</Text>
                  </View>
                ):null}
              </View>
            </View>
          ):null}

          <Text style={s.foot}>
            {globalMode
              ?`${sorted.length} worldwide · type a flight # to search any airport`
              :`${sorted.length}${query||statusFilter!=='all'?` of ${poolSorted.length}`:''} flights · live refresh · pull to refresh`}
          </Text>
          <View style={{height:50}}/>
            </>
          )}
        </ScrollView>
      )}

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
  screen:      {flex:1,backgroundColor:C.bg},
  header:      {flexDirection:'row',justifyContent:'space-between',alignItems:'center',
                paddingHorizontal:20,paddingTop:Platform.OS==='web'?20:54,paddingBottom:16,backgroundColor:C.bg,gap:12},
  headerLeft:  {flexShrink:0},
  headerRight: {flexDirection:'row',alignItems:'center',gap:10,flexShrink:0},
  themeBtn:    {width:36,height:36,borderRadius:10,backgroundColor:C.list,borderWidth:1,
                borderColor:C.border,alignItems:'center',justifyContent:'center',flexShrink:0},
  logoRow:     {flexDirection:'row',alignItems:'center',gap:8},
  logo:        {fontSize:20,fontWeight:'700',color:C.text,letterSpacing:-0.4,flexShrink:0},
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
  seaCard:     {marginHorizontal:16,marginBottom:10,backgroundColor:C.card,borderRadius:16,
                paddingHorizontal:16,paddingVertical:14,borderWidth:1,
                borderColor:themeMode==='dark'?'rgba(255,255,255,0.08)':'rgba(15,23,42,0.04)',
                shadowColor:'#000',shadowOpacity:0.08,shadowRadius:24,shadowOffset:{width:0,height:4},
                elevation:3},
  seaCardLbl:  {fontSize:11,fontWeight:'700',color:C.muted,letterSpacing:0.8,textTransform:'uppercase',marginBottom:4},
  seaCardVal:  {fontSize:17,fontWeight:'700',color:C.text},
  apChevron:   {flexShrink:0},
  switchBanner:{marginHorizontal:16,marginBottom:12,paddingVertical:12,paddingHorizontal:14,
                backgroundColor:themeMode==='light'?'rgba(201,168,76,0.08)':'rgba(201,168,76,0.12)',
                borderRadius:12,borderLeftWidth:3,borderLeftColor:BRAND.gold,
                flexDirection:'row',alignItems:'center',gap:10},
  switchBannerTxt:{color:C.text,fontSize:14,fontWeight:'700'},
  switchBannerSub:{color:C.secondary,fontSize:11,flex:1,textAlign:'right'},
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
  pIata:       {fontSize:14,fontWeight:'700',color:C.accent},
  pName:       {fontSize:12,fontWeight:'400',color:C.secondary},
  pCity:       {fontSize:11,color:C.muted,marginTop:2},
  tabs:        {flexDirection:'row',marginHorizontal:8,marginBottom:8,backgroundColor:'transparent',
                height:56,alignItems:'stretch',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
  tab:         {flex:1,minWidth:0,height:56,paddingHorizontal:2,alignItems:'center',
                flexDirection:'column',justifyContent:'center',gap:2,borderBottomWidth:2,borderBottomColor:'transparent'},
  tabOn:       {borderBottomColor:C.accent,backgroundColor:'transparent'},
  tabTxt:      {color:C.secondary,fontSize:10,fontWeight:'600',textAlign:'center'},
  tabTxtOn:    {color:C.accent,fontWeight:'700'},
  myWrap:      {paddingBottom:8},
  myEmpty:     {marginHorizontal:16,marginTop:24,padding:28,alignItems:'center',gap:10,
                backgroundColor:C.card,borderRadius:16,...cardShadow},
  myEmptyTitle:{fontSize:16,fontWeight:'700',color:C.text},
  myEmptySub:  {fontSize:13,color:C.secondary,textAlign:'center',lineHeight:18},
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
                padding:14,marginBottom:10},
  myCardOn:    {borderWidth:1,borderColor:C.accent,backgroundColor:C.accentDim},
  myCardTop:   {flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},
  myNum:       {fontSize:17,fontWeight:'800',color:C.text},
  myPill:      {borderRadius:12,borderWidth:1,paddingHorizontal:8,paddingVertical:3},
  myPillTxt:   {fontSize:11,fontWeight:'700'},
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
  searchWrap:  {flexDirection:'row',alignItems:'center',marginHorizontal:16,marginBottom:10,
                backgroundColor:C.card,borderRadius:16,...cardShadow,
                paddingHorizontal:14,paddingVertical:Platform.OS==='ios'?2:0,gap:8},
  searchInput: {flex:1,color:C.text,fontSize:16,paddingVertical:Platform.OS==='ios'?10:8,
                fontWeight:'400'},
  searchClear: {width:28,height:28,borderRadius:14,backgroundColor:C.list,
                alignItems:'center',justifyContent:'center'},
  searchHint:  {marginHorizontal:20,marginBottom:10,fontSize:12,color:C.accent,fontWeight:'600'},
  connLink:    {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:20,paddingBottom:12,alignSelf:'flex-start'},
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
                paddingHorizontal:20,paddingTop:18,paddingBottom:8},
  listTitleRow:{flexDirection:'row',alignItems:'center',gap:8},
  listTitle:   {fontSize:16,fontWeight:'700',color:C.text,flexShrink:1,minWidth:0},
  listCount:   {minWidth:40,paddingHorizontal:8,paddingVertical:2,borderRadius:12,
                fontSize:12,fontWeight:'700',
                color:themeMode==='dark'?'#ffffff':'#0f1117',
                backgroundColor:themeMode==='dark'?'#1a1d27':'#e2e8f0',
                overflow:'hidden',textAlign:'center',flexShrink:0},
  listAirport: {fontSize:13,fontWeight:'600',color:C.accent,marginTop:4},
  listMeta:    {flexDirection:'row',alignItems:'center',gap:8,paddingTop:2},
  statusFilters:{flexGrow:0,marginBottom:4},
  statusFiltersInner:{paddingHorizontal:16,paddingBottom:10,gap:8,alignItems:'center'},
  statusPill:  {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:8,paddingHorizontal:12,
                borderRadius:20,borderWidth:1,borderColor:C.border,backgroundColor:C.card},
  statusPillOn:{backgroundColor:C.accent,borderColor:C.accent},
  statusPillTxt:{fontSize:12,fontWeight:'700',color:C.secondary},
  statusPillTxtOn:{color:themeMode==='dark'?BRAND.deep:'#fff'},
  statusPillBadge:{minWidth:20,paddingHorizontal:6,paddingVertical:2,borderRadius:10,
                backgroundColor:themeMode==='dark'?'#1a1d27':'#e2e8f0'},
  statusPillBadgeOn:{backgroundColor:themeMode==='dark'?'rgba(10,15,30,0.15)':'rgba(255,255,255,0.2)'},
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
  flightCards: {paddingHorizontal:16,gap:10,marginBottom:8},
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
  card:        {marginTop:-22,marginHorizontal:16,marginBottom:14,backgroundColor:C.card,
                borderRadius:24,
                paddingHorizontal:20,paddingTop:12,paddingBottom:22,
                shadowColor:'#000',shadowOpacity:0.08,shadowRadius:24,
                shadowOffset:{width:0,height:4},elevation:8},
  handle:      {alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:C.muted,
                opacity:0.35,marginBottom:16},
  headRow:     {flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},
  logo:        {width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},
  logoTxt:     {color:'#fff',fontSize:10,fontWeight:'800',letterSpacing:0.4},
  flNum:       {fontSize:17,fontWeight:'700',color:C.text},
  dateTxt:     {fontSize:13,fontWeight:'500',color:C.secondary},
  routeTitle:  {fontSize:22,fontWeight:'800',color:C.text,letterSpacing:-0.4,marginBottom:12},
  statusLine:  {fontSize:15,fontWeight:'700',marginBottom:4},
  statusBar:   {fontSize:14,fontWeight:'700',marginBottom:6},
  progressWrap:{marginTop:10,marginBottom:8},
  progressTrack:{height:2,borderRadius:1,backgroundColor:themeMode==='dark'?'rgba(255,255,255,0.12)':'#E5EAF5',position:'relative',overflow:'visible'},
  progressFill:{height:2,borderRadius:1,backgroundColor:LIVE.onTime},
  progressPlane:{position:'absolute',top:-8,marginLeft:-8,width:16,height:16,alignItems:'center',justifyContent:'center'},
  progressRemain:{fontSize:12,fontWeight:'600',marginTop:10},
  livePos:     {fontSize:13,fontWeight:'700',color:C.gold,marginBottom:8},
  wasGate:     {fontSize:11,fontWeight:'600',color:C.muted,marginTop:4,textAlign:'center'},
  inbound:     {fontSize:13,fontWeight:'500',color:C.secondary,marginBottom:16},
  passCard:    {backgroundColor:C.list,borderRadius:12,padding:12,marginBottom:12,gap:4},
  passLine:    {fontSize:13,fontWeight:'700',color:C.text},
  leg:         {paddingVertical:16},
  legTop:      {flexDirection:'row',alignItems:'flex-start'},
  legIata:     {fontSize:13,fontWeight:'600',color:C.secondary,marginBottom:8},
  heroTime:    {fontSize:40,fontWeight:'800',letterSpacing:-0.8,lineHeight:44,maxHeight:48},
  timeSuffix:  {fontSize:12,fontWeight:'600',color:C.muted,marginTop:2},
  heroRow:     {flexDirection:'row',alignItems:'flex-end',gap:10},
  strike:      {fontSize:14,color:C.muted,textDecorationLine:'line-through',marginTop:2,fontWeight:'600'},
  strikeBig:   {fontSize:18,color:C.muted,textDecorationLine:'line-through',marginBottom:8,fontWeight:'600'},
  legSub:      {fontSize:13,fontWeight:'600',marginTop:6},
  routeArrow:  {alignItems:'center',paddingVertical:4},
  routeArrowTxt:{fontSize:15,fontWeight:'700',color:C.secondary,letterSpacing:1.4},
  divider:     {height:StyleSheet.hairlineWidth,backgroundColor:C.border},
  bottomRow:   {flexDirection:'row',alignItems:'center',gap:8,marginTop:8,paddingTop:16,
                borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border},
  iconBtn:     {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:10,
                borderRadius:12,backgroundColor:themeMode==='dark'?'rgba(255,255,255,0.06)':C.list},
  regChip:     {fontSize:11,fontWeight:'700',color:C.secondary,maxWidth:72},
  trackBtn:    {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:12,
                borderRadius:12,borderWidth:1,borderColor:C.border,backgroundColor:C.list},
  trackBtnOn:  {backgroundColor:LIVE.onTime,borderColor:LIVE.onTime},
  trackBtnTxt: {fontSize:13,fontWeight:'700',color:C.text},
  shareBtn:    {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:14,
                borderRadius:20,backgroundColor:LIVE.share,marginLeft:'auto'},
  shareTxt:    {color:'#fff',fontSize:13,fontWeight:'700'},
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
});}
let dc=makeDc(C);

function makeFr(C:ThemeColors){return StyleSheet.create({
  row:    {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:14,gap:12,
           backgroundColor:C.card,borderRadius:16,
           shadowColor:'#000',shadowOpacity:0.12,shadowRadius:16,shadowOffset:{width:0,height:6},
           elevation:4},
  active: {borderWidth:1,borderColor:LIVE.onTime+'55'},
  rowBoard:{transform:[{scale:1.02}],zIndex:2},
  cancel: {opacity:0.7},
  liveDot: {width:8,height:8,borderRadius:4,backgroundColor:LIVE.boarding},
  stampWrap:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center'},
  stamp:  {fontSize:22,fontWeight:'800',letterSpacing:2,color:LIVE.cancelled,opacity:0.18,
           transform:[{rotate:'-12deg'}]},
  delayChip:{position:'absolute',top:8,right:10,backgroundColor:'rgba(255,179,0,0.16)',
             borderRadius:8,paddingHorizontal:7,paddingVertical:3,zIndex:2},
  delayChipTxt:{fontSize:10,fontWeight:'700',color:LIVE.delayed},
  logo:   {width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',flexShrink:0},
  logoTxt:{color:'#fff',fontSize:12,fontWeight:'800',letterSpacing:0.3},
  mid:    {flex:1,minWidth:0},
  numRow: {flexDirection:'row',alignItems:'center',gap:6},
  num:    {fontSize:17,fontWeight:'700',color:C.text},
  route:  {fontSize:13,color:C.secondary,marginTop:3,fontWeight:'500'},
  subRow: {flexDirection:'row',alignItems:'center',marginTop:6},
  sub:    {fontSize:12,color:C.muted,marginTop:3,fontWeight:'500'},
  right:  {alignItems:'flex-end',flexShrink:0,minWidth:84,maxWidth:110},
  time:   {fontSize:16,fontWeight:'700',letterSpacing:-0.2},
  localLbl:{fontSize:10,fontWeight:'600',color:C.muted,marginTop:1},
  old:    {fontSize:11,color:C.muted,textDecorationLine:'line-through',marginBottom:2,fontWeight:'600'},
  badge:  {paddingHorizontal:8,paddingVertical:3,borderRadius:999,borderWidth:1},
  badgeTxt:{fontSize:11,fontWeight:'700'},
});}
let fr=makeFr(C);

function makeCx(C:ThemeColors){return StyleSheet.create({
  backdrop:   {flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'flex-end'},
  sheetWrap:  {maxHeight:'92%'},
  sheet:      {backgroundColor:C.card,borderTopLeftRadius:22,borderTopRightRadius:22,
               paddingHorizontal:20,paddingTop:10,paddingBottom:Platform.OS==='ios'?28:16,
               ...cardShadow},
  handle:     {alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:C.muted,marginBottom:14},
  head:       {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18},
  title:      {fontSize:18,fontWeight:'800',color:C.text},
  sub:        {fontSize:12,color:C.secondary,marginTop:4},
  close:      {width:32,height:32,borderRadius:16,backgroundColor:C.list,alignItems:'center',justifyContent:'center'},
  closeTxt:   {color:C.secondary,fontWeight:'700'},
  label:      {fontSize:10,fontWeight:'700',color:C.muted,letterSpacing:1.2,marginBottom:6,marginTop:4},
  input:      {backgroundColor:C.list,borderWidth:1,borderColor:C.border,borderRadius:12,
               color:C.text,fontSize:16,fontWeight:'700',paddingHorizontal:14,
               paddingVertical:Platform.OS==='ios'?13:10,marginBottom:12,letterSpacing:1},
  inlineHint: {fontSize:11,color:'#f59e0b',marginTop:-8,marginBottom:10,fontWeight:'600'},
  hint:       {fontSize:11,color:C.secondary,marginTop:-6,marginBottom:10},
  cta:        {backgroundColor:C.accent,borderRadius:12,paddingVertical:14,alignItems:'center',marginBottom:12},
  ctaTxt:     {color:themeMode==='dark'?BRAND.deep:'#fff',fontSize:15,fontWeight:'800'},
  errRow:     {flexDirection:'row',alignItems:'center',gap:8,marginBottom:10},
  err:        {color:themeMode==='light'?'#b91c1c':'#fca5a5',fontSize:12,flex:1},
  result:     {borderRadius:12,borderWidth:1,padding:16,marginTop:4},
  resultMsgRow:{flexDirection:'row',alignItems:'flex-start',gap:10,marginBottom:14},
  verdictDot: {width:10,height:10,borderRadius:5,marginTop:6},
  resultMsg:  {fontSize:15,fontWeight:'700',lineHeight:22,flex:1},
  metaRow:    {flexDirection:'row',gap:10,marginBottom:14},
  metaBox:    {flex:1,backgroundColor:'rgba(0,0,0,0.22)',borderRadius:10,padding:10},
  metaLbl:    {fontSize:9,color:C.secondary,fontWeight:'700',letterSpacing:0.8,marginBottom:4},
  metaVal:    {fontSize:15,fontWeight:'800',color:C.text},
  metaSub:    {fontSize:10,color:C.secondary,marginTop:2},
  leg:        {backgroundColor:'rgba(0,0,0,0.22)',borderRadius:12,padding:12,marginBottom:8},
  legTitle:   {fontSize:13,fontWeight:'700',color:C.text,marginBottom:4},
  legLine:    {fontSize:12,color:C.secondary},
  legTime:    {fontSize:13,fontWeight:'700',color:C.accent,marginTop:4},
  refresh:    {marginTop:8,alignItems:'center',paddingVertical:10},
  refreshTxt: {color:C.accent,fontSize:13,fontWeight:'600'},
});}
let cx=makeCx(C);

function makeRd(C:ThemeColors){return StyleSheet.create({
  backdrop:   {flex:1,backgroundColor:'rgba(0,0,0,0.45)',justifyContent:'flex-end'},
  sheet:      {backgroundColor:C.bg,borderTopLeftRadius:22,borderTopRightRadius:22,
               borderWidth:1,borderColor:C.border,overflow:'hidden',
               paddingBottom:Platform.OS==='ios'?8:4},
  grabZone:   {paddingTop:10,paddingBottom:4},
  handle:     {alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:C.muted,marginBottom:12},
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
});}
let rd=makeRd(C);

function applyTheme(mode:ThemeMode){
  themeMode=mode;
  C=THEMES[mode];
  s=makeS(C);
  map=makeMap(C);
  dc=makeDc(C);
  fr=makeFr(C);
  cx=makeCx(C);
  rd=makeRd(C);
  tb=makeTb(C);
}
