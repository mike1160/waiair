/**
 * Gmail import after "Continue with Google" on the opening screen.
 * Scans the inbox for travel mail (metadata only), shows what it found, and queues the picked mails.
 * Dedupe is on device (gmail_imported_ids) — the readonly scope cannot write a Gmail label.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { connectGmail, isGmailConnected, type GmailConnectResult } from '../lib/gmailTripExtras';
import { signInFailureIsRetryable, type GoogleSignInFailure } from '../lib/googleSignInError';
import * as Updates from 'expo-updates';
import { formatUpdateLabel } from '../lib/appVersion';
import { signInTraceLines } from '../lib/signInTrace';
import {
  IMPORT_DIAGNOSTIC_TIMEOUT_MS,
  diagnosticsLines,
  type ImportDiagnostics,
} from '../lib/importDiagnostics';
import { signInWatchdogAction } from '../lib/screenHandoff';
import {
  SCAN_DAYS_DEFAULT,
  SCAN_DAYS_EXTENDED,
  groupItems,
  itemHint,
  partitionByHint,
  truncateSubject,
  type GmailInboxItem,
  type GmailItemKind,
} from '../lib/gmailInboxScan';
import { savePendingImports, saveSyncStatus, scanGmailInbox, type ScanFailure, type ScanSkip } from '../lib/gmailInboxStore';
import { isEmptyOutcome, type ImportOutcome } from '../lib/gmailImport';

const BG = '#0D1B2A';
const CARD_BG = '#14263C';
const EDGE = '#20395A';
const WHITE = '#FFFFFF';
const MUTED = '#8CA2BD';
const GLOW = '#6AA5FF';
const OK = '#34D399';
const LOGO = require('../assets/images/waiair-logo.png');
import { KIND_ICON, detectOnly, kindLabel } from '../lib/gmailKinds';

const W = Dimensions.get('window').width;
/** The progress bar fills in 3s while the real scan runs; real progress overtakes it when it is faster. */
const FAKE_FILL_MS = 3000;
/**
 * How long the screen may sit on nothing after the Google sheet closes.
 *
 * Signing in happens in Google's own view: the app is put in the background and the sheet owns the screen.
 * When it closes the app comes back and the scan carries on — unless the sign-in promise never settles,
 * which is what the very first attempt did: the sheet went away, the app came back to a dark screen with
 * nothing on it, and stayed there. So the return to the foreground is watched, and a sign-in that has still
 * not answered two seconds later is given up on and the traveller is put back on the homescreen.
 */
/** How often the stall check looks; the limit itself is lib/screenHandoff.ts SIGN_IN_STALL_MS. */
const STALL_CHECK_MS = 5000;



type Phase = 'scanning' | 'results' | 'empty' | 'success' | 'error';

type Props = {
  visible: boolean;
  /** Back to the app without importing (also used after a failed Google login). */
  onClose: () => void;
  onViewTrips: () => void;
  onAddManually: () => void;
  /**
   * The picked mails are queued here; the app reads their bodies, parses them and adds the trips. What came
   * of it is reported back, so this screen says what was added instead of how many mails were ticked.
   */
  onImported?: () => Promise<ImportOutcome | null> | void;
  /** [W/14] What the import actually did, read when this screen shows the result. */
  getImportDiagnostics?: () => ImportDiagnostics | null;
};


/**
 * [V/1c] What the scan looked at and put aside, and why.
 *
 * A forwarded booking that goes missing looks exactly like one that was never there, and without this the
 * only way to tell them apart was to guess. A subject that is absent from this list was never returned by
 * the Gmail search at all — which is a different failure from anything the classifier does, and the one
 * thing the list proves by not mentioning it.
 *
 * Nothing leaves the device: this is the traveller's own mail on the traveller's own screen.
 */
