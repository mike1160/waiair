import { overlayZoneColor, type TurbulenceSeverity } from './turbulence';
import type { WeatherKind } from './destinationServices';
import { ENGLISH_DARK_BASE, ENGLISH_DARK_LABELS } from './englishMapTiles';

export type LatLng = { latitude: number; longitude: number };
type WxPin = { emoji: string; temp: number } | null;

const DEP_DOT = '#E5E7EB';
const PLANE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22">' +
  '<path fill="#F1F5F9" d="M12 2.2l.55 1.1.7 7.3 7.55 2.45v.55l-7.55.7-.55 5.9 1.7 1.15v.4L12 21.1l-2.4.65v-.4l1.7-1.15-.55-5.9-7.55-.7v-.55l7.55-2.45.7-7.3z"/></svg>';

export function validCoord(lat?: number, lon?: number): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

export function toPt(lat?: number, lon?: number): LatLng | null {
  if (!validCoord(lat, lon)) return null;
  return { latitude: lat as number, longitude: lon as number };
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

export function interpolateGC(a: LatLng, b: LatLng, t: number): LatLng {
  const lat1 = toRad(a.latitude);
  const lon1 = toRad(a.longitude);
  const lat2 = toRad(b.latitude);
  const lon2 = toRad(b.longitude);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ));
  if (!(d > 1e-6)) return a;
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  return {
    latitude: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    longitude: toDeg(Math.atan2(y, x)),
  };
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function routeT(progress: number) {
  return Math.min(0.97, Math.max(0.03, progress));
}

