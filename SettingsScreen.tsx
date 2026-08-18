import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Platform, ScrollView, Switch, Alert,
} from 'react-native';
import {
  X, Sparkle, ArrowsCounterClockwise, BellSimple, CaretRight, UserCircle,
  Thermometer, Clock, Airplane, Trash, Info, Globe, Star, FileText,
  EnvelopeSimple, SquaresFour, InstagramLogo, Check, Lock,
} from 'phosphor-react-native';
import Constants from 'expo-constants';
import {
  presentCustomerCenter,
  restorePurchases,
  getProPlanSummary,
  type ProPlanSummary,
} from './lib/purchases';
import {
  type AppPrefs,
  type NotifyPrefs,
  type TempUnit,
  type TimeFormat,
  type LocalePref,
  savePrefs,
  clearAppCache,
} from './lib/prefs';
import { t } from './lib/i18n';
import LegalScreen from './LegalScreen';
import WidgetHelpSheet from './components/WidgetHelpSheet';
import { openStoreListing } from './lib/storeReview';
import { THEME_CATALOG, type ThemeId } from './lib/themes';

type ThemeColors = {
  bg: string; card: string; text: string; secondary: string;
  muted: string; accent: string; border: string; list: string; gold: string;
};

type AirportLite = {
  iata: string; name: string; city: string; country: string;
  flag: string; lat: number; lon: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  isPro: boolean;
  colors: ThemeColors;
  onOpenPaywall: () => void;
  onProUnlocked: () => void;
  onToast: (msg: string) => void;
  prefs: AppPrefs;
  currentAirport: AirportLite;
  onOpenAirportPicker: () => void;
  onRequirePro: (highlight?: string) => void;
  onCacheCleared?: () => void;
  trackedCount?: number;
  trackLimit?: number;
  betaMode?: boolean;
  themeId: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
};

