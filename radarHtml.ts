/** Pure SVG SEA radar — no external tiles / CSP-safe for iframe */

export type RadarTheme = 'dark' | 'light';

const DEFAULT_PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'http://localhost:3001').replace(/\/$/, '');

export function buildRadarHTML(
  centerLat = 13.68,
  centerLon = 100.75,
  zoom = 7,
  proxyUrl = DEFAULT_PROXY,
  theme: RadarTheme = 'light'
): string {
  const radarUrl = `${(proxyUrl || DEFAULT_PROXY).replace(/\/$/, '')}/radar`;
  const dark = theme !== 'light';
  const bg = dark ? '#0f1117' : '#ffffff';
  const card = dark ? '#1a1d27' : '#f5f7fa';
  const border = dark ? '#2a2d3a' : '#e5e7eb';
  const text = dark ? '#f8fafc' : '#1a1a1a';
  const muted = dark ? '#64748b' : '#666666';
  const landStroke = dark ? '#2a2d3a' : '#d1d5db';
  const gridStroke = dark ? '#1a1d27' : '#e5e7eb';
  const labelFill = dark ? '#475569' : '#9ca3af';
  const tipBg = card;
  const tipBorder = border;
  const tipText = text;
  const statusBg = dark ? 'rgba(30,35,51,.92)' : 'rgba(255,255,255,.92)';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;background:${bg};overflow:hidden;font-family:-apple-system,system-ui,sans-serif}
  #wrap{position:relative;width:100%;height:100%;background:${bg}}
  #hud{
    position:absolute;top:10px;left:10px;right:10px;z-index:5;
    display:flex;justify-content:flex-end;align-items:center;pointer-events:none;
  }
  #status{
    font:600 11px -apple-system,system-ui,sans-serif;color:${muted};
    background:${statusBg};border:1px solid ${border};border-radius:10px;padding:7px 10px;
  }
  #svgRoot{width:100%;height:100%;display:block;background:${bg};touch-action:none}
  .land{fill:none;stroke:${landStroke};stroke-width:0.5;vector-effect:non-scaling-stroke}
  .grid{stroke:${gridStroke};stroke-width:0.35;vector-effect:non-scaling-stroke}
  .route{stroke:${dark ? 'rgba(96,165,250,0.18)' : 'rgba(0,102,204,0.22)'};stroke-width:0.7;fill:none;vector-effect:non-scaling-stroke}
  .airport{fill:${dark ? '#3b82f6' : '#0066cc'};stroke:none}
  .airport-lbl{fill:${dark ? '#ffffff' : '#1a1a1a'};font:700 10px -apple-system,system-ui,sans-serif;pointer-events:none}
  .country{fill:${labelFill};font:700 11px -apple-system,system-ui,sans-serif;letter-spacing:1.5px;opacity:0.55;pointer-events:none}
  .plane{cursor:pointer;transform-box:fill-box;transform-origin:center;animation:dotPulse 2.6s ease-in-out infinite}
  .plane:hover{opacity:0.9}
  @keyframes dotPulse{
    0%,100%{opacity:1;transform:scale(1)}
    50%{opacity:0.55;transform:scale(0.72)}
  }
  #sweep{
    transform-origin:480px 320px;
    animation:sweep 8s linear infinite;
    pointer-events:none;
  }
  @keyframes sweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  #tip{
    position:absolute;z-index:8;display:none;pointer-events:none;
    background:${tipBg};border:1px solid ${tipBorder};border-radius:12px;
    padding:10px 12px;color:${tipText};font:600 11px -apple-system,system-ui,sans-serif;
    box-shadow:0 10px 28px rgba(0,0,0,${dark ? '.45' : '.12'});min-width:120px;
    backdrop-filter:blur(8px);
  }
  #tip .cs{color:${dark ? '#60a5fa' : '#0066cc'};font-weight:800;font-size:13px;letter-spacing:0.3px}
  #tip .meta{color:${muted};font-weight:600;font-size:10px;margin-top:4px;line-height:1.4}
  #tip .bar{height:2px;width:36px;background:${dark ? '#60a5fa' : '#0066cc'};border-radius:2px;margin-bottom:8px;opacity:0.8}
