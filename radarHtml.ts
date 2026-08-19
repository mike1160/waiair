import { ENGLISH_DARK_BASE, ENGLISH_DARK_LABELS } from './lib/englishMapTiles';

/** Dark English-label map + live aircraft. Positions are pushed from RN via applyRadarAircraft. */

export type RadarTheme = 'dark' | 'light';

/** Default view: airport + surrounding region (~250 km radius). */
export const RADAR_RADIUS_KM = 250;
export const RADAR_MAX_ZOOM = 11;
export const RADAR_MARKER_BATCH = 20;

export function buildRadarHTML(
  centerLat = 13.68,
  centerLon = 100.75,
  zoom = RADAR_MAX_ZOOM,
  _theme: RadarTheme = 'dark',
  proxyUrl = 'https://waiair-production.up.railway.app',
  iata = 'BKK',
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
    position:absolute;top:10px;left:10px;right:10px;z-index:1200;
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
    z-index:1200;display:flex;align-items:center;gap:8px;
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
  .leaflet-overlay-pane{z-index:650}
  .leaflet-shadow-pane{z-index:500}
  .leaflet-marker-pane{z-index:700}
  .leaflet-tooltip-pane{z-index:750}
  .leaflet-popup-pane{z-index:900}
  .leaflet-planes-pane{z-index:850 !important}
  .leaflet-div-icon{background:transparent !important;border:none !important}
  .ac-icon{background:transparent !important;border:none !important;overflow:visible !important;pointer-events:auto !important}
  .ac-wrap{width:36px;height:36px;display:flex;align-items:center;justify-content:center}
  .ac-wrap svg{display:block;overflow:visible}
  .ac-popup .leaflet-popup-content-wrapper{
    background:#121A2E;color:#F8FAFC;border:1px solid rgba(201,168,76,.45);
    border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.45);
  }
  .ac-popup .leaflet-popup-tip{background:#121A2E}
  .ac-popup .leaflet-popup-content{margin:10px 12px;min-width:148px}
  .ac-pop-cs{font:800 14px/1.2 -apple-system,system-ui,sans-serif;color:#F5A623;margin-bottom:4px}
  .ac-pop-row{font:600 12px/1.45 -apple-system,system-ui,sans-serif;color:#E2E8F0}
  .ac-pop-muted{color:#8896B0}
  .apt{
    width:10px;height:10px;border-radius:5px;background:#C9A84C;
    box-shadow:0 0 0 2px rgba(248,250,252,.9);
  }
  .apt-here{
    width:12px;height:12px;border-radius:6px;background:#C9A84C;
    box-shadow:0 0 0 3px rgba(201,168,76,.45);
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
<div id="boot" style="display:none"><span class="spin"></span><span id="bootTxt">Loading aircraft…</span></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var CENTER_LAT = ${Number(centerLat) || 13.68};
  var CENTER_LON = ${Number(centerLon) || 100.75};
  var CENTER_IATA = ${JSON.stringify(String(iata || 'BKK').toUpperCase())};
  var MAX_ZOOM = ${Number(zoom) || 11};
  var RADIUS_KM = ${RADAR_RADIUS_KM};
  var KEEP_KM = ${Math.round(RADAR_RADIUS_KM * 1.852)};
  var PROXY = ${JSON.stringify(String(proxyUrl || '').replace(/\/$/, ''))};
  var MAX = 500;
  var BATCH = 20;
  var statusEl = document.getElementById('status');
  var liveDot = document.getElementById('liveDot');
  var bootEl = document.getElementById('boot');
  var bootTxt = document.getElementById('bootTxt');
  var mapReady = false;
  var pending = window.__pendingRadar || null;
  if(pending && pending.list && pending.list.length){
    log('[radar] restored pending queue', pending.list.length);
  }

  function log(){
    try { console.log.apply(console, arguments); } catch (e) {}
  }

  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: false
  }).setView([CENTER_LAT, CENTER_LON], MAX_ZOOM);

  map.createPane('planes');
  var planePane = map.getPane('planes');
  planePane.style.zIndex = 850;
  planePane.style.pointerEvents = 'auto';

  L.tileLayer('${ENGLISH_DARK_BASE}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 16,
    keepBuffer: 2,
    pane: 'tilePane'
  }).addTo(map);
  L.tileLayer('${ENGLISH_DARK_LABELS}', {
    maxZoom: 16,
    keepBuffer: 2,
    pane: 'tilePane'
  }).addTo(map);

  var AIRPORTS = [
    { iata:'BKK', lat:13.69, lon:100.75 },
    { iata:'HKT', lat:8.1132, lon:98.3017 },
    { iata:'SIN', lat:1.36, lon:103.99 },
    { iata:'KUL', lat:2.75, lon:101.71 },
    { iata:'DPS', lat:-8.75, lon:115.17 },
    { iata:'CNX', lat:18.77, lon:98.96 }
  ];
  if(!AIRPORTS.some(function(ap){ return ap.iata === CENTER_IATA; })){
    AIRPORTS.unshift({ iata: CENTER_IATA, lat: CENTER_LAT, lon: CENTER_LON });
  }
  AIRPORTS.forEach(function(ap){
    var here = ap.iata === CENTER_IATA;
    var icon = L.divIcon({
      className: 'ac-icon',
      html: '<div style="display:flex;align-items:center"><div class="'+(here?'apt-here':'apt')+'"></div><span class="apt-lbl">'+ap.iata+'</span></div>',
      iconSize: [54, 16],
      iconAnchor: [5, 8]
    });
    L.marker([ap.lat, ap.lon], {
      icon: icon, interactive: false, keyboard: false,
      pane: 'markerPane', zIndexOffset: here ? 800 : 200
    }).addTo(map);
  });

  var markers = {};
  var lastList = [];
  var lastMeta = { cached: false, source: '', at: 0 };
  var addQueue = [];
  var batchTimer = null;
  var queuedIds = {};

  function fixCoord(a){
    if(!a) return null;
    var lat = Number(a.lat != null ? a.lat : a.latitude);
    var lon = Number(a.lon != null ? a.lon : (a.lng != null ? a.lng : a.longitude));
    if(!isFinite(lat) || !isFinite(lon)) return null;
    if(Math.abs(lat) > 90 && Math.abs(lon) <= 90){
      var swap = lat; lat = lon; lon = swap;
    }
    if(Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    a.lat = lat;
    a.lon = lon;
    return a;
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
    var svg = '<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="11" cy="11" r="5" fill="#C9A84C" stroke="#0A0F1E" stroke-width="1.5"/>'
      + '<path d="M11 2.5 L15.5 16 L11 12.5 L6.5 16 Z" fill="#F8FAFC" stroke="#C9A84C" stroke-width="1"/>'
      + '</svg>';
    return L.divIcon({
      className: 'ac-icon',
      html: '<div class="ac-wrap" data-ac="1" style="transform:rotate('+rot+'deg)">'+svg+'</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  }

  function esc(s){
    return String(s || '').replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function planePopupHtml(data){
    var cs = String(data.cs || data.id || '—').trim() || '—';
    var type = String(data.acType || data.t || data.aircraft || '').trim();
    var origin = String(data.origin || '').trim().toUpperCase();
    var dest = String(data.dest || '').trim().toUpperCase();
    var route = origin && dest ? origin + ' → ' + dest : (origin || dest);
    var alt = (data.altM != null && isFinite(Number(data.altM)))
      ? Math.round(Number(data.altM) * 3.281).toLocaleString('en-US') + ' ft'
      : '—';
    var spd = (data.spdMs != null && isFinite(Number(data.spdMs)))
      ? Math.round(Number(data.spdMs) * 1.944) + ' kt'
      : '—';
    var html = '<div class="ac-pop">';
    html += '<div class="ac-pop-cs">'+esc(cs)+'</div>';
    if(type) html += '<div class="ac-pop-row ac-pop-muted">'+esc(type)+'</div>';
    html += '<div class="ac-pop-row">'+esc(alt)+' · '+esc(spd)+'</div>';
    if(route) html += '<div class="ac-pop-row">'+esc(route)+'</div>';
    if(data.reg) html += '<div class="ac-pop-row ac-pop-muted">'+esc(data.reg)+'</div>';
    html += '</div>';
    return html;
  }

  function postSelect(data){
    post({
      type: 'planeSelect',
      callsign: data.cs || data.id || '',
      icao: data.id || '',
      altitude: data.altM,
      speedMs: data.spdMs,
      lat: data.lat,
      lon: data.lon,
      heading: data.hdg,
      vertRate: data.vr,
      country: data.country || '',
      registration: data.reg || '',
      acType: data.acType || data.t || '',
      origin: data.origin || '',
      dest: data.dest || ''
    });
  }

  function dist2(a, b){
    var dlat = a.lat - b.lat, dlon = a.lon - b.lon;
    return dlat*dlat + dlon*dlon;
  }

  function distKm(lat1, lon1, lat2, lon2){
    var dlat = lat1 - lat2, dlon = lon1 - lon2;
    return Math.sqrt(dlat * dlat + dlon * dlon) * 111;
  }

  function visibleList(src){
    var c = map.getCenter();
    var valid = [];
    for(var i=0;i<src.length;i++){
      var a = fixCoord(src[i]);
      if(!a) continue;
      if(distKm(a.lat, a.lon, CENTER_LAT, CENTER_LON) > KEEP_KM) continue;
      valid.push(a);
    }
    valid.sort(function(x,y){ return dist2(x, c) - dist2(y, c); });
    return valid.slice(0, MAX);
  }

  function bindTap(layer, data){
    if(!layer) return;
    layer.off('click');
    layer.on('click', function(ev){
      if(ev) L.DomEvent.stop(ev);
      try {
        layer.unbindPopup();
        layer.bindPopup(planePopupHtml(data), {
          className: 'ac-popup',
          maxWidth: 240,
          closeButton: true,
          autoPan: true,
          offset: [0, -10]
        }).openPopup();
      } catch (e) {}
      postSelect(data);
    });
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
    if(loading && shown === 0) setBoot(true, 'Loading aircraft…');
    else setBoot(false);
  }

  function addOne(a){
    a = fixCoord(a);
    if(!a || !a.id || markers[a.id]) return;
    if(!isFinite(a.lat) || !isFinite(a.lon)){
      log('[radar] skip invalid coords', a.id, a.lat, a.lon);
      return;
    }
    var latlng = L.latLng(a.lat, a.lon);
    var circle = L.circleMarker(latlng, {
      radius: 16,
      color: 'transparent',
      weight: 0,
      fillColor: '#C9A84C',
      fillOpacity: 0.01,
      pane: 'planes',
      interactive: true,
      bubblingMouseEvents: false
    });
    var arrow = L.marker(latlng, {
      icon: planeIcon(a.hdg),
      keyboard: false,
      pane: 'planes',
      zIndexOffset: 1200,
      interactive: true
    });
    bindTap(circle, a);
    bindTap(arrow, a);
    circle.addTo(map);
    arrow.addTo(map);
    markers[a.id] = {
      circle: circle, marker: arrow,
      lat: a.lat, lon: a.lon, tLat: a.lat, tLon: a.lon,
      hdg: a.hdg || 0, tHdg: a.hdg || 0, data: a
    };
  }

  function removeOne(id){
    var rec = markers[id];
    if(!rec) return;
    try { map.removeLayer(rec.circle); } catch (e) {}
    try { map.removeLayer(rec.marker); } catch (e) {}
    delete markers[id];
  }

  function placeRec(rec){
    if(!rec) return;
    rec.lat = rec.tLat;
    rec.lon = rec.tLon;
    rec.hdg = rec.tHdg;
    var ll = L.latLng(rec.lat, rec.lon);
    rec.circle.setLatLng(ll);
    rec.marker.setLatLng(ll);
    var el = rec.marker.getElement();
    if(el){
      var wrap = el.querySelector('.ac-wrap');
      if(wrap) wrap.style.transform = 'rotate(' + rec.hdg + 'deg)';
    }
  }

  function reprojectAll(){
    Object.keys(markers).forEach(function(id){ placeRec(markers[id]); });
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
    } else {
      reprojectAll();
    }
  }

  function applyList(list, meta){
    console.log('[Radar] applyList received:', (list || []).length, 'aircraft');
    var incoming = (list || []).map(fixCoord).filter(Boolean);
    var partial = !!(meta && meta.partial);
    if(partial && lastList.length){
      var byId = {};
      for(var p=0;p<lastList.length;p++) byId[lastList[p].id] = lastList[p];
      for(var n=0;n<incoming.length;n++) byId[incoming[n].id] = incoming[n];
      lastList = Object.keys(byId).map(function(k){ return byId[k]; });
    } else {
      lastList = incoming;
    }
    lastMeta = meta || lastMeta;
    try { map.invalidateSize({ animate: false }); } catch (e) {}
    var vis = visibleList(lastList);
    console.log('[Radar] visible after filter:', vis.length);
    var ids = {};
    log('[radar] apply', lastList.length, 'total,', vis.length, 'visible, zoom', map.getZoom(), 'size', map.getSize(), partial ? 'partial' : '');
    if(vis[0]) log('[radar] sample', vis[0].id, vis[0].cs, vis[0].lat, vis[0].lon, vis[0].hdg);

    for(var i=0;i<vis.length;i++){
      var a = vis[i];
      ids[a.id] = 1;
      var rec = markers[a.id];
      if(rec){
        rec.tLat = a.lat; rec.tLon = a.lon;
        rec.tHdg = a.hdg == null ? rec.tHdg : a.hdg;
        rec.data = a;
        bindTap(rec.circle, a);
        bindTap(rec.marker, a);
        placeRec(rec);
      } else if(!queuedIds[a.id]){
        queuedIds[a.id] = 1;
        addQueue.push(a);
      }
    }

    if(!partial){
      Object.keys(markers).forEach(function(id){
        if(!ids[id]) removeOne(id);
      });
    }
    addQueue = addQueue.filter(function(a){ return (partial || !!ids[a.id]) && !markers[a.id]; });
    queuedIds = {};
    for(var q=0;q<addQueue.length;q++) queuedIds[addQueue[q].id] = 1;

    updateHud();
    if(addQueue.length){
      if(batchTimer) clearTimeout(batchTimer);
      drainQueue();
    } else {
      reprojectAll();
    }
  }

  function lerp(a, b, t){ return a + (b - a) * t; }

  function tick(){
    if(!window.__radarActive) return;
    if(addQueue.length) return;
    var t = 0.28;
    Object.keys(markers).forEach(function(id){
      var rec = markers[id];
      var dlat = rec.tLat - rec.lat, dlon = rec.tLon - rec.lon;
      if(dlat*dlat + dlon*dlon < 1e-12 && Math.abs(rec.tHdg - rec.hdg) < 0.4) return;
      rec.lat = lerp(rec.lat, rec.tLat, t);
      rec.lon = lerp(rec.lon, rec.tLon, t);
      rec.hdg = lerp(rec.hdg, rec.tHdg, t);
      rec.circle.setLatLng([rec.lat, rec.lon]);
      rec.marker.setLatLng([rec.lat, rec.lon]);
      var el = rec.marker.getElement();
      if(el){
        var wrap = el.querySelector('.ac-wrap');
        if(wrap) wrap.style.transform = 'rotate(' + rec.hdg + 'deg)';
      }
    });
  }
  window.__radarActive = false;
  var tickTimer = null;
  function startRadarTick(){
    window.__radarActive = true;
    if(tickTimer) return;
    tickTimer = setInterval(tick, 200);
  }
  function stopRadarTick(){
    window.__radarActive = false;
    if(tickTimer){ clearInterval(tickTimer); tickTimer = null; }
  }
  window.startRadarTick = startRadarTick;
  window.stopRadarTick = stopRadarTick;

  var moveTimer = null;
  function scheduleApply(){
    clearTimeout(moveTimer);
    moveTimer = setTimeout(function(){ applyList(lastList, lastMeta); }, 80);
  }
  map.on('moveend zoomend resize', scheduleApply);

  function runPending(){
    if(!pending) return;
    var p = pending;
    pending = null;
    window.__pendingRadar = null;
    applyList(p.list || [], p.meta || {});
  }

  function queueRadar(list, meta){
    var incoming = list || [];
    if(pending && pending.list && pending.list.length > incoming.length && meta && meta.partial){
      var byId = {};
      for(var i=0;i<pending.list.length;i++) byId[pending.list[i].id] = pending.list[i];
      for(var j=0;j<incoming.length;j++) byId[incoming[j].id] = incoming[j];
      incoming = Object.keys(byId).map(function(k){ return byId[k]; });
    }
    pending = { list: incoming, meta: meta || {} };
    window.__pendingRadar = pending;
    log('[radar] queued', incoming.length, 'until map ready');
  }

  window.applyRadarAircraft = function(list, meta){
    if(!mapReady){
      queueRadar(list, meta);
      return;
    }
    applyList(list || [], meta || {});
  };

  function onRNMessage(event){
    try {
      var raw = event && event.data;
      if(typeof raw !== 'string') return;
      var msg = JSON.parse(raw);
      if(msg && msg.type === 'radarAircraft'){
        if(!mapReady){
          queueRadar(msg.list || [], msg.meta || {});
          return;
        }
        window.applyRadarAircraft(msg.list || [], msg.meta || {});
      }
    } catch (e) { log('[radar] rn message error', e); }
  }
  window.addEventListener('message', onRNMessage);
  document.addEventListener('message', onRNMessage);
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
    window.applyRadarAircraft(out, {});
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
    var bbox = 'lamin='+(CENTER_LAT-4)+'&lomin='+(CENTER_LON-4)+'&lamax='+(CENTER_LAT+4)+'&lomax='+(CENTER_LON+4)+'&lat='+CENTER_LAT+'&lon='+CENTER_LON;
    var tries = [];
    tries.push('https://api.adsb.lol/v2/point/' + CENTER_LAT + '/' + CENTER_LON + '/250');
    if(PROXY) tries.push(PROXY + '/radar?' + bbox);
    (function next(i){
      if(lastList.length || i >= tries.length) return;
      fetch(tries[i]).then(function(r){ return r.ok ? r.json() : Promise.reject(); })
        .then(function(data){
          var list = parseAc(data).filter(function(a){
            a = fixCoord(a);
            return a && distKm(a.lat, a.lon, CENTER_LAT, CENTER_LON) <= KEEP_KM;
          });
          if(list.length) window.applyRadarAircraft(list, { cached: false, source: 'webview' });
          else next(i+1);
        })
        .catch(function(){ next(i+1); });
    })(0);
  }
  setTimeout(fallbackFetch, 3500);

  function readyMap(){
    map.invalidateSize({ animate: false });
    fitAirport(CENTER_LAT, CENTER_LON, false);
    mapReady = true;
    startRadarTick();
    post({ type: 'radarReady' });
    runPending();
    log('[radar] map ready', CENTER_LAT, CENTER_LON, 'zoom', map.getZoom(), 'size', map.getSize());
  }

  map.whenReady(function(){
    readyMap();
    [80, 250, 700].forEach(function(ms){
      setTimeout(function(){
        map.invalidateSize({ animate: false });
        reprojectAll();
        if(lastList.length) applyList(lastList, lastMeta);
      }, ms);
    });
  });

  if(window.ResizeObserver){
    new ResizeObserver(function(){
      map.invalidateSize({ animate: false });
      reprojectAll();
    }).observe(document.getElementById('map'));
  }
})();
</script>
</body>
</html>`;
}
