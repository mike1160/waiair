import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeQRCode from './components/SafeQRCode';
import { useStayAwake } from './lib/keepAwake';
import { mapsNativeAvailable, MapView, Marker } from './nativeMaps';
import { X } from 'phosphor-react-native';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';
import {
  getTogetherDisplayName,
  interpolateTogetherPosition,
  isValidTogetherCode,
  joinTogetherGroup,
  listTogetherParticipants,
  subscribeTogetherGroup,
  togetherAllLanded,
  togetherEnRouteNames,
  togetherFlightFromShare,
  togetherLastLandingGap,
  togetherMeetingPoint,
  togetherPrimaryDest,
  togetherShareLink,
  type FlyTogetherGroup,
  type TogetherFlightInput,
  type TogetherParticipant,
} from './lib/flyTogether';
import type { NextFlightShareData } from './MyNextFlightShare';

function formatClock(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}

function statusLine(p: TogetherParticipant): string {
  if (p.status === 'landed') return `${t().togetherLanded} ${formatClock(p.landedAtIso || p.etaIso)} ✅`;
  if (p.status === 'cancelled') return t().cancelled;
  if (p.status === 'delayed' || p.delayMin > 0) {
    return `${t().togetherDelayed} · ${t().togetherEta(formatClock(p.etaIso))}`;
  }
  if (p.status === 'en-route') return `${t().togetherInAir} · ${t().togetherEta(formatClock(p.etaIso))}`;
  return t().togetherScheduled;
}

