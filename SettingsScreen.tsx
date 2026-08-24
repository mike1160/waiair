import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Linking, Platform, ScrollView, Switch, Alert,
} from 'react-native';
import {
  X, Sparkle, ArrowsCounterClockwise, BellSimple, CaretRight, UserCircle,
  Thermometer, Clock, Airplane, Trash, Info, Star, FileText,
  EnvelopeSimple, Lock, Heart, Phone, Check,
} from 'phosphor-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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
  savePrefs,
  clearAppCache,
} from './lib/prefs';
import { t } from './lib/i18n';
import { loadPickupContact, savePickupContact } from './lib/pickupContact';
import LanguageSplitFlapBoard from './LanguageSplitFlapBoard';
import { haptics } from './lib/haptics';
import { SSF_DONATE_URL } from './PromoBoardCard';
import LegalScreen from './LegalScreen';
import { SocialBrandIcon } from './components/SocialBrandIcons';
import { openStoreListing } from './lib/storeReview';
import { FLAG_EMOJI, THEME_CATALOG, THEMES, type ThemeId, type ThemeMeta } from './lib/themes';
import {
  applyPreset,
  getActiveModules,
  getPreset,
  isModuleActive,
  MODULES,
  setActiveModules as persistActiveModules,
  setPreset,
  type ModuleId,
  type Preset,
} from './lib/modules';

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
  const [pickupName, setPickupName] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [activePreset, setActivePreset] = useState<Preset>('traveller');
  const [activeModules, setActiveModules] = useState<ModuleId[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const modulesScrollY = useRef(0);
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

  useEffect(() => {
    if (!visible) return;
    loadPickupContact().then(c => {
      setPickupName(c?.name || '');
      setPickupPhone(c?.phone || '');
    }).catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const [preset, modules] = await Promise.all([getPreset(), getActiveModules()]);
        setActivePreset(preset);
        setActiveModules(modules);
      } catch { /* ignore */ }
    })();
  }, [visible]);

  const selectPreset = async (preset: Preset) => {
    haptics.light();
    try {
      await applyPreset(preset);
      if (preset === 'custom') await setPreset('custom');
      const [nextPreset, modules] = await Promise.all([getPreset(), getActiveModules()]);
      setActivePreset(nextPreset);
      setActiveModules(modules);
      if (preset === 'custom') {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: modulesScrollY.current, animated: true });
        });
      }
    } catch { /* ignore */ }
  };

  const toggleModule = async (id: ModuleId, enabled: boolean) => {
    if (id === 'journey_phase') return;
    haptics.light();
    try {
      const currentlyActive = await isModuleActive(id);
      if (enabled === currentlyActive) return;
      const current = await getActiveModules();
      const next = new Set(current);
      if (enabled) next.add(id);
      else next.delete(id);
      next.add('journey_phase');
      const updated = MODULES.map(m => m.id).filter(mid => next.has(mid));
      await persistActiveModules(updated);
      const [modules, preset] = await Promise.all([getActiveModules(), getPreset()]);
      setActiveModules(modules);
      setActivePreset(preset);
    } catch { /* ignore */ }
  };

  const presetRows: { id: Preset; emoji: string; label: string }[] = [
    { id: 'quick', emoji: '⚡', label: copy.onboardingPresetQuickTitle },
    { id: 'traveller', emoji: '🛫', label: copy.onboardingPresetTravellerTitle },
    { id: 'pro', emoji: '🤓', label: copy.onboardingPresetProTitle },
    { id: 'custom', emoji: '⚙️', label: copy.onboardingPresetCustomTitle },
  ];

  const activeModuleSet = new Set(activeModules);

  const persistPickupContact = (name: string, phone: string) => {
    void savePickupContact({ name, phone });
  };

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

        {visible ? (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
          <LanguageSplitFlapBoard
            locale={prefs.locale}
            cardColor={C.card}
            textColor={C.text}
            onSelect={code => { void savePrefs({ locale: code }); }}
          />

          <Text style={[styles.section, { color: C.muted }]}>MY APP</Text>

          <Text style={[styles.section, { color: C.muted, marginTop: 0 }]}>Mode</Text>
          <View style={[styles.card, { backgroundColor: C.card, flexDirection: 'column', alignItems: 'stretch', gap: 0 }]}>
            {presetRows.map((row, i) => (
              <TouchableOpacity
                key={row.id}
                style={[styles.switchRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }]}
                onPress={() => { void selectPreset(row.id); }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: activePreset === row.id }}
                accessibilityLabel={row.label}
              >
                <Text style={{ fontSize: 18, lineHeight: 22 }}>{row.emoji}</Text>
                <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{row.label}</Text>
                {activePreset === row.id ? (
                  <Check size={18} color={C.accent} weight="bold" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          <View
            onLayout={e => { modulesScrollY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={[styles.section, { color: C.muted, marginTop: 8 }]}>Modules</Text>
            <View style={[styles.card, { backgroundColor: C.card, flexDirection: 'column', alignItems: 'stretch', gap: 0 }]}>
              {MODULES.map((mod, i) => {
                const locked = mod.id === 'journey_phase';
                const on = locked || activeModuleSet.has(mod.id);
                return (
                  <View
                    key={mod.id}
                    style={[styles.switchRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }]}
                  >
                    <Text style={{ fontSize: 16, lineHeight: 20 }}>{mod.icon}</Text>
                    <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>{mod.label}</Text>
                    {locked ? (
                      <Lock size={18} color={C.muted} />
                    ) : (
                      <Switch
                        value={on}
                        onValueChange={v => { void toggleModule(mod.id, v); }}
                        trackColor={{ false: C.border, true: C.accent }}
                        accessibilityLabel={mod.label}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>

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

          <View style={styles.themeBlock}>
            <Text style={[styles.themeSectionHead, { color: C.accent }]}>STYLE</Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.themeRow}
            >
              {coreThemes.map((meta) => (
                <ThemePreviewCard
                  key={meta.id}
                  variant="style"
                  meta={meta}
                  selected={themeId === meta.id}
                  locked={!!meta.pro && !isPro && !betaMode}
                  copy={copy}
                  onSelect={onSelectTheme}
                />
              ))}
            </ScrollView>

            <Text style={[styles.themeSectionHead, styles.themeSectionHeadSpaced, { color: C.accent }]}>COUNTRIES 🌍</Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.themeRow}
            >
              {countryThemes.map((meta) => (
                <ThemePreviewCard
                  key={meta.id}
                  variant="country"
                  meta={meta}
                  selected={themeId === meta.id}
                  locked={false}
                  copy={copy}
                  onSelect={onSelectTheme}
                />
              ))}
            </ScrollView>
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
              <Phone size={18} color={C.accent} />
              <Text style={[styles.rowTxt, { color: C.text }]}>{copy.pickupContactTitle}</Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: '500' }}>{copy.pickupContactHint}</Text>
            <TextInput
              value={pickupName}
              onChangeText={setPickupName}
              onBlur={() => persistPickupContact(pickupName, pickupPhone)}
              placeholder={copy.pickupContactName}
              placeholderTextColor={C.muted}
              autoCapitalize="words"
              style={[styles.pickupInput, { color: C.text, borderColor: C.border, backgroundColor: C.list }]}
              accessibilityLabel={copy.pickupContactName}
            />
            <TextInput
              value={pickupPhone}
              onChangeText={setPickupPhone}
              onBlur={() => persistPickupContact(pickupName, pickupPhone)}
              placeholder={copy.pickupContactPhone}
              placeholderTextColor={C.muted}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              style={[styles.pickupInput, { color: C.text, borderColor: C.border, backgroundColor: C.list }]}
              accessibilityLabel={copy.pickupContactPhone}
            />
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

          <Text style={[styles.section, { color: C.muted, marginTop: 24 }]}>{(copy.partners || 'Partner').toUpperCase()}</Text>
          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={() => {
              haptics.light();
              void Linking.openURL(SSF_DONATE_URL);
            }}
            activeOpacity={0.8}
            accessibilityRole="link"
            accessibilityLabel={copy.ssfPartnerA11y || copy.ssfPartnerName || 'Saved Souls Foundation'}
          >
            <Heart size={18} color="#22c55e" weight="fill" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTxt, { color: C.text }]}>{copy.ssfPartnerName || 'Saved Souls Foundation'}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{copy.ssfPartnerSub || ''}</Text>
            </View>
            <CaretRight size={16} color={C.muted} />
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
        ) : null}
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

const THEME_CARD_W = 75;
const THEME_CARD_H = 95;

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

function ThemePreviewCard({
  variant,
  meta,
  selected,
  locked,
  copy,
  onSelect,
}: {
  variant: 'style' | 'country';
  meta: ThemeMeta;
  selected: boolean;
  locked: boolean;
  copy: { themeA11y: (name: string, pro: boolean, locked: boolean, selected: boolean) => string };
  onSelect: (id: ThemeId) => void;
}) {
  const palette = THEMES[meta.id];
  const country = splitCountryLabel(meta.name);
  const flag = FLAG_EMOJI[meta.id] || country.flag || '🌍';
  const styleName = meta.name.replace(/^✈\s*/, '');
  const caption = variant === 'country'
    ? country.label
    : `${styleName} ${STYLE_EMOJI[meta.id] ?? ''}`.trim();
  const gradId = `theme-preview-${meta.id}`;

  return (
    <TouchableOpacity
      style={styles.themePick}
      onPress={() => onSelect(meta.id)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: false }}
      accessibilityLabel={copy.themeA11y(meta.name, !!meta.pro, locked, selected)}
    >
      <View
        style={[
          styles.themePreview,
          {
            backgroundColor: palette.bg,
            borderColor: selected ? palette.accent : 'transparent',
          },
        ]}
      >
        {variant === 'country' ? (
          <>
            <Svg
              width={THEME_CARD_W}
              height={THEME_CARD_H}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Defs>
                <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={palette.bg} />
                  <Stop offset="0.7" stopColor={palette.bg} />
                  <Stop offset="1" stopColor={palette.accent} />
                </LinearGradient>
              </Defs>
              <Rect width={THEME_CARD_W} height={THEME_CARD_H} fill={`url(#${gradId})`} />
            </Svg>
            <View style={styles.themeCardBody}>
              <Text allowFontScaling={false} style={styles.themeFlag}>{flag}</Text>
            </View>
          </>
        ) : (
          <View style={[styles.themeAccentBar, { backgroundColor: palette.accent }]} />
        )}
        {locked ? (
          <View style={styles.themeLock}>
            <Lock size={10} color="#fff" weight="bold" />
          </View>
        ) : null}
      </View>
      <Text style={styles.themeCaption} numberOfLines={1}>
        {caption}
      </Text>
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
  pickupInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(136,150,176,0.12)', borderRadius: 10, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  themeBlock: {
    marginHorizontal: -20,
    marginTop: 24,
  },
  themeSectionHead: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingLeft: 16,
    marginBottom: 10,
  },
  themeSectionHeadSpaced: {
    marginTop: 18,
  },
  themeRow: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 4,
    gap: 8,
    alignItems: 'flex-start',
  },
  themePick: {
    width: THEME_CARD_W,
    alignItems: 'center',
  },
  themePreview: {
    width: THEME_CARD_W,
    height: THEME_CARD_H,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  themeCardBody: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeAccentBar: {
    height: 6,
    width: '100%',
  },
  themeFlag: {
    fontSize: 36,
    lineHeight: 42,
    textAlign: 'center',
    includeFontPadding: false,
  },
  themeLock: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCaption: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    width: THEME_CARD_W,
    color: '#FFFFFF',
  },
});
