type LatLng = { latitude: number; longitude: number };

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function interpolateGC(a: LatLng, b: LatLng, t: number): LatLng {
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
    latitude: Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI,
    longitude: Math.atan2(y, x) * 180 / Math.PI,
  };
}

export function arcLatLngSamples(
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number,
  segments = 48,
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

export function arcProgressForStatus(status: string): number {
  switch (status) {
    case 'landed':
      return 0.95;
    case 'boarding':
      return 0.3;
    case 'en-route':
    case 'departed':
      return 0.5;
    case 'delayed':
      return 0.08;
    case 'cancelled':
    case 'scheduled':
    default:
      return 0.05;
  }
}

const PLANE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">' +
  '<path fill="#FFFFFF" d="M12 2.2l.55 1.1.7 7.3 7.55 2.45v.55l-7.55.7-.55 5.9 1.7 1.15v.4L12 21.1l-2.4.65v-.4l1.7-1.15-.55-5.9-7.55-.7v-.55l7.55-2.45.7-7.3z"/></svg>';

export function buildQuickRouteMapHTML(opts: {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  progress: number;
}): string {
  const { originLat, originLon, destLat, destLon } = opts;
  const progress = Math.max(0, Math.min(1, opts.progress));
  const arc = arcLatLngSamples(originLat, originLon, destLat, destLon);
  const mapboxToken = String(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#1a2a35;overflow:hidden}
  .leaflet-control-zoom,.leaflet-control-attribution{display:none!important}
  .leaflet-div-icon{background:transparent!important;border:none!important}
  .dot{width:8px;height:8px;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.45)}
  .ac{width:16px;height:16px;display:block;transform-origin:8px 8px;filter:drop-shadow(0 0 2px rgba(0,0,0,.8))}
</style></head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var o=[${originLat},${originLon}];
  var d=[${destLat},${destLon}];
  var arc=[${arc.map(([la, ln]) => `[${la},${ln}]`).join(',')}];
  var t=${progress.toFixed(4)};
  var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false});
  var mapboxToken='${mapboxToken}';
  if(mapboxToken){
    L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/{z}/{x}/{y}?access_token=' + mapboxToken,
      { tileSize: 512, zoomOffset: -1, maxZoom: 19 }
    ).addTo(map);
  }else{
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);
  }
  L.polyline(arc,{color:'rgba(0,0,0,0.45)',weight:5,lineCap:'round',interactive:false}).addTo(map);
  L.polyline(arc,{color:'#F5C518',weight:2.2,lineCap:'round',interactive:false}).addTo(map);
  L.marker(o,{interactive:false,icon:L.divIcon({className:'',iconSize:[8,8],iconAnchor:[4,4],html:'<div class="dot" style="background:#F5C518"></div>'})}).addTo(map);
  L.marker(d,{interactive:false,icon:L.divIcon({className:'',iconSize:[8,8],iconAnchor:[4,4],html:'<div class="dot" style="background:#FFFFFF"></div>'})}).addTo(map);
  var idx=Math.min(arc.length-2, Math.max(0, Math.floor(t*(arc.length-1))));
  var plane=arc[idx];
  var nxt=arc[idx+1];
  function bearing(a,b){
    var lat1=a[0]*Math.PI/180, lat2=b[0]*Math.PI/180;
    var dLon=(b[1]-a[1])*Math.PI/180;
    var y=Math.sin(dLon)*Math.cos(lat2);
    var x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  }
  var hd=bearing(plane,nxt);
  L.marker(plane,{interactive:false,icon:L.divIcon({className:'',iconSize:[16,16],iconAnchor:[8,8],
    html:'<div class="ac" style="transform:rotate('+(hd-45)+'deg)">${PLANE_SVG}</div>'})}).addTo(map);
  map.fitBounds(L.polyline(arc).getBounds().pad(0.22),{paddingTopLeft:[12,10],paddingBottomRight:[12,10],maxZoom:5});
  window.__rhMap=map;
  function rhResize(){try{map.invalidateSize();}catch(e){}}
  setTimeout(rhResize,80);
  setTimeout(rhResize,320);
</script></body></html>`;
}
