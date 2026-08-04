import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, TextInput, Modal, Share, Linking, Animated,
  ScrollView, ActivityIndicator, RefreshControl, Platform, KeyboardAvoidingView, Pressable,
  Dimensions, PanResponder,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Rect, Circle, Text as SvgText } from 'react-native-svg';
import { useState, useEffect, useRef, useCallback, useMemo, Fragment, createContext, useContext } from 'react';
import { buildRadarHTML } from './radarHtml';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'http://localhost:3001').replace(/\/$/, '');
const TRACK_STORAGE_KEY = 'waiair.tracked.v1';
const THEME_STORAGE_KEY = 'waiair.theme.v1';

type ThemeMode = 'dark'|'light';
type ThemeColors = {
  bg:string; card:string; list:string; border:string; text:string;
  secondary:string; muted:string; accent:string; accentDim:string;
  tabOn:string; field:string; fieldBorder:string;
};

const THEMES:Record<ThemeMode, ThemeColors> = {
  dark: {
    bg:'#0f1117', card:'#1a1d27', list:'#161820', border:'#2a2d3a',
    text:'#f8fafc', secondary:'#9ca3af', muted:'#6b7280',
    accent:'#60a5fa', accentDim:'#2a3f6e', tabOn:'#3b6fd4',
    field:'#1e2333', fieldBorder:'#3a3f54',
  },
  light: {
    bg:'#ffffff', card:'#f5f7fa', list:'#f5f7fa', border:'#e5e7eb',
    text:'#1a1a1a', secondary:'#666666', muted:'#888888',
    accent:'#0066cc', accentDim:'#e8f1fb', tabOn:'#0066cc',
    field:'#ffffff', fieldBorder:'#e5e7eb',
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

type AppTab = 'arrival'|'departure';

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

type Airport = { iata:string; name:string; city:string; country:string; flag:string; lat:number; lon:number };
type ApiAirport = { iata:string; name:string; municipality:string; country:string; lat:number; lon:number };

const FAV_STORAGE_KEY = 'waiair.favorites.v1';
const FALLBACK_AIRPORT:Airport = {
  iata:'BKK', name:'Suvarnabhumi Airport', city:'Bangkok',
  country:'TH', flag:'🇹🇭', lat:13.6811, lon:100.7475,
};

const airportCache = new Map<string, Airport>([[FALLBACK_AIRPORT.iata, FALLBACK_AIRPORT]]);

function flagFromIso(iso:string):string{
  const c=(iso||'').toUpperCase();
  if(c.length!==2) return '🛫';
  return String.fromCodePoint(...[...c].map(ch=>0x1F1E6 + ch.charCodeAt(0) - 65));
}

function fromApiAirport(a:Partial<ApiAirport> & { city?:string; flag?:string }):Airport{
  const iata=String(a.iata||'').toUpperCase();
  const ap:Airport={
    iata,
    name:a.name||iata,
    city:a.municipality||a.city||'',
    country:String(a.country||'').toUpperCase(),
    flag:a.flag||flagFromIso(String(a.country||'')),
    lat:Number(a.lat)||0,
    lon:Number(a.lon)||0,
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
  const res=await fetch(`${PROXY}/airports/nearest?lat=${lat}&lon=${lon}`);
  if(!res.ok) throw new Error('Nearest airports failed');
  const data=await res.json();
  return (Array.isArray(data)?data:[]).map(fromApiAirport);
}

async function loadFavorites():Promise<Airport[]>{
  try{
    const raw=await AsyncStorage.getItem(FAV_STORAGE_KEY);
    if(!raw) return [];
    const list=JSON.parse(raw);
    if(!Array.isArray(list)) return [];
    return list.slice(0,5).map((a:any)=>fromApiAirport(a));
  } catch{ return []; }
}

async function saveFavorites(list:Airport[]){
  await AsyncStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(list.slice(0,5)));
}

type TransportInfo = {
  options:string;
  grabCountry:string; // grab.com/{country}/
  lat:number;
  lng:number;
  bolt:string|null;   // city/airport Bolt page (no ride deep link API)
};

const TRANSPORT_INFO:Record<string, TransportInfo> = {
  BKK: { options:'🚇 Rail Link 45฿ · 🚗 Grab ~350฿ · 🚕 Taxi ~500฿', grabCountry:'th', lat:13.6811, lng:100.7475, bolt:'https://bolt.eu/en/cities/bangkok/airports/suvarnabhumi-airport/' },
  DMK: { options:'🚌 Bus A1 30฿ · 🚗 Grab ~280฿ · 🚕 Taxi ~400฿', grabCountry:'th', lat:13.9126, lng:100.6067, bolt:'https://bolt.eu/en/cities/bangkok/airports/don-mueang-airport/' },
  HKT: { options:'🚗 Grab ~600฿ Patong · ⚡ Bolt ~500฿ · 🚕 Taxi ~650฿', grabCountry:'th', lat:8.1132, lng:98.3169, bolt:'https://bolt.eu/en/cities/phuket/airports/phuket-airport/' },
  CNX: { options:'🚗 Grab ~120฿ · ⚡ Bolt ~100฿ · 🚕 Taxi ~150฿', grabCountry:'th', lat:18.7668, lng:98.9628, bolt:'https://bolt.eu/en/cities/chiang-mai/' },
  SIN: { options:'🚇 MRT $2.50 · 🚗 Grab ~$25 · 🚕 Taxi ~$30', grabCountry:'sg', lat:1.3644, lng:103.9915, bolt:null },
  KUL: { options:'🚇 KLIA Ekspres RM55 · 🚗 Grab ~RM45', grabCountry:'my', lat:2.7456, lng:101.7099, bolt:null },
  SGN: { options:'🚌 Bus 109 20k₫ · 🚗 Grab ~150k₫', grabCountry:'vn', lat:10.8188, lng:106.6520, bolt:null },
  HAN: { options:'🚌 Bus 86 9k₫ · 🚗 Grab ~200k₫', grabCountry:'vn', lat:21.2212, lng:105.8072, bolt:null },
  CGK: { options:'🚇 Railink Rp70k · 🚗 Grab ~Rp150k', grabCountry:'id', lat:-6.1256, lng:106.6559, bolt:null },
  DPS: { options:'🚗 Grab ~Rp120k · 🚕 Taxi ~Rp150k Kuta', grabCountry:'id', lat:-8.7481, lng:115.1670, bolt:null },
  MNL: { options:'🚗 Grab ~₱400 · 🚕 Taxi ~₱500', grabCountry:'ph', lat:14.5086, lng:121.0194, bolt:null },
};

type WeatherInfo = { emoji:string; label:string; temp:number; wind:number };

function weatherFromCode(code:number):{emoji:string;label:string}{
  if(code===0) return {emoji:'☀️', label:'Clear'};
  if(code>=1 && code<=3) return {emoji:'⛅', label:'Partly cloudy'};
  if(code>=45 && code<=48) return {emoji:'🌫️', label:'Foggy'};
  if(code>=51 && code<=67) return {emoji:'🌧️', label:'Rainy'};
  if(code>=71 && code<=77) return {emoji:'❄️', label:'Snow'};
  if(code>=80 && code<=82) return {emoji:'🌦️', label:'Showers'};
  if(code>=95 && code<=99) return {emoji:'⛈️', label:'Thunderstorm'};
  return {emoji:'🌤️', label:'Weather'};
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
      emoji:mapped.emoji,
      label:mapped.label,
      temp:Math.round(Number(cur.temperature_2m??0)),
      wind:Math.round(Number(cur.windspeed_10m??0)),
    };
  } catch{ return null; }
}

async function openUrl(url:string){
  try{ await Linking.openURL(url); } catch{ /* ignore */ }
}

/** Open Grab app booking with airport as pickup; fallback to country website */
async function openGrab(lat:number, lng:number, country:string){
  const deepLink=`grab://open?screenType=BOOKING&originLat=${lat}&originLng=${lng}`;
  const web=`https://grab.com/${country}/`;
  try{
    const canOpen=await Linking.canOpenURL(deepLink);
    if(canOpen){ await Linking.openURL(deepLink); return; }
  } catch{ /* fall through */ }
  await openUrl(web);
}

async function openBolt(url:string){
  await openUrl(url);
}

