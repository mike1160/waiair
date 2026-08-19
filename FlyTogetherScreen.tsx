import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import AirlineLogo, { normalizeAirlineCode } from './AirlineLogo';
import FlightStatusBadge from './FlightStatusBadge';
import ShareMoreSheet from './components/ShareMoreSheet';
import { useStayAwake } from './lib/keepAwake';
import { X } from 'phosphor-react-native';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';
import { formatAirportClockLabeled } from './lib/flightTimes';
import { liveBoardPhase, liveStatusLabel } from './boardingCountdown';
import {
  PLATFORM_META,
  shareTextMore,
  shareTextToPlatform,
  type QuickSharePlatform,
} from './lib/flightQuickShare';
import { InstagramGradientBg, SocialBrandIcon } from './components/SocialBrandIcons';
import {
  fetchTogetherGroup,
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

const GOLD = '#F5A623';
const INVITE_PLATFORMS: QuickSharePlatform[] = ['whatsapp', 'line'];

function airlineFromFlight(flightNumber: string): string {
  const raw = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  const m = raw.match(/^([A-Z0-9]{2,3})/);
  return normalizeAirlineCode(m?.[1] || raw.slice(0, 2));
}

function statusBadge(p: TogetherParticipant): { label: string; bg: string; color: string } {
  const phase = liveBoardPhase({
    status: p.status,
    scheduledTime: p.scheduledTime,
    origin: p.originIata,
    progress: p.progressPct,
    lat: p.lat,
    lng: p.lon,
  });
  if (phase === 'landed') {
    return { label: t().togetherLanded, bg: 'rgba(34,197,94,0.15)', color: '#86EFAC' };
  }
  if (phase === 'cancelled') return { label: t().cancelled, bg: 'rgba(248,113,113,0.15)', color: '#FCA5A5' };
  if (phase === 'enRoute') {
    return { label: t().togetherInAir, bg: 'rgba(125,211,252,0.15)', color: '#7DD3FC' };
  }
  if (phase === 'departed' || phase === 'gateClosed') {
    return { label: liveStatusLabel({ status: p.status, scheduledTime: p.scheduledTime, origin: p.originIata, progress: p.progressPct }), bg: 'rgba(125,211,252,0.15)', color: '#7DD3FC' };
  }
  if (phase === 'delayed' || p.delayMin > 0) {
    return { label: t().togetherDelayed, bg: 'rgba(245,166,35,0.15)', color: GOLD };
  }
  return { label: t().togetherScheduled, bg: 'rgba(148,163,184,0.12)', color: '#94A3B8' };
}

function WaitingDots() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      try {
        loop.stop();
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [pulse]);

  return (
    <View style={st.waitDots}>
      {[0, 1, 2].map(i => (
        <Animated.View
          key={i}
          style={[
            st.waitDot,
            {
              opacity: pulse.interpolate({
                inputRange: [0, 0.33, 0.66, 1],
                outputRange: i === 0 ? [1, 0.35, 0.35, 1] : i === 1 ? [0.35, 1, 0.35, 0.35] : [0.35, 0.35, 1, 0.35],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

function MemberCard({ p, isSelf }: { p: TogetherParticipant; isSelf: boolean }) {
  const badge = statusBadge(p);
  const eta = p.status !== 'landed' && p.status !== 'cancelled' && p.etaIso
    ? ` · ${t().togetherEta(formatAirportClockLabeled(p.etaIso, p.destIata))}`
    : '';

  return (
    <View style={[st.memberCard, isSelf && st.memberCardSelf]}>
      <View style={st.memberAvatar}>
        <AirlineLogo iata={airlineFromFlight(p.flightNumber)} size={44} />
      </View>
      <View style={st.memberBody}>
        <Text style={st.memberName} numberOfLines={1}>
          {p.displayName}{isSelf ? ` ${t().togetherYou}` : ''}
        </Text>
        <Text style={st.memberFlight} numberOfLines={1}>
          {p.flightNumber} · {p.originIata} → {p.destIata}
        </Text>
        <FlightStatusBadge label={`${badge.label}${eta}`} color={badge.color} />
      </View>
    </View>
  );
}

function InviteShareButton({
  platform,
  onPress,
}: {
  platform: QuickSharePlatform;
  onPress: () => void;
}) {
  const meta = PLATFORM_META[platform];
  const isGradient = platform === 'instagram';
  return (
    <TouchableOpacity style={st.shareItem} onPress={onPress} accessibilityLabel={meta.label}>
      <View style={[st.shareCircle, !isGradient && { backgroundColor: meta.bg }]}>
        {isGradient ? <InstagramGradientBg size={40} /> : null}
        <SocialBrandIcon platform={platform} size={20} />
      </View>
      <Text style={st.shareLabel} numberOfLines={1}>{meta.label}</Text>
    </TouchableOpacity>
  );
}

function InviteSection({
  code,
  groupName,
  onGroupNameChange,
  onCopied,
  prominent,
}: {
  code: string;
  groupName: string;
  onGroupNameChange: (v: string) => void;
  onCopied?: () => void;
  prominent?: boolean;
}) {
  const link = togetherShareLink(code);
  const inviteText = t().togetherInviteShareMessage(link);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  const copyLink = async () => {
    try {
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      await Clipboard.setStringAsync(link);
      haptics.success();
      onCopied?.();
    } catch {
      haptics.error();
    }
  };

  const shareText = async (fn: (msg: string) => Promise<void>) => {
    if (shareBusy) return;
    setShareBusy(true);
    haptics.light();
    try {
      await fn(inviteText);
    } catch {
      haptics.error();
    } finally {
      setShareBusy(false);
    }
  };

  const inviteWhatsApp = () => shareText(msg => shareTextToPlatform('whatsapp', msg));

  return (
    <View style={[st.inviteBox, prominent && st.inviteBoxProminent]}>
      <Text style={st.inviteHeadline}>{t().togetherInviteFriends}</Text>
      {prominent ? (
        <TouchableOpacity style={st.invitePrimaryBtn} onPress={inviteWhatsApp} disabled={shareBusy}>
          {shareBusy ? (
            <ActivityIndicator color="#0A0E1A" />
          ) : (
            <Text style={st.invitePrimaryBtnTxt}>👥 {t().togetherInviteFriends}</Text>
          )}
        </TouchableOpacity>
      ) : null}
      <TextInput
        style={st.groupNameInput}
        value={groupName}
        onChangeText={onGroupNameChange}
        placeholder={t().togetherGroupNamePlaceholder}
        placeholderTextColor="#64748B"
      />
      <TouchableOpacity style={st.copyBtn} onPress={copyLink}>
        <Text style={st.copyBtnTxt}>📋 {t().togetherCopyLink}</Text>
      </TouchableOpacity>
      <Text style={st.shareViaLbl}>{t().togetherShareVia}</Text>
      <View style={st.shareRow}>
        {INVITE_PLATFORMS.map(platform => (
          <InviteShareButton
            key={platform}
            platform={platform}
            onPress={() => shareText(msg => shareTextToPlatform(platform, msg))}
          />
        ))}
        <TouchableOpacity
          style={st.shareItem}
          onPress={() => {
            haptics.light();
            setMoreOpen(true);
          }}
          accessibilityLabel="More"
        >
          <View style={[st.shareCircle, st.moreCircle]}>
            {shareBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={st.moreDots}>•••</Text>
            )}
          </View>
          <Text style={st.shareLabel}>More</Text>
        </TouchableOpacity>
      </View>
      <Text style={st.previewLbl}>{t().togetherInvitePreview}</Text>
      <View style={st.previewBox}>
        <Text style={st.previewTxt}>{inviteText}</Text>
      </View>
      <ShareMoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onPlatform={platform => shareText(msg => shareTextToPlatform(platform, msg))}
        onNativeShare={() => shareText(shareTextMore)}
      />
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

  if (Platform.OS === 'web') {
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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState<FlyTogetherGroup | null>(null);

  useEffect(() => {
    if (!visible) return;
    const c = (initialCode || '').trim().toUpperCase();
    setCode(c);
    setErr('');
    setPreview(null);
    getTogetherDisplayName().then(n => setName(n || ''));
    if (!isValidTogetherCode(c)) return;
    setLoading(true);
    fetchTogetherGroup(c)
      .then(g => setPreview(g))
      .finally(() => setLoading(false));
  }, [visible, initialCode]);

  const host = preview?.participants?.[0];
  const hostName = host?.displayName?.split(' ')[0] || host?.displayName || 'Someone';
  const previewRows = listTogetherParticipants(preview?.participants || []);

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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={st.joinScreen}>
        <View style={st.joinHeader}>
          <Text style={st.joinTitle}>{t().togetherJoinPreviewTitle}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={22} color="#E2E8F0" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={st.joinScroll}>
          {loading ? (
            <ActivityIndicator color="#7DD3FC" style={{ marginTop: 40 }} />
          ) : preview ? (
            <>
              <Text style={st.joinLead}>{t().togetherJoinPreviewLead(hostName)}</Text>
              {previewRows.map(p => (
                <MemberCard key={p.id} p={p} isSelf={false} />
              ))}
            </>
          ) : (
            <Text style={st.joinLead}>{t().togetherJoinTitle}</Text>
          )}

          {!initialCode ? (
            <TextInput
              style={st.input}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder={t().togetherCodePlaceholder}
              placeholderTextColor="#64748B"
              maxLength={6}
            />
          ) : null}

          <TextInput
            style={st.input}
            value={name}
            onChangeText={setName}
            placeholder={t().togetherNamePlaceholder}
            placeholderTextColor="#64748B"
          />

          {err ? <Text style={st.err}>{err}</Text> : null}

          <TouchableOpacity style={st.addFlightBtn} onPress={join} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#0A0E1A" />
            ) : (
              <Text style={st.addFlightBtnTxt}>✈️ {t().togetherAddMyFlight}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  onCopied,
}: {
  visible: boolean;
  code: string;
  selfDeviceId: string;
  onClose: () => void;
  onNotify?: (kind: 'landed' | 'delayed' | 'allLanded', body: string) => void;
  onCopied?: () => void;
}) {
  useStayAwake('waiair-flytogether', visible);
  const [group, setGroup] = useState<FlyTogetherGroup | null>(null);
  const [busy, setBusy] = useState(true);
  const [groupName, setGroupName] = useState('');
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

  useEffect(() => {
    if (group?.groupName) setGroupName(prev => prev || group.groupName || '');
  }, [group?.groupName]);

  const participants = useMemo(
    () => listTogetherParticipants(group?.participants || []),
    [group?.participants],
  );

  const isWaiting = participants.length <= 1;
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

  const title = groupName.trim()
    ? t().togetherLiveTitle(groupName.trim())
    : group?.groupName
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
          <View style={st.loadingWrap}>
            <ActivityIndicator color="#7DD3FC" size="large" />
            <Text style={st.loadingTxt}>{t().togetherCreating}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={st.scroll}>
            {isWaiting ? (
              <>
                <InviteSection
                  code={code}
                  groupName={groupName}
                  onGroupNameChange={setGroupName}
                  onCopied={onCopied}
                  prominent
                />
                <View style={st.waitBox}>
                  <WaitingDots />
                  <Text style={st.waitTitle}>{t().togetherWaitingTitle}</Text>
                  <Text style={st.waitHint}>{t().togetherWaitingHint}</Text>
                </View>
              </>
            ) : null}

            <Text style={st.sectionTitle}>{t().togetherMembers}</Text>
            {participants.map(p => (
              <MemberCard key={p.id} p={p} isSelf={p.deviceId === selfDeviceId} />
            ))}

            {!isWaiting && dest ? (
              <Text style={st.summary}>{t().togetherAllArrivingToday(dest)}</Text>
            ) : null}

            <TogetherMap rows={participants} />

            {!isWaiting ? (
              <InviteSection
                code={code}
                groupName={groupName}
                onGroupNameChange={setGroupName}
                onCopied={onCopied}
              />
            ) : null}

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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: { color: '#CBD5E1', fontSize: 13, fontWeight: '800', marginTop: 8, marginBottom: 10, letterSpacing: 0.4 },
  waitBox: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  waitTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  waitHint: { color: '#94A3B8', fontSize: 14, fontWeight: '600', textAlign: 'center', paddingHorizontal: 12 },
  waitDots: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  waitDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7DD3FC' },
  inviteBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  inviteBoxProminent: {
    borderColor: 'rgba(245,166,35,0.35)',
    backgroundColor: 'rgba(245,166,35,0.06)',
  },
  invitePrimaryBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  invitePrimaryBtnTxt: { color: '#0A0E1A', fontSize: 17, fontWeight: '800' },
  inviteHeadline: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  groupNameInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  copyBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  copyBtnTxt: { color: '#0A0E1A', fontSize: 16, fontWeight: '800' },
  shareViaLbl: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginTop: 4 },
  shareRow: { flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap' },
  shareItem: { alignItems: 'center', width: 64, gap: 4 },
  shareCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  moreCircle: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  moreDots: { color: '#fff', fontSize: 14, fontWeight: '800' },
  shareLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600' },
  previewLbl: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 4 },
  previewBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewTxt: { color: '#CBD5E1', fontSize: 13, fontWeight: '500', lineHeight: 20 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 10,
  },
  memberCardSelf: {
    borderColor: 'rgba(125,211,252,0.35)',
    backgroundColor: 'rgba(125,211,252,0.06)',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  memberBody: { flex: 1, minWidth: 0, gap: 4 },
  memberName: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  memberFlight: { color: '#94A3B8', fontSize: 13, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  summary: { color: '#CBD5E1', fontSize: 14, fontWeight: '600', marginVertical: 12, textAlign: 'center' },
  map: { height: 220, borderRadius: 14, overflow: 'hidden', marginTop: 4, marginBottom: 8, backgroundColor: '#0f172a' },
  mapFallback: { alignItems: 'center', justifyContent: 'center' },
  mapFallbackTxt: { color: '#64748B', fontSize: 13, fontWeight: '600', padding: 16, textAlign: 'center' },
  meet: { marginTop: 12, alignItems: 'center', gap: 6, padding: 16, borderRadius: 14, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' },
  meetTitle: { color: '#86EFAC', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  meetSub: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  joinScreen: { flex: 1, backgroundColor: '#05070F', paddingTop: Platform.OS === 'web' ? 20 : 54 },
  joinHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  joinTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', flex: 1 },
  joinScroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  joinLead: { color: '#CBD5E1', fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
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
  err: { color: '#F87171', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  addFlightBtn: {
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addFlightBtnTxt: { color: '#0A0E1A', fontSize: 17, fontWeight: '800' },
});
