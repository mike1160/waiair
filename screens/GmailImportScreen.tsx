/**
 * Gmail import after "Continue with Google" on the opening screen.
 * Scans the inbox for travel mail (metadata only), shows what it found, and queues the picked mails.
 * Dedupe is on device (gmail_imported_ids) — the readonly scope cannot write a Gmail label.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { t } from '../lib/i18n';
import { connectGmail, isGmailConnected } from '../lib/gmailTripExtras';
import {
  SCAN_DAYS_DEFAULT,
  SCAN_DAYS_EXTENDED,
  groupItems,
  truncateSubject,
  type GmailInboxItem,
  type GmailItemKind,
} from '../lib/gmailInboxScan';
import { savePendingImports, scanGmailInbox, type ScanFailure } from '../lib/gmailInboxStore';

const BG = '#0D1B2A';
const CARD_BG = '#14263C';
const EDGE = '#20395A';
const WHITE = '#FFFFFF';
const MUTED = '#8CA2BD';
const GLOW = '#6AA5FF';
const OK = '#34D399';
const LOGO = require('../assets/images/waiair-logo.png');
const W = Dimensions.get('window').width;
/** The progress bar fills in 3s while the real scan runs; real progress overtakes it when it is faster. */
const FAKE_FILL_MS = 3000;

const KIND_ICON: Record<GmailItemKind, string> = { flight: '✈️', hotel: '🏨', carRental: '🚗' };

type Phase = 'scanning' | 'results' | 'empty' | 'success' | 'error';

type Props = {
  visible: boolean;
  /** Back to the app without importing (also used after a failed Google login). */
  onClose: () => void;
  onViewTrips: () => void;
  onAddManually: () => void;
  /** The picked mails are queued here; the app reads their bodies, parses them and adds the trips. */
  onImported?: () => void;
};

function kindLabel(kind: GmailItemKind): string {
  if (kind === 'flight') return t().gmailFlights;
  if (kind === 'hotel') return t().gmailHotels;
  return t().gmailCars;
}