export default function SettingsScreen({
  visible, onClose, isPro, colors: C, onOpenPaywall, onProUnlocked, onToast,
  prefs, currentAirport, onOpenAirportPicker, onRequirePro, onCacheCleared,
  trackedCount = 0, trackLimit = 3, betaMode = false,
  themeId, onSelectTheme,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);
  const [widgetHelpOpen, setWidgetHelpOpen] = useState(false);
  const [plan, setPlan] = useState<ProPlanSummary | null>(null);
  const copy = t();
  const version = Constants.expoConfig?.version || '1.1.0';
  const build = Constants.expoConfig?.ios?.buildNumber || '';

  useEffect(() => {
    if (!visible || !isPro) {
      setPlan(null);
      return;
    }
    getProPlanSummary().then(setPlan).catch(() => setPlan(null));
  }, [visible, isPro]);

  const restore = async () => {
    setBusy(true);
    try {
      const result = await restorePurchases();
      if (result.ok) {
        onProUnlocked();
        onToast(copy.proRestored);
      } else {
        onToast(result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const openCustomerCenter = async () => {
    setBusy(true);
    try {
      onClose();
      await presentCustomerCenter();
    } catch {
      onToast(copy.customerCenterUnavailable);
    } finally {
      setBusy(false);
    }
  };

  const setTemp = (unit: TempUnit) => savePrefs({ tempUnit: unit });
  const setTime = (fmt: TimeFormat) => savePrefs({ timeFormat: fmt });
  const setNotify = (key: keyof NotifyPrefs, value: boolean) =>
    savePrefs({ notify: { ...prefs.notify, [key]: value } });

  const useCurrent = () => {
    savePrefs({ defaultAirport: currentAirport });
    onToast(copy.setAsDefault(currentAirport.iata));
  };

  const clear = () => {
    Alert.alert(
      copy.clearCacheConfirmTitle,
      copy.clearCacheConfirmBody,
      [
        { text: copy.cancel, style: 'cancel' },
        {
          text: copy.clearCacheConfirmAction,
          style: 'destructive',
          onPress: () => { void confirmClear(); },
        },
      ],
    );
  };

  const confirmClear = async () => {
    setBusy(true);
    try {
      await clearAppCache();
      onCacheCleared?.();
      onToast(copy.cacheCleared);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: C.bg }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: C.text }]}>{copy.settings}</Text>
          <TouchableOpacity
            style={[styles.close, { backgroundColor: C.list }]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={copy.closeSettings}
          >
            <X size={18} color={C.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.section, { color: C.muted }]}>{copy.account}</Text>

          {isPro ? (
            <>
              <View style={[styles.planCard, { backgroundColor: C.card }]}>
                <Sparkle size={18} color={C.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proActive, { color: C.gold }]}>{copy.waiairPro}</Text>
                  <Text style={{ color: C.muted, fontSize: 13, fontWeight: '500', marginTop: 4 }}>
                    {betaMode
                      ? copy.testFlightUnlocked
                      : (plan?.renewsLabel || copy.active)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.card, styles.cardBtn, { backgroundColor: C.card, opacity: busy ? 0.7 : 1 }]}
                onPress={openCustomerCenter}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={copy.manageSubscription}
              >
                <UserCircle size={18} color={C.accent} />
                <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.manageSubscription}</Text>
                <CaretRight size={16} color={C.muted} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={[styles.planCard, { backgroundColor: C.card }]}>
              <Sparkle size={18} color={C.gold} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTxt, { color: C.text }]}>{copy.waiairFree}</Text>
                <Text style={{ color: C.muted, fontSize: 13, fontWeight: '500', marginTop: 4 }}>
                  {copy.flightsTrackedOf(Math.min(trackedCount, trackLimit), trackLimit)}
                </Text>
                <TouchableOpacity
                  onPress={() => { onClose(); onOpenPaywall(); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={copy.upgradeToPro}
                  style={{ marginTop: 12 }}
                >
                  <Text style={{ color: C.accent, fontSize: 15, fontWeight: '800' }}>{copy.upgradeToPro}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card, opacity: busy ? 0.7 : 1 }]}
            onPress={restore}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={copy.restorePurchase}
          >
            {busy
              ? <ActivityIndicator color={C.accent} />
              : <ArrowsCounterClockwise size={18} color={C.accent} />}
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.restorePurchase}</Text>
          </TouchableOpacity>

          <Text style={[styles.section, { color: C.muted, marginTop: 24 }]}>{copy.appearance}</Text>
          <View style={styles.themeGrid}>
            {THEME_CATALOG.map((meta) => {
              const selected = themeId === meta.id;
              const locked = !!meta.pro && !isPro && !betaMode;
              return (
                <TouchableOpacity
                  key={meta.id}
                  style={[
                    styles.themeTile,
                    {
                      backgroundColor: C.card,
                      borderColor: selected ? C.accent : C.border,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => onSelectTheme(meta.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: false }}
                  accessibilityLabel={copy.themeA11y(meta.name, !!meta.pro, locked, selected)}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: meta.swatchBg, borderColor: meta.swatchAccent }]}>
                    <View style={[styles.themeSwatchDot, { backgroundColor: meta.swatchAccent }]} />
                    {selected ? (
                      <View style={styles.themeCheck}>
                        <Check size={12} color="#0A0A0A" weight="bold" />
                      </View>
                    ) : null}
                    {locked ? (
                      <View style={styles.themeLock}>
                        <Lock size={10} color="#fff" weight="bold" />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.themeNameRow}>
                    <Text
                      style={[styles.themeName, { color: selected ? C.accent : C.text }]}
                      numberOfLines={1}
                    >
                      {meta.pro ? '👑 ' : ''}{meta.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.section, { color: C.muted, marginTop: 24 }]}>{copy.preferences}</Text>
          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={() => { onClose(); onOpenAirportPicker(); }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={copy.defaultAirport}
          >
            <Airplane size={18} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTxt, { color: C.text }]}>{copy.defaultAirport}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                {prefs.defaultAirport
                  ? `${prefs.defaultAirport.flag} ${prefs.defaultAirport.iata} · ${prefs.defaultAirport.city}`
                  : copy.nearestAirport}
              </Text>
            </View>
            <CaretRight size={16} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={useCurrent}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={copy.useCurrentAirport}
          >
            <Text style={[styles.rowTxt, { color: C.accent }]}>
              {copy.useCurrentAirport} ({currentAirport.iata})
            </Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: C.card, justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Thermometer size={18} color={C.accent} />
              <Text style={[styles.rowTxt, { color: C.text }]}>{copy.temperature}</Text>
            </View>
            <View style={styles.seg}>
              {(['C', 'F'] as const).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.segBtn, prefs.tempUnit === u && { backgroundColor: C.accent }]}
                  onPress={() => setTemp(u)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: prefs.tempUnit === u }}
                  accessibilityLabel={u === 'C' ? copy.celsius : copy.fahrenheit}
                >
                  <Text style={{ color: prefs.tempUnit === u ? '#fff' : C.secondary, fontWeight: '700', fontSize: 13 }}>
                    {u === 'C' ? copy.celsius : copy.fahrenheit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: C.card, justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Clock size={18} color={C.accent} />
              <Text style={[styles.rowTxt, { color: C.text }]}>{copy.timeFormat}</Text>
            </View>
            <View style={styles.seg}>
              {(['24h', '12h'] as const).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.segBtn, prefs.timeFormat === u && { backgroundColor: C.accent }]}
                  onPress={() => setTime(u)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: prefs.timeFormat === u }}
                  accessibilityLabel={u === '24h' ? copy.hour24 : copy.hour12}
                >
                  <Text style={{ color: prefs.timeFormat === u ? '#fff' : C.secondary, fontWeight: '700', fontSize: 13 }}>
                    {u === '24h' ? '24h' : '12h'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: C.card, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Globe size={18} color={C.accent} />
              <Text style={[styles.rowTxt, { color: C.text }]}>{copy.language}</Text>
            </View>
            <View style={styles.langGrid}>
              {([
                ['en', '🇬🇧', copy.english],
                ['nl', '🇳🇱', copy.dutch],
                ['zh', '🇨🇳', copy.chinese],
                ['th', '🇹🇭', copy.thai],
                ['de', '🇩🇪', copy.german],
                ['ru', '🇷🇺', copy.russian],
                ['ja', '🇯🇵', copy.japanese],
                ['ko', '🇰🇷', copy.korean],
                ['vi', '🇻🇳', copy.vietnamese],
              ] as const).map(([code, flag, label]) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.langBtn, prefs.locale === code && { backgroundColor: C.accent }]}
                  onPress={() => savePrefs({ locale: code as LocalePref })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: prefs.locale === code }}
                  accessibilityLabel={label}
                >
                  <Text style={{ color: prefs.locale === code ? '#fff' : C.secondary, fontWeight: '700', fontSize: 13 }}>
                    {flag} {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={() => setWidgetHelpOpen(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={copy.widget}
          >
            <SquaresFour size={18} color={C.accent} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.widget}</Text>
            <CaretRight size={16} color={C.muted} />
          </TouchableOpacity>

          <Text style={[styles.section, { color: C.muted, marginTop: 24 }]}>{copy.notifications.toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: C.card, flexDirection: 'column', alignItems: 'stretch', gap: 0 }]}>
            {([
              ['boarding', copy.notifyBoarding],
              ['gate', copy.notifyGate],
              ['delay', copy.notifyDelay],
              ['landed', copy.notifyLanded],
            ] as const).map(([key, label], i) => (
              <View key={key} style={[styles.switchRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }]}>
                <Text style={[styles.rowTxt, { color: C.text }]}>{label}</Text>
                <Switch
                  value={prefs.notify[key]}
                  onValueChange={v => { void setNotify(key, v); }}
                  trackColor={{ false: C.border, true: C.accent }}
                  accessibilityLabel={label}
                />
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={copy.systemNotificationSettings}
          >
            <BellSimple size={18} color={C.accent} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.systemNotificationSettings}</Text>
            <CaretRight size={16} color={C.muted} />
          </TouchableOpacity>

          <Text style={[styles.section, { color: C.muted, marginTop: 24 }]}>{copy.data}</Text>
          <View style={[styles.card, { backgroundColor: C.card, justifyContent: 'space-between' }]}>
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.refreshInterval}</Text>
            <View style={styles.seg}>
              {([[30000, '30s'], [60000, '60s'], [300000, '5m']] as const).map(([ms, label]) => (
                <TouchableOpacity
                  key={ms}
                  style={[styles.segBtn, prefs.refreshIntervalMs === ms && { backgroundColor: C.accent }]}
                  onPress={() => {
                    if (ms === 30000 && !isPro) {
                      onClose();
                      onRequirePro(copy.priorityRefreshPro);
                      return;
                    }
                    savePrefs({ refreshIntervalMs: ms });
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: prefs.refreshIntervalMs === ms }}
                  accessibilityLabel={copy.refreshA11y(label, ms === 30000 && !isPro)}
                >
                  <Text style={{ color: prefs.refreshIntervalMs === ms ? '#fff' : C.secondary, fontWeight: '700', fontSize: 13 }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: C.card, justifyContent: 'space-between' }]}>
            <Text style={[styles.rowTxt, { color: C.text }]}>{copy.offlineData}</Text>
            <Switch
              value={prefs.offlineEnabled}
              onValueChange={v => { void savePrefs({ offlineEnabled: v }); }}
              trackColor={{ false: C.border, true: C.accent }}
              accessibilityLabel={copy.offlineData}
            />
          </View>

          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card, opacity: busy ? 0.7 : 1 }]}
            onPress={clear}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={copy.clearCache}
          >
            <Trash size={18} color={C.accent} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.clearCache}</Text>
          </TouchableOpacity>

          <Text style={[styles.section, { color: C.muted, marginTop: 24 }]}>{copy.about.toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: C.card }]}>
            <Info size={18} color={C.accent} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>
              {copy.version} {version}{build ? ` (${build})` : ''}
            </Text>
          </View>
          <TouchableOpacity style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]} onPress={() => setLegal('privacy')} accessibilityRole="button" accessibilityLabel={copy.privacy}>
            <FileText size={18} color={C.accent} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.privacy}</Text>
            <CaretRight size={16} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]} onPress={() => setLegal('terms')} accessibilityRole="button" accessibilityLabel={copy.terms}>
            <FileText size={18} color={C.accent} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.terms}</Text>
            <CaretRight size={16} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={() => { void openStoreListing(); }}
            accessibilityRole="button"
            accessibilityLabel={copy.rateApp}
          >
            <Star size={18} color={C.gold} weight="fill" />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.rateApp}  ⭐⭐⭐⭐⭐</Text>
            <CaretRight size={16} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={() => Linking.openURL('mailto:support@waiair.app')}
            accessibilityRole="button"
            accessibilityLabel={copy.contact}
          >
            <EnvelopeSimple size={18} color={C.accent} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.contact}</Text>
            <CaretRight size={16} color={C.muted} />
          </TouchableOpacity>
          <Text style={[styles.section, { color: C.muted, marginTop: 24 }]}>{copy.followUs.toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.card, { flex: 1, backgroundColor: C.card, justifyContent: 'center' }]}
              onPress={() => Linking.openURL('https://x.com/WaiAir')}
              accessibilityRole="link"
              accessibilityLabel={copy.waiairOnX}
            >
              <Text style={[styles.rowTxt, { color: C.text }]}>𝕏 @WaiAir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.card, { flex: 1, backgroundColor: C.card, justifyContent: 'center' }]}
              onPress={() => Linking.openURL('https://instagram.com/WaiAir.app')}
              accessibilityRole="link"
              accessibilityLabel={copy.waiairOnInstagram}
            >
              <InstagramLogo size={16} color={C.accent} />
              <Text style={[styles.rowTxt, { color: C.text }]}>@WaiAir.app</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <LegalScreen
          visible={!!legal}
          kind={legal || 'privacy'}
          colors={C}
          onClose={() => setLegal(null)}
        />
        <WidgetHelpSheet
          visible={widgetHelpOpen}
          onClose={() => setWidgetHelpOpen(false)}
          colors={C}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Platform.OS === 'ios' ? 16 : 20 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800' },
  close: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  section: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    marginBottom: 10, marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  cardBtn: {},
  planCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  proActive: { fontSize: 15, fontWeight: '700' },
  rowTxt: { fontSize: 15, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(136,150,176,0.12)', borderRadius: 10, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(136,150,176,0.12)',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 4,
  },
  themeTile: {
    width: '33.33%',
    padding: 5,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  themeSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  themeSwatchDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  themeCheck: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeLock: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  themeName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