async function detectNearestAirport():Promise<Airport>{
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

const STATUS_CFG:Record<FlightStatus,{label:string;color:string;bg:string;desc:string;dot:string;priority:number}> = {
  boarding:   {label:'Boarding',  color:'#22c55e', bg:'#052e16', desc:'Head to your gate now',    dot:'🟢', priority:0},
  'en-route': {label:'En Route',  color:'#3b82f6', bg:'#172554', desc:'Flight is in the air',     dot:'🔵', priority:1},
  delayed:    {label:'Delayed',   color:'#f59e0b', bg:'#451a03', desc:'Departure pushed back',    dot:'🟡', priority:2},
  cancelled:  {label:'Cancelled', color:'#ef4444', bg:'#450a0a', desc:'Flight has been cancelled',dot:'🔴', priority:3},
  scheduled:  {label:'Scheduled', color:'#64748b', bg:'#0f172a', desc:'On time as planned',        dot:'⚪', priority:4},
  landed:     {label:'Landed',    color:'#a78bfa', bg:'#2e1065', desc:'Aircraft has arrived',      dot:'🟣', priority:5},
  unknown:    {label:'Unknown',   color:'#475569', bg:'#0f172a', desc:'Status unavailable',        dot:'⚫', priority:6},
};

function countryFlag(code:string):string{
  if(!code||code.length!==2) return '';
  const b=0x1F1E6;
  return String.fromCodePoint(b+code.toUpperCase().charCodeAt(0)-65)+
         String.fromCodePoint(b+code.toUpperCase().charCodeAt(1)-65);
}

function fmt(iso:string){
  if(!iso) return '--:--';
  try{ return new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }
  catch{ return '--:--'; }
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

// Parse AeroDataBox ICAO endpoint response
function parseFIDS(raw:any, type:'arrival'|'departure'):Flight{
  const mov=raw.movement??{};
  const ap=mov.airport??{};

  // Times — prefer local, fallback to UTC
  const sched  =mov.scheduledTime?.local??mov.scheduledTime?.utc??'';
  const revised=mov.revisedTime?.local  ??mov.revisedTime?.utc  ??sched;
  const actual =mov.runwayTime?.local   ??mov.runwayTime?.utc   ??'';

  // Status mapping from AeroDataBox
  const rawSt=(raw.status??'').toLowerCase();
  let status:FlightStatus=
    rawSt==='arrived'  ?'landed'   :
    rawSt==='canceled' ?'cancelled':
    rawSt==='cancelled'?'cancelled':
    rawSt==='expected' ?'scheduled':
    rawSt==='departing'?'boarding' :
    rawSt==='boarding' ?'boarding' :
    rawSt==='en-route' ?'en-route' :'scheduled';

  // Calculate delay
  const schedMs  =sched  ?new Date(sched).getTime()  :0;
  const revisedMs=revised?new Date(revised).getTime():0;
  const delayMin =schedMs&&revisedMs?Math.max(0,Math.round((revisedMs-schedMs)/60000)):0;
  if(delayMin>5) status='delayed';

  const remoteCode=pickAirportCode(ap);
  const remoteCity=pickAirportCity(ap, remoteCode);
  const remoteCountry=pickAirportCountry(ap, remoteCode);

  return {
    id:          raw.number??Math.random().toString(),
    number:      raw.number??'—',
    airline:     raw.airline?.name||raw.airline?.iata||'—',
    airlineCode: raw.airline?.iata||'—',
    origin:      type==='arrival'  ?remoteCode:'',
    originCity:  type==='arrival'  ?remoteCity:'',
    originCountry:type==='arrival' ?remoteCountry:'',
    destination: type==='departure'?remoteCode:'',
    destCity:    type==='departure'?remoteCity:'',
    destCountry: type==='departure'?remoteCountry:'',
    scheduledTime:sched,
    revisedTime:  revised,
    actualTime:   actual,
    arrivalTime:  type==='arrival'? (actual||revised||sched) : '',
    departureTime:type==='departure'? (actual||revised||sched) : '',
    gate:         mov.gate??'',
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
    progress:     actual?1.0:rawSt==='en-route'?0.5:0,
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
  if(fromApi) return fromApi;
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

function mapRawStatus(rawSt:string, delayMin:number):FlightStatus{
  let status:FlightStatus=
    rawSt==='arrived'  ?'landed'   :
    rawSt==='canceled' ?'cancelled':
    rawSt==='cancelled'?'cancelled':
    rawSt==='expected' ?'scheduled':
    rawSt==='departing'?'boarding' :
    rawSt==='boarding' ?'boarding' :
    rawSt==='en-route' || rawSt==='airborne' ?'en-route' :'scheduled';
  if(delayMin>5) status='delayed';
  return status;
}

const RATE_LIMIT_MSG='⏱ Too many requests — please wait a moment and try again';

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
  const items=type==='arrival'?(json.arrivals??[]):(json.departures??json.arrivals??[]);
  if(!Array.isArray(items)||items.length===0) return [];
  return items.map((i:any)=>parseFIDS(i,type));
}

function bestSideTime(side:any):string{
  return side?.runwayTime?.local??side?.runwayTime?.utc
    ??side?.revisedTime?.local??side?.revisedTime?.utc
    ??side?.predictedTime?.local??side?.predictedTime?.utc
    ??side?.scheduledTime?.local??side?.scheduledTime?.utc
    ??'';
}

/** Parse AeroDataBox /flights/number response (has departure + arrival) */
function parseFlightStatus(raw:any):Flight{
  const dep=raw.departure??{};
  const arr=raw.arrival??{};
  const depAp=dep.airport??{};
  const arrAp=arr.airport??{};
  const arrivalTime=bestSideTime(arr);
  const departureTime=bestSideTime(dep);
  const side=arrivalTime?arr:dep;
  const sched  =side.scheduledTime?.local??side.scheduledTime?.utc
    ??dep.scheduledTime?.local??dep.scheduledTime?.utc??'';
  const revised=side.revisedTime?.local??side.revisedTime?.utc
    ??side.predictedTime?.local??side.predictedTime?.utc??sched;
  const actual =side.runwayTime?.local??side.runwayTime?.utc??'';
  const schedMs  =sched  ?new Date(sched).getTime()  :0;
  const revisedMs=revised?new Date(revised).getTime():0;
  const delayMin =schedMs&&revisedMs?Math.max(0,Math.round((revisedMs-schedMs)/60000)):0;
  const rawSt=(raw.status??'').toLowerCase();
  const originCode=pickAirportCode(depAp);
  const destCode=pickAirportCode(arrAp);
  const status=mapRawStatus(rawSt, delayMin);
  return {
    id:          `${raw.number??'—'}-${sched||Math.random()}`,
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
    gate:         (side.gate??dep.gate??arr.gate)??'',
    terminal:     (side.terminal??dep.terminal??arr.terminal)??'',
    baggage:      arr.baggage??arr.baggageBelt??'',
    runway:       side.runway??'',
    arrTerminal:  arr.terminal??'',
    depTerminal:  dep.terminal??'',
    status,
    delay:        delayMin,
    aircraft:     raw.aircraft?.model??'',
    aircraftReg:  raw.aircraft?.reg??'',
    callSign:     raw.callSign??'',
    progress:     actual?1.0:rawSt.includes('en-route')||rawSt==='airborne'?0.5:0,
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
    message='❌ Not enough time — connecting flight departs before arrival';
  } else if(gapMin>24*60){
    verdict='miss';
    message='⚠️ These flights are not on the same day — connection unlikely';
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

const VERDICT_UI:Record<ConnVerdict,{emoji:string;color:string;bg:string;border:string;bgLight:string;borderLight:string}>={
  good:    {emoji:'🟢', color:'#16a34a', bg:'#052e16', border:'#166534', bgLight:'#ecfdf5', borderLight:'#86efac'},
  tight:   {emoji:'🟡', color:'#d97706', bg:'#451a03', border:'#92400e', bgLight:'#fff7ed', borderLight:'#fdba74'},
  miss:    {emoji:'🔴', color:'#dc2626', bg:'#450a0a', border:'#7f1d1d', bgLight:'#fef2f2', borderLight:'#fca5a5'},
  unknown: {emoji:'⚪', color:'#6b7280', bg:'#0f172a', border:'#1e293b', bgLight:'#f5f5f5', borderLight:'#d1d5db'},
};

function matchesSearch(f:Flight, q:string):boolean{
  if(!q) return true;
  const hay=[f.number,f.airline,f.airlineCode,f.origin,f.originCity,f.destination,f.destCity]
    .join(' ').toLowerCase();
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

// ── Flight tracking + local notifications ──────────────────────────────────────
type TrackedFlight = {
  key:string;
  flightNumber:string;
  scheduledTime:string;
  lastStatus:FlightStatus;
  lastGate:string;
  lastDelay:number;
  lastRevisedTime:string;
  lastBaggage:string;
  activeAlert:boolean;
  airportIata:string;
  type:'arrival'|'departure';
  flight:Flight;
};

function flightTrackKey(f:Pick<Flight,'number'|'scheduledTime'>):string{
  return `${f.number.replace(/\s+/g,'').toUpperCase()}|${f.scheduledTime}`;
}

function toTracked(f:Flight, airportIata:string, type:'arrival'|'departure'):TrackedFlight{
  const status=f.status;
  const activeAlert=status==='delayed' || status==='cancelled';
  return {
    key:flightTrackKey(f),
    flightNumber:f.number.replace(/\s+/g,'').toUpperCase(),
    scheduledTime:f.scheduledTime,
    lastStatus:status,
    lastGate:f.gate||'',
    lastDelay:f.delay||0,
    lastRevisedTime:f.revisedTime||f.scheduledTime,
    lastBaggage:f.baggage||'',
    activeAlert,
    airportIata,
    type,
    flight:f,
  };
}

type NotifyKind = 'delay'|'gate'|'boarding'|'cancelled'|'landed';
type NotifyEvent = { kind:NotifyKind; body:string; urgent:boolean };

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
      return { ...t, activeAlert };
    });
  } catch{ return []; }
}

async function saveTracked(list:TrackedFlight[]):Promise<void>{
  await AsyncStorage.setItem(TRACK_STORAGE_KEY, JSON.stringify(list));
}

async function ensureNotifyPermission():Promise<boolean>{
  if(Platform.OS==='web') return false;
  try{
    if(Platform.OS==='android'){
      await Notifications.setNotificationChannelAsync('flights',{
        name:'Flight updates',
        importance:Notifications.AndroidImportance.DEFAULT,
        vibrationPattern:[0,120],
        lightColor:'#1d4ed8',
      });
      await Notifications.setNotificationChannelAsync('flights-urgent',{
        name:'Urgent flight updates',
        importance:Notifications.AndroidImportance.HIGH,
        vibrationPattern:[0,250,250,250],
        lightColor:'#1d4ed8',
      });
    }
    const { status:existing }=await Notifications.getPermissionsAsync();
    if(existing==='granted') return true;
    const { status }=await Notifications.requestPermissionsAsync();
    return status==='granted';
  } catch{ return false; }
}

async function syncAlertBadge(list:TrackedFlight[]){
  if(Platform.OS==='web') return;
  try{
    await Notifications.setBadgeCountAsync(activeAlertCount(list));
  } catch{ /* ignore */ }
}

async function notifyLocal(flightNumber:string, event:NotifyEvent){
  if(Platform.OS==='web') return;
  try{
    const clean=flightNumber.replace(/\s+/g,'').toUpperCase();
    await Notifications.scheduleNotificationAsync({
      content:{
        title:clean,
        body:event.body,
        sound:true,
        categoryIdentifier:`flight-${clean}`,
        data:{ thread:`flight-${clean}` },
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

function matchTrackedHit(tracked:TrackedFlight, hits:Flight[]):Flight|undefined{
  const norm=(n:string)=>n.replace(/\s+/g,'').toUpperCase();
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
  const num=live.number.replace(/\s+/g,'').toUpperCase()||prev.flightNumber;
  const gate=live.gate||'';
  const status=live.status;
  const delay=live.delay||0;
  const revised=live.revisedTime||live.scheduledTime;
  const baggage=live.baggage||'';

  if(gate && gate!==prev.lastGate){
    events.push({
      kind:'gate',
      body:`${num} · Gate changed: ${prev.lastGate||'—'} → ${gate}`,
      urgent:true,
    });
  }
  if(status==='boarding' && prev.lastStatus!=='boarding'){
    events.push({
      kind:'boarding',
      body:`${num} · Now boarding${gate?` · Gate ${gate}`:''}`,
      urgent:false,
    });
  }
  if((status==='delayed' && prev.lastStatus!=='delayed') || (delay>prev.lastDelay && delay>5)){
    events.push({
      kind:'delay',
      body:`${num} · Delayed ${delay} min · Now ${fmt(revised)}`,
      urgent:false,
    });
  }
  if(status==='cancelled' && prev.lastStatus!=='cancelled'){
    events.push({
      kind:'cancelled',
      body:`${num} · Cancelled`,
      urgent:true,
    });
  }
  if(status==='landed' && prev.lastStatus!=='landed'){
    events.push({
      kind:'landed',
      body:baggage?`${num} · Landed · Baggage ${baggage}`:`${num} · Landed`,
      urgent:false,
    });
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
            <Text style={[map.plane,{left:`${Math.round(pct*100)}%` as any,color:cfg.color}]}>✈</Text>
          )}
        </View>
        <View style={[map.dot,{backgroundColor:cfg.color}]}/>
      </View>

      <Text style={[map.statusTxt,{color:cfg.color}]}>{cfg.dot} {cfg.desc}</Text>
    </View>
  );
}

// ── Mini live radar strip (Arrivals / Departures) ──────────────────────────────
type MiniPlane = { id:string; x:number; y:number; color:string };

const MINI_LAT_MIN = 0, MINI_LAT_MAX = 28;
const MINI_LNG_MIN = 92, MINI_LNG_MAX = 140;
const MINI_W = 400, MINI_H = 120;
const MINI_AIRPORTS = [
  { iata:'BKK', lat:13.7, lng:100.5 },
  { iata:'HKT', lat:8.1, lng:98.3 },
  { iata:'SIN', lat:1.4, lng:103.8 },
  { iata:'KUL', lat:2.7, lng:101.7 },
  { iata:'DPS', lat:-8.7, lng:115.2 },
];

function miniAltColor(alt:any){
  const n = Number(alt);
  if(!Number.isFinite(n)) return '#60a5fa';
  if(n < 1000) return '#22c55e';
  if(n <= 8000) return '#60a5fa';
  return '#f8fafc';
}

function MiniRadarStrip({ onOpen }:{ onOpen:()=>void }){
  const { C: colors, mode } = useTheme();
  const [planes, setPlanes] = useState<MiniPlane[]>([]);
  const [count, setCount] = useState(0);
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

  useEffect(()=>{
    let alive = true;
    const load = async()=>{
      try{
        const res = await fetch(`${PROXY}/radar`);
        if(!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const states:any[] = data.states || [];
        const next:MiniPlane[] = [];
        for(let i=0;i<states.length;i++){
          const s = states[i];
          const lon = s[5], lat = s[6];
          if(lon==null || lat==null) continue;
          if(lat<MINI_LAT_MIN || lat>MINI_LAT_MAX || lon<MINI_LNG_MIN || lon>MINI_LNG_MAX) continue;
          const x = (lon - MINI_LNG_MIN) / (MINI_LNG_MAX - MINI_LNG_MIN) * MINI_W;
          const y = (1 - (lat - MINI_LAT_MIN) / (MINI_LAT_MAX - MINI_LAT_MIN)) * MINI_H;
          next.push({ id:`${s[0]||i}-${s[1]||i}`, x, y, color:miniAltColor(s[7]) });
        }
        if(alive){ setPlanes(next); setCount(next.length); }
      } catch{
        /* keep last good frame */
      }
    };
    load();
    const t = setInterval(load, 30000);
    return ()=>{ alive=false; clearInterval(t); };
  },[]);

  return (
    <TouchableOpacity style={mini.wrap} onPress={onOpen} activeOpacity={0.88}>
      <Svg width="100%" height={MINI_H} viewBox={`0 0 ${MINI_W} ${MINI_H}`} preserveAspectRatio="none">
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
        <Text style={mini.countTxt}>✈ {count} live</Text>
      </View>
      <Text style={mini.hint} pointerEvents="none">SEA radar · tap for full map</Text>
    </TouchableOpacity>
  );
}

function makeMini(C:ThemeColors){
  return StyleSheet.create({
  wrap:       {marginHorizontal:16,marginBottom:10,height:120,borderRadius:18,overflow:'hidden',
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
  btn:     {borderRadius:20,paddingHorizontal:12,paddingVertical:6,
            backgroundColor:C.list,alignItems:'center',justifyContent:'center'},
  btnOn:   {backgroundColor:C.accent},
  txt:     {fontSize:13,fontWeight:'600',color:C.secondary},
  txtOn:   {color:'#ffffff'},
});}
let tb=makeTb(C);

function TrackBtn({on,onPress}:{on:boolean;onPress:()=>void}){
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[tb.btn,on&&tb.btnOn]}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={on?'Tracking':'Track'}
      accessibilityState={{selected:on}}
    >
      <Text style={[tb.txt,on&&tb.txtOn]}>{on?'✓ Tracking':'＋ Track'}</Text>
    </TouchableOpacity>
  );
}

function ShareBtn({onPress}:{onPress:()=>void}){
  return (
    <TouchableOpacity
      onPress={onPress}
      style={tb.btn}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Share"
    >
      <Text style={tb.txt}>↑ Share</Text>
    </TouchableOpacity>
  );
}

function displayGate(gate:string):string{
  const g=(gate||'').trim();
  if(!g || /^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(g)) return '—';
  return g;
}

// ── Detail Card ────────────────────────────────────────────────────────────────
function DetailCard({f,type,airport,tracked,onToggleTrack}:{
  f:Flight; type:'arrival'|'departure'; airport:Airport;
  tracked:boolean; onToggleTrack:()=>void;
}){
  const { mode, C: theme } = useTheme();
  const cfg=STATUS_CFG[f.status]??STATUS_CFG.unknown;
  const isDelayed=f.delay>0;
  const isBoard=f.status==='boarding';
  const isLanded=f.status==='landed';
  const cd=countdown(f.revisedTime);
  const since=sinceTime(f.actualTime||f.revisedTime);
  const r=resolveRoute(f,type,airport);
  const destAp=airportByIata(r.destination);
  const transport=TRANSPORT_INFO[r.destination];
  const gateLabel=displayGate(f.gate);
  const [weather, setWeather]=useState<WeatherInfo|null>(null);
  const [weatherBusy, setWeatherBusy]=useState(false);

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
    const message =
`✈ ${f.number} · ${f.airline}
From: ${r.originCity||r.origin} (${r.origin})
To: ${r.destCity||r.destination} (${r.destination})
${type==='arrival'?'Arrives':'Departs'}: ${fmt(f.revisedTime)} · ${fmtDate(f.revisedTime||f.scheduledTime)}
${f.delay>0?`⚠️ Delayed ${f.delay} min · New time: ${fmt(f.revisedTime)}\n`:''}${f.gate?`Gate ${f.gate}${f.terminal?` · Terminal ${f.terminal}`:''}\n`:''}Status: ${cfg.label}
— Shared via WaiAir ✈`;
    try{
      await Share.share({ message });
    } catch{ /* user dismissed */ }
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
          <TrackBtn on={tracked} onPress={onToggleTrack}/>
          <ShareBtn onPress={shareFlight}/>
          <View style={[dc.pill,{borderColor:cfg.color+'60',backgroundColor:cfg.color+'15'}]}>
            <View style={[dc.pillDot,{backgroundColor:cfg.color}]}/>
            <Text style={[dc.pillTxt,{color:cfg.color}]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={dc.airline}>{f.airline}</Text>
        {f.callSign?<Text style={dc.sub}>Callsign: {f.callSign}</Text>:null}
      </View>

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

      {/* Banners */}
      {isDelayed&&(
        <View style={dc.delayBanner}>
          <Text style={dc.delayTxt}>
            ⏱  Delayed {f.delay} min · New {type==='arrival'?'arrival':'departure'}: {fmt(f.revisedTime)}
          </Text>
        </View>
      )}
      {f.status==='cancelled'&&(
        <View style={dc.cancelBanner}>
          <Text style={dc.cancelTxt}>❌  Flight cancelled · Please contact your airline</Text>
        </View>
      )}

      {/* Times */}
      <View style={dc.timesRow}>
        <View style={dc.tBox}>
          <Text style={dc.tLabel}>SCHEDULED</Text>
          <Text style={[dc.tVal,isDelayed&&{color:theme.muted,textDecorationLine:'line-through'}]}>
            {fmt(f.scheduledTime)}
          </Text>
        </View>
        {isDelayed&&(
          <View style={dc.tBox}>
            <Text style={dc.tLabel}>NEW TIME</Text>
            <Text style={[dc.tVal,{color:'#f59e0b'}]}>{fmt(f.revisedTime)}</Text>
          </View>
        )}
        {f.actualTime&&(
          <View style={dc.tBox}>
            <Text style={dc.tLabel}>ACTUAL</Text>
            <Text style={[dc.tVal,{color:'#22c55e'}]}>{fmt(f.actualTime)}</Text>
          </View>
        )}
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
            <Text style={dc.iVal}>🧳 {f.baggage}</Text>
          </View>
        ):null}
        {f.runway?(
          <View style={dc.iBox}>
            <Text style={dc.iLabel}>RUNWAY</Text>
            <Text style={dc.iVal}>{f.runway}</Text>
          </View>
        ):null}
      </View>

      {/* Aircraft */}
      {(f.aircraft||f.aircraftReg)?(
        <View style={dc.acRow}>
          <Text style={dc.acIcon}>✈</Text>
          <View>
            {f.aircraft?<Text style={dc.acModel}>{f.aircraft}</Text>:null}
            {f.aircraftReg?<Text style={dc.acReg}>{f.aircraftReg}</Text>:null}
          </View>
        </View>
      ):null}

      {/* Weather at destination */}
      {destAp?(
        <View style={dc.weatherBox}>
          <Text style={dc.weatherTitle}>WEATHER · {r.destination}</Text>
          {weatherBusy&&!weather?(
            <ActivityIndicator size="small" color={theme.accent}/>
          ):weather?(
            <Text style={dc.weatherTxt}>
              {weather.emoji}  {weather.temp}°C · {weather.label} · Wind {weather.wind} km/h
            </Text>
          ):(
            <Text style={dc.weatherTxt}>Weather unavailable</Text>
          )}
        </View>
      ):null}

      {/* Transport */}
      {transport?(
        <View style={dc.transportBox}>
          <Text style={dc.transportTitle}>GET INTO TOWN · {r.destination}</Text>
          <Text style={dc.transportOpts}>{transport.options}</Text>
          <View style={dc.rideRow}>
            <TouchableOpacity
              style={[dc.rideBtn,dc.rideGrab]}
              onPress={()=>openGrab(transport.lat, transport.lng, transport.grabCountry)}
              activeOpacity={0.8}
            >
              <Text style={dc.rideGrabTxt}>🚗 Grab</Text>
            </TouchableOpacity>
            {transport.bolt?(
              <TouchableOpacity
                style={[dc.rideBtn,dc.rideBolt]}
                onPress={()=>openBolt(transport.bolt!)}
                activeOpacity={0.8}
              >
                <Text style={dc.rideBoltTxt}>⚡ Bolt</Text>
              </TouchableOpacity>
            ):null}
          </View>
        </View>
      ):null}
    </View>
  );
}

// ── Flight Row ─────────────────────────────────────────────────────────────────
function FlightRow({f,type,active,onPress,tracked,onToggleTrack}:{
  f:Flight; type:'arrival'|'departure'; active:boolean; onPress:()=>void;
  tracked:boolean; onToggleTrack:()=>void;
}){
  const { mode } = useTheme();
  const cfg=STATUS_CFG[f.status]??STATUS_CFG.unknown;
  const isDelayed=f.delay>0;
  const full=hasFullRoute(f);
  const other=type==='arrival'?f.origin:f.destination;
  const city=type==='arrival'?f.originCity:f.destCity;
  const otherLabel=displayAirport(other, city, type==='arrival'?f.originCountry:f.destCountry);
  const flag=otherLabel.flag||countryFlag(type==='arrival'?f.originCountry:f.destCountry);
  const cd=countdown(f.revisedTime);
  const since=sinceTime(f.actualTime||f.revisedTime);

  return (
    <TouchableOpacity
      style={[
        fr.row,
        active&&fr.active,
        f.status==='boarding'&&{backgroundColor:mode==='dark'?'#0f1a14':'#ecfdf5'},
        f.status==='cancelled'&&fr.cancel,
      ]}
      onPress={onPress} activeOpacity={0.75}
    >
      <View style={[fr.dot,{backgroundColor:cfg.color}]}/>
      <View style={fr.c1}>
        <Text style={fr.num}>{f.number}</Text>
        <TrackBtn on={tracked} onPress={onToggleTrack}/>
        <Text style={fr.airl} numberOfLines={1}>{f.airline}</Text>
        {f.aircraftReg?<Text style={fr.reg}>{f.aircraftReg}</Text>:null}
      </View>
      <View style={fr.c2}>
        {full?(
          <>
            <Text style={fr.iata}>{f.origin} → {f.destination}</Text>
            <Text style={fr.city} numberOfLines={1}>
              {(f.originCity||f.origin)||'—'} · {(f.destCity||f.destination)||'—'}
            </Text>
          </>
        ):(
          <>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
              {flag?<Text style={{fontSize:11}}>{flag}</Text>:null}
              <Text style={fr.iata}>{otherLabel.code}</Text>
            </View>
            <Text style={fr.city} numberOfLines={1}>{otherLabel.city||otherLabel.code}</Text>
          </>
        )}
      </View>
      <View style={fr.c3}>
        {displayGate(f.gate)==='—'
          ?<Text style={fr.nogate}>—</Text>
          :<Text style={[fr.gate,f.status==='boarding'&&{color:'#22c55e'}]}>G{f.gate}</Text>}
        {f.terminal?<Text style={fr.term}>T{f.terminal}</Text>:null}
        {f.baggage?<Text style={fr.bag}>🧳{f.baggage}</Text>:null}
      </View>
      <View style={fr.c4}>
        <Text style={[fr.time,{color:isDelayed?'#f59e0b':cfg.color}]}>{fmt(f.revisedTime)}</Text>
        {isDelayed
          ?<Text style={fr.old}>{fmt(f.scheduledTime)}</Text>
          :cd?<Text style={fr.cd}>in {cd}</Text>
          :since?<Text style={fr.since}>{since}</Text>
          :null}
        {isDelayed?<Text style={fr.delay}>+{f.delay}m</Text>:null}
      </View>
    </TouchableOpacity>
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
                <Text style={cx.closeTxt}>✕</Text>
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

              {err?<Text style={cx.err}>⚠️ {err}</Text>:null}

              {result&&v?(
                <View style={[cx.result, {backgroundColor:verdictBg, borderColor:verdictBorder}]}>
                  <Text style={[cx.resultMsg,{color:v.color}]}>
                    {v.emoji}  {result.message}
                  </Text>

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
                          :result.sameTerminal?'Same ✓':'Change'}
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
                    <Text style={cx.legTitle}>🛬 Incoming · {result.incoming.number}</Text>
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
                    <Text style={cx.legTitle}>🛫 Connecting · {result.outgoing.number}</Text>
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

function RadarModal({
  visible, onClose, airport,
}:{ visible:boolean; onClose:()=>void; airport:Airport }){
  const { mode, C: theme } = useTheme();
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sheetH = Math.round(Dimensions.get('window').height * 0.9);
  const translateY = useRef(new Animated.Value(sheetH)).current;
  const closing = useRef(false);

  const html = useMemo(
    ()=>buildRadarHTML(airport.lat, airport.lon, 7, PROXY, mode),
    [airport.iata, mode]
  );

  const dismiss=useCallback(()=>{
    if(closing.current) return;
    closing.current=true;
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
                <Text style={rd.title}>🗺 Live Radar · SEA</Text>
                <Text style={rd.sub}>OpenSky · updates every 15s</Text>
              </View>
              <TouchableOpacity onPress={dismiss} style={rd.close} hitSlop={10} accessibilityLabel="Close radar">
                <Text style={rd.closeTxt}>✕</Text>
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
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App(){
  const [mode, setMode] = useState<ThemeMode>('light');
  const [themeReady, setThemeReady] = useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if(saved==='light'||saved==='dark'){
          applyTheme(saved);
          setMode(saved);
        } else {
          applyTheme('light');
        }
      } catch{
        applyTheme('light');
      }
      setThemeReady(true);
    })();
  },[]);

  const toggleTheme = useCallback(()=>{
    setMode(prev=>{
      const next:ThemeMode = prev==='dark' ? 'light' : 'dark';
      applyTheme(next);
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(()=>{});
      return next;
    });
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
  const [search,     setSearch]     = useState('');
  const [globalHits, setGlobalHits] = useState<Flight[]|null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<Airport[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [favorites, setFavorites] = useState<Airport[]>([]);
  const [switchBanner, setSwitchBanner] = useState('');
  const [showConn,   setShowConn]   = useState(false);
  const [connIncoming, setConnIncoming] = useState('');
  const pillAnim = useRef(new Animated.Value(0)).current;
  const switchTimer = useRef<any>(null);
  const [isLive,     setIsLive]     = useState(false);
  const [error,      setError]      = useState('');
  const [lastUpd,    setLastUpd]    = useState('');
  const [time,       setTime]       = useState(new Date());
  const [tracked,    setTracked]    = useState<TrackedFlight[]>([]);
  const [toast,      setToast]      = useState<string|null>(null);
  const timer = useRef<any>(null);
  const trackTimer = useRef<any>(null);
  const searchTimer = useRef<any>(null);
  const pickerTimer = useRef<any>(null);
  const pickerSeq = useRef(0);
  const searchSeq = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const trackedRef = useRef<TrackedFlight[]>([]);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastRun = useRef<Animated.CompositeAnimation|null>(null);

  useEffect(()=>{ trackedRef.current=tracked; },[tracked]);

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

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date()),1000);
    return ()=>clearInterval(t);
  },[]);

  // Load tracked flights + favorites from storage
  useEffect(()=>{
    loadTracked().then(list=>{
      setTracked(list);
      syncAlertBadge(list);
    });
    loadFavorites().then(setFavorites);
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
      if(events.length){
        for(const event of events) await notifyLocal(next.flightNumber, event);
        dirty=true;
      } else if(
        next.lastStatus!==t.lastStatus ||
        next.lastGate!==t.lastGate ||
        next.lastDelay!==t.lastDelay ||
        next.lastRevisedTime!==t.lastRevisedTime ||
        next.lastBaggage!==t.lastBaggage ||
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
  },[applyLiveUpdates]);

  // Re-fetch tracked flights every 60s
  useEffect(()=>{
    if(trackTimer.current) clearInterval(trackTimer.current);
    if(!tracked.length) return;
    trackTimer.current=setInterval(()=>{ pollTracked(); },60000);
    return ()=>clearInterval(trackTimer.current);
  },[tracked.length,pollTracked]);

  const flightTab: 'arrival'|'departure' = tab;

  const toggleTrack=useCallback(async(f:Flight)=>{
    const key=flightTrackKey(f);
    const exists=trackedRef.current.some(t=>t.key===key);
    if(exists){
      const next=trackedRef.current.filter(t=>t.key!==key);
      setTracked(next);
      await saveTracked(next);
      await syncAlertBadge(next);
      showToast('Tracking gestopt');
      return;
    }
    await ensureNotifyPermission();
    const dir = tab==='departure' ? 'departure' : 'arrival';
    const entry=toTracked(f, airport.iata, dir);
    const next=[...trackedRef.current.filter(t=>t.key!==key), entry];
    setTracked(next);
    await saveTracked(next);
    await syncAlertBadge(next);
    showToast(`✈️ ${f.number} wordt gevolgd`);
  },[airport.iata,tab,showToast]);

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
        setSelected(prev=>s.find(f=>f.id===prev.id)??s[0]);
        applyLiveUpdates(s);
      } else {
        // API returned empty — use demo
        const s=sortFlights(DEMO);
        setFlights(s); setIsLive(false);
        setSelected(prev=>s.find(f=>f.id===prev.id)??s[0]);
        setError('No flights in API response — showing demo data');
      }
    } catch(e:any){
      const s=sortFlights(DEMO);
      setFlights(s); setIsLive(false);
      setSelected(prev=>s.find(f=>f.id===prev.id)??s[0]);
      setError('Proxy offline · Run: cd ~/WaiAir/proxy && node server.js');
    } finally {
      setLoading(false); setRefreshing(false);
      setLastUpd(new Date().toLocaleTimeString('en-GB'));
    }
  },[applyLiveUpdates]);

  useEffect(()=>{
    if(!locReady) return;
    setSearch('');
    setGlobalHits(null);
    load(airport.iata,tab);
    timer.current=setInterval(()=>load(airport.iata,tab,true),60000);
    return ()=>clearInterval(timer.current);
  },[airport,tab,locReady]);

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
  const globalMode=!!globalHits && globalHits.length>0;
  const sorted=useMemo(()=>{
    const base=sortFlights(flights);
    const localFiltered=query?base.filter(f=>matchesSearch(f,query)):base;
    // Keep Arrivals/Departures search stable even if global API returns empty.
    if(globalMode) return sortFlights(globalHits!);
    return localFiltered;
  },[flights,query,globalHits,globalMode]);

  // Keep detail card in sync with filtered list
  useEffect(()=>{
    if(sorted.length===0) return;
    if(!sorted.some(f=>f.id===selected.id)) setSelected(sorted[0]);
  },[sorted,selected.id]);

  const clearSearch=()=>{ setSearch(''); setGlobalHits(null); };

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

  const selectAirport=useCallback((a:Airport)=>{
    if(a.iata!==airport.iata) flashAirportChange(a);
    setAirport(a);
    setShowPicker(false);
    setPickerQuery('');
    setPickerResults([]);
    setFavorites(prev=>{
      const next=[a, ...prev.filter(x=>x.iata!==a.iata)].slice(0,5);
      saveFavorites(next).catch(()=>{});
      return next;
    });
  },[airport.iata, flashAirportChange]);

  const pillBorder=pillAnim.interpolate({
    inputRange:[0,1],
    outputRange:[theme.fieldBorder, theme.accent],
  });
  const pillBg=pillAnim.interpolate({
    inputRange:[0,1],
    outputRange:[theme.field, theme.accentDim],
  });

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

  // My Flights: prefer live list match, else stored snapshot
  const myFlights=useMemo(()=>{
    const pool=[...flights, ...(globalHits??[])];
    return tracked.map(t=>{
      const live=matchTrackedHit(t, pool);
      return live??t.flight;
    }).filter(Boolean) as Flight[];
  },[tracked,flights,globalHits]);

  // Group by status
  const groups=[
    {key:'boarding',  label:'🟢 Boarding Now', data:sorted.filter(f=>f.status==='boarding')},
    {key:'enroute',   label:'🔵 En Route',     data:sorted.filter(f=>f.status==='en-route')},
    {key:'delayed',   label:'🟡 Delayed',      data:sorted.filter(f=>f.status==='delayed')},
    {key:'cancelled', label:'🔴 Cancelled',    data:sorted.filter(f=>f.status==='cancelled')},
    {key:'scheduled', label:'⚪ Scheduled',    data:sorted.filter(f=>f.status==='scheduled')},
    {key:'landed',    label:'🟣 Landed',        data:sorted.filter(f=>f.status==='landed')},
  ].filter(g=>g.data.length>0);

  return (
    <View style={s.screen} key={mode}>
      <StatusBar style={mode==='dark'?'light':'dark'}/>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoRow}>
            <Image
              source={require('./assets/images/waiair-logo.png')}
              style={{ width: 32, height: 32, borderRadius: 6 }}
            />
            <Text style={s.logo}>WaiAir</Text>
          </View>
          <Text style={s.clock}>{time.toLocaleTimeString('en-GB')}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.themeBtn} onPress={toggle} activeOpacity={0.8} hitSlop={6}>
            <Text style={s.themeBtnTxt}>{mode==='dark'?'☀️':'🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={()=>{
              setShowPicker(v=>{
                if(v){ setPickerQuery(''); setPickerResults([]); }
                return !v;
              });
            }}
            activeOpacity={0.85}
          >
            <Animated.View style={[s.apPill,{backgroundColor:pillBg,borderColor:pillBorder}]}>
              <Text style={s.apFlag}>{airport.flag}</Text>
              <View style={{maxWidth:160}}>
                <Text style={s.apIata}>{airport.iata}</Text>
                <Text style={s.apName} numberOfLines={1}>{airport.name}</Text>
                <Text style={s.apCity}>{airport.city}</Text>
              </View>
              <Text style={s.apChev}>{showPicker?'▴':'▾'}</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

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
            <Text style={s.pickerSearchIcon}>🔍</Text>
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
                <Text style={s.pickerSearchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{maxHeight:320}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!showSearchResults&&favFiltered.length>0&&(
              <View>
                <View style={s.pCountry}>
                  <Text style={s.pCountryTxt}>★ Favorites</Text>
                </View>
                {favFiltered.map(a=>(
                  <TouchableOpacity key={`fav-${a.iata}`} style={s.pRow} onPress={()=>selectAirport(a)}>
                    <Text style={s.pFlag}>{a.flag}</Text>
                    <View style={{flex:1}}>
                      <Text style={s.pIata}>{a.iata}
                        <Text style={s.pName}>  {a.name}</Text>
                      </Text>
                      <Text style={s.pCity}>{a.city}{a.country?` · ${a.country}`:''}</Text>
                    </View>
                    {a.iata===airport.iata&&<Text style={s.pCheck}>✓</Text>}
                  </TouchableOpacity>
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
                {pickerResults.map(a=>(
                  <TouchableOpacity key={a.iata} style={s.pRow} onPress={()=>selectAirport(a)}>
                    <Text style={s.pFlag}>{a.flag}</Text>
                    <View style={{flex:1}}>
                      <Text style={s.pIata}>{a.iata}
                        <Text style={s.pName}>  {a.name}</Text>
                      </Text>
                      <Text style={s.pCity}>{a.city}{a.country?` · ${a.country}`:''}</Text>
                    </View>
                    {a.iata===airport.iata&&<Text style={s.pCheck}>✓</Text>}
                  </TouchableOpacity>
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
                <Text style={s.pickerEmptyTxt}>Search any airport worldwide</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {([
          { id:'arrival' as const,   label:'🛬 Arrivals' },
          { id:'departure' as const, label:'🛫 Departures' },
        ]).map(t=>(
          <TouchableOpacity key={t.id} style={[s.tab,tab===t.id&&!showRadar&&s.tabOn]} onPress={()=>{ setShowRadar(false); setTab(t.id); }}>
            <Text style={[s.tabTxt,tab===t.id&&!showRadar&&s.tabTxtOn]} numberOfLines={1}>{t.label}</Text>
            <View style={[s.tabBadge,tab===t.id&&!showRadar&&s.tabBadgeOn]}>
              <Text style={[s.tabBadgeTxt,tab===t.id&&!showRadar&&{color:'#bfdbfe'}]}>{sorted.length}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.tab, showRadar&&s.tabOn]}
          onPress={()=>setShowRadar(true)}
        >
          <Text style={[s.tabTxt, showRadar&&s.tabTxtOn]} numberOfLines={1}>🗺 Radar</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <Pressable
        style={s.searchWrap}
        onPress={()=>searchInputRef.current?.focus()}
      >
        <TextInput
          ref={searchInputRef}
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search flight #, airline, city..."
          placeholderTextColor={theme.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          clearButtonMode="never"
          returnKeyType="search"
        />
        {globalBusy&&<ActivityIndicator size="small" color={theme.accent}/>}
        {search.length>0&&(
          <TouchableOpacity style={s.searchClear} onPress={clearSearch} hitSlop={8}>
            <Text style={s.searchClearTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </Pressable>
      {globalMode?(
        <Text style={s.searchHint}>
          {globalBusy?'Searching worldwide…':`🌍 Global · ${sorted.length} result${sorted.length===1?'':'s'} for ${search.trim().toUpperCase()}`}
        </Text>
      ):null}

      <TouchableOpacity
        style={s.connBtn}
        onPress={()=>{ setConnIncoming(search); setShowConn(true); }}
        activeOpacity={0.8}
      >
        <Text style={s.connBtnTxt}>🔁  Check Connection</Text>
        <Text style={s.connBtnSub}>Will I make my connection?</Text>
      </TouchableOpacity>

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
      />

      {/* Error */}
      {error?(
        <View style={s.errBanner}>
          <Text style={s.errTxt}>⚠️ {error}</Text>
        </View>
      ):null}

      {!locReady||loading?(
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.accent}/>
          <Text style={s.loadTxt}>
            {!locReady?`Finding nearest airport…`:`Loading ${airport.iata} · ${airport.name}`}
          </Text>
        </View>
      ):(
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(airport.iata,flightTab);}} tintColor={C.accent}/>}
        >
          <MiniRadarStrip onOpen={()=>setShowRadar(true)}/>
          {sorted.length>0||myFlights.length>0?(
            <>
              <RouteMap f={selected} type={flightTab} airport={airport}/>
              <DetailCard
                f={selected}
                type={flightTab}
                airport={airport}
                tracked={isTracked(selected)}
                onToggleTrack={()=>toggleTrack(selected)}
              />
            </>
          ):null}

          {/* My Flights (tracked) */}
          {myFlights.length>0&&(
            <View>
              <View style={s.secHead}>
                <Text style={[s.secLabel,{color:C.accent}]}>🔔 My Flights</Text>
                <Text style={[s.secCount,{color:C.text,backgroundColor:C.accentDim}]}>{myFlights.length}</Text>
              </View>
              <View style={[s.list,{borderColor:C.accent}]}>
                {myFlights.map((f,i)=>(
                  <View key={`track-${flightTrackKey(f)}`}>
                    {i>0&&<View style={s.sep}/>}
                    <FlightRow
                      f={f}
                      type={flightTab}
                      active={selected.id===f.id}
                      onPress={()=>selectFlight(f)}
                      tracked
                      onToggleTrack={()=>toggleTrack(f)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* List header */}
          <View style={s.listHead}>
            <View style={{flex:1,paddingRight:12}}>
              <Text style={s.listTitle}>
                {globalMode
                  ?`Global search · ${search.trim().toUpperCase()}`
                  :`${flightTab==='arrival'?'Arrivals':'Departures'} · ${airport.iata}`}
              </Text>
              {!globalMode?(
                <Text style={s.listAirport} numberOfLines={1}>
                  {airport.flag}  {airport.name}
                </Text>
              ):null}
            </View>
            <View style={s.listMeta}>
              {isLive
                ?<View style={s.livePill}><Text style={s.liveTxt}>● LIVE</Text></View>
                :<Text style={s.demoTxt}>Demo</Text>}
              <Text style={s.updTxt}>{lastUpd}</Text>
            </View>
          </View>

          {/* Grouped sections */}
          {groups.map(g=>(
            <View key={g.key}>
              <View style={s.secHead}>
                <Text style={s.secLabel}>{g.label}</Text>
                <Text style={s.secCount}>{g.data.length}</Text>
              </View>
              <View style={s.colHead}>
                <View style={{width:8}}/>
                <Text style={[s.colTxt,{width:118}]}>FLIGHT</Text>
                <Text style={[s.colTxt,{flex:1}]}>{globalMode?'ROUTE':(flightTab==='arrival'?'FROM':'TO')}</Text>
                <Text style={[s.colTxt,{width:56,textAlign:'center'}]}>GATE</Text>
                <Text style={[s.colTxt,{width:90,textAlign:'right'}]}>TIME</Text>
              </View>
              <View style={s.list}>
                {g.data.map((f,i)=>(
                  <View key={f.id}>
                    {i>0&&<View style={s.sep}/>}
                    <FlightRow
                      f={f}
                      type={flightTab}
                      active={selected.id===f.id}
                      onPress={()=>selectFlight(f)}
                      tracked={isTracked(f)}
                      onToggleTrack={()=>toggleTrack(f)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}

          {sorted.length===0&&(
            <View style={s.center}>
              <Text style={{fontSize:40,marginBottom:12}}>✈️</Text>
              <Text style={s.emptyTxt}>
                {query?`No flights match “${search.trim()}”`:'No flights found'}
              </Text>
            </View>
          )}

          <Text style={s.foot}>
            {globalMode
              ?`${sorted.length} worldwide · type a flight # to search any airport`
              :`${sorted.length}${query?` of ${flights.length}`:''} flights · auto-refresh 60s · pull to refresh`}
          </Text>
          <View style={{height:50}}/>
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
                paddingHorizontal:20,paddingTop:Platform.OS==='web'?20:54,paddingBottom:14,backgroundColor:C.bg,gap:10},
  headerLeft:  {flexShrink:1},
  headerRight: {flexDirection:'row',alignItems:'center',gap:10},
  themeBtn:    {width:40,height:40,borderRadius:12,backgroundColor:C.field,borderWidth:1,
                borderColor:C.fieldBorder,alignItems:'center',justifyContent:'center'},
  themeBtnTxt: {fontSize:18},
  logoRow:     {flexDirection:'row',alignItems:'center',gap:8},
  logo:        {fontSize:22,fontWeight:'800',color:C.text,letterSpacing:0.5},
  clock:       {fontSize:12,color:C.muted,marginTop:2},
  apPill:      {flexDirection:'row',alignItems:'center',gap:8,backgroundColor:C.field,
                borderRadius:14,paddingHorizontal:14,paddingVertical:10,borderWidth:1.5,borderColor:C.fieldBorder},
  apFlag:      {fontSize:20},
  apIata:      {fontSize:18,fontWeight:'800',color:C.accent},
  apName:      {fontSize:11,fontWeight:'600',color:C.text,marginTop:1},
  apCity:      {fontSize:10,color:C.secondary,marginTop:1},
  apChev:      {fontSize:13,color:C.muted},
  switchBanner:{marginHorizontal:16,marginBottom:10,paddingVertical:12,paddingHorizontal:14,
                backgroundColor:C.accentDim,borderRadius:14,borderWidth:1,borderColor:C.accent,
                flexDirection:'row',alignItems:'center',gap:10},
  switchBannerTxt:{color:C.text,fontSize:14,fontWeight:'700'},
  switchBannerSub:{color:C.secondary,fontSize:11,flex:1,textAlign:'right'},
  picker:      {backgroundColor:C.bg,borderBottomWidth:1,borderColor:C.border},
  pickerSearch:{flexDirection:'row',alignItems:'center',marginHorizontal:16,marginTop:4,marginBottom:8,
                backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.border,
                paddingHorizontal:12,gap:8},
  pickerSearchIcon:{fontSize:14},
  pickerSearchInput:{flex:1,color:C.text,fontSize:14,fontWeight:'500',
                     paddingVertical:Platform.OS==='ios'?11:8},
  pickerSearchClear:{color:C.secondary,fontSize:13,fontWeight:'700',padding:4},
  pickerEmpty: {paddingVertical:28,alignItems:'center'},
  pickerEmptyTxt:{color:C.muted,fontSize:13},
  pCountry:    {paddingHorizontal:20,paddingTop:12,paddingBottom:6,backgroundColor:C.list,
                borderTopWidth:1,borderColor:C.border},
  pCountryTxt: {fontSize:12,fontWeight:'800',color:C.text,letterSpacing:0.2},
  pCountryCodes:{fontSize:10,color:C.muted,marginTop:3,fontWeight:'600'},
  pRow:        {flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:12,
                gap:12,borderBottomWidth:1,borderColor:C.border},
  pFlag:       {fontSize:18},
  pIata:       {fontSize:14,fontWeight:'700',color:C.accent},
  pName:       {fontSize:12,fontWeight:'400',color:C.secondary},
  pCity:       {fontSize:11,color:C.muted,marginTop:2},
  pCheck:      {color:'#22c55e',fontSize:16,fontWeight:'700'},
  tabs:        {flexDirection:'row',marginHorizontal:16,marginBottom:10,backgroundColor:C.card,
                borderRadius:12,padding:4,borderWidth:1,borderColor:C.border},
  tab:         {flex:1,paddingVertical:10,alignItems:'center',borderRadius:10,
                flexDirection:'row',justifyContent:'center',gap:6},
  tabOn:       {backgroundColor:C.tabOn},
  tabTxt:      {color:C.muted,fontSize:12,fontWeight:'600'},
  tabTxtOn:    {color:'#fff',fontWeight:'700'},
  tabBadge:    {backgroundColor:C.list,borderRadius:10,paddingHorizontal:6,paddingVertical:2},
  tabBadgeOn:  {backgroundColor:C.accent},
  tabBadgeTxt: {fontSize:10,color:C.secondary,fontWeight:'700'},
  searchWrap:  {flexDirection:'row',alignItems:'center',marginHorizontal:16,marginBottom:6,
                backgroundColor:C.field,borderRadius:14,borderWidth:1.5,borderColor:C.fieldBorder,
                paddingHorizontal:16,paddingVertical:Platform.OS==='ios'?2:0},
  searchInput: {flex:1,color:C.text,fontSize:15,paddingVertical:Platform.OS==='ios'?13:12,
                fontWeight:'500'},
  searchClear: {width:28,height:28,borderRadius:14,backgroundColor:C.list,
                alignItems:'center',justifyContent:'center',marginLeft:8},
  searchClearTxt:{color:C.text,fontSize:12,fontWeight:'700'},
  searchHint:  {marginHorizontal:20,marginBottom:8,fontSize:11,color:C.accent,fontWeight:'600'},
  connBtn:     {marginHorizontal:16,marginBottom:10,paddingVertical:12,paddingHorizontal:14,
                backgroundColor:C.field,borderRadius:14,borderWidth:1.5,borderColor:C.fieldBorder,
                flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  connBtnTxt:  {color:C.text,fontSize:14,fontWeight:'700'},
  connBtnSub:  {color:C.secondary,fontSize:11,fontWeight:'500'},
  errBanner:   {marginHorizontal:16,marginBottom:8,padding:10,
                backgroundColor:themeMode==='light'?'#fef2f2':'#450a0a',
                borderRadius:8,borderWidth:1,borderColor:themeMode==='light'?'#fca5a5':'#7f1d1d'},
  errTxt:      {color:themeMode==='light'?'#b91c1c':'#fca5a5',fontSize:12},
  center:      {justifyContent:'center',alignItems:'center',paddingVertical:60,gap:8},
  loadTxt:     {color:C.secondary,fontSize:14},
  emptyTxt:    {color:C.secondary,fontSize:15},
  listHead:    {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',
                paddingHorizontal:20,paddingTop:12,paddingBottom:6},
  listTitle:   {fontSize:16,fontWeight:'800',color:C.text},
  listAirport: {fontSize:13,fontWeight:'600',color:C.accent,marginTop:4},
  listMeta:    {flexDirection:'row',alignItems:'center',gap:8,paddingTop:2},
  livePill:    {backgroundColor:themeMode==='light'?'#ecfdf5':'#052e16',borderRadius:10,paddingHorizontal:8,paddingVertical:3},
  liveTxt:     {fontSize:10,fontWeight:'700',color:themeMode==='light'?'#16a34a':'#22c55e'},
  demoTxt:     {fontSize:10,color:C.muted,fontWeight:'600'},
  updTxt:      {fontSize:10,color:C.muted},
  secHead:     {flexDirection:'row',justifyContent:'space-between',alignItems:'center',
                paddingHorizontal:20,paddingTop:14,paddingBottom:6},
  secLabel:    {fontSize:12,fontWeight:'700',color:C.secondary,letterSpacing:0.5},
  secCount:    {fontSize:11,fontWeight:'700',color:C.secondary,backgroundColor:C.list,
                paddingHorizontal:8,paddingVertical:2,borderRadius:10},
  colHead:     {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:4,
                borderTopWidth:1,borderBottomWidth:1,borderColor:C.border},
  colTxt:      {fontSize:9,color:C.muted,fontWeight:'700',letterSpacing:1,textTransform:'uppercase'},
  list:        {marginHorizontal:16,borderRadius:14,backgroundColor:C.list,
                overflow:'hidden',borderWidth:1,borderColor:C.border,marginBottom:4},
  sep:         {height:1,backgroundColor:C.border,marginLeft:48},
  foot:        {textAlign:'center',color:C.muted,fontSize:11,marginTop:20},
  toast:       {position:'absolute',left:20,right:20,bottom:Platform.OS==='ios'?36:24,
                backgroundColor:C.card,borderRadius:14,paddingVertical:14,paddingHorizontal:16,
                borderWidth:1,borderColor:C.border,alignItems:'center',
                shadowColor:'#000',shadowOpacity:0.25,shadowRadius:12,shadowOffset:{width:0,height:4},
                elevation:6},
  toastTxt:    {color:C.text,fontSize:14,fontWeight:'700',textAlign:'center'},
});}
let s=makeS(C);

function makeMap(C:ThemeColors){return StyleSheet.create({
  wrap:      {marginHorizontal:16,marginBottom:10,backgroundColor:C.card,
              borderRadius:18,borderWidth:1,borderColor:C.border,
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
  plane:     {position:'absolute',top:-2,fontSize:14,marginLeft:-8},
  statusTxt: {fontSize:11,fontWeight:'600',textAlign:'center',marginTop:8},
});}
let map=makeMap(C);

function makeDc(C:ThemeColors){return StyleSheet.create({
  card:        {marginHorizontal:16,marginBottom:14,backgroundColor:C.card,
                borderRadius:18,padding:18,paddingBottom:22,overflow:'hidden',
                borderWidth:1,borderColor:C.border},
  cardBoard:   {borderColor:'#166534',backgroundColor:'#0f1a14'},
  cardCancel:  {opacity:0.7},
  boardBar:    {position:'absolute',left:0,top:0,bottom:0,width:4,backgroundColor:'#22c55e',
                borderTopLeftRadius:18,borderBottomLeftRadius:18},
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
  delayBanner: {backgroundColor:themeMode==='light'?'#fff7ed':'#451a03',borderRadius:10,padding:12,marginBottom:16,
                borderWidth:1,borderColor:themeMode==='light'?'#fdba74':'#92400e'},
  delayTxt:    {color:themeMode==='light'?'#c2410c':'#fbbf24',fontSize:13,fontWeight:'600'},
  cancelBanner:{backgroundColor:themeMode==='light'?'#fef2f2':'#450a0a',borderRadius:10,padding:12,marginBottom:16,
                borderWidth:1,borderColor:themeMode==='light'?'#fca5a5':'#7f1d1d'},
  cancelTxt:   {color:themeMode==='light'?'#b91c1c':'#fca5a5',fontSize:13,fontWeight:'600'},
  timesRow:    {flexDirection:'row',gap:20,marginBottom:16,paddingBottom:16,
                borderBottomWidth:1,borderColor:C.border,flexWrap:'wrap'},
  tBox:        {},
  tLabel:      {fontSize:9,color:C.muted,fontWeight:'700',letterSpacing:1,marginBottom:3},
  tVal:        {fontSize:20,fontWeight:'800',color:C.text},
  infoGrid:    {flexDirection:'row',gap:20,flexWrap:'wrap',marginBottom:14,
                paddingBottom:14,borderBottomWidth:1,borderColor:C.border},
  iBox:        {},
  iLabel:      {fontSize:9,color:C.muted,fontWeight:'700',letterSpacing:1,marginBottom:3},
  iVal:        {fontSize:14,fontWeight:'700',color:C.text},
  acRow:       {flexDirection:'row',alignItems:'center',gap:10,marginBottom:4},
  acIcon:      {fontSize:16,color:C.muted},
  acModel:     {fontSize:13,fontWeight:'600',color:C.secondary},
  acReg:       {fontSize:11,color:C.muted,marginTop:1},
  weatherBox:  {marginTop:14,paddingTop:14,borderTopWidth:1,borderColor:C.border},
  weatherTitle:{fontSize:9,color:C.muted,fontWeight:'700',letterSpacing:1,marginBottom:6},
  weatherTxt:  {fontSize:13,fontWeight:'600',color:C.text},
  transportBox:{marginTop:14,paddingTop:14,borderTopWidth:1,borderColor:C.border},
  transportTitle:{fontSize:9,color:C.muted,fontWeight:'700',letterSpacing:1,marginBottom:6},
  transportOpts:{fontSize:12,color:C.secondary,lineHeight:18,marginBottom:10},
  rideRow:     {flexDirection:'row',gap:8},
  rideBtn:     {flex:1,minHeight:44,borderRadius:12,paddingVertical:12,paddingHorizontal:12,
                alignItems:'center',justifyContent:'center',borderWidth:0},
  rideGrab:    {backgroundColor:'#00B14F'},
  rideBolt:    {backgroundColor:'#FFCC00'},
  rideGrabTxt: {color:'#ffffff',fontSize:13,fontWeight:'700'},
  rideBoltTxt: {color:'#0f1117',fontSize:13,fontWeight:'700'},
});}
let dc=makeDc(C);

function makeFr(C:ThemeColors){return StyleSheet.create({
  row:    {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:12,gap:10},
  active: {backgroundColor:C.card},
  board:  {backgroundColor:'#0f1a14'},
  cancel: {opacity:0.4},
  dot:    {width:8,height:8,borderRadius:4,flexShrink:0},
  c1:     {width:118},
  c2:     {flex:1},
  c3:     {width:56,alignItems:'center'},
  c4:     {width:90,alignItems:'flex-end'},
  num:    {fontSize:14,fontWeight:'700',color:C.text},
  airl:   {fontSize:10,color:C.muted,marginTop:2},
  reg:    {fontSize:9,color:C.muted,marginTop:1},
  iata:   {fontSize:15,fontWeight:'700',color:C.text},
  city:   {fontSize:10,color:C.secondary,marginTop:2},
  gate:   {fontSize:13,fontWeight:'700',color:C.accent},
  nogate: {fontSize:16,color:C.muted},
  term:   {fontSize:9,color:C.muted,marginTop:2},
  bag:    {fontSize:9,color:C.muted,marginTop:2},
  time:   {fontSize:15,fontWeight:'700'},
  old:    {fontSize:10,color:C.secondary,textDecorationLine:'line-through'},
  cd:     {fontSize:10,color:C.muted,marginTop:2},
  since:  {fontSize:10,color:'#a78bfa',marginTop:2},
  delay:  {fontSize:11,color:'#f59e0b',fontWeight:'700',marginTop:1},
});}
let fr=makeFr(C);

function makeCx(C:ThemeColors){return StyleSheet.create({
  backdrop:   {flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'flex-end'},
  sheetWrap:  {maxHeight:'92%'},
  sheet:      {backgroundColor:C.card,borderTopLeftRadius:22,borderTopRightRadius:22,
               paddingHorizontal:20,paddingTop:10,paddingBottom:Platform.OS==='ios'?28:16,
               borderWidth:1,borderColor:C.border},
  handle:     {alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:C.muted,marginBottom:14},
  head:       {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18},
  title:      {fontSize:18,fontWeight:'800',color:C.text},
  sub:        {fontSize:12,color:C.secondary,marginTop:4},
  close:      {width:32,height:32,borderRadius:16,backgroundColor:C.list,alignItems:'center',justifyContent:'center'},
  closeTxt:   {color:C.secondary,fontWeight:'700'},
  label:      {fontSize:10,fontWeight:'700',color:C.muted,letterSpacing:1,marginBottom:6,marginTop:4},
  input:      {backgroundColor:C.list,borderWidth:1,borderColor:C.border,borderRadius:12,
               color:C.text,fontSize:16,fontWeight:'700',paddingHorizontal:14,
               paddingVertical:Platform.OS==='ios'?13:10,marginBottom:12,letterSpacing:1},
  inlineHint: {fontSize:11,color:'#f59e0b',marginTop:-8,marginBottom:10,fontWeight:'600'},
  hint:       {fontSize:11,color:C.secondary,marginTop:-6,marginBottom:10},
  cta:        {backgroundColor:C.tabOn,borderRadius:14,paddingVertical:14,alignItems:'center',marginBottom:12},
  ctaTxt:     {color:'#fff',fontSize:15,fontWeight:'800'},
  err:        {color:'#fca5a5',fontSize:12,marginBottom:10},
  result:     {borderRadius:16,borderWidth:1,padding:16,marginTop:4},
  resultMsg:  {fontSize:16,fontWeight:'800',lineHeight:22,marginBottom:14},
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
