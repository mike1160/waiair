import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { airportRecByIata } from './lib/airportsDb';
import { ENGLISH_DARK_BASE, ENGLISH_DARK_LABELS } from './lib/englishMapTiles';
import type { PassportEntry } from './lib/flightPassport';

const MAP_H = 220;
const GOLD = '#C9A84C';
const BG = '#0a0a1a';

type LatLng = { lat: number; lon: number };
type RouteArc = {
  origin: string;
  dest: string;
  pts: [number, number][];
};

function validCoord(lat?: number, lon?: number): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

function coordsFor(iata: string, lat?: number, lon?: number): LatLng | null {
  if (validCoord(lat, lon)) return { lat: lat as number, lon: lon as number };
  const ap = airportRecByIata(iata);
  if (ap && validCoord(ap.lat, ap.lon)) return { lat: ap.lat, lon: ap.lon };
  return null;
}

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

function interpolateGC(a: LatLng, b: LatLng, t: number): LatLng {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);
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
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lon: toDeg(Math.atan2(y, x)),
  };
}

function arcPts(a: LatLng, b: LatLng, segments = 48): [number, number][] {
  const pts: [number, number][] = [];
  let prevLon = a.lon;
  for (let i = 0; i <= segments; i++) {
    const p = interpolateGC(a, b, i / segments);
    let lon = p.lon;
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    pts.push([p.lat, lon]);
    prevLon = lon;
  }
  return pts;
}

function buildRoutes(entries: PassportEntry[]): { routes: RouteArc[]; airports: { iata: string; lat: number; lon: number }[] } {
  const seenRoute = new Set<string>();
  const routes: RouteArc[] = [];
  const byIata = new Map<string, { iata: string; lat: number; lon: number }>();

  for (const e of entries) {
    const oIata = String(e.originIata || '').toUpperCase();
    const dIata = String(e.destIata || '').toUpperCase();
    if (!oIata || !dIata || oIata === dIata) continue;
    const o = coordsFor(oIata, e.originLat, e.originLon);
    const d = coordsFor(dIata, e.destLat, e.destLon);
    if (!o || !d) continue;
    const key = `${oIata}>${dIata}`;
    if (!seenRoute.has(key)) {
      seenRoute.add(key);
      routes.push({ origin: oIata, dest: dIata, pts: arcPts(o, d) });
    }
    if (!byIata.has(oIata)) byIata.set(oIata, { iata: oIata, lat: o.lat, lon: o.lon });
    if (!byIata.has(dIata)) byIata.set(dIata, { iata: dIata, lat: d.lat, lon: d.lon });
  }
  return { routes, airports: [...byIata.values()] };
}

function buildMapHtml(routes: RouteArc[], airports: { iata: string; lat: number; lon: number }[]): string {
  const routeJson = JSON.stringify(routes);
  const airportJson = JSON.stringify(airports);
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${BG};overflow:hidden}
  .leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
  .leaflet-div-icon{background:transparent!important;border:none!important}
  .dot{width:8px;height:8px;border-radius:50%;background:${GOLD};box-shadow:0 0 8px ${GOLD};}
  .lbl{position:absolute;left:50%;top:100%;margin:4px 0 0 0;transform:translateX(-50%);
    font:700 9px/1.1 -apple-system,system-ui,sans-serif;color:${GOLD};letter-spacing:.04em;
    text-shadow:0 1px 2px #000;white-space:nowrap;pointer-events:none}
</style></head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var routes=${routeJson};
  var airports=${airportJson};
  var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:true,scrollWheelZoom:false,doubleClickZoom:false});
  var base=L.tileLayer('${ENGLISH_DARK_BASE}',{maxZoom:8,keepBuffer:2}).addTo(map);
  var bc=base.getContainer();
  if(bc) bc.style.filter='contrast(1.2) brightness(0.72) saturate(0.45)';
  L.tileLayer('${ENGLISH_DARK_LABELS}',{maxZoom:8,keepBuffer:2}).addTo(map);
  var bounds=[];
  airports.forEach(function(a){
    bounds.push([a.lat,a.lon]);
    L.marker([a.lat,a.lon],{keyboard:false,icon:L.divIcon({
      className:'',iconSize:[8,8],iconAnchor:[4,4],
      html:'<div class="dot"></div><div class="lbl">'+String(a.iata||'')+'</div>'
    })}).addTo(map).bindPopup(String(a.iata||''));
  });
  if(bounds.length) map.fitBounds(bounds,{padding:[28,28],maxZoom:5});
  else map.setView([12,100],3);
  function drawRoute(route, done){
    var line=L.polyline([],{color:'${GOLD}',weight:1.6,opacity:0.92,lineCap:'round'}).addTo(map);
    var glow=L.polyline([],{color:'${GOLD}',weight:5,opacity:0.18,lineCap:'round'}).addTo(map);
    var i=0, n=route.pts.length, start=Date.now(), dur=2000;
    function step(){
      var t=Math.min(1,(Date.now()-start)/dur);
      var next=Math.max(i, Math.floor(t*(n-1))+1);
      while(i<next && i<n){ line.addLatLng(route.pts[i]); glow.addLatLng(route.pts[i]); i++; }
      if(t<1) requestAnimationFrame(step); else done();
    }
    if(!n){ done(); return; }
    line.addLatLng(route.pts[0]); glow.addLatLng(route.pts[0]); i=1;
    requestAnimationFrame(step);
  }
  var idx=0;
  function next(){
    if(idx>=routes.length) return;
    drawRoute(routes[idx++], next);
  }
  next();
</script></body></html>`;
}

export default function PassportRouteMap({
  entries,
  routeCount,
  countryCount,
  airportCount,
}: {
  entries: PassportEntry[];
  routeCount?: number;
  countryCount?: number;
  airportCount?: number;
}) {
  const { routes, airports } = useMemo(() => buildRoutes(entries), [entries]);
  const html = useMemo(() => (routes.length ? buildMapHtml(routes, airports) : ''), [routes, airports]);

  if (!routes.length) return null;

  const caption = [
    `${routeCount ?? routes.length} routes`,
    countryCount != null ? `${countryCount} countries` : '',
    airportCount != null ? `${airportCount} airports` : '',
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.wrap}>
      <View style={styles.map}>
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={html}
            title="Flight passport routes"
            style={{ width: '100%', height: MAP_H, border: 'none', background: BG }}
          />
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={styles.web}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            setSupportMultipleWindows={false}
            mixedContentMode="always"
            androidLayerType="hardware"
          />
        )}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.28)',
  },
  map: { height: MAP_H, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
  caption: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