</style>
</head>
<body>
<div id="wrap">
  <div id="hud">
    <div id="status">Loading radar…</div>
  </div>
  <svg id="svgRoot" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#60a5fa" stop-opacity="0"/>
        <stop offset="100%" stop-color="#60a5fa" stop-opacity="${dark ? '0.22' : '0.16'}"/>
      </linearGradient>
    </defs>
    <rect id="bgRect" width="960" height="640" fill="${bg}"/>
    <g id="grid"></g>
    <g id="land"></g>
    <g id="labels"></g>
    <g id="routes"></g>
    <g id="sweep">
      <path d="M480 320 L480 40 A280 280 0 0 1 720 200 Z" fill="url(#sweepGrad)"/>
    </g>
    <g id="airports"></g>
    <g id="planes"></g>
  </svg>
  <div id="tip"><div class="bar"></div><div class="cs" id="tipCs">—</div><div class="meta" id="tipMeta"></div></div>
</div>
<script>
(function(){
  var LAT_MIN = -11, LAT_MAX = 28;
  var LNG_MIN = 92, LNG_MAX = 140;
  var W = 960, H = 640;
  var svg = document.getElementById('svgRoot');
  var landG = document.getElementById('land');
  var gridG = document.getElementById('grid');
  var planesG = document.getElementById('planes');
  var airportsG = document.getElementById('airports');
  var routesG = document.getElementById('routes');
  var labelsG = document.getElementById('labels');
  var statusEl = document.getElementById('status');
  var tip = document.getElementById('tip');
  var tipCs = document.getElementById('tipCs');
  var tipMeta = document.getElementById('tipMeta');

  function project(lat, lng){
    var x = (lng - LNG_MIN) / (LNG_MAX - LNG_MIN) * W;
    var y = (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H;
    return { x: x, y: y };
  }

  function pathFromRing(ring){
    var d = '';
    for(var i=0;i<ring.length;i++){
      var p = project(ring[i][0], ring[i][1]);
      d += (i===0?'M':'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }
    return d + 'Z';
  }

  function altColor(alt){
    if(alt == null || isNaN(alt)) return '#60a5fa';
    if(alt < 1000) return '#22c55e';
    if(alt <= 8000) return '#60a5fa';
    return '#f8fafc';
  }

  var LAND = [
    [[20.4,100.1],[20.0,99.0],[18.2,97.8],[16.5,98.5],[15.0,98.4],[13.5,99.0],
     [11.8,99.5],[10.4,99.0],[9.2,98.3],[8.0,98.2],[7.2,99.4],[6.6,100.1],
     [6.4,101.2],[6.8,101.8],[7.8,100.6],[9.5,99.8],[10.8,99.5],[12.6,100.9],
     [13.4,101.0],[12.7,101.5],[13.2,102.2],[14.5,102.8],[15.5,102.5],
     [16.5,104.5],[17.5,104.7],[18.2,103.5],[18.0,102.0],[17.8,100.8],
     [18.8,100.0],[19.9,100.2],[20.4,100.1]],
    [[6.4,100.2],[5.8,100.4],[5.0,100.5],[4.2,101.2],[3.2,101.3],[2.4,101.9],
     [1.6,103.4],[1.3,104.2],[2.0,103.9],[2.8,103.5],[3.8,103.4],[4.5,103.4],
     [5.4,103.1],[5.9,102.4],[6.2,102.2],[6.4,100.2]],
    [[5.6,95.3],[4.0,96.0],[2.2,97.5],[0.5,98.5],[-1.0,99.5],[-2.5,100.5],
     [-4.0,102.0],[-5.5,104.0],[-5.8,105.5],[-4.5,105.8],[-3.0,104.5],
     [-1.0,103.5],[0.5,102.5],[2.0,101.0],[3.5,99.0],[5.0,97.0],[5.6,95.3]],
    [[-5.9,105.9],[-6.1,106.8],[-6.5,108.5],[-6.8,110.5],[-7.2,112.5],
     [-8.2,114.2],[-8.6,114.5],[-8.4,112.8],[-7.8,110.5],[-7.4,108.5],
     [-7.0,106.5],[-6.5,105.5],[-5.9,105.9]],
    [[-8.2,114.4],[-8.1,115.0],[-8.4,115.7],[-8.8,115.7],[-8.8,114.5],[-8.2,114.4]],
    [[-8.2,116.0],[-8.1,116.7],[-8.6,116.8],[-8.9,116.2],[-8.2,116.0]],
    [[7.0,117.0],[6.0,116.0],[4.5,114.0],[3.0,112.0],[1.5,110.0],[0.5,109.0],
     [-1.0,109.5],[-2.5,111.0],[-3.5,114.0],[-4.0,116.5],[-3.0,118.0],
     [-1.0,117.5],[1.0,118.5],[3.0,118.0],[5.0,119.0],[6.5,118.0],[7.0,117.0]],
    [[1.8,120.5],[0.5,120.0],[-1.0,120.5],[-2.5,121.5],[-4.0,122.0],
     [-5.5,122.5],[-5.0,123.5],[-3.0,123.0],[-1.5,123.5],[0.5,124.5],
     [1.5,125.0],[2.0,124.0],[1.5,122.0],[1.8,120.5]],
    [[21.5,105.0],[22.5,104.0],[22.0,106.5],[21.0,107.0],[20.0,106.5],
     [18.5,105.8],[17.0,107.0],[16.0,108.2],[15.0,108.8],[13.5,109.2],
     [12.0,109.2],[10.5,107.5],[9.5,106.0],[10.5,105.0],[11.5,106.5],
     [13.0,107.5],[14.5,107.0],[16.0,106.0],[17.5,105.5],[19.0,105.5],
     [20.5,105.5],[21.5,105.0]],
    [[13.5,102.5],[12.0,102.8],[10.5,103.5],[10.0,104.5],[11.0,105.5],
     [12.5,105.0],[13.8,104.5],[14.5,103.5],[13.5,102.5]],
    [[18.5,120.8],[18.2,122.0],[16.5,122.3],[15.0,121.5],[14.0,121.0],
     [13.5,121.5],[14.2,120.5],[15.5,119.8],[16.8,120.0],[18.0,120.2],[18.5,120.8]],
    [[11.5,123.5],[11.0,125.0],[10.0,125.5],[9.5,124.0],[10.5,123.0],[11.5,123.5]],
    [[9.5,125.5],[8.5,126.5],[7.0,126.0],[6.0,125.0],[5.5,124.0],[6.5,123.0],
     [8.0,124.0],[9.0,125.0],[9.5,125.5]],
    [[11.8,119.5],[10.5,119.3],[9.0,118.0],[8.5,117.2],[9.5,118.5],[11.0,119.5],[11.8,119.5]]
  ];

  var AIRPORTS = [
    { iata:'BKK', lat:13.7, lng:100.5 },
    { iata:'HKT', lat:8.1, lng:98.3 },
    { iata:'SIN', lat:1.4, lng:103.8 },
    { iata:'KUL', lat:2.7, lng:101.7 },
    { iata:'DPS', lat:-8.7, lng:115.2 }
  ];

  var COUNTRIES = [
    { name:'THAILAND', lat:15.5, lng:101.0 },
    { name:'MALAYSIA', lat:4.2, lng:102.2 },
    { name:'INDONESIA', lat:-2.5, lng:113.5 }
  ];

  for(var lat=LAT_MIN; lat<=LAT_MAX; lat+=5){
    var a = project(lat, LNG_MIN), b = project(lat, LNG_MAX);
    var line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('class','grid');
    gridG.appendChild(line);
  }
  for(var lng=LNG_MIN; lng<=LNG_MAX; lng+=5){
    var c = project(LAT_MIN, lng), d = project(LAT_MAX, lng);
    var line2 = document.createElementNS('http://www.w3.org/2000/svg','line');
    line2.setAttribute('x1', c.x); line2.setAttribute('y1', c.y);
    line2.setAttribute('x2', d.x); line2.setAttribute('y2', d.y);
    line2.setAttribute('class','grid');
    gridG.appendChild(line2);
  }

  LAND.forEach(function(ring){
    var path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', pathFromRing(ring));
    path.setAttribute('class','land');
    landG.appendChild(path);
  });

  COUNTRIES.forEach(function(co){
    var p = project(co.lat, co.lng);
    var t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x', p.x); t.setAttribute('y', p.y);
    t.setAttribute('class','country');
    t.setAttribute('text-anchor','middle');
    t.textContent = co.name;
    labelsG.appendChild(t);
  });

  AIRPORTS.forEach(function(ap){
    var p = project(ap.lat, ap.lng);
    var dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
    dot.setAttribute('r', 4); dot.setAttribute('class','airport');
    airportsG.appendChild(dot);
    var lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    lbl.setAttribute('x', p.x + 7); lbl.setAttribute('y', p.y + 3.5);
    lbl.setAttribute('class','airport-lbl');
    lbl.textContent = ap.iata;
    airportsG.appendChild(lbl);
  });

  var view = { cx: W/2, cy: H/2, scale: 1 };

  function applyView(){
    var vw = W / view.scale;
    var vh = H / view.scale;
    var x = view.cx - vw/2;
    var y = view.cy - vh/2;
    svg.setAttribute('viewBox', x + ' ' + y + ' ' + vw + ' ' + vh);
  }

  function flyTo(lat, lon, z){
    var p = project(lat, lon);
    view.cx = p.x;
    view.cy = p.y;
    var zz = z || 7;
    view.scale = Math.max(1, Math.min(8, (zz - 4) * 1.2));
    applyView();
  }
  window.flyTo = flyTo;
  flyTo(${centerLat}, ${centerLon}, ${zoom});

  function hideTip(){ tip.style.display = 'none'; }

  function showTip(ev, cs, meta){
    tipCs.textContent = cs;
    tipMeta.textContent = meta || '';
    tip.style.display = 'block';
    var rect = tip.parentElement.getBoundingClientRect();
    var x = ev.clientX - rect.left + 12;
    var y = ev.clientY - rect.top + 12;
    if(x + 170 > rect.width) x = ev.clientX - rect.left - 170;
    if(y + 60 > rect.height) y = ev.clientY - rect.top - 60;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }

  function drawRoutes(pts){
    while(routesG.firstChild) routesG.removeChild(routesG.firstChild);
    var maxDist = 38;
    var drawn = {};
    var limit = Math.min(pts.length, 180);
    for(var i=0;i<limit;i++){
      var best = -1, bestD = maxDist;
      for(var j=i+1;j<limit;j++){
        var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        var d = Math.sqrt(dx*dx + dy*dy);
        if(d < bestD){ bestD = d; best = j; }
      }
      if(best < 0) continue;
      var key = i < best ? i+'-'+best : best+'-'+i;
      if(drawn[key]) continue;
      drawn[key] = 1;
      var line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', pts[i].x); line.setAttribute('y1', pts[i].y);
      line.setAttribute('x2', pts[best].x); line.setAttribute('y2', pts[best].y);
      line.setAttribute('class','route');
      routesG.appendChild(line);
    }
  }

  function renderPlanes(states){
    while(planesG.firstChild) planesG.removeChild(planesG.firstChild);
    var count = 0;
    var pts = [];
    for(var i=0;i<states.length;i++){
      var s = states[i];
      var lon = s[5], lat = s[6];
      if(lon == null || lat == null) continue;
      if(lat < LAT_MIN || lat > LAT_MAX || lon < LNG_MIN || lon > LNG_MAX) continue;
      var p = project(lat, lon);
      var cs = ((s[1] || s[0] || '????') + '').trim() || '????';
      var alt = s[7];
      var spd = s[9];
      var meta = '';
      if(alt != null) meta += Math.round(alt) + ' m';
      if(spd != null) meta += (meta ? ' · ' : '') + Math.round(spd * 3.6) + ' km/h';
      var color = altColor(alt);

      var t = document.createElementNS('http://www.w3.org/2000/svg','circle');
      t.setAttribute('cx', p.x);
      t.setAttribute('cy', p.y);
      t.setAttribute('r', 3);
      t.setAttribute('fill', color);
      t.setAttribute('class', 'plane');
      t.style.animationDelay = ((i % 12) * 0.12) + 's';
      (function(callsign, metaTxt){
        t.addEventListener('mouseenter', function(ev){ showTip(ev, callsign, metaTxt); });
        t.addEventListener('mousemove', function(ev){ showTip(ev, callsign, metaTxt); });
        t.addEventListener('mouseleave', hideTip);
        t.addEventListener('click', function(ev){
          ev.stopPropagation();
          showTip(ev, callsign, metaTxt);
        });
      })(cs, meta);
      planesG.appendChild(t);
      pts.push(p);
      count++;
    }
    drawRoutes(pts);
    statusEl.textContent = '\\u2708 ' + count + ' live';
  }

  function loadTraffic(){
    statusEl.textContent = 'Updating…';
    fetch(${JSON.stringify(radarUrl)})
      .then(function(r){
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data){
        renderPlanes(data.states || []);
      })
      .catch(function(err){
        statusEl.textContent = 'Radar offline · retrying';
        console.log(err);
      });
  }

  loadTraffic();
  setInterval(loadTraffic, 15000);
})();
</script>
</body>
</html>`;
}