function esc(s: string) {
  return String(s || '').replace(/[<>&"']/g, '');
}

export function groupOverlay<T>(
  items: Array<{ severity: TurbulenceSeverity; pt: T }>,
): Array<{ color: string; pts: T[] }> {
  if (items.length < 2) return [];
  const out: Array<{ color: string; pts: T[] }> = [];
  let pts = [items[0].pt];
  let sev = items[0].severity;
  for (let i = 1; i < items.length; i++) {
    const pt = items[i].pt;
    if (items[i].severity === sev) {
      pts.push(pt);
      continue;
    }
    pts.push(pt);
    if (pts.length >= 2 && sev !== 'smooth') out.push({ color: overlayZoneColor(sev), pts });
    pts = [pt];
    sev = items[i].severity;
  }
  if (pts.length >= 2 && sev !== 'smooth') out.push({ color: overlayZoneColor(sev), pts });
  return out;
}

export function arcLatLngSamples(
  oLat: number, oLng: number, dLat: number, dLng: number, segments = 56,
): [number, number][] {
  const origin = { latitude: oLat, longitude: oLng };
  const dest = { latitude: dLat, longitude: dLng };
  const pts: [number, number][] = [];
  let prevLon = oLng;
  for (let i = 0; i <= segments; i++) {
    const p = interpolateGC(origin, dest, i / segments);
    let lon = p.longitude;
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    pts.push([p.latitude, lon]);
    prevLon = lon;
  }
  return pts;
}

export function routeLineColor(status?: string): string {
  switch (String(status || '').toLowerCase()) {
    case 'landed':
    case 'arrived':
      return '#22c55e';
    case 'en-route':
      return '#FF9800';
    case 'delayed':
    case 'cancelled':
      return '#EF4444';
    default:
      return '#94A3B8';
  }
}

export function wxEmoji(kind?: WeatherKind): string {
  switch (kind) {
    case 'sun': return '☀️';
    case 'rain': return '🌧️';
    case 'storm': return '⛈️';
    case 'snow': return '❄️';
    case 'fog': return '🌫️';
    default: return '☁️';
  }
}

export function buildRouteMapHTML(
  origin: LatLng,
  dest: LatLng,
  originCode: string,
  destCode: string,
  plane: LatLng | null,
  heading: number,
  accentColor: string,
  overlaySegs: Array<{ color: string; latlngs: [number, number][] }>,
  originWx: WxPin,
  destWx: WxPin,
  windDeg?: number,
  compact = false,
) {
  const oCode = esc(originCode.toUpperCase());
  const dCode = esc(destCode.toUpperCase());
  const depIata = oCode;
  const arrIata = dCode;
  const arc = arcLatLngSamples(origin.latitude, origin.longitude, dest.latitude, dest.longitude);
  const mid = arc[Math.floor(arc.length / 2)];
  const hd = Number.isFinite(heading) ? Math.round(heading) : 0;
  const tileBase = esc(ENGLISH_DARK_BASE);
  const tileLabels = esc(ENGLISH_DARK_LABELS);
  const wxChip = (pin: WxPin, id: string) => pin
    ? `<div class="wx" id="${id}">${esc(pin.emoji)} ${pin.temp}°</div>`
    : '';
  const padTL = compact ? '[28,20]' : '[48,36]';
  const padBR = compact ? '[28,56]' : '[48,100]';
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#07090f;overflow:hidden}
  .leaflet-control-zoom{display:none!important}
  .leaflet-div-icon{background:transparent!important;border:none!important}
  .leaflet-marker-icon{overflow:visible!important}
  .pin{position:relative;width:9px;height:9px}
  .dot{width:9px;height:9px;border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,.35);transform-origin:center center}
  .dot-dep,.dot-arr{animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.4}}
  .wx{position:absolute;left:50%;bottom:100%;top:auto;margin:0 0 6px 0;transform:translateX(-50%);
    background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    color:#FFFFFF;font:500 11px/1.15 -apple-system,system-ui,sans-serif;
    padding:2px 5px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);
    white-space:nowrap;letter-spacing:.01em;pointer-events:none}
  .dep-label,.arr-label{background:transparent!important;border:none!important;overflow:visible!important}
  .iata-lbl{
    font:700 11px/1.2 -apple-system,system-ui,sans-serif;color:#FFFFFF;
    background:rgba(0,0,0,0.85);padding:3px 7px;border-radius:4px;
    border:1px solid rgba(255,255,255,0.5);
    text-shadow:0 1px 2px rgba(0,0,0,0.9);
    white-space:nowrap;pointer-events:none}
  .iata-lbl.dep{transform:translate(calc(-100% - 4px),10px)}
  .iata-lbl.arr{transform:translate(4px,10px)}
  .wind{font-size:12px;line-height:12px;opacity:.65;filter:drop-shadow(0 1px 1px #000);transform-origin:center}
  .ac{width:22px;height:22px;display:block;transform-origin:11px 11px;
    filter:drop-shadow(0px 0px 3px white)}
</style></head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var o=[${origin.latitude},${origin.longitude}];
  var d=[${dest.latitude},${dest.longitude}];
  var depIata='${depIata}';
  var arrIata='${arrIata}';
  var map;
  function rhInit(){
    var el=document.getElementById('map');
    if(!el||el.offsetWidth<2||el.offsetHeight<2){requestAnimationFrame(rhInit);return;}
    map=L.map('map',{zoomControl:false,attributionControl:true,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,tap:false});
    L.tileLayer('${tileBase}',{attribution:'Tiles © Esri',maxZoom:16,keepBuffer:2}).addTo(map);
    L.tileLayer('${tileLabels}',{maxZoom:16,keepBuffer:2}).addTo(map);
    rhLayers();
  }
  function rhLayers(){
  var arc=[${arc.map(([la, ln]) => `[${la},${ln}]`).join(',')}];
  var lineOutline=L.polyline(arc,{color:'#000000',weight:6,dashArray:'8 6',lineCap:'round',opacity:0.5,interactive:false}).addTo(map);
  var line=L.polyline(arc,{color:'#FFFFFF',weight:3,dashArray:'8 6',lineCap:'round',opacity:1,interactive:false}).addTo(map);
  map.fitBounds(line.getBounds().pad(0.28),{paddingTopLeft:${padTL},paddingBottomRight:${padBR},maxZoom:5});
  ${overlaySegs.map(s =>
    `L.polyline([${s.latlngs.map(([la, ln]) => `[${la},${ln}]`).join(',')}],{color:'${esc(s.color)}',weight:5,opacity:0.85,lineCap:'round',interactive:false}).addTo(map);`
  ).join('\n  ')}
  function pin(ll,color,html,cls){
    return L.marker(ll,{interactive:false,keyboard:false,icon:L.divIcon({className:'rh-icon',iconSize:[9,9],iconAnchor:[5,5],html:'<div class="pin"><div class="dot '+(cls||'')+'" style="background:'+color+'"></div>'+html+'</div>'})});
  }
  function iataLabel(ll,text,side){
    return L.marker(ll,{interactive:false,keyboard:false,icon:L.divIcon({
      className:side==='dep'?'dep-label':'arr-label',
      iconSize:[1,1],iconAnchor:[5,5],
      html:'<div class="iata-lbl '+side+'">'+text+'</div>'
    })});
  }
  pin(o,'${DEP_DOT}','${wxChip(originWx, 'wx-o')}','dot-dep').addTo(map);
  iataLabel(o,depIata,'dep').addTo(map);
  ${dCode && dCode !== oCode ? `pin(d,'${esc(accentColor)}','${wxChip(destWx, 'wx-d')}','dot-arr').addTo(map);
  iataLabel(d,arrIata,'arr').addTo(map);` : ''}
  ${windDeg != null && Number.isFinite(windDeg) ? `
  L.marker([${mid[0]},${mid[1]}],{interactive:false,keyboard:false,icon:L.divIcon({className:'rh-icon',iconSize:[14,14],iconAnchor:[7,7],html:'<div class="wind" style="transform:rotate(${Math.round(windDeg + 180)}deg)">➤</div>'})}).addTo(map);
  ` : ''}
  var p=${plane ? `[${plane.latitude},${plane.longitude}]` : 'null'};
  if(p){
    L.marker(p,{interactive:false,keyboard:false,icon:L.divIcon({className:'rh-icon',iconSize:[22,22],iconAnchor:[11,11],
      html:'<div class="ac" style="transform:rotate(${hd}deg)">${PLANE_SVG}</div>'})}).addTo(map);
    function havKm(a,b){
      var R=6371,p1=a[0]*Math.PI/180,p2=b[0]*Math.PI/180;
      var dlat=(b[0]-a[0])*Math.PI/180,dlng=(b[1]-a[1])*Math.PI/180;
      var s=Math.sin(dlat/2)*Math.sin(dlat/2)+Math.cos(p1)*Math.cos(p2)*Math.sin(dlng/2)*Math.sin(dlng/2);
      return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
    }
    function shiftWx(ll,id,other){
      var el=document.getElementById(id);
      if(!el||!ll) return;
      var km=havKm(p,ll);
      var ptP=map.latLngToContainerPoint(p);
      var ptB=map.latLngToContainerPoint(ll);
      var dx=ptB.x-ptP.x, dy=ptB.y-ptP.y;
      var pix=Math.sqrt(dx*dx+dy*dy);
      if(km>=150 && pix>=60) return;
      var ox,oy;
      if(pix<8){
        var ptO=map.latLngToContainerPoint(o);
        var ptD=map.latLngToContainerPoint(d);
        var rx=ptD.x-ptO.x, ry=ptD.y-ptO.y;
        var rlen=Math.sqrt(rx*rx+ry*ry)||1;
        ox=(-ry/rlen)*40;
        oy=(rx/rlen)*40;
        var ptOther=map.latLngToContainerPoint(other);
        if((ptOther.x-(ptB.x+ox))*ox+(ptOther.y-(ptB.y+oy))*oy>0){ox=-ox;oy=-oy;}
      } else {
        ox=(dx/pix)*40;
        oy=(dy/pix)*40;
      }
      el.style.transform='translate(calc(-50% + '+Math.round(ox)+'px), '+Math.round(oy)+'px)';
    }
    shiftWx(o,'wx-o',d);
    shiftWx(d,'wx-d',o);
  }
  window.__rhMap=map;
  function rhResize(){try{map.invalidateSize(true);}catch(e){}}
  setTimeout(rhResize,120);
  setTimeout(rhResize,520);
  }
  requestAnimationFrame(rhInit);
</script></body></html>`;
}