export default function GmailImportScreen({ visible, onClose, onViewTrips, onAddManually, onImported }: Props) {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [items, setItems] = useState<GmailInboxItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [partial, setPartial] = useState(false);
  const [failure, setFailure] = useState<ScanFailure | 'login' | null>(null);
  const [days, setDays] = useState(SCAN_DAYS_DEFAULT);
  const [imported, setImported] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const planeX = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const realProgress = useRef(0);
  const runId = useRef(0);

  const runScan = useCallback(async (scanDays: number) => {
    const run = ++runId.current;
    realProgress.current = 0;
    setPhase('scanning');
    setFailure(null);
    setPartial(false);
    progress.setValue(0);
    Animated.timing(progress, { toValue: 0.9, duration: FAKE_FILL_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();

    if (!(await isGmailConnected())) {
      const login = await connectGmail();
      if (!login.ok) {
        if (run !== runId.current) return;
        setFailure('login');
        setPhase('error');
        return;
      }
    }

    const result = await scanGmailInbox({
      days: scanDays,
      onProgress: (done, total) => {
        if (run !== runId.current || !total) return;
        const next = Math.min(0.95, done / total);
        if (next > realProgress.current) {
          realProgress.current = next;
          progress.setValue(next);
        }
      },
    });
    if (run !== runId.current) return;

    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: false }).start();
    setPartial(result.partial);
    if (result.reason && !result.items.length) {
      setFailure(result.reason);
      setPhase('error');
      return;
    }
    setItems(result.items);
    setPicked(new Set(result.items.map(i => i.id)));
    setPhase(result.items.length ? 'results' : 'empty');
  }, [progress]);

  useEffect(() => {
    if (!visible) return;
    void runScan(SCAN_DAYS_DEFAULT);
  }, [visible, runScan]);

  useEffect(() => {
    if (phase !== 'scanning') return undefined;
    planeX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(planeX, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, planeX]);

  useEffect(() => {
    if (phase !== 'success') return;
    check.setValue(0);
    Animated.spring(check, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
  }, [phase, check]);

  const toggle = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allPicked = items.length > 0 && picked.size === items.length;

  const doImport = async () => {
    const chosen = items.filter(i => picked.has(i.id));
    if (!chosen.length) return;
    // Only queued here: a mail counts as imported once it has produced a flight or a booking, so one that
    // cannot be parsed comes back on the next scan instead of disappearing.
    await savePendingImports(chosen);
    setImported(chosen.length);
    setPhase('success');
    onImported?.();
  };

  if (!visible) return null;

  if (phase === 'scanning') {
    return (
      <View style={[styles.root, styles.center]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t().gmailScanTitle}</Text>
        <Animated.Text
          style={[
            styles.plane,
            { transform: [{ translateX: planeX.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.35, W * 0.35] }) }] },
          ]}
        >
          ✈️
        </Animated.Text>
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
        <ActivityIndicator color={MUTED} />
      </View>
    );
  }

  if (phase === 'error') {
    const message = failure === 'offline' ? t().gmailOffline
      : failure === 'login' ? t().googleLoginFailed
        : t().gmailScanFailed;
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyIcon}>✈️❔</Text>
        <Text style={styles.title}>{message}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void runScan(days)} accessibilityRole="button">
          <Text style={styles.primaryTxt}>{t().gmailRetry}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.ghostTxt}>{t().close}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'empty') {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyIcon}>✈️❔</Text>
        <Text style={styles.title}>{t().gmailEmptyTitle}</Text>
        <Text style={styles.sub}>{days >= SCAN_DAYS_EXTENDED ? t().gmailEmptySubYear : t().gmailEmptySub}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onAddManually} accessibilityRole="button">
          <Text style={styles.primaryTxt}>{t().gmailAddManually}</Text>
        </TouchableOpacity>
        {days < SCAN_DAYS_EXTENDED ? (
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => { setDays(SCAN_DAYS_EXTENDED); void runScan(SCAN_DAYS_EXTENDED); }}
            accessibilityRole="button"
          >
            <Text style={styles.ghostTxt}>{t().gmailSearchFurther}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.ghostBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.ghostTxt}>{t().close}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (phase === 'success') {
    return (
      <View style={[styles.root, styles.center]}>
        <Animated.Text style={[styles.check, { transform: [{ scale: check }] }]}>✓</Animated.Text>
        <Text style={styles.title}>{t().gmailSuccessTrips(imported)}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onViewTrips} accessibilityRole="button">
          <Text style={styles.primaryTxt}>{t().gmailViewTrips}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t().gmailFoundTitle}</Text>
        <TouchableOpacity onPress={() => setPicked(allPicked ? new Set() : new Set(items.map(i => i.id)))} accessibilityRole="button">
          <Text style={styles.link}>{allPicked ? t().gmailDeselectAll : t().gmailSelectAll}</Text>
        </TouchableOpacity>
      </View>
      {partial ? <Text style={styles.sub}>{t().gmailPartial}</Text> : null}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {groupItems(items).map(group => (
          <View key={group.kind} style={styles.group}>
            <Text style={styles.groupTitle}>{`${KIND_ICON[group.kind]}  ${kindLabel(group.kind)} (${group.items.length})`}</Text>
            {group.items.map(item => {
              const on = picked.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.row}
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${item.sender}: ${item.subject}`}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowSender}>{item.sender}</Text>
                    <Text style={styles.rowSubject}>{truncateSubject(item.subject)}</Text>
                    <Text style={styles.rowDate}>
                      {item.dateMs ? new Date(item.dateMs).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  <View style={[styles.box, on && styles.boxOn]}>
                    {on ? <Text style={styles.boxTick}>✓</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={styles.listTail} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, styles.barBtn, !picked.size && styles.btnOff]}
          onPress={() => void doImport()}
          disabled={!picked.size}
          accessibilityRole="button"
        >
          <Text style={styles.primaryTxt}>{t().gmailImportItems(picked.size)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.ghostTxt}>{t().close}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 18 },
  logo: { width: 108, height: 32 },
  title: { color: WHITE, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sub: { color: MUTED, fontSize: 13, textAlign: 'center' },
  plane: { fontSize: 30 },
  barTrack: { width: '70%', height: 6, borderRadius: 3, backgroundColor: CARD_BG, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: GLOW },
  emptyIcon: { fontSize: 44 },
  check: { color: OK, fontSize: 64, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: GLOW, fontSize: 13, fontWeight: '600' },
  list: { paddingTop: 16, gap: 18 },
  listTail: { height: 8 },
  group: { gap: 8 },
  groupTitle: { color: MUTED, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: EDGE,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowText: { flex: 1, gap: 2 },
  rowSender: { color: WHITE, fontSize: 14, fontWeight: '600' },
  rowSubject: { color: MUTED, fontSize: 13 },
  rowDate: { color: MUTED, fontSize: 11, opacity: 0.8 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: EDGE, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: GLOW, borderColor: GLOW },
  boxTick: { color: BG, fontSize: 15, fontWeight: '800' },
  bottomBar: { paddingTop: 12, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: EDGE },
  primaryBtn: { backgroundColor: WHITE, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center' },
  barBtn: { width: '100%' },
  btnOff: { opacity: 0.4 },
  primaryTxt: { color: BG, fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 10, alignItems: 'center' },
  ghostTxt: { color: MUTED, fontSize: 13 },
});
