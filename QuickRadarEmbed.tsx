import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import RadarWorldFallback from './RadarWorldFallback';
import { buildRadarHTML, RADAR_MAX_ZOOM } from './radarHtml';
import {
  fetchRadarNear,
  fetchRadarSnapshot,
  mergeAircraft,
  nearestWithin,
  readRadarCache,
  writeRadarCache,
  RADAR_KEEP_KM,
  type RadarAircraft,
} from './lib/radar';
import { parseRadarPlaneMessage, pickRadarFlight, radarCallsignToFlightNumber } from './lib/radarPick';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const RADAR_RETRY_MS = 30_000;

export type QuickRadarAirport = {
  iata: string;
  lat: number;
  lon: number;
};

type RadarLookupFlight = {
  status: string;
};

type Props = {
  airport: QuickRadarAirport;
  lookupFlight: (number: string) => Promise<RadarLookupFlight[]>;
  onOpenFlight?: (flight: RadarLookupFlight, mode: 'departure' | 'arrival') => void;
  pollsActive?: boolean;
  mapTheme?: 'light' | 'dark';
};

export default function QuickRadarEmbed({
  airport,
  lookupFlight,
  onOpenFlight,
  pollsActive = true,
  mapTheme = 'dark',
}: Props) {
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastAircraft = useRef<RadarAircraft[]>([]);
  const mapReady = useRef(false);
  const radarLoadSeq = useRef(0);
  const opening = useRef(false);

  const [radarCount, setRadarCount] = useState(0);
  const [markersLoading, setMarkersLoading] = useState(false);
  const [radarCached, setRadarCached] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const html = useMemo(
    () => buildRadarHTML(airport.lat, airport.lon, RADAR_MAX_ZOOM, mapTheme, PROXY, airport.iata),
    [airport.iata, airport.lat, airport.lon, mapTheme],
  );

  const showFallback = initialLoadDone && radarCount === 0 && !markersLoading;
  const showBootSpinner = !initialLoadDone && radarCount === 0;

  const pushAircraft = useCallback((
    list: RadarAircraft[],
    meta?: { cached?: boolean; partial?: boolean },
    allowEmpty = false,
  ) => {
    if (!list.length && !allowEmpty) return;
    lastAircraft.current = list;
    const metaObj = { cached: !!meta?.cached, partial: !!meta?.partial };
    if (Platform.OS === 'web') {
      const win = iframeRef.current?.contentWindow as (Window & {
        applyRadarAircraft?: (s: RadarAircraft[], m?: { cached?: boolean; partial?: boolean }) => void;
      }) | null;
      win?.applyRadarAircraft?.(list, metaObj);
      return;
    }
    const wv = webRef.current;
    if (!wv) return;
    const payload = JSON.stringify({ type: 'radarAircraft', list, meta: metaObj });
    wv.injectJavaScript(
      `try{window.applyRadarAircraft&&window.applyRadarAircraft(${JSON.stringify(list)},${JSON.stringify(metaObj)});}catch(e){} true;`,
    );
    wv.postMessage(payload);
  }, []);

  useEffect(() => {
    mapReady.current = false;
    setInitialLoadDone(false);
    setRadarCount(0);
    setMarkersLoading(false);
  }, [html]);

  const openPlane = useCallback(async (callsign: string) => {
    if (opening.current || !onOpenFlight) return;
    opening.current = true;
    try {
      const clean = callsign.replace(/\s+/g, '').toUpperCase();
      const guessed = radarCallsignToFlightNumber(clean);
      const tryLookup = async (num: string) => {
        const hits = await lookupFlight(num);
        const f = pickRadarFlight(hits);
        if (!f) throw new Error('not found');
        return f;
      };
      let flight: RadarLookupFlight | null = null;
      try {
        flight = await tryLookup(guessed);
      } catch {
        if (guessed !== clean) flight = await tryLookup(clean).catch(() => null);
      }
      if (flight) onOpenFlight(flight, 'departure');
    } finally {
      opening.current = false;
    }
  }, [lookupFlight, onOpenFlight]);

  const onMapReady = useCallback(() => {
    mapReady.current = true;
    const push = () => {
      if (lastAircraft.current.length) pushAircraft(lastAircraft.current, { cached: radarCached });
    };
    push();
    setTimeout(push, 200);
    setTimeout(push, 700);
    if (pollsActive) {
      if (Platform.OS === 'web') {
        const win = iframeRef.current?.contentWindow as (Window & { startRadarTick?: () => void }) | null;
        win?.startRadarTick?.();
      } else {
        webRef.current?.injectJavaScript('window.startRadarTick && window.startRadarTick(); true;');
      }
    }
  }, [pollsActive, pushAircraft, radarCached]);

  const handleRadarMessage = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (data?.type === 'radarReady') {
        onMapReady();
        return;
      }
      if (data?.type === 'radarProgress') {
        if (typeof data.total === 'number') setRadarCount(data.total);
        setMarkersLoading(!!data.loading);
        return;
      }
    } catch { /* not json */ }
    const parsed = parseRadarPlaneMessage(raw);
    if (parsed?.callsign) void openPlane(parsed.callsign);
  }, [onMapReady, openPlane]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = (ev: MessageEvent) => {
      const data = typeof ev.data === 'string' ? ev.data : null;
      if (!data) return;
      handleRadarMessage(data);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [handleRadarMessage]);

  const onWebViewMessage = useCallback((ev: { nativeEvent: { data: string } }) => {
    handleRadarMessage(ev.nativeEvent.data);
  }, [handleRadarMessage]);

  const markLoadDone = useCallback(() => {
    setInitialLoadDone(true);
    setMarkersLoading(false);
  }, []);

  const loadRadar = useCallback(async () => {
    const seq = ++radarLoadSeq.current;
    const alive = () => seq === radarLoadSeq.current;
    const aroundAirport = (list: RadarAircraft[]) =>
      nearestWithin(list, airport.lat, airport.lon, RADAR_KEEP_KM, 500);

    let fullApplied = false;
    const apply = (
      list: RadarAircraft[],
      meta?: { cached?: boolean },
      kind?: 'cache' | 'near' | 'full',
    ) => {
      if (!alive()) return;
      list = aroundAirport(list);
      if (kind !== 'full' && lastAircraft.current.length > list.length) {
        list = aroundAirport(mergeAircraft(lastAircraft.current, list));
      }
      if (kind === 'near' && !list.length) return;
      lastAircraft.current = list;
      setRadarCount(list.length);
      if (meta?.cached != null) setRadarCached(!!meta.cached);
      pushAircraft(list, { ...meta, partial: kind === 'near' }, kind !== 'near');
    };

    lastAircraft.current = aroundAirport(lastAircraft.current);
    if (lastAircraft.current.length) {
      apply(lastAircraft.current, { cached: true }, 'cache');
    }

    const cacheTask = readRadarCache(airport.iata).then(disk => {
      if (!alive() || fullApplied || !disk?.aircraft.length) return;
      const had = lastAircraft.current;
      const next = had.length ? mergeAircraft(had, disk.aircraft) : disk.aircraft;
      apply(next, { cached: true }, 'cache');
    }).catch(() => {});

    const nearTask = fetchRadarNear(airport.lat, airport.lon).then(snap => {
      if (!alive() || fullApplied) return;
      const first = nearestWithin(snap.aircraft, airport.lat, airport.lon);
      if (!first.length) return;
      const next = lastAircraft.current.length
        ? mergeAircraft(lastAircraft.current, first)
        : first;
      apply(next, { cached: false }, 'near');
    }).catch(() => {});

    const fullTask = fetchRadarSnapshot(airport.lat, airport.lon).then(snap => {
      if (!alive()) return;
      fullApplied = true;
      apply(snap.aircraft, { cached: snap.cached }, 'full');
      writeRadarCache(airport.iata, snap).catch(() => {});
    }).catch(() => {
      if (alive() && lastAircraft.current.length) {
        setRadarCached(true);
        pushAircraft(lastAircraft.current, { cached: true });
      }
    });

    await Promise.allSettled([cacheTask, nearTask, fullTask]);
    if (alive()) markLoadDone();
  }, [airport.iata, airport.lat, airport.lon, markLoadDone, pushAircraft]);

  const stopRadarWebView = useCallback(() => {
    if (Platform.OS === 'web') {
      const win = iframeRef.current?.contentWindow as (Window & { stopRadarTick?: () => void }) | null;
      win?.stopRadarTick?.();
    } else {
      webRef.current?.injectJavaScript('window.stopRadarTick && window.stopRadarTick(); true;');
    }
  }, []);

  const startRadarWebView = useCallback(() => {
    if (Platform.OS === 'web') {
      const win = iframeRef.current?.contentWindow as (Window & { startRadarTick?: () => void }) | null;
      win?.startRadarTick?.();
    } else {
      webRef.current?.injectJavaScript('window.startRadarTick && window.startRadarTick(); true;');
    }
  }, []);

  useEffect(() => {
    if (!pollsActive) {
      mapReady.current = false;
      stopRadarWebView();
      return;
    }
    loadRadar();
    const poll = setInterval(() => { loadRadar(); }, RADAR_RETRY_MS);
    const syncLive = () => {
      startRadarWebView();
      if (lastAircraft.current.length) {
        pushAircraft(lastAircraft.current, { cached: radarCached });
      }
    };
    syncLive();
    const retries = [400, 1200].map(ms => setTimeout(syncLive, ms));
    const mapTimeout = setTimeout(() => {
      if (!mapReady.current) markLoadDone();
    }, RADAR_RETRY_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(mapTimeout);
      retries.forEach(clearTimeout);
      stopRadarWebView();
    };
  }, [pollsActive, loadRadar, stopRadarWebView, startRadarWebView, pushAircraft, radarCached, markLoadDone]);

  const onMapError = useCallback(() => {
    markLoadDone();
  }, [markLoadDone]);

  return (
    <View style={st.root}>
      <View style={[st.mapLayer, showFallback && st.mapHidden]} pointerEvents={showFallback ? 'none' : 'auto'}>
        {Platform.OS === 'web' ? (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            title="Live radar"
          />
        ) : (
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html, headers: { 'Accept-Language': 'en-US,en;q=1.0' } }}
            style={st.web}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
            mixedContentMode="always"
            overScrollMode="never"
            nestedScrollEnabled
            onShouldStartLoadWithRequest={() => true}
            onMessage={onWebViewMessage}
            onError={onMapError}
            onHttpError={onMapError}
          />
        )}
      </View>
      {showFallback ? <RadarWorldFallback /> : null}
      {showBootSpinner ? (
        <View pointerEvents="none" style={st.bootCenter}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#05070d',
  },
  mapLayer: {
    ...StyleSheet.absoluteFill,
  },
  mapHidden: {
    opacity: 0,
  },
  web: {
    flex: 1,
    backgroundColor: '#05070d',
  },
  bootCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
