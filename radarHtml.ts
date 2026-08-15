/** Dark Carto map + live aircraft. Positions are pushed from RN via applyRadarAircraft. */

export type RadarTheme = 'dark' | 'light';

export function buildRadarHTML(
  centerLat = 13.68,
  centerLon = 100.75,
  zoom = 7,
  _theme: RadarTheme = 'dark',
  proxyUrl = 'https://waiair-production.up.railway.app',
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#0A0F1E;overflow:hidden}
  body{font-family:-apple-system,system-ui,sans-serif}
  #hud{
    position:absolute;top:10px;left:10px;right:10px;z-index:500;
    display:flex;justify-content:space-between;align-items:center;gap:8px;pointer-events:none;
  }
  #status{
    font:600 11px -apple-system,system-ui,sans-serif;color:#8896B0;
    background:rgba(10,15,30,.88);border:1px solid rgba(201,168,76,.28);
    border-radius:10px;padding:7px 10px;backdrop-filter:blur(8px);
  }
  #status .dot{display:inline-block;width:7px;height:7px;border-radius:4px;background:#22c55e;margin-right:6px}
  #status .dot.pulse{animation:pulse 1.2s ease-out}
  #status.cached .dot{background:#f59e0b}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}100%{box-shadow:0 0 0 8px rgba(34,197,94,0)}}
  .ac-wrap{width:28px;height:28px;display:flex;align-items:center;justify-content:center}
  .ac{
    font-size:18px;line-height:1;filter:drop-shadow(0 0 3px rgba(201,168,76,.85));
    transform-origin:center center;will-change:transform;
  }
  .apt{
    width:10px;height:10px;border-radius:5px;background:#C9A84C;
    box-shadow:0 0 0 2px rgba(248,250,252,.9),0 0 8px rgba(201,168,76,.7);
  }
  .apt-lbl{
    color:#F8FAFC;font:700 10px/1 -apple-system,system-ui,sans-serif;
    text-shadow:0 1px 3px #0A0F1E;margin-left:4px;white-space:nowrap;
  }
  .cluster{
    background:rgba(201,168,76,.92);color:#0A0F1E;border-radius:16px;
    min-width:28px;height:28px;padding:0 7px;
    display:flex;align-items:center;justify-content:center;
    font:800 11px -apple-system,system-ui,sans-serif;
    box-shadow:0 0 0 2px rgba(10,15,30,.6);
  }
  .leaflet-control-attribution{background:rgba(10,15,30,.65)!important;color:#64748b!important;font-size:9px!important}
  .leaflet-control-attribution a{color:#8896B0!important}
  .leaflet-control-zoom a{
    background:#121A2E!important;color:#F8FAFC!important;border-color:#1f2a44!important;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="hud"><div id="status"><span class="dot" id="liveDot"></span>Waiting for radar…</div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var CENTER_LAT = ${Number(centerLat) || 13.68};
  var CENTER_LON = ${Number(centerLon) || 100.75};
  var START_ZOOM = ${Number(zoom) || 7};
  var PROXY = ${JSON.stringify(String(proxyUrl || '').replace(/\/$/, ''))};
  var MAX = 500;
  var LAT_MIN = 0, LAT_MAX = 28, LNG_MIN = 92, LNG_MAX = 140;
  var statusEl = document.getElementById('status');
  var liveDot = document.getElementById('liveDot');

  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: false
  }).setView([CENTER_LAT, CENTER_LON], START_ZOOM);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  var AIRPORTS = [
    { iata:'BKK', lat:13.69, lon:100.75 },
    { iata:'HKT', lat:8.11, lon:98.31 },
    { iata:'SIN', lat:1.36, lon:103.99 },
    { iata:'KUL', lat:2.75, lon:101.71 },
    { iata:'DPS', lat:-8.75, lon:115.17 },
    { iata:'CNX', lat:18.77, lon:98.96 }
  ];
  AIRPORTS.forEach(function(ap){
    var icon = L.divIcon({
      className: '',
      html: '<div style="display:flex;align-items:center"><div class="apt"></div><span class="apt-lbl">'+ap.iata+'</span></div>',
      iconSize: [54, 16],
      iconAnchor: [5, 8]
    });
    L.marker([ap.lat, ap.lon], { icon: icon, interactive: false, keyboard: false }).addTo(map);
  });

  var planeLayer = L.layerGroup().addTo(map);
  var clusterLayer = L.layerGroup().addTo(map);
  var markers = {}; // id -> { marker, lat, lon, tLat, tLon, hdg, tHdg, data }
  var lastList = [];
  var lastMeta = { cached: false, source: '', at: 0 };
  var lastApply = Date.now();

  function inSea(lat, lon){
    return lat >= LAT_MIN && lat <= LAT_MAX && lon >= LNG_MIN && lon <= LNG_MAX;
  }

  function setStatus(txt, cached){
    statusEl.className = cached ? 'cached' : '';
    statusEl.innerHTML = '<span class="dot'+(cached?'':' pulse')+'" id="liveDot"></span>' + txt;
    liveDot = document.getElementById('liveDot');
    if(!cached){
      setTimeout(function(){ if(liveDot) liveDot.classList.remove('pulse'); }, 1200);
    }
  }

  function planeIcon(hdg){
    var rot = (hdg == null || isNaN(hdg)) ? 0 : Number(hdg);
    return L.divIcon({
      className: '',
      html: '<div class="ac-wrap"><div class="ac" style="transform:rotate('+rot+'deg)">✈️</div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function postSelect(data){
    var payload = JSON.stringify({
      type: 'planeSelect',
      callsign: data.cs || '',
      icao: data.id || '',
      altitude: data.altM,
      speedMs: data.spdMs,
      lat: data.lat,
      lon: data.lon,
      heading: data.hdg,
      vertRate: data.vr,
      country: data.country || '',
      registration: data.reg || ''
    });
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(payload);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) {}
  }

  function dist2(a, b){
    var dlat = a.lat - b.lat, dlon = a.lon - b.lon;
    return dlat*dlat + dlon*dlon;
  }

  function visibleList(src){
    var b = map.getBounds();
    var c = map.getCenter();
    var inView = [];
    var rest = [];
    for(var i=0;i<src.length;i++){
      var a = src[i];
      if(!a || !inSea(a.lat, a.lon)) continue;
      if(b.contains([a.lat, a.lon])) inView.push(a);
      else rest.push(a);
    }
    inView.sort(function(x,y){ return dist2(x, c) - dist2(y, c); });
    rest.sort(function(x,y){ return dist2(x, c) - dist2(y, c); });
    return inView.concat(rest).slice(0, MAX);
  }

  function clusterCell(lat, lon, zoom){
    var cell = Math.max(0.08, 2.4 / Math.pow(2, Math.max(0, zoom - 5)));
    return Math.round(lat / cell) + ':' + Math.round(lon / cell);
  }

  function renderClusters(list, zoom){
    clusterLayer.clearLayers();
    if(zoom >= 6) return false;
    var buckets = {};
    for(var i=0;i<list.length;i++){
      var a = list[i];
      var k = clusterCell(a.lat, a.lon, zoom);
      if(!buckets[k]) buckets[k] = { n:0, lat:0, lon:0 };
      buckets[k].n++;
      buckets[k].lat += a.lat;
      buckets[k].lon += a.lon;
    }
    Object.keys(buckets).forEach(function(k){
      var b = buckets[k];
      var lat = b.lat / b.n, lon = b.lon / b.n;
      var icon = L.divIcon({
        className: '',
        html: '<div class="cluster">'+b.n+'</div>',
        iconSize: [32, 28],
        iconAnchor: [16, 14]
      });
      L.marker([lat, lon], { icon: icon, keyboard: false }).addTo(clusterLayer);
    });
    return true;
  }

  function bindTap(marker, data){
    marker.off('click');
    marker.on('click', function(){ postSelect(data); });
  }

  function applyList(list, meta){
    lastList = list || [];
    lastMeta = meta || lastMeta;
    lastApply = Date.now();
    var zoom = map.getZoom();
    var vis = visibleList(lastList);
    var clustered = renderClusters(vis, zoom);
    var shown = clustered ? 0 : vis.length;
    var ids = {};

    if(!clustered){
      for(var i=0;i<vis.length;i++){
        var a = vis[i];
        ids[a.id] = 1;
        var rec = markers[a.id];
        if(!rec){
          var m = L.marker([a.lat, a.lon], { icon: planeIcon(a.hdg), keyboard: false });
          bindTap(m, a);
          m.addTo(planeLayer);
          markers[a.id] = {
            marker: m, lat: a.lat, lon: a.lon, tLat: a.lat, tLon: a.lon,
            hdg: a.hdg || 0, tHdg: a.hdg || 0, data: a
          };
        } else {
          rec.tLat = a.lat; rec.tLon = a.lon;
          rec.tHdg = a.hdg || rec.tHdg;
          rec.data = a;
          bindTap(rec.marker, a);
        }
      }
    }

    Object.keys(markers).forEach(function(id){
      if(clustered || !ids[id]){
        planeLayer.removeLayer(markers[id].marker);
        delete markers[id];
      }
    });

    var n = lastList.length;
    var clock = new Date();
    var hh = String(clock.getHours()).padStart(2,'0');
    var mm = String(clock.getMinutes()).padStart(2,'0');
    var ss = String(clock.getSeconds()).padStart(2,'0');
    var tag = lastMeta.cached ? 'CACHED' : 'Live';
    setStatus('\\u2708 ' + n + ' aircraft · SEA · ' + tag + ' ' + hh + ':' + mm + ':' + ss, !!lastMeta.cached);
  }

  function lerp(a, b, t){ return a + (b - a) * t; }

  function tick(){
    var zoom = map.getZoom();
    if(zoom >= 6){
      var t = 0.18;
      Object.keys(markers).forEach(function(id){
        var rec = markers[id];
        rec.lat = lerp(rec.lat, rec.tLat, t);
        rec.lon = lerp(rec.lon, rec.tLon, t);
        rec.hdg = lerp(rec.hdg, rec.tHdg, t);
        rec.marker.setLatLng([rec.lat, rec.lon]);
        var el = rec.marker.getElement();
        if(el){
          var ac = el.querySelector('.ac');
          if(ac) ac.style.transform = 'rotate(' + rec.hdg + 'deg)';
        }
      });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  var moveTimer = null;
  map.on('moveend zoomend', function(){
    clearTimeout(moveTimer);
    moveTimer = setTimeout(function(){ applyList(lastList, lastMeta); }, 80);
  });

  window.applyRadarAircraft = function(list, meta){
    applyList(list || [], meta || {});
  };
  window.applyRadarStates = function(states){
    var out = [];
    for(var i=0;i<(states||[]).length;i++){
      var s = states[i];
      var lon = s[5], lat = s[6];
      if(lat == null || lon == null) continue;
      out.push({
        id: String(s[0]||i), cs: String(s[1]||s[0]||'').trim(),
        country: String(s[2]||''), lon: lon, lat: lat,
        altM: s[7], spdMs: s[9], hdg: s[10], vr: s[11], reg: ''
      });
    }
    applyList(out, {});
  };
  window.flyTo = function(lat, lon, z){
    map.setView([lat, lon], z || 9, { animate: true });
  };

  function parseAc(data){
    if(data && Array.isArray(data.aircraft) && data.aircraft.length) return data.aircraft;
    if(data && Array.isArray(data.states)){
      var out = [];
      for(var i=0;i<data.states.length;i++){
        var s = data.states[i];
        if(!s || s[5]==null || s[6]==null) continue;
        out.push({ id:String(s[0]||i), cs:String(s[1]||s[0]||'').trim(), country:String(s[2]||''), lon:s[5], lat:s[6], altM:s[7], spdMs:s[9], hdg:s[10], vr:s[11], reg:'' });
      }
      return out;
    }
    if(data && Array.isArray(data.ac)){
      var out2 = [];
      for(var j=0;j<data.ac.length;j++){
        var a = data.ac[j];
        if(!a || a.lat==null || a.lon==null) continue;
        var altFt = a.alt_baro==='ground' ? 0 : a.alt_baro;
        out2.push({
          id:String(a.hex||j), cs:String(a.flight||a.hex||'').trim(),
          country:'', lon:a.lon, lat:a.lat,
          altM: altFt==null?null:altFt/3.281,
          spdMs: a.gs==null?null:a.gs/1.944,
          hdg: a.track, vr: a.baro_rate==null?null:a.baro_rate/3.281/60,
          reg: String(a.r||'')
        });
      }
      return out2;
    }
    return [];
  }

  function fallbackFetch(){
    if(lastList.length) return;
    var bbox = 'lamin=0&lomin=92&lamax=28&lomax=140';
    var tries = [];
    if(PROXY) tries.push(PROXY + '/radar?' + bbox);
    tries.push('https://opensky-network.org/api/states/all?' + bbox);
    tries.push('https://api.adsb.lol/v2/lat/13.75/lon/100.5/dist/250');
    (function next(i){
      if(lastList.length || i >= tries.length) return;
      fetch(tries[i]).then(function(r){ return r.ok ? r.json() : Promise.reject(); })
        .then(function(data){
          var list = parseAc(data);
          if(list.length) applyList(list, { cached: false, source: 'webview' });
          else next(i+1);
        })
        .catch(function(){ next(i+1); });
    })(0);
  }
  setTimeout(fallbackFetch, 3500);

  try {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'radarReady' }));
    }
  } catch (e) {}
})();
</script>
</body>
</html>`;
}