function ScanDiagnostics({ skipped }: { skipped: ScanSkip[] }) {
  if (!skipped.length) return null;
  return (
    <View style={styles.diagBox}>
      <Text style={styles.diagHead}>{t().gmailSkippedTitle(skipped.length)}</Text>
      {skipped.slice(0, 12).map(s => (
        <View key={s.id} style={styles.diagItem}>
          <Text style={styles.diagLine} numberOfLines={2}>
            {`· ${s.subject || '(geen onderwerp)'} — ${s.reason}`}
          </Text>
          {/* [V/1d] Only where the body was read: the shape of the real mail, to fix against facts. */}
          {s.bodyChars != null ? (
            <>
              <Text style={styles.diagMeta} numberOfLines={2}>
                {`   ${s.bodyChars} tekens · afzender: ${s.fromDomain || '(geen adres gevonden)'}`}
              </Text>
              {/* [V/1f] Every signal with its score: a near miss should look like a near miss. */}
              <Text style={styles.diagMeta} numberOfLines={4}>{`   ${s.signals || '—'}`}</Text>
              {s.window ? (
                <Text style={styles.diagMeta} numberOfLines={4}>{`   …${s.window}…`}</Text>
              ) : null}
              <Text style={styles.diagMeta} numberOfLines={4}>{`   "${s.head || ''}"`}</Text>
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function GmailImportScreen({
  visible, onClose, onViewTrips, onAddManually, onImported, getImportDiagnostics,
}: Props) {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [items, setItems] = useState<GmailInboxItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [partial, setPartial] = useState(false);
  /* [V/1c] What the scan put aside and why — the traveller's own mail, on their own screen. */
  const [skipped, setSkipped] = useState<ScanSkip[]>([]);
  const [failure, setFailure] = useState<ScanFailure | 'login' | null>(null);
  /** [W/6] Why the Google sign-in failed, and Google's status code, so it can be reported without a cable. */
  const [loginFailure, setLoginFailure] = useState<{ reason?: string; detail?: string } | null>(null);
  /** [W/14] Shown under the result. Null until an import has run in this session. */
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostics | null>(null);
  /** [W/14] An import that produced no outcome, or none within the deadline: never a spinner forever. */
  const [stalled, setStalled] = useState<'timeout' | 'noOutcome' | null>(null);
  /**
   * [W/15] Which bundle is actually running.
   *
   * The failure arrived with no detail line, and no path in the source can produce that — so the most likely
   * explanation was that the device is not running the code being blamed. This settles it on the screen.
   */
  const bundleLabel = formatUpdateLabel({
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEnabled: Updates.isEnabled,
  });
  /** runScan is memoised on [progress]; the close callback is reached through a ref rather than widening it. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [days, setDays] = useState(SCAN_DAYS_DEFAULT);
  const [imported, setImported] = useState(0);
  /** What the import produced; null while the mails are still being read. */
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const planeX = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const realProgress = useRef(0);
  const runId = useRef(0);
  /** True while Google's sign-in sheet has the screen and has not answered yet. */
  const connecting = useRef(false);

  const runScan = useCallback(async (scanDays: number) => {
    const run = ++runId.current;
    realProgress.current = 0;
    setPhase('scanning');
    setFailure(null);
    setLoginFailure(null);
    setPartial(false);
    setSkipped([]);
    progress.setValue(0);
    Animated.timing(progress, { toValue: 0.9, duration: FAKE_FILL_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();

    if (!(await isGmailConnected())) {
      connecting.current = true;
      let login: GmailConnectResult = { ok: false };
      try {
        login = await connectGmail();
      } finally {
        connecting.current = false;
      }
      // The watchdog gave up on this sign-in while the sheet was open: it has already closed the screen.
      if (run !== runId.current) return;
      if (!login.ok) {
        /*
         * [W/6] The reason is kept now. A cancel is the traveller closing the sheet and is not an error
         * worth a screen; everything else says what it was, including Google's own status code.
         */
        if (login.reason === 'cancelled') {
          // Backing out of the Google sheet is a decision, not a failure: close, and say nothing.
          onCloseRef.current();
          return;
        }
        setLoginFailure({ reason: login.reason, detail: login.detail });
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
    // Settings shows when the inbox was last looked at, whoever asked for it.
    void saveSyncStatus({ ms: Date.now(), found: result.items.length });
    setPartial(result.partial);
    setSkipped(result.skipped || []);
    if (result.reason && !result.items.length) {
      setFailure(result.reason);
      setPhase('error');
      return;
    }
    setItems(result.items);
    /*
     * [W/16c] Only a travel brand confirming a booking is ticked in advance. Everything else stays on the
     * screen and stays tickable — this changes the default, not what is shown. Ticking a newsletter by
     * default cost a free flight and put a flight nobody was on in front of the traveller.
     */
    setPicked(new Set(
      result.items.filter(i => itemHint(i) === 'strong' && !detectOnly(i.kind)).map(i => i.id),
    ));
    setPhase(result.items.length ? 'results' : 'empty');
  }, [progress]);

  useEffect(() => {
    if (!visible) return;
    void runScan(SCAN_DAYS_DEFAULT);
  }, [visible, runScan]);

  /**
   * A sign-in that never answers [W/7].
   *
   * This used to watch AppState and, two seconds after the app became active with a sign-in in flight,
   * dismiss this screen. That reading of "active" was wrong: on a first-ever sign-in iOS shows its own
   * "wants to use google.com" consent alert, and dismissing *that* returns the app to active while the
   * Google sheet is still open. The timer then fired in the middle of the consent screen and tore down the
   * modal the native sheet was presented from — a black, unresponsive app that needed a force-quit.
   *
   * So app state is no longer consulted at all, and nothing dismisses this screen while a sign-in is running
   * (lib/screenHandoff.ts mayDismissDuringSignIn). The sign-in's own promise says what happened, and [W/6]
   * classifies it. The only safety net left is a long stall timeout, and it shows a retry *inside* the
   * screen — it never dismisses anything.
   */
  useEffect(() => {
    if (!visible) return undefined;
    const startedAt = Date.now();
    const tick = setInterval(() => {
      if (!connecting.current) return;
      const action = signInWatchdogAction({ connecting: true, elapsedMs: Date.now() - startedAt });
      if (action !== 'recover') return;
      connecting.current = false;
      // Nothing may land on the screen afterwards: the abandoned sign-in can still resolve.
      runId.current += 1;
      setLoginFailure({ reason: 'error', detail: 'stalled · no answer from Google' });
      setFailure('login');
      setPhase('error');
    }, STALL_CHECK_MS);
    return () => clearInterval(tick);
  }, [visible]);

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
    if (detectOnly(items.find(i => i.id === id)?.kind || 'flight')) return;
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /** [W/16c] The marketing tier starts collapsed; one tap opens it. Nothing is ever removed from the list. */
  const [promoOpen, setPromoOpen] = useState(false);
  const tiers = useMemo<{
    key: string; label: string; items: GmailInboxItem[]; collapsible: boolean; hidden: boolean;
  }[]>(() => {
    const parts = partitionByHint(items);
    return [
      { key: 'strong', label: '', items: parts.strong, collapsible: false, hidden: false },
      { key: 'weak', label: t().gmailMaybeTravel, items: parts.weak, collapsible: false, hidden: false },
      {
        key: 'promo',
        label: t().gmailPromotions,
        items: parts.promo,
        collapsible: true,
        hidden: !promoOpen,
      },
    ].filter(tier => tier.items.length > 0);
  }, [items, promoOpen]);

  /** Only what can actually be imported counts towards "select all". */
  const pickable = items.filter(i => !detectOnly(i.kind));
  const allPicked = pickable.length > 0 && picked.size === pickable.length;

  const doImport = async () => {
    const chosen = items.filter(i => picked.has(i.id));
    if (!chosen.length) return;
    // Only queued here: a mail counts as imported once it has produced a flight or a booking, so one that
    // cannot be parsed comes back on the next scan instead of disappearing.
    setImported(chosen.length);
    setOutcome(null);
    setStalled(null);
    setDiagnostics(null);
    setPhase('success');
    /*
     * [W/14] This used to be four awaited lines with no try/catch, and savePendingImports swallows its own
     * errors — so a queue that was never written became applyGmailImports returning null, which this screen
     * rendered as an ActivityIndicator that never resolved. Now every path ends in something on screen.
     */
    try {
      await savePendingImports(chosen);
      const result = await Promise.race([
        Promise.resolve(onImported?.()).then(r => ({ kind: 'outcome' as const, r })),
        new Promise<{ kind: 'timeout' }>(resolve => {
          setTimeout(() => resolve({ kind: 'timeout' }), IMPORT_DIAGNOSTIC_TIMEOUT_MS);
        }),
      ]);
      setDiagnostics(getImportDiagnostics?.() ?? null);
      if (result.kind === 'timeout') {
        setStalled('timeout');
        return;
      }
      const outcomeOrNull = result.r ?? null;
      setOutcome(outcomeOrNull);
      if (!outcomeOrNull) setStalled('noOutcome');
    } catch {
      setDiagnostics(getImportDiagnostics?.() ?? null);
      setStalled('noOutcome');
    }
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
    // 'not_connected' is Gmail refusing the token, not the scan going wrong: say so, so the answer is to
    // connect again rather than to try the same broken thing.
    const message = failure === 'offline' ? t().gmailOffline
      : loginFailure?.reason === 'misconfigured' || loginFailure?.reason === 'not_configured'
        ? t().googleLoginMisconfigured
        : loginFailure?.reason === 'no_play_services' ? t().googleLoginPlayServices
          : failure === 'login' || failure === 'not_connected' ? t().googleLoginFailed
            : t().gmailScanFailed;
    // [W/6] A build that cannot sign in will not sign in on the fourth attempt either: no retry button.
    const retryable = !loginFailure?.reason
      || signInFailureIsRetryable(loginFailure.reason as GoogleSignInFailure);
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyIcon}>✈️❔</Text>
        <Text style={styles.title}>{message}</Text>
        {/* [W/15] Never empty: an absent detail falls back to the reason, which beats a bare headline. */}
        <Text style={styles.loginDetail} selectable>
          {loginFailure?.detail || loginFailure?.reason || failure || 'unknown'}
        </Text>
        {/* [W/15] Which of the five native steps failed, with Google's own code, and on which bundle. */}
        {signInTraceLines({ bundle: bundleLabel }).map(line => (
          <Text key={line} style={styles.loginDetail} selectable>{line}</Text>
        ))}
        {retryable ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void runScan(days)} accessibilityRole="button">
            <Text style={styles.primaryTxt}>{t().gmailRetry}</Text>
          </TouchableOpacity>
        ) : null}
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
        <ScanDiagnostics skipped={skipped} />
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
    // Every line is something that actually happened; until the mails have been read, only the count is known.
    const lines = outcome
      ? [
        outcome.flightsAdded ? `✓  ${t().gmailResultFlights(outcome.flightsAdded)}` : '',
        outcome.bookingsAttached ? `✓  ${t().gmailResultBookings(outcome.bookingsAttached)}` : '',
        outcome.bookingsUpdated ? `✓  ${t().gmailResultUpdated(outcome.bookingsUpdated)}` : '',
        outcome.bookingsWaiting ? `⏳  ${t().gmailResultWaiting(outcome.bookingsWaiting)}` : '',
        // The free allowance ran out [M/3]. This screen is a full-screen modal, so the toast and the paywall
        // that used to carry this news never reached the traveller: the import simply looked like it did
        // nothing. It is said here, and the paywall follows once this screen is out of the way.
        outcome.limitReached ? `✕  ${t().gmailResultLimit(outcome.limitReached)}` : '',
        /*
         * [W/11] Said out loud rather than silently dropped. A past-dated confirmation used to vanish in a
         * `dateIso < today` filter, and one whose date had not parsed was worse than silent — it became
         * today's rotation of that flight number, presented as the traveller's own flight.
         */
        outcome.alreadyFlown ? `✕  ${t().gmailResultFlown(outcome.alreadyFlown)}` : '',
        outcome.dateUnclear ? `✕  ${t().gmailResultDateUnclear(outcome.dateUnclear)}` : '',
        outcome.failed ? `✕  ${t().gmailResultFailed(outcome.failed)}` : '',
      ].filter(Boolean)
      : [];
    return (
      <View style={[styles.root, styles.center]}>
        <Animated.Text style={[styles.check, { transform: [{ scale: check }] }]}>✓</Animated.Text>
        <Text style={styles.title}>{t().gmailSuccessTrips(imported)}</Text>
        {outcome ? (
          <View style={styles.resultList}>
            {isEmptyOutcome(outcome)
              ? <Text style={styles.resultLine}>{t().gmailResultNothing}</Text>
              : lines.map(line => <Text key={line} style={styles.resultLine}>{line}</Text>)}
          </View>
        ) : stalled ? (
          /* [W/14] No outcome, or none inside the deadline. Anything but a spinner that never resolves. */
          <View style={styles.resultList}>
            <Text style={styles.resultLine}>{`✕  ${t().gmailScanFailed}`}</Text>
          </View>
        ) : (
          <ActivityIndicator color={GLOW} style={styles.resultSpinner} />
        )}
        {/*
          * [W/14] What the import actually did: counts, the Pro status it ran with, whether the notification
          * permission question had been answered, and any error. Technical and therefore untranslated, like
          * the sign-in status code above — it is for reading out to whoever is fixing it.
          */}
        {diagnosticsLines(diagnostics).map(line => (
          <Text key={line} style={styles.loginDetail} selectable>{line}</Text>
        ))}
        {stalled ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void doImport()} accessibilityRole="button">
            <Text style={styles.primaryTxt}>{t().gmailRetry}</Text>
          </TouchableOpacity>
        ) : null}
        {outcome?.limitReached ? (
          <Text style={[styles.sub, styles.limitNote]}>{t().gmailLimitUpgrade}</Text>
        ) : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={onViewTrips} accessibilityRole="button">
          <Text style={styles.primaryTxt}>{t().gmailViewTrips}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
   * Everything above answers for itself; this last screen is a list, and a list of nothing is a blank page
   * with a dead button on it. Whatever left the state in that shape, the way out is the empty screen, which
   * says what happened and offers the next step.
   */
  if (!Array.isArray(items) || !items.length) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyIcon}>✈️❔</Text>
        <Text style={styles.title}>{t().gmailEmptyTitle}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onAddManually} accessibilityRole="button">
          <Text style={styles.primaryTxt}>{t().gmailAddManually}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.ghostTxt}>{t().close}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t().gmailFoundTitle}</Text>
        <TouchableOpacity onPress={() => setPicked(allPicked ? new Set() : new Set(pickable.map(i => i.id)))} accessibilityRole="button">
          <Text style={styles.link}>{allPicked ? t().gmailDeselectAll : t().gmailSelectAll}</Text>
        </TouchableOpacity>
      </View>
      {partial ? <Text style={styles.sub}>{t().gmailPartial}</Text> : null}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {tiers.map(tier => (
          <View key={tier.key}>
            {tier.label ? (
              <TouchableOpacity
                style={styles.tierHead}
                onPress={() => tier.collapsible && setPromoOpen(o => !o)}
                disabled={!tier.collapsible}
                accessibilityRole={tier.collapsible ? 'button' : 'header'}
              >
                <Text style={styles.tierTitle}>{`${tier.label} (${tier.items.length})`}</Text>
                {tier.collapsible ? (
                  <Text style={styles.tierToggle}>{promoOpen ? '▾' : `▸ ${t().gmailShowGroup}`}</Text>
                ) : null}
              </TouchableOpacity>
            ) : null}
            {tier.hidden ? null : groupItems(tier.items).map(group => (
          <View key={group.kind} style={styles.group}>
            <Text style={styles.groupTitle}>{`${KIND_ICON[group.kind]}  ${kindLabel(group.kind)} (${group.items.length})`}</Text>
            {group.items.map(item => {
              const on = picked.has(item.id);
              const soon = detectOnly(item.kind);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.row}
                  onPress={() => toggle(item.id)}
                  disabled={soon}
                  accessibilityRole={soon ? 'text' : 'checkbox'}
                  accessibilityState={soon ? { disabled: true } : { checked: on }}
                  accessibilityLabel={soon
                    ? `${item.sender}: ${item.subject}, ${t().gmailNotYetImportable}`
                    : `${item.sender}: ${item.subject}`}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowSender}>{item.sender}</Text>
                    <Text style={styles.rowSubject}>{truncateSubject(item.subject)}</Text>
                    <Text style={styles.rowDate}>
                      {item.dateMs ? new Date(item.dateMs).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  {soon ? (
                    <Text style={styles.rowSoon}>{t().gmailNotYetImportable}</Text>
                  ) : (
                    <View style={[styles.box, on && styles.boxOn]}>
                      {on ? <Text style={styles.boxTick}>✓</Text> : null}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
            ))}
          </View>
        ))}
        <ScanDiagnostics skipped={skipped} />
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
  /* [V/1c] Quiet and last: a diagnostic, not a feature — it should never compete with the result above it. */
  diagBox: { marginTop: 18, alignSelf: 'stretch', paddingHorizontal: 4, gap: 4 },
  diagHead: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  diagLine: { color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 15 },
  diagItem: { gap: 2 },
  diagMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 10, lineHeight: 13 },

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
  resultList: { alignSelf: 'stretch', paddingHorizontal: 28, gap: 8, marginTop: 4, marginBottom: 20 },
  limitNote: { marginTop: 4 },
  resultLine: { color: WHITE, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  resultSpinner: { marginTop: 12, marginBottom: 24 },
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
  rowSoon: { color: MUTED, fontSize: 11, fontWeight: '600', opacity: 0.8 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: EDGE, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: GLOW, borderColor: GLOW },
  boxTick: { color: BG, fontSize: 15, fontWeight: '800' },
  bottomBar: { paddingTop: 12, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: EDGE },
  /** [W/6] Small, muted, selectable: a status code to report, not a thing to read. */
  loginDetail: { fontSize: 12, opacity: 0.6, marginTop: -6, marginBottom: 10, fontVariant: ['tabular-nums'] },
  /* [W/16c] The tier headings. The marketing one is a button; the others are plain headers. */
  tierHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 4 },
  tierTitle: { fontSize: 13, fontWeight: '700', opacity: 0.55, letterSpacing: 0.3, textTransform: 'uppercase' },
  tierToggle: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  primaryBtn: { backgroundColor: WHITE, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center' },
  barBtn: { width: '100%' },
  btnOff: { opacity: 0.4 },
  primaryTxt: { color: BG, fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 10, alignItems: 'center' },
  ghostTxt: { color: MUTED, fontSize: 13 },
});
