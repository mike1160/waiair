import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar';
import * as Updates from 'expo-updates';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, TextInput, Modal, Share, Linking, Animated,
  ScrollView, ActivityIndicator, RefreshControl, Platform, KeyboardAvoidingView, Pressable,
  Dimensions, PanResponder, AppState, Alert, type AppStateStatus,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Rect, Circle, Text as SvgText } from 'react-native-svg';
import {
  Train, Car, Zap, Sun, Moon, Plane, PlaneLanding, PlaneTakeoff, Map as MapIcon,
  Search, X, ChevronDown, ChevronUp, ChevronRight, Star, Check, Bell, Trash2,
  CloudSun, Cloud, CloudFog, CloudRain, CloudSnow, CloudDrizzle, CloudLightning,
  Clock, AlertTriangle, Share2, ArrowLeftRight, ScanLine, CalendarPlus, MessageCircle,
  DoorOpen, DoorClosed, Luggage, WifiOff, ArrowRightLeft, CircleAlert,
  Layers, CircleCheck, CircleX, Settings2, ArrowRight,
  Lock, LayoutDashboard,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useCallback, useMemo, Fragment, createContext, useContext } from 'react';
import ReliabilityBadge from './ReliabilityBadge';
import RadarFlightSheet, { type RadarPick } from './RadarFlightSheet';
import { buildRadarHTML } from './radarHtml';
import {
  boardingCountdownLabel,
  boardingTargetIso,
  getBoardingPhase,
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
import SettingsScreen from './SettingsScreen';
import FlightHistorySection from './FlightHistorySection';
import FlightStageTimeline from './FlightStageTimeline';
import AirportInfoCard from './AirportInfoCard';
import FlightAutocomplete from './FlightAutocomplete';
import FlightDelayHistory from './FlightDelayHistory';
import AirportDelayBanner from './AirportDelayBanner';
import AircraftInfoCard from './AircraftInfoCard';
import RunwayInfo from './RunwayInfo';
import ShareFlightCardBtn from './ShareFlightCard';
import { haptics } from './lib/haptics';
import WakeUpControl from './WakeUpControl';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
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
const FIDS_POLL_MS = 60 * 1000;            // AeroDataBox FIDS board
const TRACK_POLL_ACTIVE_MS = 15 * 1000;    // En Route / Delayed via /flight/:number
const TRACK_POLL_IDLE_MS = 20 * 1000;      // other tracked statuses
/** Fresh offline snapshot TTL — active boards must not serve data older than 60s as "live". */
const FIDS_CACHE_TTL_MS = 60 * 1000;
/** Absolute max age for true offline fallback (banner shows stale age). */
const FIDS_CACHE_STALE_MAX_MS = 3 * 60 * 60 * 1000;

function needsFastTrackPoll(status: string | undefined): boolean {
  return status === 'en-route' || status === 'delayed';
}

async function checkForUpdate(){
  try{
    if(Platform.OS==='web' || !Updates.isEnabled) return;
    const update=await Updates.checkForUpdateAsync();
    if(update.isAvailable){
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch(e){
    console.log('OTA check failed:', e);
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
    bg:'#0A0F1E', card:'#111827', list:'#1A2235', border:'#1E2D45',
    text:'#F0F4FF', secondary:'#8896B0', muted:'#8896B0',
    accent:'#C9A84C', accentDim:'#1A2235', tabOn:'#FFFFFF',
    field:'#111827', fieldBorder:'#1E2D45', gold:'#C9A84C', icon:'#C9A84C',
  },
  light: {
    bg:'#FAFAF8', card:'#FFFFFF', list:'#FFFFFF', border:'#E8E4DC',
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
  Icon:typeof Layers;
}[] = [
  { key:'all',       label:'All',       Icon:Layers },
  { key:'boarding',  label:'Boarding',  Icon:DoorOpen },
  { key:'delayed',   label:'Delayed',   Icon:Clock },
  { key:'scheduled', label:'On Time',   Icon:CircleCheck },
  { key:'landed',    label:'Landed',    Icon:PlaneLanding },
  { key:'cancelled', label:'Cancelled', Icon:CircleX },
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
  const stroke = 2;
  if(kind==='rail' || kind==='bus') return <Train size={size} color={color} strokeWidth={stroke}/>;
  if(kind==='taxi') return <Car size={size} color={BRAND.gray} strokeWidth={stroke}/>;
  if(kind==='bolt') return <Zap size={size} color={color} strokeWidth={stroke}/>;
  return <Car size={size} color={color} strokeWidth={stroke}/>;
}

type WeatherInfo = { icon:'sun'|'cloud'|'fog'|'rain'|'snow'|'drizzle'|'storm'|'default'; label:string; temp:number; wind:number };

function weatherFromCode(code:number):{icon:WeatherInfo['icon'];label:string}{
  if(code===0) return {icon:'sun', label:'Clear'};
  if(code>=1 && code<=3) return {icon:'cloud', label:'Partly cloudy'};
  if(code>=45 && code<=48) return {icon:'fog', label:'Foggy'};
  if(code>=51 && code<=67) return {icon:'rain', label:'Rainy'};
  if(code>=71 && code<=77) return {icon:'snow', label:'Snow'};
  if(code>=80 && code<=82) return {icon:'drizzle', label:'Showers'};
  if(code>=95 && code<=99) return {icon:'storm', label:'Thunderstorm'};
  return {icon:'default', label:'Weather'};
}

function WeatherGlyph({ icon, color }:{ icon:WeatherInfo['icon']; color:string }){
  const props = { size:18, color, strokeWidth:2 } as const;
  if(icon==='sun') return <CloudSun {...props}/>;
  if(icon==='cloud') return <Cloud {...props}/>;
  if(icon==='fog') return <CloudFog {...props}/>;
  if(icon==='rain') return <CloudRain {...props}/>;
  if(icon==='snow') return <CloudSnow {...props}/>;
  if(icon==='drizzle') return <CloudDrizzle {...props}/>;
  if(icon==='storm') return <CloudLightning {...props}/>;
  return <CloudSun {...props}/>;
}

function airportByIata(iata:string):Airport|undefined{
  return airportCache.get(iata.toUpperCase());
}

async function fetchWeather(lat:number, lon:number):Promise<WeatherInfo|null>{
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&timezone=auto`;
    const res=await fetch(url);
    if(!res.ok) return null;
    const json=await res.json();
    const cur=json.current??{};
    const mapped=weatherFromCode(Number(cur.weathercode??-1));
    return {
      icon:mapped.icon,
      label:mapped.label,
      temp:Math.round(Number(cur.temperature_2m??0)),
      wind:Math.round(Number(cur.windspeed_10m??0)),
    };
  } catch{ return null; }
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
}

const STATUS_CFG:Record<FlightStatus,{label:string;color:string;bg:string;desc:string;priority:number}> = {
  boarding:   {label:'Boarding',  color:'#3B82F6', bg:'#172554', desc:'Head to your gate now',    priority:0},
  'en-route': {label:'En Route',  color:'#3B82F6', bg:'#172554', desc:'Flight is in the air',     priority:1},
  delayed:    {label:'Delayed',   color:'#F59E0B', bg:'#451a03', desc:'Departure pushed back',    priority:2},
  cancelled:  {label:'Cancelled', color:'#EF4444', bg:'#450a0a', desc:'Flight has been cancelled',priority:3},
  scheduled:  {label:'Scheduled', color:'#8896B0', bg:'#0f172a', desc:'On time as planned',        priority:4},
  landed:     {label:'Landed',    color:'#22C55E', bg:'#052e16', desc:'Aircraft has arrived',      priority:5},
  unknown:    {label:'Unknown',   color:'#8896B0', bg:'#0f172a', desc:'Status unavailable',        priority:6},
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
  // AeroDataBox local times: "2026-08-12 13:25+02:00" — show airport-local clock (don't convert to device TZ)
  const s=String(iso).trim();
  if(/[+-]\d{2}:?\d{2}$/.test(s) && !/Z$/i.test(s)){
    const m=s.match(/[ T](\d{2}):(\d{2})/);
    if(m) return `${m[1]}:${m[2]}`;
  }
  try{
    const normalized=s.includes('T')?s:s.replace(' ','T');
    return new Date(normalized).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  }
  catch{ return '--:--'; }
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
  const diff=Math.floor((new Date(iso).getTime()-Date.now())/60000);
  if(diff<=0) return null;
  if(diff<60) return `${diff}m`;
  return `${Math.floor(diff/60)}h ${diff%60}m`;
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
      <Clock size={16} color={color} strokeWidth={2}/>
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
  const Icon=closed||urgent?DoorClosed:DoorOpen;
  const label=closed
    ?'Gate closed'
    :`Gate closes in ${mins} min`;

  return (
    <View style={[dc.gateClose,{borderLeftColor:color,backgroundColor:'rgba(239,68,68,0.08)'}]}>
      <Icon size={18} color={color} strokeWidth={2.2}/>
      <Text style={[dc.gateCloseTxt,{color}]}>{label}</Text>
    </View>
  );
}


// Parse AeroDataBox ICAO FIDS item (departures[] / arrivals[] entries)
function parseFIDS(raw:any, type:'arrival'|'departure'):Flight{
  // FIDS items are flat: { movement, number, status, airline, aircraft }
  // (not nested under departure/arrival — that shape is /flights/number only)
  const mov=raw.movement??raw.departure?.movement??raw.arrival?.movement??{};
  const ap=mov.airport??{};

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
  const airline=raw.airline??{};
  const gateRaw = raw.movement?.gate ?? null;
  const best=actual||revised||sched;

  return {
    id:          String(raw.number??Math.random()),
    number:      raw.number??'—',
    airline:     airline.name||airline.iata||'—',
    airlineCode: airline.iata||'—',
    origin:      type==='arrival'  ?remote.code:'',
    originCity:  type==='arrival'  ?remote.city:'',
    originCountry:type==='arrival' ?remote.country:'',
    destination: type==='departure'?remote.code:'',
    destCity:    type==='departure'?remote.city:'',
    destCountry: type==='departure'?remote.country:'',
    scheduledTime:sched,
    revisedTime:  revised,
    actualTime:   actual,
    arrivalTime:  type==='arrival'? best : '',
    departureTime:type==='departure'? best : '',
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
      arrivalTime:actual||revised, departureTime:'',
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
  return (name??'').replace(/\s+International\b/gi,'').replace(/\s+Airport\b/gi,'').trim();
}

/** Best available airport code from AeroDataBox airport object (never invent ???). */
function pickAirportCode(ap:any):string{
  if(!ap||typeof ap!=='object') return '';
  const raw=ap.iata||ap.iataCode||ap.localCode||ap.icao||ap.icaoCode||'';
  return String(raw).trim().toUpperCase();
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
  const local=code?airportByIata(code):undefined;
  return {
    code: code||'—',
    city: local?.city||city||code||'',
    flag: local?.flag||countryFlag(country)||'',
  };
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

const RATE_LIMIT_MSG='Too many requests — please wait a moment and try again';

function sleep(ms:number){
  return new Promise<void>(r=>setTimeout(r, ms));
}

async function fetchProxyJson(url:string, debugLabel=''):Promise<any>{
  const once=async()=>{
    const res=await fetch(url);
    if(res.status===429){
      const err=new Error(RATE_LIMIT_MSG) as Error & { status?:number };
      err.status=429;
      throw err;
    }
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw=await res.text();
    if(debugLabel){
      console.log(`[${debugLabel}] raw response:`, raw);
    }
    if(!raw || !raw.trim()) throw new Error('Empty response from upstream API');
    try{
      return JSON.parse(raw);
    } catch{
      throw new Error('Invalid JSON response from upstream API');
    }
  };
  try{
    return await once();
  } catch(e:any){
    if(e?.status===429){
      await sleep(2000);
      try{
        return await once();
      } catch(e2:any){
        if(e2?.status===429) throw new Error(RATE_LIMIT_MSG);
        throw e2;
      }
    }
    throw e;
  }
}

// Fetch from proxy — NO filtering, show all flights
async function fetchFIDS(iata:string, type:'arrival'|'departure'):Promise<Flight[]>{
  const json=await fetchProxyJson(`${PROXY}/fids/${iata}/${type}`);
  // AeroDataBox FIDS: arrivals → { arrivals: [...] }, departures → { departures: [...] }
  const items = type === 'arrival'
    ? (Array.isArray(json?.arrivals) ? json.arrivals : [])
    : (Array.isArray(json?.departures) ? json.departures
      : Array.isArray(json?.arrivals) ? json.arrivals : []);
  if(!Array.isArray(items) || items.length === 0) return [];
  // Mutates items: fill codeshare {name:Unknown} airports from sibling operating flights
  enrichFidsRemoteAirports(items);
  return items.map((i:any) => parseFIDS(i, type));
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
    const json=await fetchProxyJson(
      `${PROXY}/flight/${encodeURIComponent(clean)}`,
      `flight lookup ${clean}`
    );
    const items=Array.isArray(json)?json:(json?[json]:[]);
    return items.map(parseFlightStatus);
  } catch(e:any){
    const msg=(e?.message||'').toString().toLowerCase();
    if(
      msg.includes('json') ||
      msg.includes('empty response') ||
      msg.includes('unexpected end of input') ||
      msg.includes('http 404')
    ){
      throw new Error(flightLookupError(clean));
    }
    throw e;
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
  const mct=minConnectionMinutes(hub, domestic);

  const innTerm=(incoming.arrTerminal||incoming.terminal||'').trim();
  const outTerm=(outgoing.depTerminal||outgoing.terminal||'').trim();
  const sameTerminal=innTerm&&outTerm?innTerm===outTerm:null;

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
  } else if(gapMin<0){
    verdict='miss';
    message='Not enough time — connecting flight departs before arrival';
  } else if(gapMin>24*60){
    verdict='miss';
    message='These flights are not on the same day — connection unlikely';
  } else if(gapMin < mct*0.5){
    verdict='miss';
    message=`Only ${fmtDuration(gapMin)} — You will likely miss this connection`;
  } else if(gapMin < mct){
    verdict='tight';
    message=`Only ${fmtDuration(gapMin)} — Tight connection, consider informing airline`;
  } else {
    verdict='good';
    message=`You have ${fmtDuration(gapMin)} — Connection looks good`;
  }

  return { incoming, outgoing, hub:hub.toUpperCase(), arriveMs, departMs, gapMin, mct, domestic, sameTerminal, verdict, message };
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

function matchesSearch(f:Flight, q:string, type?:'arrival'|'departure', airport?:Airport):boolean{
  if(!q) return true;
  if(statusMatchesQuery(f.status, q)) return true;
  // FIDS responses often omit the local airport side — resolve it for city/code search.
  const r=type&&airport?resolveRoute(f,type,airport):null;
  const hay=[
    f.number,
    f.airline,
    f.airlineCode,
    r?.origin??f.origin,
    r?.originCity??f.originCity,
    r?.destination??f.destination,
    r?.destCity??f.destCity,
    STATUS_CFG[f.status]?.label||'',
    f.status,
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function hasFullRoute(f:Flight):boolean{
  return !!f.origin && !!f.destination;
}

/** Resolve origin→destination using flight data + selected airport for FIDS one-sided responses */
function resolveRoute(f:Flight, type:'arrival'|'departure', airport:Airport){
  if(hasFullRoute(f)){
    const o=displayAirport(f.origin, f.originCity, f.originCountry);
    const d=displayAirport(f.destination, f.destCity, f.destCountry);
    return {
      origin:o.code, originCity:o.city, originFlag:o.flag,
      destination:d.code, destCity:d.city, destFlag:d.flag,
    };
  }
  if(type==='arrival'){
    const o=displayAirport(f.origin, f.originCity, f.originCountry);
    return {
      origin:o.code, originCity:o.city||o.code, originFlag:o.flag,
      destination:airport.iata, destCity:airport.city, destFlag:airport.flag,
    };
  }
  const d=displayAirport(f.destination, f.destCity, f.destCountry);
  return {
    origin:airport.iata, originCity:airport.city, originFlag:airport.flag,
    destination:d.code, destCity:d.city||d.code, destFlag:d.flag,
  };
}

// ── Flight tracking + push / local notifications ───────────────────────────────
type TrackedFlight = {
  key:string;
  flightNumber:string;
  scheduledTime:string;
  lastStatus:FlightStatus;
  lastGate:string;
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
  activeAlert:boolean;
  airportIata:string;
  type:'arrival'|'departure';
  flight:Flight;
};

function flightSlug(number:string):string{
  return String(number||'').replace(/\s+/g,'').toUpperCase();
}

type BcbpResult = {
  flightNumber:string;
  dateIso?:string;
  from?:string;
  to?:string;
};

/** Julian day-of-year → nearest calendar date (year not stored in BCBP). */
function julianDayToIso(day:number, ref=new Date()):string|undefined{
  if(!Number.isFinite(day) || day<1 || day>366) return undefined;
  const year=ref.getFullYear();
  const candidates=[year-1, year, year+1].map(y=>{
    const d=new Date(Date.UTC(y, 0, day));
    return d;
  }).filter(d=>!Number.isNaN(d.getTime()));
  if(!candidates.length) return undefined;
  const best=candidates.reduce((a,b)=>
    Math.abs(a.getTime()-ref.getTime())<=Math.abs(b.getTime()-ref.getTime())?a:b
  );
  return best.toISOString().slice(0,10);
}

/**
 * Parse IATA BCBP (boarding pass) barcode payload.
 * Leg layout (0-based within first leg after unique header):
 *   PNR 0-6, from 7-9, to 10-12, carrier 13-15, flight 16-20 (field S),
 *   Julian date 21-23.
 * Field S = flight number: positions 13–18 (carrier+flight start) / standard
 * flight field at 16–20, trimmed; strip leading zeros on the numeric part.
 */
function parseBcbp(raw:string):BcbpResult|null{
  const data=String(raw||'').replace(/[\r\n]/g,'').trim();
  if(!data) return null;

  if(isFlightNumberQuery(data)){
    return { flightNumber:flightSlug(data) };
  }

  // Standard M-format BCBP (min unique 23 + first leg fields)
  if(/^M\d/i.test(data) && data.length>=42){
    const leg=data.slice(23);
    if(leg.length>=24){
      const from=leg.slice(7,10).trim().toUpperCase();
      const to=leg.slice(10,13).trim().toUpperCase();
      const carrier=leg.slice(13,16).trim().toUpperCase();
      // Field S — flight number (padded); positions 13-18 as fallback blob
      const flightField=leg.slice(16,21).trim().toUpperCase();
      const fieldS=leg.slice(13,19).trim().toUpperCase();
      const julianRaw=leg.slice(21,24).trim();
      const julian=parseInt(julianRaw,10);

      let flightNumber='';
      if(carrier && flightField){
        const num=flightField.replace(/^0+(?=\d)/,'');
        flightNumber=flightSlug(carrier+num);
      } else if(fieldS && isFlightNumberQuery(fieldS.replace(/\s+/g,''))){
        flightNumber=flightSlug(fieldS);
      }

      if(flightNumber && isFlightNumberQuery(flightNumber)){
        return {
          flightNumber,
          dateIso:julianDayToIso(julian),
          from:from||undefined,
          to:to||undefined,
        };
      }
    }
  }

  // Fallback: first flight-number-like token in free-form QR text
  const token=data.match(/\b([A-Z]{1,3}\s?\d{1,4}[A-Z]?)\b/i);
  if(token && isFlightNumberQuery(token[1])){
    return { flightNumber:flightSlug(token[1]) };
  }
  return null;
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

function stubFlightFromNumber(number:string, dateIso?:string):Flight{
  const clean=flightSlug(number);
  const scheduled=dateIso
    ? `${dateIso}T12:00:00.000Z`
    : new Date().toISOString();
  return {
    id:`${clean}-${scheduled}`,
    number:clean,
    airline:'—',
    airlineCode:clean.replace(/\d.*/,'')||'—',
    origin:'',
    originCity:'',
    originCountry:'',
    destination:'',
    destCity:'',
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

function toTracked(f:Flight, airportIata:string, type:'arrival'|'departure'):TrackedFlight{
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
  };
}

type NotifyKind = 'delay'|'gate'|'boarding'|'cancelled'|'landed'|'baggage'|'gateClose'|'connection';
type NotifyEvent = { kind:NotifyKind; title:string; body:string; urgent:boolean };

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
      };
    });
  } catch{ return []; }
}

/** Free tier: max 1 tracked flight. Pro: unlimited. */
const FREE_TRACK_LIMIT = 1;

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
      title:'Gate change',
      body:`${num} has moved to Gate ${gate}`,
      urgent:true,
    });
    notifiedGate=gate;
  }
  if(status==='boarding' && prev.lastStatus!=='boarding' && notifiedStatus!=='boarding'){
    events.push({
      kind:'boarding',
      title:'Now boarding',
      body:gate?`${num} is boarding at Gate ${gate}`:`${num} is boarding`,
      urgent:false,
    });
    notifiedStatus='boarding';
  }
  // Delay increased by 10+ minutes since last notified delay
  if(delay>=(notifiedDelay+10) && delay>0){
    const verb=prev.type==='arrival'?'arrives':'departs';
    events.push({
      kind:'delay',
      title:'Flight delayed',
      body:`${num} ${verb} at ${fmt(revised)} — ${delay} minutes late`,
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
    events.push({
      kind:'landed',
      title:'Flight landed',
      body:`${num} has landed`,
      urgent:false,
    });
    notifiedStatus='landed';
  }

  // Baggage belt becomes available when / after landing — notify once
  if(
    status==='landed' &&
    baggage &&
    !notifiedBaggageClaim &&
    (prev.lastStatus!=='landed' || !prev.lastBaggage)
  ){
    events.push({
      kind:'baggage',
      title:`${num} landed`,
      body:`${num} landed — Baggage belt ${baggage} is ready`,
      urgent:false,
    });
    notifiedBaggageClaim=true;
  }

  // Gate closes at T-15: push once when ≤15 min before departure
  const minsDep=minutesUntilDeparture(live);
  if(
    !notifiedGateClose &&
    minsDep!==null &&
    minsDep<=15 &&
    minsDep>=0 &&
    (status==='boarding' || status==='scheduled' || status==='delayed')
  ){
    events.push({
      kind:'gateClose',
      title:`${num} — Gate closing`,
      body:`${num} — Gate closes in 15 minutes. Board now.`,
      urgent:true,
    });
    notifiedGateClose=true;
  }

  const activeAlert=status==='delayed' || status==='cancelled' || (!!gate && gate!==prev.lastGate);

  return {
    next:{
      ...prev,
      flightNumber:num,
      scheduledTime:live.scheduledTime||prev.scheduledTime,
      lastStatus:status,
      lastGate:gate,
      lastDelay:delay,
      lastRevisedTime:revised,
      lastBaggage:baggage,
      notifiedDelay,
      notifiedGate,
      notifiedStatus,
      notifiedGateClose,
      notifiedBaggageClaim,
      activeAlert,
      flight:live,
      key:flightTrackKey({ number:num, scheduledTime:live.scheduledTime||prev.scheduledTime }),
    },
    events,
  };
}

function sortFlights(f:Flight[]):Flight[]{
  return [...f].sort((a,b)=>{
    const pa=STATUS_CFG[a.status]?.priority??9;
    const pb=STATUS_CFG[b.status]?.priority??9;
    if(pa!==pb) return pa-pb;
    const ta=a.revisedTime||a.scheduledTime;
    const tb=b.revisedTime||b.scheduledTime;
    return new Date(ta).getTime()-new Date(tb).getTime();
  });
}

// ── Route Map ──────────────────────────────────────────────────────────────────
function RouteMap({f,type,airport}:{f:Flight;type:'arrival'|'departure';airport:Airport}){
  const cfg=STATUS_CFG[f.status]??STATUS_CFG.unknown;
  const pct=Math.min(Math.max(f.progress,0),1);
  const r=resolveRoute(f,type,airport);

  return (
    <View style={map.wrap}>
      {/* Tekst eerst — volledig boven de lijn */}
      <View style={map.textRow}>
        <View style={map.col}>
          <View style={map.iataRow}>
            {r.originFlag?<Text style={map.flag}>{r.originFlag}</Text>:null}
            <Text style={map.iata}>{r.origin}</Text>
          </View>
          {r.originCity?<Text style={map.city}>{r.originCity}</Text>:null}
        </View>
        <View style={[map.col,map.colRight]}>
          <View style={map.iataRow}>
            {r.destFlag?<Text style={map.flag}>{r.destFlag}</Text>:null}
            <Text style={map.iata}>{r.destination}</Text>
          </View>
          {r.destCity?<Text style={map.city}>{r.destCity}</Text>:null}
        </View>
      </View>

      {/* Lijn als laatste element — onder de tekst */}
      <View style={map.lineRow}>
        <View style={[map.dot,{backgroundColor:cfg.color}]}/>
        <View style={map.track}>
          <View style={map.trackBg}/>
          {pct>0&&(
            <View style={[map.trackFg,{width:`${Math.round(pct*100)}%` as any,backgroundColor:cfg.color}]}/>
          )}
          {pct>0&&pct<1&&(
            <View style={[map.plane,{left:`${Math.round(pct*100)}%` as any}]}>
              <Plane size={14} color={cfg.color} strokeWidth={2.5}/>
            </View>
          )}
        </View>
        <View style={[map.dot,{backgroundColor:cfg.color}]}/>
      </View>

      <Text style={[map.statusTxt,{color:cfg.color}]}>{cfg.desc}</Text>
    </View>
  );
}

// ── Mini live radar strip (Arrivals / Departures) ──────────────────────────────
type MiniPlane = { id:string; x:number; y:number; color:string };

const MINI_LAT_MIN = 0, MINI_LAT_MAX = 25;
const MINI_LNG_MIN = 90, MINI_LNG_MAX = 140;
const MINI_W = 400, MINI_H = 120;
const MINI_AIRPORTS = [
  { iata:'BKK', lat:13.7, lng:100.5 },
  { iata:'HKT', lat:8.1, lng:98.3 },
  { iata:'SIN', lat:1.4, lng:103.8 },
  { iata:'KUL', lat:2.7, lng:101.7 },
  { iata:'DPS', lat:-8.7, lng:115.2 },
];

function MiniRadarStrip({ onOpen }:{ onOpen:()=>void }){
  const { C: colors, mode } = useTheme();
  const planes: MiniPlane[] = [];
  const count = 0;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse,{ toValue:0.25, duration:900, useNativeDriver:true }),
        Animated.timing(pulse,{ toValue:1, duration:900, useNativeDriver:true }),
      ])
    );
    loop.start();
    return ()=>loop.stop();
  },[pulse]);

  return (
    <TouchableOpacity style={mini.wrap} onPress={onOpen} activeOpacity={0.88}>
      <Svg width="100%" height={MINI_H} viewBox={`0 0 ${MINI_W} ${MINI_H}`} preserveAspectRatio="none" pointerEvents="none">
        <Rect x={0} y={0} width={MINI_W} height={MINI_H} fill={colors.bg}/>
        {planes.map(p=>(
          <Circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={1.6}
            fill={p.color}
          />
        ))}
        {MINI_AIRPORTS.filter(a=>a.lat>=MINI_LAT_MIN).map(a=>{
          const x = (a.lng - MINI_LNG_MIN) / (MINI_LNG_MAX - MINI_LNG_MIN) * MINI_W;
          const y = (1 - (a.lat - MINI_LAT_MIN) / (MINI_LAT_MAX - MINI_LAT_MIN)) * MINI_H;
          return (
            <Fragment key={a.iata}>
              <Circle cx={x} cy={y} r={2.2} fill="#3b82f6"/>
              <SvgText x={x+4} y={y+3} fill={mode==='dark'?'#ffffff':colors.text} fontSize={7} fontWeight="700">{a.iata}</SvgText>
            </Fragment>
          );
        })}
      </Svg>
      <View style={mini.liveBadge} pointerEvents="none">
        <Animated.View style={[mini.liveDot,{ opacity:pulse }]}/>
        <Text style={mini.liveTxt}>LIVE</Text>
      </View>
      <View style={mini.countBadge} pointerEvents="none">
        <Text style={mini.countTxt}>{count} live</Text>
      </View>
      <Text style={mini.hint} pointerEvents="none">SEA radar · tap for full map</Text>
    </TouchableOpacity>
  );
}

function makeMini(C:ThemeColors){
  return StyleSheet.create({
  wrap:       {marginHorizontal:16,marginBottom:10,height:120,borderRadius:12,overflow:'hidden',
               borderWidth:1,borderColor:C.border,backgroundColor:C.bg},
  liveBadge:  {position:'absolute',top:10,left:12,flexDirection:'row',alignItems:'center',gap:6,
               backgroundColor:C.card,borderRadius:10,paddingHorizontal:8,paddingVertical:4,
               borderWidth:1,borderColor:C.border,opacity:0.95},
  liveDot:    {width:7,height:7,borderRadius:4,backgroundColor:'#22c55e'},
  liveTxt:    {fontSize:10,fontWeight:'800',color:'#22c55e',letterSpacing:0.8},
  countBadge: {position:'absolute',top:10,right:12,backgroundColor:C.card,
               borderRadius:10,paddingHorizontal:8,paddingVertical:4,borderWidth:1,borderColor:C.border,opacity:0.95},
  countTxt:   {fontSize:11,fontWeight:'700',color:C.accent},
  hint:       {position:'absolute',bottom:8,left:12,fontSize:10,fontWeight:'600',color:C.muted},
  });
}
let mini = makeMini(C);

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
  if(locked && !on){
    return (
      <TouchableOpacity
        onPress={onLockedPress}
        style={[tb.btn, large&&tb.btnLg, { borderColor: BRAND.gold+'80' }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Unlock unlimited tracking with Pro"
      >
        <Lock size={large?16:13} color={BRAND.gold} strokeWidth={2.5}/>
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
        ?<Check size={large?16:13} color={mode==='dark'?BRAND.deep:'#fff'} strokeWidth={2.5}/>
        :<Bell size={large?16:13} color={theme.icon} strokeWidth={2}/>}
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
      <Share2 size={13} color={theme.icon} strokeWidth={2}/>
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
      <MessageCircle size={13} color={WA_GREEN} strokeWidth={2}/>
      <Text style={[tb.txt,{color:WA_GREEN}]}>WhatsApp</Text>
    </TouchableOpacity>
  );
}

// ── Detail Card ────────────────────────────────────────────────────────────────
function DetailCard({f,type,airport,tracked,onToggleTrack,onToast,isPro,onRequirePro,trackAtLimit}:{
  f:Flight; type:'arrival'|'departure'; airport:Airport;
  tracked:boolean; onToggleTrack:()=>void; onToast:(msg:string)=>void;
  isPro:boolean; onRequirePro:(highlight?:string)=>void; trackAtLimit?:boolean;
}){
  const { mode, C: theme } = useTheme();
  const cfg=STATUS_CFG[f.status]??STATUS_CFG.unknown;
  const isDelayed=f.delay>0;
  const isBoard=f.status==='boarding';
  const isLanded=f.status==='landed';
  const cd=countdown(bestDisplayTime(f, type));
  const since=sinceTime(f.actualTime||bestDisplayTime(f, type));
  const r=resolveRoute(f,type,airport);
  const destAp=airportByIata(r.destination);
  const transport=TRANSPORT_INFO[r.destination];
  const gateLabel=displayGate(f.gate);
  const [weather, setWeather]=useState<WeatherInfo|null>(null);
  const [weatherBusy, setWeatherBusy]=useState(false);
  const [calBusy, setCalBusy]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    if(!destAp){ setWeather(null); return; }
    setWeatherBusy(true);
    fetchWeather(destAp.lat, destAp.lon).then(w=>{
      if(!cancelled){ setWeather(w); setWeatherBusy(false); }
    });
    return ()=>{ cancelled=true; };
  },[destAp?.iata, destAp?.lat, destAp?.lon]);

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

  const addToCalendar=async()=>{
    if(calBusy) return;
    setCalBusy(true);
    try{
      await addFlightToCalendar(f, type, airport);
      onToast('Added to calendar ✅');
    } catch(e:any){
      onToast(e?.message || 'Could not add to calendar');
    } finally {
      setCalBusy(false);
    }
  };

  return (
    <View
      style={[
        dc.card,
        isBoard&&{borderColor:'#166534',backgroundColor:mode==='dark'?'#0f1a14':'#ecfdf5'},
        f.status==='cancelled'&&dc.cardCancel,
      ]}
    >
      {isBoard&&<View style={dc.boardBar}/>}

      {/* Header */}
      <View style={dc.head}>
        <View style={dc.headTop}>
          <Text style={dc.num}>{f.number}</Text>
          <ShareBtn onPress={shareFlight}/>
          <WhatsAppShareBtn flightNumber={f.number}/>
          <ShareFlightCardBtn
            flightNumber={f.number}
            origin={r.origin}
            destination={r.destination}
            status={cfg.label}
            depTime={fmt(bestDisplayTime(f, 'departure'))}
            arrTime={fmt(bestDisplayTime(f, 'arrival'))}
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
          <View style={[dc.pill,{borderColor:cfg.color+'60',backgroundColor:cfg.color+'15'}]}>
            <View style={[dc.pillDot,{backgroundColor:cfg.color}]}/>
            <Text style={[dc.pillTxt,{color:cfg.color}]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={dc.airline}>{f.airline}</Text>
        <ReliabilityBadge
          airlineCode={f.airlineCode}
          airlineName={f.airline}
          theme={theme}
        />
        <FlightDelayHistory
          flightNumber={f.number}
          theme={{
            text: theme.text,
            secondary: theme.secondary,
            muted: theme.muted,
            accent: theme.accent,
            border: theme.border,
            card: theme.card,
          }}
        />
        {f.callSign?<Text style={dc.sub}>Callsign: {f.callSign}</Text>:null}
        <TrackBtn
          on={tracked}
          onPress={onToggleTrack}
          large
          locked={!!trackAtLimit}
          onLockedPress={()=>onRequirePro('Track unlimited flights with Pro')}
        />
        {Platform.OS!=='web'?(
          <TouchableOpacity
            style={[tb.btn, tb.btnLg, calBusy&&{opacity:0.65}]}
            onPress={addToCalendar}
            disabled={calBusy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add to calendar"
          >
            {calBusy
              ?<ActivityIndicator size="small" color={theme.icon}/>
              :<CalendarPlus size={16} color={theme.icon} strokeWidth={2}/>}
            <Text style={[tb.txt, tb.txtLg]}>Add to Calendar</Text>
          </TouchableOpacity>
        ):null}
      </View>

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

      <BoardingCountdownBanner f={f}/>
      <GateCloseBanner f={f}/>

      {/* Route */}
      <View style={dc.routeBlock}>
        <View style={dc.routeTextRow}>
          <View style={dc.routeCol}>
            <View style={dc.routeIataRow}>
              {r.originFlag?<Text style={dc.routeFlag}>{r.originFlag}</Text>:null}
              <Text style={dc.routeIata}>{r.origin}</Text>
            </View>
            <Text style={dc.routeCity}>{r.originCity}</Text>
          </View>
          <View style={[dc.routeCol,dc.routeColRight]}>
            <View style={dc.routeIataRow}>
              {r.destFlag?<Text style={dc.routeFlag}>{r.destFlag}</Text>:null}
              <Text style={dc.routeIata}>{r.destination}</Text>
            </View>
            <Text style={dc.routeCity}>{r.destCity}</Text>
          </View>
        </View>
        <View style={dc.routeLineRow}>
          <View style={[dc.routeDot,{backgroundColor:cfg.color}]}/>
          <View style={dc.routeLineSeg}/>
          <View style={[dc.routeDot,{backgroundColor:cfg.color}]}/>
        </View>
      </View>

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

      {/* Banners */}
      {isDelayed&&!f.actualTime&&(
        <View style={dc.delayBanner}>
          <Clock size={15} color={themeMode==='light'?'#c2410c':'#fbbf24'} strokeWidth={2}/>
          <Text style={dc.delayTxt}>
            Delayed {f.delay} min · New {type==='arrival'?'arrival':'departure'}: {fmt(f.revisedTime||bestDisplayTime(f, type))}
          </Text>
        </View>
      )}
      {f.status==='cancelled'&&(
        <View style={dc.cancelBanner}>
          <X size={15} color={themeMode==='light'?'#b91c1c':'#fca5a5'} strokeWidth={2}/>
          <Text style={dc.cancelTxt}>Flight cancelled · Please contact your airline</Text>
        </View>
      )}

      {/* Times — actualTime > estimated/revised > scheduled */}
      <View style={dc.timesRow}>
        <View style={dc.tBox}>
          <Text style={dc.tLabel}>SCHEDULED</Text>
          <Text style={[dc.tVal,(isDelayed||!!f.actualTime)&&{color:theme.muted,textDecorationLine:'line-through'}]}>
            {fmt(f.scheduledTime)}
          </Text>
        </View>
        {isDelayed&&!f.actualTime?(
          <View style={dc.tBox}>
            <Text style={dc.tLabel}>NEW TIME</Text>
            <Text style={[dc.tVal,{color:'#f59e0b'}]}>{fmt(f.revisedTime)}</Text>
          </View>
        ):null}
        {f.actualTime?(
          <View style={dc.tBox}>
            <Text style={dc.tLabel}>ACTUAL</Text>
            <Text style={[dc.tVal,{color:'#22c55e'}]}>{fmt(f.actualTime)}</Text>
          </View>
        ):null}
        {cd&&(
          <View style={dc.tBox}>
            <Text style={dc.tLabel}>{isBoard?'BOARDS IN':type==='arrival'?'LANDS IN':'DEPARTS IN'}</Text>
            <Text style={[dc.tVal,{color:cfg.color}]}>{cd}</Text>
          </View>
        )}
        {isLanded&&since&&(
          <View style={dc.tBox}>
            <Text style={dc.tLabel}>LANDED</Text>
            <Text style={[dc.tVal,{color:'#a78bfa',fontSize:14}]}>{since}</Text>
          </View>
        )}
      </View>

      {/* Info grid */}
      <View style={dc.infoGrid}>
        <View style={dc.iBox}>
          <Text style={dc.iLabel}>GATE</Text>
          <Text style={[dc.iVal, isBoard && gateLabel!=='—' && {color:'#22c55e'}]}>
            {gateLabel}
          </Text>
        </View>
        {f.terminal?(
          <View style={dc.iBox}>
            <Text style={dc.iLabel}>TERMINAL</Text>
            <Text style={dc.iVal}>{f.terminal}</Text>
          </View>
        ):null}
        {f.baggage?(
          <View style={dc.iBox}>
            <Text style={dc.iLabel}>BAGGAGE</Text>
            <View style={dc.iValRow}>
              <Luggage size={14} color={theme.icon} strokeWidth={2}/>
              <Text style={dc.iVal}>{f.baggage}</Text>
            </View>
          </View>
        ):null}
        {f.runway?(
          <View style={dc.iBox}>
            <Text style={dc.iLabel}>RUNWAY</Text>
            <Text style={dc.iVal}>{f.runway}</Text>
          </View>
        ):null}
      </View>

      <RunwayInfo
        airportIata={type==='departure'?airport.iata:(r.origin||airport.iata)}
        activeRunway={f.runway}
        theme={{
          text: theme.text,
          secondary: theme.secondary,
          muted: theme.muted,
          accent: theme.accent,
          border: theme.border,
          list: theme.list,
        }}
      />

      {/* Aircraft */}
      {(f.aircraft||f.aircraftReg)?(
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
      ):null}

      {/* Weather at destination */}
      {destAp?(
        <View style={dc.weatherBox}>
          <Text style={dc.weatherTitle}>WEATHER · {r.destination}</Text>
          {weatherBusy&&!weather?(
            <ActivityIndicator size="small" color={theme.accent}/>
          ):weather?(
            <View style={dc.weatherRow}>
              <WeatherGlyph icon={weather.icon} color={theme.icon}/>
              <Text style={dc.weatherTxt}>
                {weather.temp}°C · {weather.label} · Wind {weather.wind} km/h
              </Text>
            </View>
          ):(
            <Text style={dc.weatherTxt}>Weather unavailable</Text>
          )}
        </View>
      ):null}

      {/* Transport */}
      {transport?(
        <View style={dc.transportBox}>
          <Text style={dc.transportTitle}>GET INTO TOWN · {r.destination}</Text>
          <View style={dc.transportOpts}>
            {transport.options.map((opt, i)=>(
              <TouchableOpacity
                key={`${opt.kind}-${i}`}
                style={[
                  dc.transportOptRow,
                  { borderLeftColor: TRANSPORT_ACCENT[opt.kind] },
                ]}
                onPress={()=>openTransportOption(opt, transport)}
                activeOpacity={0.7}
              >
                <View style={[dc.transportIconWrap, { backgroundColor: `${TRANSPORT_ACCENT[opt.kind]}18` }]}>
                  <TransportOptionIcon kind={opt.kind} color={TRANSPORT_ACCENT[opt.kind]}/>
                </View>
                <Text style={dc.transportOptTxt}>{opt.name}</Text>
                <Text style={dc.transportOptPrice}>{opt.price}</Text>
                <ArrowRight size={14} color={theme.secondary} strokeWidth={2}/>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ):null}

      <View style={{ marginTop: transport ? 12 : 16 }}>
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
      </View>
    </View>
  );
}

// ── Flight Row ─────────────────────────────────────────────────────────────────
function FlightRow({f,type,active,onPress,tracked}:{
  f:Flight; type:'arrival'|'departure'; active:boolean; onPress:()=>void;
  tracked?:boolean;
}){
  const { mode, C: theme } = useTheme();
  const cfg=STATUS_CFG[f.status]??STATUS_CFG.unknown;
  const isDelayed=f.delay>0;
  const full=hasFullRoute(f);
  const other=type==='arrival'?f.origin:f.destination;
  const city=type==='arrival'?f.originCity:f.destCity;
  const otherLabel=displayAirport(other, city, type==='arrival'?f.originCountry:f.destCountry);
  const flag=otherLabel.flag||countryFlag(type==='arrival'?f.originCountry:f.destCountry);
  const cd=countdown(bestDisplayTime(f, type));
  const since=sinceTime(f.actualTime||bestDisplayTime(f, type));

  return (
    <TouchableOpacity
      style={[
        fr.row,
        active&&fr.active,
        f.status==='boarding'&&{backgroundColor:mode==='dark'?'#0f1a14':'#ecfdf5'},
        f.status==='cancelled'&&fr.cancel,
      ]}
      onPress={onPress} activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${f.number}, open flight details`}
    >
      <View style={[fr.dot,{backgroundColor:cfg.color}]}/>
      <View style={fr.c1}>
        <View style={fr.numRow}>
          <Text style={fr.num}>{f.number}</Text>
          {tracked ? <Bell size={12} color={theme.accent} strokeWidth={2.4}/> : null}
        </View>
        <Text style={fr.airl} numberOfLines={1}>{f.airline}</Text>
        {f.aircraftReg?<Text style={fr.reg}>{f.aircraftReg}</Text>:null}
      </View>
      <View style={fr.c2}>
        {full?(
          <>
            <Text style={fr.iata}>{f.origin} → {f.destination}</Text>
            <Text style={fr.city}>
              {(f.originCity||f.origin)||'—'} · {(f.destCity||f.destination)||'—'}
            </Text>
          </>
        ):(
          <>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
              {flag?<Text style={{fontSize:11}}>{flag}</Text>:null}
              <Text style={fr.iata}>{otherLabel.code}</Text>
            </View>
            <Text style={fr.city}>{otherLabel.city||otherLabel.code}</Text>
          </>
        )}
      </View>
      <View style={fr.c3}>
        {displayGate(f.gate)==='—'
          ?<Text style={fr.nogate}>—</Text>
          :<Text style={[fr.gate,f.status==='boarding'&&{color:'#22c55e'}]}>G{f.gate}</Text>}
        {f.terminal?<Text style={fr.term}>T{f.terminal}</Text>:null}
        {f.baggage?(
          <View style={fr.bagRow}>
            <Luggage size={11} color={theme.icon} strokeWidth={2}/>
            <Text style={fr.bag}>{f.baggage}</Text>
          </View>
        ):null}
      </View>
      <View style={fr.c4}>
        <Text style={[fr.time,{color:f.actualTime?'#22c55e':isDelayed?'#f59e0b':cfg.color}]}>
          {fmt(bestDisplayTime(f, type))}
        </Text>
        {f.actualTime && f.scheduledTime && fmt(f.actualTime)!==fmt(f.scheduledTime)
          ?<Text style={fr.old}>{fmt(f.scheduledTime)}</Text>
          :isDelayed
          ?<Text style={fr.old}>{fmt(f.scheduledTime)}</Text>
          :cd?<Text style={fr.cd}>in {cd}</Text>
          :since?<Text style={fr.since}>{since}</Text>
          :null}
        {isDelayed && !f.actualTime?<Text style={fr.delay}>+{f.delay}m</Text>:null}
      </View>
    </TouchableOpacity>
  );
}

/** My Flights tab — timeline of tracked flights */
function BoardingPassScannerModal({
  visible, onClose, onParsed,
}:{
  visible:boolean;
  onClose:()=>void;
  onParsed:(result:BcbpResult)=>void;
}){
  const { C: theme } = useTheme();
  const [permission, requestPermission]=useCameraPermissions();
  const [err, setErr]=useState('');
  const lockRef=useRef(false);

  useEffect(()=>{
    if(!visible){
      lockRef.current=false;
      setErr('');
      return;
    }
    if(permission && !permission.granted && permission.canAskAgain){
      requestPermission().catch(()=>{});
    }
  },[visible, permission, requestPermission]);

  const onBarcodeScanned=(scan:BarcodeScanningResult)=>{
    if(lockRef.current) return;
    const parsed=parseBcbp(scan?.data||'');
    if(!parsed){
      setErr('Could not read boarding pass. Try again or enter the flight number.');
      return;
    }
    lockRef.current=true;
    setErr('');
    onParsed(parsed);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[scanSt.root,{backgroundColor:theme.bg}]}>
        <View style={scanSt.head}>
          <TouchableOpacity
            onPress={onClose}
            style={[scanSt.close,{backgroundColor:theme.list}]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <X size={18} color={theme.text} strokeWidth={2.2}/>
          </TouchableOpacity>
          <View style={{flex:1}}>
            <Text style={[scanSt.title,{color:theme.text}]}>Scan boarding pass</Text>
            <Text style={[scanSt.sub,{color:theme.secondary}]}>
              PDF417 · QR · Aztec
            </Text>
          </View>
        </View>

        {Platform.OS==='web'?(
          <View style={scanSt.center}>
            <Text style={[scanSt.hint,{color:theme.secondary}]}>
              Camera scanning is available in the iOS and Android apps.
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={[scanSt.manualTxt,{color:theme.accent}]}>Enter manually</Text>
            </TouchableOpacity>
          </View>
        ):!permission?.granted?(
          <View style={scanSt.center}>
            <Text style={[scanSt.hint,{color:theme.secondary}]}>
              Camera access is needed to scan your boarding pass.
            </Text>
            <TouchableOpacity
              style={[scanSt.permBtn,{backgroundColor:theme.accent}]}
              onPress={()=>requestPermission()}
            >
              <Text style={scanSt.permBtnTxt}>Allow camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={[scanSt.manualTxt,{color:theme.accent}]}>Enter manually</Text>
            </TouchableOpacity>
          </View>
        ):(
          <View style={scanSt.camWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes:['pdf417','qr','aztec'],
              }}
              onBarcodeScanned={onBarcodeScanned}
            />
            <View style={scanSt.frame} pointerEvents="none"/>
            <View style={scanSt.camFooter} pointerEvents="box-none">
              <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Enter manually">
                <Text style={scanSt.manualCamTxt}>Enter manually</Text>
              </TouchableOpacity>
              <Text style={scanSt.camHint}>Align the barcode inside the frame</Text>
            </View>
          </View>
        )}

        {err?(
          <Text style={[scanSt.err,{color:themeMode==='light'?'#b91c1c':'#fca5a5'}]}>{err}</Text>
        ):null}
      </View>
    </Modal>
  );
}

const scanSt = StyleSheet.create({
  root:      {flex:1,paddingTop:Platform.OS==='ios'?56:24},
  head:      {flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:16,gap:12},
  title:     {fontSize:20,fontWeight:'800'},
  sub:       {fontSize:13,fontWeight:'500',marginTop:4},
  close:     {width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  center:    {flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:16},
  hint:      {fontSize:14,textAlign:'center',lineHeight:20},
  permBtn:   {paddingHorizontal:18,paddingVertical:12,borderRadius:12},
  permBtnTxt:{color:'#fff',fontWeight:'700',fontSize:14},
  manualTxt: {fontSize:14,fontWeight:'700'},
  camWrap:   {flex:1,marginHorizontal:16,marginBottom:24,borderRadius:16,overflow:'hidden',backgroundColor:'#000'},
  frame:     {position:'absolute',left:'10%',right:'10%',top:'28%',bottom:'28%',
              borderWidth:2,borderColor:'rgba(255,255,255,0.85)',borderRadius:12},
  camFooter: {position:'absolute',left:16,right:16,bottom:18,alignItems:'center',gap:10},
  manualCamTxt:{color:'#fff',fontSize:14,fontWeight:'700',textDecorationLine:'underline',
                backgroundColor:'rgba(0,0,0,0.45)',paddingHorizontal:12,paddingVertical:6,borderRadius:10,
                overflow:'hidden'},
  camHint:   {color:'#fff',fontSize:12,fontWeight:'600',textAlign:'center',
              backgroundColor:'rgba(0,0,0,0.45)',paddingHorizontal:12,paddingVertical:6,borderRadius:10,
              overflow:'hidden'},
  err:       {marginHorizontal:20,marginBottom:24,fontSize:13,fontWeight:'600',textAlign:'center'},
});

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
      <Text style={s.addTitle}>Add a flight</Text>
      <Text style={s.addSub}>Scan a boarding pass or type the flight number</Text>

      {Platform.OS!=='web'?(
        <TouchableOpacity
          style={s.scanBtn}
          onPress={onOpenScanner}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Scan boarding pass barcode"
        >
          <ScanLine size={18} color="#fff" strokeWidth={2.2}/>
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
        <Bell size={28} color={theme.muted} strokeWidth={1.8}/>
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
          <Bell size={14} color={theme.accent} strokeWidth={2}/>
          <Text style={[s.secLabel,{color:theme.accent}]}>Timeline</Text>
        </View>
        <Text style={[s.secCount,{color:theme.text,backgroundColor:theme.accentDim}]}>{sorted.length}</Text>
      </View>
      {sorted.map((f,i)=>{
        const cfg=STATUS_CFG[f.status]??STATUS_CFG.unknown;
        const label=boardingCountdownLabel(f);
        const phase=getBoardingPhase(f);
        const active=selectedId===f.id;
        const route=`${f.origin||'—'} → ${f.destination||'—'}`;
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
                  <Text style={s.myNum}>{f.number}</Text>
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
                    <Trash2 size={16} color={theme.muted} strokeWidth={2}/>
                  </TouchableOpacity>
                </View>
                <Text style={s.myRoute}>{route}</Text>
                <Text style={s.myAirline} numberOfLines={1}>{f.airline}</Text>
                {f.baggage?(
                  <View style={s.myBagRow}>
                    <Luggage size={13} color={theme.icon} strokeWidth={2}/>
                    <Text style={s.myBagTxt}>Belt {f.baggage}</Text>
                  </View>
                ):null}
                <Text style={[s.myCd,{
                  color:phase==='boarding'?'#22c55e':phase==='departed'?'#94a3b8':theme.accent,
                }]}>
                  {label||fmt(f.revisedTime||f.scheduledTime)}
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
                    ?<CircleAlert size={18} color="#dc2626" strokeWidth={2.2}/>
                    :<ArrowRightLeft size={18} color="#d97706" strokeWidth={2.2}/>}
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
  visible, onClose, defaultHub, defaultIncoming='',
}:{ visible:boolean; onClose:()=>void; defaultHub:string; defaultIncoming?:string }){
  const { mode, C: theme } = useTheme();
  const [inn, setInn]=useState('');
  const [out, setOut]=useState('');
  const [hub, setHub]=useState(defaultHub);
  const [busy, setBusy]=useState(false);
  const [err, setErr]=useState('');
  const [result, setResult]=useState<ConnResult|null>(null);

  useEffect(()=>{
    if(!visible) return;
    setHub('');
    setErr('');
    setResult(null);
    setOut('');
    setInn(defaultIncoming.trim().toUpperCase());
  },[visible, defaultHub, defaultIncoming]);

  const isDigitsOnlyFlight=(v:string)=>/^\d+$/.test(v.trim());

  const run=async()=>{
    const a=inn.trim(), b=out.trim();
    if(!a||!b){ setErr('Enter both flight numbers'); return; }
    if(isDigitsOnlyFlight(a) || isDigitsOnlyFlight(b)){
      setErr('Please include airline code, e.g. PR404');
      return;
    }
    setBusy(true); setErr(''); setResult(null);
    try{
      const r=await checkConnection(a,b);
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

              {err?(
                <View style={cx.errRow}>
                  <AlertTriangle size={14} color={themeMode==='light'?'#b91c1c':'#fca5a5'} strokeWidth={2}/>
                  <Text style={cx.err}>{err}</Text>
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
                      <Text style={cx.metaLbl}>MIN REQUIRED</Text>
                      <Text style={cx.metaVal}>{result.mct}m</Text>
                      <Text style={cx.metaSub}>{result.domestic?'Domestic':'International'}</Text>
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
  { iata:'BKK', lat:13.7, lon:100.5, z:9 },
  { iata:'HKT', lat:8.1,  lon:98.3,  z:9 },
  { iata:'SIN', lat:1.4,  lon:103.8, z:9 },
  { iata:'KUL', lat:2.7,  lon:101.7, z:9 },
  { iata:'DPS', lat:-8.7, lon:115.2, z:9 },
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
      altitude:Number.isFinite(altitude as number)?(altitude as number):null,
      speedMs:Number.isFinite(speedMs as number)?(speedMs as number):null,
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
  const { mode, C: theme } = useTheme();
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sheetH = Math.round(Dimensions.get('window').height * 0.9);
  const translateY = useRef(new Animated.Value(sheetH)).current;
  const closing = useRef(false);
  const lastStates = useRef<any[] | null>(null);

  const [pick, setPick] = useState<RadarPick|null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flightBusy, setFlightBusy] = useState(false);
  const [flightErr, setFlightErr] = useState('');
  const [radarFlight, setRadarFlight] = useState<Flight|null>(null);

  const html = useMemo(
    ()=>buildRadarHTML(airport.lat, airport.lon, 7, mode),
    [airport.iata, mode]
  );

  const pushStates = useCallback((states:any[])=>{
    lastStates.current = states;
    if(Platform.OS==='web'){
      const win = iframeRef.current?.contentWindow as (Window & { applyRadarStates?:(s:any[])=>void })|null;
      win?.applyRadarStates?.(states);
      return;
    }
    webRef.current?.injectJavaScript(
      `window.applyRadarStates && window.applyRadarStates(${JSON.stringify(states)}); true;`
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
    if(lastStates.current) pushStates(lastStates.current);
  },[pushStates]);

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
                <Text style={rd.title}>Live Radar · SEA</Text>
                <Text style={rd.sub}>Live map · tap a plane</Text>
              </View>
              <TouchableOpacity onPress={dismiss} style={rd.close} hitSlop={10} accessibilityLabel="Close radar">
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
      <AppBody/>
    </ThemeCtx.Provider>
  );
}

function AppBody(){
  const { mode, toggle, C: theme } = useTheme();
  const [airport,    setAirport]    = useState(FALLBACK_AIRPORT);
  const [locReady,   setLocReady]   = useState(false);
  const [tab,        setTab]        = useState<AppTab>('arrival');
  const [showRadar,  setShowRadar]  = useState(false);
  const [flights,    setFlights]    = useState<Flight[]>(DEMO);
  const [selected,   setSelected]   = useState<Flight>(DEMO[0]);
  const [search, setSearch] = useState('');
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
  const [error,      setError]      = useState('');
  const [offlineCacheAt, setOfflineCacheAt] = useState<number|null>(null);
  const [lastUpd,    setLastUpd]    = useState('');
  const [tracked,    setTracked]    = useState<TrackedFlight[]>([]);
  const [toast,      setToast]      = useState<string|null>(null);
  const [notifyBanner, setNotifyBanner] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallHighlight, setPaywallHighlight] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [airport2, setAirport2] = useState<Airport|null>(null);
  const [flights2, setFlights2] = useState<Flight[]>([]);
  const [pickerSlot, setPickerSlot] = useState<'primary'|'secondary'>('primary');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const timer = useRef<any>(null);
  const trackTimer = useRef<any>(null);
  const searchTimer = useRef<any>(null);
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
  useEffect(()=>{ isProRef.current=isPro; },[isPro]);

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

  // Load tracked flights + favorites; notification permission + Expo push token
  useEffect(()=>{
    checkForUpdate().catch(()=>{});
    initPurchases()
      .then(()=>checkProStatus())
      .then(setIsPro)
      .catch(()=>setIsPro(false));
    const unsubPro=subscribeProStatus((pro)=>setIsPro(pro));
    AsyncStorage.getItem(AIRPORT2_KEY).then(raw=>{
      if(!raw) return;
      try{
        const a=JSON.parse(raw) as Airport;
        if(a?.iata) setAirport2(a);
      } catch{ /* ignore */ }
    }).catch(()=>{});
    loadTracked().then(list=>{
      setTracked(list);
      syncAlertBadge(list);
      // Pro surfaces (Live Activity / home widget) sync after isPro is known
    });
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

  // Auto-select nearest airport from device location
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const nearest=await detectNearestAirport();
      if(!cancelled){ setAirport(nearest); setLocReady(true); }
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
        for(const event of events) await notifyFlight(next.flightNumber, event);
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
    if(isProRef.current){
      await syncAllLiveActivities(dedup.map(t=>({key:t.key, flight:t.flight})));
      syncHomeScreenWidget(dedup).catch(()=>{});
    }
  },[]);

  const pollTracked=useCallback(async()=>{
    const list=trackedRef.current;
    if(!list.length) return;

    const lives:Flight[]=[];
    for(const t of list){
      try{
        const hits=await fetchFlightByNumber(t.flightNumber);
        const live=matchTrackedHit(t, hits);
        if(live) lives.push(live);
      } catch{ /* keep previous snapshot */ }
    }
    if(lives.length) await applyLiveUpdates(lives);
    if(isProRef.current){
      await syncAllLiveActivities(
        trackedRef.current.map(t=>({key:t.key, flight:t.flight})),
      );
      await syncHomeScreenWidget(trackedRef.current);
    }
  },[applyLiveUpdates]);

  // AeroDataBox /flight/:number: 15s En Route/Delayed, else 20s
  const trackPollMs=useMemo(()=>{
    const hot=tracked.some(t=>needsFastTrackPoll(t.lastStatus)||needsFastTrackPoll(t.flight?.status));
    return hot ? TRACK_POLL_ACTIVE_MS : TRACK_POLL_IDLE_MS;
  },[tracked]);

  useEffect(()=>{
    if(trackTimer.current) clearInterval(trackTimer.current);
    if(!tracked.length) return;
    pollTracked();
    trackTimer.current=setInterval(()=>{ pollTracked(); }, trackPollMs);
    return ()=>clearInterval(trackTimer.current);
  },[tracked.length, pollTracked, trackPollMs]);

  const flightTab: FidsTab = tab==='departure' ? 'departure' : 'arrival';

  const toggleTrack=useCallback(async(f:Flight)=>{
    haptics.medium();
    const key=flightTrackKey(f);
    const exists=trackedRef.current.some(t=>t.key===key);
    if(exists){
      const next=trackedRef.current.filter(t=>t.key!==key);
      setTracked(next);
      await saveTracked(next);
      await syncAlertBadge(next);
      await endLiveActivity(key, toFlightActivityProps(f));
      if(isProRef.current) syncHomeScreenWidget(next).catch(()=>{});
      else syncHomeScreenWidget([]).catch(()=>{});
      showToast('Tracking gestopt');
      return;
    }
    if(!isProRef.current && trackedRef.current.length >= FREE_TRACK_LIMIT){
      setPaywallHighlight('Track unlimited flights with Pro');
      setShowPaywall(true);
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
    if(isProRef.current){
      await startOrUpdateLiveActivity(key, f);
      syncHomeScreenWidget(next).catch(()=>{});
    }
    showToast(`${f.number} wordt gevolgd`);
  },[airport.iata,tab,showToast]);

  const addTrackByNumber=useCallback(async(flightNumber:string, dateIso?:string)=>{
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
      if(!flight) flight=stubFlightFromNumber(clean, dateIso);

      const key=flightTrackKey(flight);
      const already=trackedRef.current.some(t=>t.key===key || flightSlug(t.flightNumber)===clean);
      if(already){
        const existing=trackedRef.current.find(t=>t.key===key || flightSlug(t.flightNumber)===clean);
        if(existing) setSelected(existing.flight);
        showToast(`${clean} added — tracking now`);
        return;
      }

      if(!isProRef.current && trackedRef.current.length >= FREE_TRACK_LIMIT){
        setPaywallHighlight('Track unlimited flights with Pro');
        setShowPaywall(true);
        return;
      }

      const dir: FidsTab =
        flight.origin && flight.origin===airport.iata ? 'departure'
        : flight.destination && flight.destination===airport.iata ? 'arrival'
        : 'departure';
      const entry=toTracked(flight, airport.iata, dir);
      const next=[...trackedRef.current, entry];
      setTracked(next);
      await saveTracked(next);
      await syncAlertBadge(next);
      if(isProRef.current){
        await startOrUpdateLiveActivity(key, flight);
        syncHomeScreenWidget(next).catch(()=>{});
      }
      setSelected(flight);
      applyLiveUpdates([flight]);
      showToast(`${clean} added — tracking now`);
    } catch(e:any){
      showToast(e?.message || `Could not add ${clean}`);
    } finally {
      setAddBusy(false);
    }
  },[airport.iata, showToast, applyLiveUpdates]);

  const onBoardingPassParsed=useCallback((result:BcbpResult)=>{
    setShowScanner(false);
    addTrackByNumber(result.flightNumber, result.dateIso).catch(()=>{});
  },[addTrackByNumber]);

  const isTracked=(f:Flight)=>tracked.some(t=>t.key===flightTrackKey(f));

  const selectFlight=useCallback((f:Flight)=>{
    setSelected(f);
    scrollRef.current?.scrollTo({ y:0, animated:true });
  },[]);

  const load=useCallback(async(iata:string,type:'arrival'|'departure',silent=false)=>{
    if(!silent) setLoading(true);
    setError('');
    try{
      const data=await fetchFIDS(iata,type);
      if(data.length>0){
        const s=sortFlights(data);
        setFlights(s); setIsLive(true);
        setOfflineCacheAt(null);
        setSelected(prev=>s.find(f=>f.id===prev.id)??s[0]);
        applyLiveUpdates(s);
        saveFidsCache(iata, type, s).catch(()=>{});
      } else {
        const cached=await loadFidsCache(iata, type, { allowStale:true });
        if(cached?.flights?.length){
          const s=sortFlights(cached.flights);
          setFlights(s); setIsLive(false);
          setOfflineCacheAt(cached.ts);
          setSelected(prev=>s.find(f=>f.id===prev.id)??s[0]);
          setError('');
        } else {
          const s=sortFlights(DEMO);
          setFlights(s); setIsLive(false);
          setOfflineCacheAt(null);
          setSelected(prev=>s.find(f=>f.id===prev.id)??s[0]);
          setError('No flights in API response — showing demo data');
        }
      }
    } catch(e:any){
      const cached=await loadFidsCache(iata, type, { allowStale:true });
      if(cached?.flights?.length){
        const s=sortFlights(cached.flights);
        setFlights(s); setIsLive(false);
        setOfflineCacheAt(cached.ts);
        setSelected(prev=>s.find(f=>f.id===prev.id)??s[0]);
        setError('');
      } else {
        const s=sortFlights(DEMO);
        setFlights(s); setIsLive(false);
        setOfflineCacheAt(null);
        setSelected(prev=>s.find(f=>f.id===prev.id)??s[0]);
        setError('Proxy offline · Run: cd ~/WaiAir/proxy && node server.js');
      }
    } finally {
      setLoading(false); setRefreshing(false);
      setLastUpd(new Date().toLocaleTimeString('en-GB'));
    }
  },[applyLiveUpdates]);

  useEffect(()=>{
    if(!locReady) return;
    if(tab==='myflights') return;
    setSearch('');
    setGlobalHits(null);
    load(airport.iata, tab==='departure' ? 'departure' : 'arrival');
    // FIDS (AeroDataBox): fixed 60s — gate/terminal/schedule
    timer.current=setInterval(
      ()=>load(airport.iata, tab==='departure' ? 'departure' : 'arrival', true),
      FIDS_POLL_MS,
    );
    return ()=>clearInterval(timer.current);
  },[airport,tab,locReady,load]);

  // Second airport arrivals (Pro multi-airport)
  useEffect(()=>{
    if(!locReady || !isPro || !airport2 || tab!=='arrival' || showRadar){
      if(!airport2) setFlights2([]);
      return;
    }
    let cancelled=false;
    const pull=async(silent=false)=>{
      try{
        const data=await fetchFIDS(airport2.iata,'arrival');
        if(cancelled) return;
        setFlights2(sortFlights(data.length?data:[]));
      } catch{
        if(!cancelled && !silent) setFlights2([]);
      }
    };
    pull();
    const id=setInterval(()=>pull(true),FIDS_POLL_MS);
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

  const query=search.trim().toLowerCase();
  const flightNumberQuery=isFlightNumberQuery(search.trim());
  /** Global mode once a flight-number lookup is in flight or finished (any airport). */
  const globalMode=flightNumberQuery && (globalBusy || globalHits!==null);

  /** Full Arrivals/Departures pool (before status + text filter) */
  const poolSorted=useMemo(()=>{
    if(flightNumberQuery && globalHits && globalHits.length>0) return sortFlights(globalHits);
    if(flightNumberQuery && globalHits!==null) return [];
    return sortFlights(flights);
  },[flights, globalHits, flightNumberQuery]);

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
    if(query && !globalMode){
      list=list.filter(f=>matchesSearch(f, query, flightTab, airport));
    }
    return list;
  },[poolSorted, statusFilter, query, globalMode, flightTab, airport]);

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
    if(await checkProStatus()){
      setIsPro(true);
      return;
    }
    setPaywallHighlight(highlight||'');
    setShowPaywall(true);
  },[]);

  // When Pro unlocks, push Live Activities + home widget for current tracked flights
  useEffect(()=>{
    if(!isPro){
      syncHomeScreenWidget([]).catch(()=>{});
      return;
    }
    const list=trackedRef.current;
    if(!list.length) return;
    reconcileLiveActivities(list.map(t=>({key:t.key, flight:t.flight}))).catch(()=>{});
    syncHomeScreenWidget(list).catch(()=>{});
  },[isPro]);

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
            onPress={toggle}
            activeOpacity={0.8}
            hitSlop={{ top:10, bottom:10, left:10, right:10 }}
            accessibilityLabel="Toggle theme"
          >
            {mode==='dark'
              ? <Sun size={18} color={C.icon} strokeWidth={2}/>
              : <Moon size={18} color={C.icon} strokeWidth={2}/>}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.themeBtn}
            onPress={()=>setShowSettings(true)}
            activeOpacity={0.8}
            hitSlop={6}
            accessibilityLabel="Settings"
          >
            <Settings2 size={18} color={C.icon} strokeWidth={2}/>
          </TouchableOpacity>
          <Pressable
            style={{flexShrink:1,minWidth:0}}
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
                <Text style={s.apFlag}>{airport.flag}</Text>
                <View style={s.apMeta}>
                  <Text style={s.apIata}>
                    {airport.iata}{isPro&&airport2?` · ${airport2.iata}`:''}
                  </Text>
                  <Text style={s.apCity} numberOfLines={1}>
                    {isPro&&airport2?`${airport.city} + ${airport2.city}`:airport.city}
                  </Text>
                </View>
                {showPicker
                  ? <ChevronUp size={15} color={apChevronColor} strokeWidth={2.25} style={s.apChevron}/>
                  : <ChevronDown size={15} color={apChevronColor} strokeWidth={2.25} style={s.apChevron}/>}
              </Animated.View>
            )}
          </Pressable>
        </View>
      </View>

      {notifyBanner?(
        <View style={s.notifyBanner} accessibilityRole="alert">
          <Bell size={18} color="#92400e" strokeWidth={2.2} style={{marginTop:2}}/>
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
            <X size={16} color="#92400e" strokeWidth={2.4}/>
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

      <AirportDelayBanner
        iata={airport.iata}
        theme={{
          text: C.text,
          muted: C.muted,
          border: C.border,
          card: C.card,
        }}
      />

      {/* Picker */}
      {showPicker&&(
        <View style={s.picker}>
          <View style={s.pickerSearch}>
            <Search size={16} color={C.muted} strokeWidth={2}/>
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
                <X size={16} color={C.secondary} strokeWidth={2}/>
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
                      <Lock size={10} color={BRAND.gold} strokeWidth={2.5}/>
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
                : <Ionicons name="location" size={16} color={C.accent}/>}
              <Text style={[s.nearMeTxt,{color:C.accent}]}>Near me</Text>
            </TouchableOpacity>

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
                    <Star size={12} color={C.gold} strokeWidth={2} fill={C.gold}/>
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
                      {(pickerSlot==='secondary'?a.iata===airport2?.iata:a.iata===airport.iata)&&<Check size={16} color="#22c55e" strokeWidth={2.5}/>}
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
                {pickerResults.map(a=>{
                  const fav=isFavouriteAirport(a.iata);
                  return (
                    <View key={a.iata} style={s.pRow}>
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
                        {(pickerSlot==='secondary'?a.iata===airport2?.iata:a.iata===airport.iata)&&<Check size={16} color="#22c55e" strokeWidth={2.5}/>}
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
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab,tab==='arrival'&&!showRadar&&s.tabOn]} onPress={()=>{ haptics.light(); setShowRadar(false); setTab('arrival'); }}>
          <PlaneLanding size={13} color={tab==='arrival'&&!showRadar?BRAND.deep:C.muted} strokeWidth={2}/>
          <Text style={[s.tabTxt,tab==='arrival'&&!showRadar&&s.tabTxtOn]} numberOfLines={1}>Arrivals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab,tab==='departure'&&!showRadar&&s.tabOn]} onPress={()=>{ haptics.light(); setShowRadar(false); setTab('departure'); }}>
          <PlaneTakeoff size={13} color={tab==='departure'&&!showRadar?BRAND.deep:C.muted} strokeWidth={2}/>
          <Text style={[s.tabTxt,tab==='departure'&&!showRadar&&s.tabTxtOn]} numberOfLines={1}>Departures</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab==='myflights'&&!showRadar&&s.tabOn]}
          onPress={()=>{ haptics.light(); setShowRadar(false); setTab('myflights'); }}
        >
          <Bell size={13} color={tab==='myflights'&&!showRadar?BRAND.deep:C.muted} strokeWidth={2}/>
          <Text style={[s.tabTxt, tab==='myflights'&&!showRadar&&s.tabTxtOn]} numberOfLines={1}>My Flights</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, showRadar&&s.tabOn]}
          onPress={()=>{ haptics.light(); setShowRadar(true); }}
        >
          <MapIcon size={13} color={showRadar?BRAND.deep:C.muted} strokeWidth={2}/>
          <Text style={[s.tabTxt, showRadar&&s.tabTxtOn]} numberOfLines={1}>Radar</Text>
        </TouchableOpacity>
      </View>

      {/* Search — available on every tab for local filter + global flight-number lookup */}
      <Pressable
        style={s.searchWrap}
        onPress={()=>searchInputRef.current?.focus()}
      >
        <Search size={16} color={C.muted} strokeWidth={2}/>
        <TextInput
          key={`fids-search-${airport.iata}-${tab}`}
          ref={searchInputRef}
          style={s.searchInput}
          value={search}
          onChangeText={onSearchChange}
          placeholder="Flight number (e.g. KL430), airline or city..."
          placeholderTextColor={theme.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          clearButtonMode="never"
          returnKeyType="search"
        />
        {globalBusy&&<ActivityIndicator size="small" color={theme.accent}/>}
        {search.length>0&&(
          <TouchableOpacity style={s.searchClear} onPress={clearSearch} hitSlop={8}>
            <X size={14} color={C.text} strokeWidth={2}/>
          </TouchableOpacity>
        )}
      </Pressable>
      <FlightAutocomplete
        query={search}
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
        }}
      />
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
            return (
              <TouchableOpacity
                key={key}
                style={[s.statusPill, on&&s.statusPillOn]}
                onPress={()=>setStatusFilter(key)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{selected:on}}
                accessibilityLabel={`${label}, ${count} flights`}
              >
                <Icon size={14} color={on?'#fff':C.muted} strokeWidth={2.2}/>
                <Text style={[s.statusPillTxt, on&&s.statusPillTxtOn]}>{label}</Text>
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
        style={s.connBtn}
        onPress={()=>{ setConnIncoming(search); setShowConn(true); }}
        activeOpacity={0.8}
      >
        <View style={s.connBtnLeft}>
          <ArrowLeftRight size={16} color={C.icon} strokeWidth={2}/>
          <View>
            <Text style={s.connBtnTxt}>Check Connection</Text>
            <Text style={s.connBtnSub}>Will I make my connection?</Text>
          </View>
        </View>
        <ChevronRight size={16} color={C.muted} strokeWidth={2}/>
      </TouchableOpacity>
      ):null}

      <ConnectionModal
        visible={showConn}
        onClose={()=>setShowConn(false)}
        defaultHub={airport.iata}
        defaultIncoming={connIncoming}
      />

      <RadarModal
        visible={showRadar}
        onClose={()=>setShowRadar(false)}
        airport={airport}
        isTracked={isTracked}
        onToggleTrack={toggleTrack}
      />

      <BoardingPassScannerModal
        visible={showScanner}
        onClose={()=>setShowScanner(false)}
        onParsed={onBoardingPassParsed}
      />

      <ProPaywallScreen
        visible={showPaywall}
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
      />

      {offlineCacheAt?(
        <View style={s.offlineBanner} accessibilityRole="text">
          <WifiOff size={14} color={themeMode==='light'?'#6b7280':'#94a3b8'} strokeWidth={2}/>
          <Text style={s.offlineBannerTxt}>
            Offline — showing data from {fmtCacheAge(offlineCacheAt)}
          </Text>
        </View>
      ):null}

      {/* Error */}
      {error?(
        <View style={s.errBanner}>
          <AlertTriangle size={14} color={themeMode==='light'?'#b91c1c':'#fca5a5'} strokeWidth={2}/>
          <Text style={s.errTxt}>{error}</Text>
        </View>
      ):null}

      {!locReady||(loading&&tab!=='myflights'&&!globalMode)?(
        <View style={[s.center,{flex:1}]}>
          <ActivityIndicator size="large" color={C.accent}/>
          <Text style={s.loadTxt}>
            {!locReady?`Finding nearest airport…`:`Loading ${airport.iata} · ${airport.name}`}
          </Text>
        </View>
      ):(
        <ScrollView
          ref={scrollRef}
          style={{flex:1}}
          contentContainerStyle={{flexGrow:1}}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          refreshControl={<RefreshControl
            refreshing={refreshing}
            onRefresh={async()=>{
              haptics.light();
              setRefreshing(true);
              if(tab==='myflights'){
                try{ await pollTracked(); } finally{ setRefreshing(false); }
              } else {
                load(airport.iata,flightTab);
              }
            }}
            tintColor={C.accent}
          />}
        >
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
                return (
                  <>
                    <RouteMap f={detail} type={detailType} airport={airport}/>
                    <DetailCard
                      f={detail}
                      type={detailType}
                      airport={airport}
                      tracked={isTracked(detail)}
                      onToggleTrack={()=>toggleTrack(detail)}
                      onToast={showToast}
                      isPro={isPro}
                      onRequirePro={requirePro}
                      trackAtLimit={!isPro && tracked.length >= FREE_TRACK_LIMIT}
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
              <Text style={s.listAirport}>Global flight search</Text>
            </View>
          ):null}
          {tab!=='myflights'?(
            <MiniRadarStrip onOpen={()=>setShowRadar(true)}/>
          ):null}
          {globalBusy&&sorted.length===0?(
            <View style={s.center}>
              <ActivityIndicator size="large" color={C.accent}/>
              <Text style={s.loadTxt}>Global · searching...</Text>
            </View>
          ):null}
          {sorted.length>0?(
            <>
              <RouteMap f={selected} type={flightTab} airport={airport}/>
              <DetailCard
                f={selected}
                type={flightTab}
                airport={airport}
                tracked={isTracked(selected)}
                onToggleTrack={()=>toggleTrack(selected)}
                onToast={showToast}
                isPro={isPro}
                onRequirePro={requirePro}
                trackAtLimit={!isPro && tracked.length >= FREE_TRACK_LIMIT}
              />
            </>
          ):null}

          {/* List header */}
          <View style={s.listHead}>
            <View style={{flex:1,paddingRight:12}}>
              <View style={s.listTitleRow}>
                <Text style={s.listTitle}>
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
                <Text style={s.listAirport} numberOfLines={1}>
                  {airport.flag}  {airport.name}
                </Text>
              ):null}
            </View>
            <View style={s.listMeta}>
              {isLive
                ?<View style={s.livePill}><Text style={s.liveTxt}>LIVE</Text></View>
                :<Text style={s.demoTxt}>Demo</Text>}
              <Text style={s.updTxt}>{lastUpd}</Text>
            </View>
          </View>

          <View style={s.colHead}>
            <View style={{width:8}}/>
            <Text style={[s.colTxt,{width:118}]}>FLIGHT</Text>
            <Text style={[s.colTxt,{flex:1}]}>{globalMode?'ROUTE':(flightTab==='arrival'?'FROM':'TO')}</Text>
            <Text style={[s.colTxt,{width:56,textAlign:'center'}]}>GATE</Text>
            <Text style={[s.colTxt,{width:90,textAlign:'right'}]}>TIME</Text>
          </View>
          <View style={s.list}>
            {sorted.map((f,i)=>(
              <View key={`${f.id}-${i}`}>
                {i>0&&<View style={s.sep}/>}
                <FlightRow
                  f={f}
                  type={flightTab}
                  active={selected.id===f.id}
                  onPress={()=>selectFlight(f)}
                  tracked={isTracked(f)}
                />
              </View>
            ))}
          </View>

          {sorted.length===0&&(
            <View style={s.center}>
              <Plane size={36} color={C.muted} strokeWidth={1.5}/>
              <Text style={s.emptyTxt}>
                {query
                  ?`No flights match “${search.trim()}”`
                  :statusFilter!=='all'
                    ?`No ${STATUS_FILTER_TABS.find(t=>t.key===statusFilter)?.label.toLowerCase()} flights`
                    :'No flights found'}
              </Text>
            </View>
          )}

          {isPro&&airport2&&flightTab==='arrival'&&!globalMode?(
            <View style={s.splitBlock}>
              <View style={s.listHead}>
                <View style={{flex:1}}>
                  <View style={s.listTitleRow}>
                    <LayoutDashboard size={14} color={BRAND.gold} strokeWidth={2}/>
                    <Text style={s.listTitle}>Arrivals · {airport2.iata}</Text>
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
                  <Text style={s.listAirport} numberOfLines={1}>
                    {airport2.flag}  {airport2.name}
                  </Text>
                </View>
              </View>
              <View style={s.colHead}>
                <View style={{width:8}}/>
                <Text style={[s.colTxt,{width:118}]}>FLIGHT</Text>
                <Text style={[s.colTxt,{flex:1}]}>FROM</Text>
                <Text style={[s.colTxt,{width:56,textAlign:'center'}]}>GATE</Text>
                <Text style={[s.colTxt,{width:90,textAlign:'right'}]}>TIME</Text>
              </View>
              <View style={s.list}>
                {flights2.slice(0,40).map((f,i)=>(
                  <View key={`a2-${f.id}-${i}`}>
                    {i>0&&<View style={s.sep}/>}
                    <FlightRow
                      f={f}
                      type="arrival"
                      active={selected.id===f.id}
                      onPress={()=>selectFlight(f)}
                      tracked={isTracked(f)}
                    />
                  </View>
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
              :`${sorted.length}${query||statusFilter!=='all'?` of ${poolSorted.length}`:''} flights · auto-refresh 60s · pull to refresh`}
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
  headerRight: {flexDirection:'row',alignItems:'center',gap:10,flexShrink:1,minWidth:0},
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
  apPill:      {flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.accentDim,
                borderRadius:10,paddingLeft:10,paddingRight:8,paddingVertical:6,borderWidth:StyleSheet.hairlineWidth,
                borderColor:C.fieldBorder,flexShrink:1,minWidth:0},
  apPillPressed:{opacity:0.72},
  apFlag:      {fontSize:17,flexShrink:0},
  apMeta:      {flexShrink:1,minWidth:0,maxWidth:132},
  apIata:      {fontSize:15,fontWeight:'700',color:C.accent,letterSpacing:-0.2},
  apCity:      {fontSize:12,fontWeight:'500',color:C.secondary,marginTop:1},
  apChevron:   {flexShrink:0,marginLeft:1},
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
  tabs:        {flexDirection:'row',marginHorizontal:12,marginBottom:12,backgroundColor:'transparent',
                borderRadius:16,padding:3,gap:2},
  tab:         {flex:1,paddingVertical:10,paddingHorizontal:2,alignItems:'center',borderRadius:12,
                flexDirection:'row',justifyContent:'center',gap:4},
  tabOn:       {backgroundColor:'#FFFFFF',...cardShadow},
  tabTxt:      {color:C.secondary,fontSize:13,fontWeight:'500',flexShrink:1},
  tabTxtOn:    {color:BRAND.deep,fontWeight:'700'},
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
  searchInput: {flex:1,color:C.text,fontSize:14,paddingVertical:Platform.OS==='ios'?12:11,
                fontWeight:'500'},
  searchClear: {width:28,height:28,borderRadius:14,backgroundColor:C.list,
                alignItems:'center',justifyContent:'center'},
  searchHint:  {marginHorizontal:20,marginBottom:10,fontSize:12,color:C.accent,fontWeight:'600'},
  connBtn:     {marginHorizontal:16,marginBottom:14,paddingVertical:14,paddingHorizontal:14,
                backgroundColor:C.card,borderRadius:16,...cardShadow,
                flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  connBtnLeft: {flexDirection:'row',alignItems:'center',gap:12,flex:1},
  connBtnTxt:  {color:C.text,fontSize:14,fontWeight:'700'},
  connBtnSub:  {color:C.secondary,fontSize:11,fontWeight:'500',marginTop:2},
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
  listTitleRow:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},
  listTitle:   {fontSize:16,fontWeight:'700',color:C.text},
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
  card:        {marginHorizontal:16,marginBottom:14,backgroundColor:C.card,
                borderRadius:16,padding:18,paddingBottom:22,overflow:'hidden',...cardShadow},
  cardBoard:   {backgroundColor:themeMode==='light'?'#F0F7FF':'#0F1A2E'},
  cardCancel:  {opacity:0.7},
  boardBar:    {position:'absolute',left:0,top:0,bottom:0,width:4,backgroundColor:'#3B82F6',
                borderTopLeftRadius:16,borderBottomLeftRadius:16},
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
  head:        {marginBottom:16},
  headTop:     {flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},
  num:         {fontSize:26,fontWeight:'800',color:C.text,marginRight:2},
  airline:     {fontSize:12,color:C.secondary,marginTop:6},
  sub:         {fontSize:10,color:C.muted,marginTop:2},
  pill:        {flexDirection:'row',alignItems:'center',gap:5,borderRadius:20,borderWidth:1,
                paddingHorizontal:12,paddingVertical:6},
  pillDot:     {width:7,height:7,borderRadius:4},
  pillTxt:     {fontSize:13,fontWeight:'600'},
  routeBlock:  {flexDirection:'column',marginBottom:16,paddingBottom:16,
                borderBottomWidth:1,borderColor:C.border},
  routeTextRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  routeCol:    {flex:1,flexDirection:'column'},
  routeColRight:{alignItems:'flex-end'},
  routeIataRow:{flexDirection:'row',alignItems:'center',gap:6},
  routeFlag:   {fontSize:18},
  routeIata:   {fontSize:28,fontWeight:'800',color:C.text},
  routeCity:   {fontSize:10,color:C.secondary,marginTop:4},
  routeLineRow:{flexDirection:'row',alignItems:'center',marginTop:8,width:'100%'},
  routeDot:    {width:8,height:8,borderRadius:4,flexShrink:0},
  routeLineSeg:{flex:1,height:1,backgroundColor:C.border,marginHorizontal:4},
  delayBanner: {backgroundColor:'rgba(245,158,11,0.08)',borderRadius:10,padding:12,marginBottom:16,
                borderLeftWidth:3,borderLeftColor:'#F59E0B',
                flexDirection:'row',alignItems:'center',gap:8},
  delayTxt:    {color:themeMode==='light'?'#c2410c':'#fbbf24',fontSize:12,fontWeight:'600',flex:1},
  cancelBanner:{backgroundColor:'rgba(239,68,68,0.08)',borderRadius:10,padding:12,marginBottom:16,
                borderLeftWidth:3,borderLeftColor:'#EF4444',
                flexDirection:'row',alignItems:'center',gap:8},
  cancelTxt:   {color:themeMode==='light'?'#b91c1c':'#fca5a5',fontSize:12,fontWeight:'600',flex:1},
  timesRow:    {flexDirection:'row',gap:20,marginBottom:16,paddingBottom:16,
                borderBottomWidth:1,borderColor:C.border,flexWrap:'wrap'},
  tBox:        {},
  tLabel:      {fontSize:10,color:C.muted,fontWeight:'700',letterSpacing:1.2,marginBottom:3},
  tVal:        {fontSize:22,fontWeight:'300',color:C.text},
  infoGrid:    {flexDirection:'row',gap:20,flexWrap:'wrap',marginBottom:14,
                paddingBottom:14,borderBottomWidth:1,borderColor:C.border},
  iBox:        {},
  iLabel:      {fontSize:10,color:C.muted,fontWeight:'700',letterSpacing:1.2,marginBottom:3},
  iVal:        {fontSize:14,fontWeight:'700',color:C.text},
  iValRow:     {flexDirection:'row',alignItems:'center',gap:6},
  acRow:       {flexDirection:'row',alignItems:'center',gap:10,marginBottom:4},
  acModel:     {fontSize:13,fontWeight:'600',color:C.secondary},
  acReg:       {fontSize:11,color:C.muted,marginTop:1},
  weatherBox:  {marginTop:16,paddingTop:16,borderTopWidth:1,borderColor:C.border},
  weatherTitle:{fontSize:10,color:C.muted,fontWeight:'700',letterSpacing:1.2,marginBottom:8},
  weatherRow:  {flexDirection:'row',alignItems:'center',gap:8},
  weatherTxt:  {fontSize:13,fontWeight:'600',color:C.text,flex:1},
  transportBox:{marginTop:16,paddingTop:16,borderTopWidth:1,borderColor:C.border},
  transportTitle:{fontSize:10,color:C.muted,fontWeight:'700',letterSpacing:1.2,marginBottom:12},
  transportOpts:{gap:8},
  transportOptRow:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:C.list,
                   borderRadius:16,...cardShadow,paddingVertical:12,paddingHorizontal:14,
                   borderLeftWidth:3,borderLeftColor:C.border},
  transportIconWrap:{width:28,height:28,borderRadius:8,
                     alignItems:'center',justifyContent:'center'},
  transportOptTxt:{flex:1,fontSize:14,fontWeight:'600',color:C.text},
  transportOptPrice:{fontSize:16,fontWeight:'700',color:C.text,textAlign:'right'},
});}
let dc=makeDc(C);

