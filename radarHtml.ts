import { ENGLISH_DARK_BASE, ENGLISH_DARK_LABELS } from './lib/englishMapTiles';

/** Dark English-label map + live aircraft. Positions are pushed from RN via applyRadarAircraft. */

export type RadarTheme = 'dark' | 'light';

/** Default view: airport + surrounding region (~50 km radius). */
export const RADAR_RADIUS_KM = 50;
export const RADAR_MAX_ZOOM = 11;
export const RADAR_MARKER_BATCH = 20;

export function buildRadarHTML(
  centerLat = 13.68,
  centerLon = 100.75,
  zoom = RADAR_MAX_ZOOM,
  _theme: RadarTheme = 'dark',
  proxyUrl = 'https://waiair-production.up.railway.app',
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta http-equiv="content-language" content="en"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#0A0F1E;overflow:hidden}
  body{font-family:-apple-system,system-ui,sans-serif}
  #hud{
    position:absolute;top:10px;left:10px;right:10px;z-index:800;
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
  @keyframes spin{to{transform:rotate(360deg)}}
  #boot{
    position:absolute;left:50%;bottom:18px;transform:translateX(-50%);
    z-index:800;display:flex;align-items:center;gap:8px;
    background:rgba(10,15,30,.82);border:1px solid rgba(201,168,76,.3);
    border-radius:999px;padding:7px 12px;pointer-events:none;
    color:#C9A84C;font:600 11px -apple-system,system-ui,sans-serif;
  }
  #boot .spin{
    width:12px;height:12px;border-radius:6px;
    border:2px solid rgba(201,168,76,.25);border-top-color:#C9A84C;
    animation:spin .8s linear infinite;
  }
  .leaflet-pane{z-index:400}
  .leaflet-tile-pane{z-index:200}
  .leaflet-overlay-pane{z-index:400}
  .leaflet-shadow-pane{z-index:500}
  .leaflet-marker-pane{z-index:600}
  .leaflet-tooltip-pane{z-index:650}
  .leaflet-popup-pane{z-index:700}
  .leaflet-planes-pane{z-index:650}
  .leaflet-div-icon{background:transparent !important;border:none !important}
  .ac-icon{background:transparent !important;border:none !important}
  .ac-wrap{width:28px;height:28px;display:flex;align-items:center;justify-content:center;position:relative}
  .ac-fallback{
    position:absolute;left:50%;top:50%;margin-left:-6px;margin-top:-9px;
    width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
    border-bottom:16px solid #C9A84C;
    filter:drop-shadow(0 0 3px rgba(201,168,76,.9));
  }
  .ac-svg{position:relative;z-index:1;display:block;width:20px;height:20px;
    filter:drop-shadow(0 0 3px rgba(201,168,76,.9))}
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
<div id="boot"><span class="spin"></span><span id="bootTxt">Loading aircraft…</span></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var CENTER_LAT = ${Number(centerLat) || 13.68};
  var CENTER_LON = ${Number(centerLon) || 100.75};
  var MAX_ZOOM = ${Number(zoom) || 11};
  var RADIUS_KM = 50;
  var PROXY = ${JSON.stringify(String(proxyUrl || '').replace(/\/$/, ''))};
  var MAX = 200;
  var BATCH = 20;
  var LAT_MIN = 0, LAT_MAX = 28, LNG_MIN = 92, LNG_MAX = 140;
  var statusEl = document.getElementById('status');
  var liveDot = document.getElementById('liveDot');
  var bootEl = document.getElementById('boot');
  var bootTxt = document.getElementById('bootTxt');

  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: false
  }).setView([CENTER_LAT, CENTER_LON], 9);

  map.createPane('planes');
  var planePane = map.getPane('planes');
  planePane.style.zIndex = 650;
  planePane.style.pointerEvents = 'auto';

  L.tileLayer('${ENGLISH_DARK_BASE}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 16,
    keepBuffer: 2
  }).addTo(map);
  L.tileLayer('${ENGLISH_DARK_LABELS}', {
    maxZoom: 16,
    keepBuffer: 2
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
      className: 'ac-icon',
      html: '<div style="display:flex;align-items:center"><div class="apt"></div><span class="apt-lbl">'+ap.iata+'</span></div>',
      iconSize: [54, 16],
      iconAnchor: [5, 8]
    });
    L.marker([ap.lat, ap.lon], { icon: icon, interactive: false, keyboard: false }).addTo(map);
  });

  var planeLayer = L.layerGroup().addTo(map);
  var clusterLayer = L.layerGroup().addTo(map);
  var markers = {};
  var lastList = [];
  var lastMeta = { cached: false, source: '', at: 0 };
  var addQueue = [];
  var batchTimer = null;
  var queuedIds = {};

  function inSea(lat, lon){
    return lat >= LAT_MIN && lat <= LAT_MAX && lon >= LNG_MIN && lon <= LNG_MAX;
  }

  function boundsForRadius(lat, lon, km){
    var dLat = km / 111;
    var dLon = km / (111 * Math.max(0.25, Math.cos(lat * Math.PI / 180)));
    return L.latLngBounds([lat - dLat, lon - dLon], [lat + dLat, lon + dLon]);
  }

  function fitAirport(lat, lon, animate){
    map.fitBounds(boundsForRadius(lat, lon, RADIUS_KM), {
      animate: !!animate,
      padding: [28, 28],
      maxZoom: MAX_ZOOM,
      duration: 0.55
    });
  }

  function setBoot(on, txt){
    if(!bootEl) return;
    bootEl.style.display = on ? 'flex' : 'none';
    if(bootTxt && txt) bootTxt.textContent = txt;
  }

  function post(msg){
    var payload = JSON.stringify(msg);
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(payload);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) {}
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
      className: 'ac-icon',
      html: '<div class="ac-wrap" data-ac="1" style="transform:rotate('+rot+'deg)">'
        + '<span class="ac-fallback"></span>'
        + '<svg class="ac-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">'
        + '<path fill="#C9A84C" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>'
        + '</svg></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function postSelect(data){
    post({
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
  }

  function dist2(a, b){
    var dlat = a.lat - b.lat, dlon = a.lon - b.lon;
    return dlat*dlat + dlon*dlon;
  }

  function visibleList(src){
    var b = map.getBounds().pad(0.2);
    var c = map.getCenter();
    var inView = [];
    for(var i=0;i<src.length;i++){
      var a = src[i];
      if(!a || !inSea(a.lat, a.lon)) continue;
      if(b.contains([a.lat, a.lon])) inView.push(a);
    }
    inView.sort(function(x,y){ return dist2(x, c) - dist2(y, c); });
    return inView.slice(0, MAX);
  }

  function renderClusters(list, zoom){
    clusterLayer.clearLayers();
    if(zoom >= 8) return false;
    var buckets = {};
    for(var i=0;i<list.length;i++){
      var a = list[i];
      var cell = Math.max(0.08, 2.4 / Math.pow(2, Math.max(0, zoom - 5)));
      var k = Math.round(a.lat / cell) + ':' + Math.round(a.lon / cell);
      if(!buckets[k]) buckets[k] = { n:0, lat:0, lon:0 };
      buckets[k].n++;
      buckets[k].lat += a.lat;
      buckets[k].lon += a.lon;
    }
    Object.keys(buckets).forEach(function(k){
      var b = buckets[k];
      var lat = b.lat / b.n, lon = b.lon / b.n;
      var icon = L.divIcon({
        className: 'ac-icon',
        html: '<div class="cluster">'+b.n+'</div>',
        iconSize: [32, 28],
        iconAnchor: [16, 14]
      });
      L.marker([lat, lon], { icon: icon, keyboard: false, zIndexOffset: 400 }).addTo(clusterLayer);
    });
    return true;
  }

  function bindTap(marker, data){
    marker.off('click');
    marker.on('click', function(){ postSelect(data); });
  }

  function updateHud(){
    var shown = Object.keys(markers).length;
    var total = lastList.length;
    var clock = new Date();
    var hh = String(clock.getHours()).padStart(2,'0');
    var mm = String(clock.getMinutes()).padStart(2,'0');
    var ss = String(clock.getSeconds()).padStart(2,'0');
    var tag = lastMeta.cached ? 'CACHED' : 'Live';
    var loading = addQueue.length > 0;
    var count = total ? (shown + '/' + total) : '0';
    setStatus('\\u2708 ' + count + ' aircraft · SEA · ' + tag + ' ' + hh + ':' + mm + ':' + ss, !!lastMeta.cached);
    post({ type: 'radarProgress', shown: shown, total: total, loading: loading });
    if(loading) setBoot(true, 'Loading aircraft… ' + shown + '/' + total);
    else setBoot(false);
  }

  function addOne(a){
    if(!a || markers[a.id]) return;
    var m = L.marker([a.lat, a.lon], {
      icon: planeIcon(a.hdg),
      keyboard: false,
      pane: 'planes',
      zIndexOffset: 1000
    });
    bindTap(m, a);
    m.addTo(planeLayer);
    markers[a.id] = {
      marker: m, lat: a.lat, lon: a.lon, tLat: a.lat, tLon: a.lon,
      hdg: a.hdg || 0, tHdg: a.hdg || 0, data: a
    };
  }

  function drainQueue(){
    batchTimer = null;
    var n = 0;
    while(n < BATCH && addQueue.length){
      var a = addQueue.shift();
      if(a){
        delete queuedIds[a.id];
        addOne(a);
      }
      n++;
    }
    updateHud();
    if(addQueue.length){
      batchTimer = setTimeout(drainQueue, 16);
    }
  }

  function applyList(list, meta){
    lastList = list || [];
    lastMeta = meta || lastMeta;
    var zoom = map.getZoom();
    var vis = visibleList(lastList);
    var clustered = renderClusters(vis, zoom);
    var ids = {};

    if(clustered){
      addQueue = [];
      queuedIds = {};
      Object.keys(markers).forEach(function(id){
        planeLayer.removeLayer(markers[id].marker);
        delete markers[id];
      });
      updateHud();
      return;
    }

    for(var i=0;i<vis.length;i++){
      var a = vis[i];
      ids[a.id] = 1;
      var rec = markers[a.id];
      if(rec){
        rec.tLat = a.lat; rec.tLon = a.lon;
        rec.tHdg = a.hdg || rec.tHdg;
        rec.data = a;
        bindTap(rec.marker, a);
      } else if(!queuedIds[a.id]){
        queuedIds[a.id] = 1;
        addQueue.push(a);
      }
    }

    Object.keys(markers).forEach(function(id){
      if(!ids[id]){
        planeLayer.removeLayer(markers[id].marker);
        delete markers[id];
      }
    });
    addQueue = addQueue.filter(function(a){ return !!ids[a.id] && !markers[a.id]; });
    queuedIds = {};
    for(var q=0;q<addQueue.length;q++) queuedIds[addQueue[q].id] = 1;

    updateHud();
    if(addQueue.length && !batchTimer) drainQueue();
  }

  function lerp(a, b, t){ return a + (b - a) * t; }

  function tick(){
    if(addQueue.length) return;
    var zoom = map.getZoom();
    if(zoom < 8) return;
    var t = 0.28;
    Object.keys(markers).forEach(function(id){
      var rec = markers[id];
      var dlat = rec.tLat - rec.lat, dlon = rec.tLon - rec.lon;
      if(dlat*dlat + dlon*dlon < 1e-12 && Math.abs(rec.tHdg - rec.hdg) < 0.4) return;
      rec.lat = lerp(rec.lat, rec.tLat, t);
      rec.lon = lerp(rec.lon, rec.tLon, t);
      rec.hdg = lerp(rec.hdg, rec.tHdg, t);
      rec.marker.setLatLng([rec.lat, rec.lon]);
      var el = rec.marker.getElement();
      if(el){
        var wrap = el.querySelector('.ac-wrap');
        if(wrap) wrap.style.transform = 'rotate(' + rec.hdg + 'deg)';
      }
    });
  }
  setInterval(tick, 200);

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
    if(typeof z === 'number' && z >= 12){
      map.setView([lat, lon], z, { animate: true });
      return;
    }
    fitAirport(lat, lon, true);
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

  map.whenReady(function(){
    function refit(){
      map.invalidateSize();
      fitAirport(CENTER_LAT, CENTER_LON, false);
    }
    refit();
    setTimeout(function(){
      refit();
      post({ type: 'radarReady' });
    }, 160);
  });
})();
</script>
</body>
</html>`;
}
