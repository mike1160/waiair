import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Platform, ScrollView, Switch, Alert,
} from 'react-native';
import {
  X, Sparkle, ArrowsCounterClockwise, BellSimple, CaretRight, UserCircle,
  Thermometer, Clock, Airplane, Trash, Info, Globe, Star, FileText,
  EnvelopeSimple, Check, Lock,
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
import { SocialBrandIcon } from './components/SocialBrandIcons';
import { openStoreListing } from './lib/storeReview';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { FLAG_EMOJI, THEME_CATALOG, THEMES, type ThemeId, type ThemeMeta } from './lib/themes';

type ThemeColors = {
  bg: string; card: string; text: string; secondary: string;
  muted: string; accent: string; border: string; list: string; gold: string;
  isDark: boolean;
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
  onOpenPassport?: () => void;
  onDevSeedPassport?: () => void;
  themeId: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
};

export default function SettingsScreen({
  visible, onClose, isPro, colors: C, onOpenPaywall, onProUnlocked, onToast,
  prefs, currentAirport, onOpenAirportPicker, onRequirePro, onCacheCleared,
  trackedCount = 0, trackLimit = 3, betaMode = false,
  onOpenPassport,
  onDevSeedPassport,
  themeId, onSelectTheme,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);
  const [plan, setPlan] = useState<ProPlanSummary | null>(null);
  const copy = t();
  const version = Constants.expoConfig?.version || '1.1.0';
  const build = Constants.expoConfig?.ios?.buildNumber || '';
  const coreThemes = THEME_CATALOG.filter(m => m.group !== 'country');
  const countryThemes = THEME_CATALOG.filter(m => m.group === 'country');

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

          {onOpenPassport ? (
            <TouchableOpacity
              style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
              onPress={onOpenPassport}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={copy.myFlightPassport}
            >
              <Airplane size={18} color={C.gold} weight="fill" />
              <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{copy.myFlightPassport}</Text>
              <CaretRight size={16} color={C.muted} />
            </TouchableOpacity>
          ) : null}

          {__DEV__ && onDevSeedPassport ? (
            <TouchableOpacity
              style={[styles.card, styles.cardBtn, { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#f5a623' }]}
              onPress={onDevSeedPassport}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, marginRight: 8 }}>🧪</Text>
              <Text style={[styles.rowTxt, { color: '#f5a623', flex: 1 }]}>DEV: Laad testvlucht in passport</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.themeSectionHead}>Style</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.themeScroller}
            contentContainerStyle={styles.themeRow}
          >
            {coreThemes.map((meta) => (
              <ThemePreviewCard
                key={meta.id}
                variant="style"
                meta={meta}
                selected={themeId === meta.id}
                locked={!!meta.pro && !isPro && !betaMode}
                captionColor={C.isDark ? '#FFFFFF' : C.text}
                copy={copy}
                onSelect={onSelectTheme}
              />
            ))}
          </ScrollView>

          <Text style={[styles.themeSectionHead, { marginTop: 22 }]}>Countries 🌍</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.themeScroller}
            contentContainerStyle={styles.themeRow}
          >
            {countryThemes.map((meta) => (
              <ThemePreviewCard
                key={meta.id}
                variant="country"
                meta={meta}
                selected={themeId === meta.id}
                locked={false}
                captionColor={C.isDark ? '#FFFFFF' : C.text}
                copy={copy}
                onSelect={onSelectTheme}
              />
            ))}
          </ScrollView>

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
          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={() => Linking.openURL('https://www.tiktok.com/@waiair')}
            accessibilityRole="link"
            accessibilityLabel={copy.waiairOnTikTok}
          >
            <SocialBrandIcon platform="tiktok" size={18} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>@waiair</Text>
            <CaretRight size={16} color={C.muted} />
          </TouchableOpacity>
        </ScrollView>
        <LegalScreen
          visible={!!legal}
          kind={legal || 'privacy'}
          colors={C}
          onClose={() => setLegal(null)}
        />
      </View>
    </Modal>
  );
}

function splitCountryLabel(name: string): { flag: string; label: string } {
  const i = name.indexOf(' ');
  if (i <= 0) return { flag: '', label: name };
  return { flag: name.slice(0, i), label: name.slice(i + 1) };
}

const SELECT_GOLD = '#C9A84C';

const STYLE_EMOJI: Record<string, string> = {
  classic: '✨',
  midnight: '🌙',
  blossom: '🌸',
  tropical: '🌴',
  junior: '🧒',
  gold: '🥇',
  platinum: '👑',
  spotter: '✈',
};