function makeFr(C:ThemeColors){return StyleSheet.create({
  row:    {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:12,gap:10},
  active: {backgroundColor:C.card},
  board:  {backgroundColor:themeMode==='light'?'#F0F7FF':'#0F1A2E'},
  cancel: {opacity:0.4},
  dot:    {width:8,height:8,borderRadius:4,flexShrink:0},
  c1:     {width:100,flexShrink:0},
  c2:     {flex:1.6,minWidth:0},
  c3:     {width:48,alignItems:'center',flexShrink:0},
  c4:     {width:78,alignItems:'flex-end',flexShrink:0},
  numRow: {flexDirection:'row',alignItems:'center',gap:5},
  num:    {fontSize:14,fontWeight:'700',color:C.text},
  airl:   {fontSize:10,color:C.muted,marginTop:2},
  reg:    {fontSize:9,color:C.muted,marginTop:1},
  iata:   {fontSize:15,fontWeight:'700',color:C.text},
  city:   {fontSize:10,color:C.secondary,marginTop:2},
  gate:   {fontSize:13,fontWeight:'700',color:C.accent},
  nogate: {fontSize:16,color:C.muted},
  term:   {fontSize:9,color:C.muted,marginTop:2},
  bag:    {fontSize:9,color:C.muted,marginTop:0},
  bagRow: {flexDirection:'row',alignItems:'center',gap:4,marginTop:2},
  time:   {fontSize:15,fontWeight:'300'},
  old:    {fontSize:10,color:C.secondary,textDecorationLine:'line-through'},
  cd:     {fontSize:10,color:C.muted,marginTop:2},
  since:  {fontSize:10,color:'#22C55E',marginTop:2},
  delay:  {fontSize:11,color:'#f59e0b',fontWeight:'700',marginTop:1},
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
  title:      {fontSize:15,fontWeight:'800',color:C.text},
  sub:        {fontSize:11,color:C.secondary,marginTop:2},
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
  mini=makeMini(C);
  tb=makeTb(C);
}