function TogetherList({ rows, selfId }: { rows: TogetherParticipant[]; selfId: string }) {
  return (
    <View style={st.list}>
      {rows.map(p => (
        <View key={p.id} style={[st.row, p.deviceId === selfId && st.rowSelf]}>
          <Text style={st.name} numberOfLines={1}>
            {p.displayName}{p.deviceId === selfId ? ` ${t().togetherYou}` : ''}
          </Text>
          <Text style={st.flight} numberOfLines={1}>
            {p.flightNumber}  {p.destIata}  {statusLine(p)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TogetherMap({ rows }: { rows: TogetherParticipant[] }) {
  const coords = rows
    .map(p => ({ p, c: interpolateTogetherPosition(p) }))
    .filter((x): x is { p: TogetherParticipant; c: { lat: number; lon: number } } => !!x.c);

  const region = useMemo(() => {
    if (!coords.length) {
      return { latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 };
    }
    const lats = coords.map(x => x.c.lat);
    const lons = coords.map(x => x.c.lon);
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const latDelta = Math.max(8, (Math.max(...lats) - Math.min(...lats)) * 1.8 + 4);
    const lonDelta = Math.max(8, (Math.max(...lons) - Math.min(...lons)) * 1.8 + 4);
    return { latitude: lat, longitude: lon, latitudeDelta: latDelta, longitudeDelta: lonDelta };
  }, [coords]);

  if (Platform.OS === 'web' || !mapsNativeAvailable) {
    return (
      <View style={[st.map, st.mapFallback]}>
        <Text style={st.mapFallbackTxt}>{t().togetherMapWebFallback}</Text>
      </View>
    );
  }

  return (
    <View style={st.map}>
      <MapView style={StyleSheet.absoluteFill} region={region} mapType="standard">
        {coords.map(({ p, c }) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: c.lat, longitude: c.lon }}
            title={p.displayName}
            description={p.flightNumber}
          />
        ))}
      </MapView>
    </View>
  );
}

export function CreateTogetherSheet({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (displayName: string, groupName: string) => void;
}) {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!visible) return;
    getTogetherDisplayName().then(n => setName(n || ''));
    setGroupName('');
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.sheetBackdrop}>
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>{t().startFlyTogether}</Text>
          <TextInput
            style={st.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder={t().togetherGroupNamePlaceholder}
            placeholderTextColor="#64748B"
          />
          <TextInput
            style={st.input}
            value={name}
            onChangeText={setName}
            placeholder={t().togetherNamePlaceholder}
            placeholderTextColor="#64748B"
          />
          <TouchableOpacity
            style={st.primaryBtn}
            onPress={() => {
              haptics.medium();
              onCreate(name.trim() || 'Traveler', groupName.trim());
            }}
          >
            <Text style={st.primaryBtnTxt}>{t().togetherCreateAction}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={st.linkBtn}>
            <Text style={st.linkBtnTxt}>{t().cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function JoinTogetherSheet({
  visible,
  initialCode,
  flight,
  onClose,
  onJoined,
}: {
  visible: boolean;
  initialCode?: string;
  flight: TogetherFlightInput;
  onClose: () => void;
  onJoined: (code: string) => void;
}) {
  const [code, setCode] = useState(initialCode || '');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCode(initialCode || '');
    setErr('');
    getTogetherDisplayName().then(n => setName(n || ''));
  }, [visible, initialCode]);

  const join = async () => {
    const c = code.trim().toUpperCase();
    if (!isValidTogetherCode(c)) {
      setErr(t().togetherInvalidCode);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const group = await joinTogetherGroup(c, name.trim() || 'Traveler', flight);
      if (!group) {
        setErr(t().togetherJoinFailed);
        haptics.error();
        return;
      }
      haptics.success();
      onJoined(group.code);
      onClose();
    } catch {
      setErr(t().togetherJoinFailed);
      haptics.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.sheetBackdrop}>
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>{t().togetherJoinTitle}</Text>
          <TextInput
            style={st.input}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder={t().togetherCodePlaceholder}
            placeholderTextColor="#64748B"
            maxLength={6}
          />
          <TextInput
            style={st.input}
            value={name}
            onChangeText={setName}
            placeholder={t().togetherNamePlaceholder}
            placeholderTextColor="#64748B"
          />
          {err ? <Text style={st.err}>{err}</Text> : null}
          <TouchableOpacity style={st.primaryBtn} onPress={join} disabled={busy}>
            {busy ? <ActivityIndicator color="#0A0E1A" /> : <Text style={st.primaryBtnTxt}>{t().togetherJoinAction}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={st.linkBtn}>
            <Text style={st.linkBtnTxt}>{t().cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function TogetherCreatedSheet({
  visible,
  code,
  groupName,
  onOpenGroup,
  onClose,
}: {
  visible: boolean;
  code: string;
  groupName?: string;
  onOpenGroup: () => void;
  onClose: () => void;
}) {
  const link = togetherShareLink(code);
  const copy = async () => {
    try {
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      await Clipboard.setStringAsync(`${link}\n${t().togetherCodeLabel(code)}`);
      haptics.light();
    } catch { /* clipboard unavailable */ }
  };
  const share = async () => {
    try {
      await Share.share({ message: t().togetherInviteMessage(groupName || '', link) });
    } catch { /* ignore */ }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={st.sheetBackdrop}>
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>{t().togetherCreatedTitle}</Text>
          {groupName ? <Text style={st.groupName}>{groupName}</Text> : null}
          <Text style={st.codeBig}>{code}</Text>
          <View style={st.qrWrap}>
            <SafeQRCode value={link} size={160} backgroundColor="#fff" color="#0A0E1A" />
          </View>
          <Text style={st.linkTxt} numberOfLines={2}>{link}</Text>
          <TouchableOpacity style={st.secondaryBtn} onPress={copy}>
            <Text style={st.secondaryBtnTxt}>{t().togetherCopyLink}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.primaryBtn} onPress={onOpenGroup}>
            <Text style={st.primaryBtnTxt}>{t().togetherOpenGroup}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.secondaryBtn} onPress={share}>
            <Text style={st.secondaryBtnTxt}>{t().share}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={st.linkBtn}>
            <Text style={st.linkBtnTxt}>{t().close}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function FlyTogetherScreen({
  visible,
  code,
  selfDeviceId,
  onClose,
  onNotify,
}: {
  visible: boolean;
  code: string;
  selfDeviceId: string;
  onClose: () => void;
  onNotify?: (kind: 'landed' | 'delayed' | 'allLanded', body: string) => void;
}) {
  useStayAwake('waiair-flytogether', visible);
  const [group, setGroup] = useState<FlyTogetherGroup | null>(null);
  const [busy, setBusy] = useState(true);
  const notifiedLand = useRef<Set<string>>(new Set());
  const notifiedDelay = useRef<Set<string>>(new Set());
  const notifiedAllLanded = useRef(false);

  useEffect(() => {
    if (!visible || !code) return;
    setBusy(true);
    const unsub = subscribeTogetherGroup(code, next => {
      setGroup(next);
      setBusy(false);
    });
    return unsub;
  }, [visible, code]);

  const participants = useMemo(
    () => listTogetherParticipants(group?.participants || []),
    [group?.participants],
  );

  const allLanded = togetherAllLanded(group?.participants || []);
  const dest = togetherPrimaryDest(participants);
  const meeting = togetherMeetingPoint(participants);

  useEffect(() => {
    if (!visible || !group || !onNotify) return;

    for (const p of participants) {
      if (p.status === 'landed' && !notifiedLand.current.has(p.id)) {
        notifiedLand.current.add(p.id);
        const others = togetherEnRouteNames(participants, p.id);
        if (others.length) {
          onNotify(
            'landed',
            t().togetherNotifyLanded(
              p.displayName.split(' ')[0] || p.displayName,
              p.destIata || dest,
              t().togetherOthersEnRoute(others.join(' and ')),
            ),
          );
        }
      }
      if ((p.status === 'delayed' || p.delayMin >= 45) && p.delayMin >= 45 && !notifiedDelay.current.has(p.id)) {
        notifiedDelay.current.add(p.id);
        onNotify(
          'delayed',
          t().togetherNotifyDelayed(p.displayName.split(' ')[0] || p.displayName, p.delayMin),
        );
      }
    }

    if (allLanded && !notifiedAllLanded.current) {
      notifiedAllLanded.current = true;
      const gap = togetherLastLandingGap(participants);
      if (gap && gap.gapMin > 0) {
        onNotify('allLanded', t().togetherNotifyAllLanded(gap.last, gap.gapMin, gap.first));
      } else {
        onNotify('allLanded', t().togetherEveryoneHere);
      }
    }
  }, [visible, group, participants, allLanded, dest, onNotify]);

  if (!visible) return null;

  const title = group?.groupName
    ? t().togetherLiveTitle(group.groupName)
    : t().togetherLiveTitleDefault;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={st.screen}>
        <View style={st.header}>
          <Text style={st.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={t().close}>
            <X size={22} color="#E2E8F0" />
          </TouchableOpacity>
        </View>

        {busy && !group ? (
          <ActivityIndicator color="#7DD3FC" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={st.scroll}>
            <View style={st.divider} />
            <TogetherList rows={participants} selfId={selfDeviceId} />
            <View style={st.divider} />
            {dest ? (
              <Text style={st.summary}>{t().togetherAllArrivingToday(dest)}</Text>
            ) : null}
            <TogetherMap rows={participants} />
            {allLanded && meeting ? (
              <View style={st.meet}>
                <Text style={st.meetTitle}>{t().togetherMeetAt(meeting)}</Text>
                <Text style={st.meetSub}>{t().togetherEveryoneHere}</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

export function shareDataToTogetherFlight(data: NextFlightShareData): TogetherFlightInput {
  return togetherFlightFromShare(data);
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05070F', paddingTop: Platform.OS === 'web' ? 20 : 54 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', flex: 1, paddingRight: 12 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(148,163,184,0.25)', marginVertical: 14 },
  list: { gap: 12 },
  row: { gap: 2 },
  rowSelf: { backgroundColor: 'rgba(125,211,252,0.06)', borderRadius: 10, padding: 10, marginHorizontal: -10 },
  name: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  flight: { color: '#94A3B8', fontSize: 13, fontWeight: '500', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  summary: { color: '#CBD5E1', fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  map: { height: 220, borderRadius: 14, overflow: 'hidden', marginTop: 4, backgroundColor: '#0f172a' },
  mapFallback: { alignItems: 'center', justifyContent: 'center' },
  mapFallbackTxt: { color: '#64748B', fontSize: 13, fontWeight: '600', padding: 16, textAlign: 'center' },
  meet: { marginTop: 20, alignItems: 'center', gap: 6, padding: 16, borderRadius: 14, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' },
  meetTitle: { color: '#86EFAC', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  meetSub: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 10,
  },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  groupName: { color: '#94A3B8', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  err: { color: '#F87171', fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#7DD3FC',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnTxt: { color: '#0A0E1A', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  secondaryBtnTxt: { color: '#E2E8F0', fontSize: 14, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkBtnTxt: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  codeBig: { color: '#7DD3FC', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 4 },
  qrWrap: { alignSelf: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 12, marginVertical: 8 },
  linkTxt: { color: '#94A3B8', fontSize: 12, textAlign: 'center' },
});