function ThemeCardSheen({ id }: { id: string }) {
  return (
    <Svg pointerEvents="none" width={90} height={120} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <Stop offset="0.42" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.32" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="90" height="120" fill={`url(#${id})`} />
    </Svg>
  );
}

function CountryCardWash({ id, accent }: { id: string; accent: string }) {
  return (
    <Svg pointerEvents="none" width={100} height={130} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity="0" />
          <Stop offset="0.58" stopColor={accent} stopOpacity="0" />
          <Stop offset="0.68" stopColor={accent} stopOpacity="0.55" />
          <Stop offset="1" stopColor={accent} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="130" fill={`url(#${id})`} />
    </Svg>
  );
}

function ThemePreviewCard({
  variant,
  meta,
  selected,
  locked,
  captionColor,
  copy,
  onSelect,
}: {
  variant: 'style' | 'country';
  meta: ThemeMeta;
  selected: boolean;
  locked: boolean;
  captionColor: string;
  copy: { themeA11y: (name: string, pro: boolean, locked: boolean, selected: boolean) => string };
  onSelect: (id: ThemeId) => void;
}) {
  const palette = THEMES[meta.id];
  const country = splitCountryLabel(meta.name);
  const flag = FLAG_EMOJI[meta.id] || country.flag || '🌍';
  const styleName = meta.name.replace(/^✈\s*/, '');
  const styleCaption = `${styleName} ${STYLE_EMOJI[meta.id] ?? ''}`.trim();
  const borderColor = selected
    ? (variant === 'style' ? SELECT_GOLD : palette.accent)
    : 'rgba(255,255,255,0.10)';
  const checkBg = variant === 'style' ? SELECT_GOLD : palette.accent;
  const cardW = variant === 'country' ? 100 : 90;
  const cardH = variant === 'country' ? 130 : 120;

  return (
    <TouchableOpacity
      style={[styles.themePick, { width: cardW }]}
      onPress={() => onSelect(meta.id)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: false }}
      accessibilityLabel={copy.themeA11y(meta.name, !!meta.pro, locked, selected)}
    >
      <View style={[styles.themePreviewOuter, { width: cardW, height: cardH, borderColor }]}>
        <View style={[styles.themePreviewInner, { backgroundColor: palette.bg }]}>
          {variant === 'style' ? (
            <>
              <View style={[styles.themeStyleTop, { backgroundColor: palette.card }]}>
                <View style={[styles.themeAccentBar, { backgroundColor: palette.accent }]} />
              </View>
              <View style={styles.themeStyleBottom}>
                <Text style={styles.themeStyleCaption} numberOfLines={1}>
                  {styleCaption}
                </Text>
              </View>
              <ThemeCardSheen id={`theme-sheen-${meta.id}`} />
            </>
          ) : (
            <>
              <CountryCardWash id={`country-wash-${meta.id}`} accent={palette.accent} />
              <View style={styles.themeCountryBody}>
                <Text allowFontScaling={false} style={styles.themeFlag}>{flag}</Text>
              </View>
              <View style={[styles.themeCountryAccentBar, { backgroundColor: palette.accent }]} />
            </>
          )}
          {selected ? (
            <View style={[styles.themeCheck, { backgroundColor: checkBg }]}>
              <Check size={11} color="#0A0A0A" weight="bold" />
            </View>
          ) : null}
          {locked ? (
            <View style={styles.themeLock}>
              <Lock size={10} color="#fff" weight="bold" />
            </View>
          ) : null}
        </View>
      </View>
      {variant === 'country' ? (
        <Text style={[styles.themeCountryName, { color: captionColor, width: 100 }]} numberOfLines={1}>
          {country.label}
        </Text>
      ) : null}
    </TouchableOpacity>
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
  themeSectionHead: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: SELECT_GOLD,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  themeScroller: {
    marginHorizontal: -20,
    marginBottom: 4,
  },
  themeRow: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 10,
    alignItems: 'flex-start',
  },
  themePick: {
    width: 90,
    alignItems: 'center',
  },
  themePreviewOuter: {
    width: 90,
    height: 120,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  themePreviewInner: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  themeStyleTop: {
    flex: 6,
    justifyContent: 'flex-end',
  },
  themeStyleBottom: {
    flex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  themeStyleCaption: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  themeCountryBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 22,
  },
  themeAccentBar: {
    height: 4,
    width: '100%',
  },
  themeCountryAccentBar: {
    height: 6,
    width: '100%',
  },
  themeFlag: {
    fontSize: 52,
    lineHeight: 62,
    textAlign: 'center',
    includeFontPadding: false,
  },
  themeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  themeLock: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCountryName: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    width: 90,
    color: '#FFFFFF',
  },
});
