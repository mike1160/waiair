import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { X } from 'phosphor-react-native';
import AirlineLogo, { airlineCodeFromFlight } from './AirlineLogo';
import { haptics } from './lib/haptics';
import { startLoopWhileActive } from './lib/appActivity';
import { boardingPassSummary, parseBcbp, type BoardingPassInfo } from './lib/bcbp';
import { t } from './lib/i18n';
import { useQuickTheme } from './lib/quickTheme';

type ThemeBits = {
  bg: string;
  text: string;
  secondary: string;
  accent: string;
  list: string;
  muted: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onParsed: (result: BoardingPassInfo) => void;
  theme: ThemeBits;
  quickMode?: boolean;
  quickThemeMode?: 'light' | 'dark';
};

const FOUND_HOLD_MS = 1500;

function isFlightNumber(q: string): boolean {
  return /^[A-Z]{1,3}\s?\d{1,4}[A-Z]?$/i.test(q.trim());
}

export default function BoardingPassScanner({ visible, onClose, onParsed, theme, quickMode = false, quickThemeMode }: Props) {
  const { colors: qm } = useQuickTheme(quickMode ? quickThemeMode : undefined);
  const chromeBg = quickMode ? qm.background : '#05070C';
  const chromeText = quickMode ? qm.text : '#fff';
  const chromeSub = quickMode ? qm.subtext : 'rgba(255,255,255,0.7)';
  const chromeInputBg = quickMode ? qm.inputBg : undefined;
  const chromeInputBorder = quickMode ? qm.accentBorderSoft : 'rgba(255,255,255,0.25)';
  const chromeInputText = quickMode ? qm.text : '#fff';
  const chromeInputPlaceholder = quickMode ? qm.inputPlaceholder : 'rgba(255,255,255,0.4)';
  const chromeCloseBg = quickMode ? qm.bgOverlaySoft : 'rgba(255,255,255,0.14)';
  const [permission, requestPermission] = useCameraPermissions();
  const [err, setErr] = useState('');
  const [manual, setManual] = useState(false);
  const [value, setValue] = useState('');
  const [found, setFound] = useState<BoardingPassInfo | null>(null);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanLine = useRef(new Animated.Value(0)).current;
  const onParsedRef = useRef(onParsed);
  const onCloseRef = useRef(onClose);
  onParsedRef.current = onParsed;
  onCloseRef.current = onClose;

  const finish = (pass: BoardingPassInfo | null) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCloseRef.current();
    if (pass) onParsedRef.current(pass);
  };

  useEffect(() => {
    if (!visible) {
      lockRef.current = false;
      finishedRef.current = false;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      setErr('');
      setManual(false);
      setValue('');
      setFound(null);
      return;
    }
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => {});
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    if (!visible || manual || found || Platform.OS === 'web') return;
    scanLine.setValue(0);
    return startLoopWhileActive(() =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLine, {
            toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
          }),
          Animated.timing(scanLine, {
            toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
          }),
        ]),
      ),
    );
  }, [visible, manual, found, scanLine]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const commit = (parsed: BoardingPassInfo) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setFound(parsed);
    haptics.success();
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => finish(parsed), FOUND_HOLD_MS);
  };

  const dismiss = () => {
    if (found) {
      finish(found);
      return;
    }
    haptics.light();
    onClose();
  };

  const onBarcodeScanned = (scan: BarcodeScanningResult) => {
    if (lockRef.current || found) return;
    const parsed = parseBcbp(scan?.data || '');
    if (!parsed) {
      setErr(t().couldNotReadPass);
      return;
    }
    setErr('');
    commit(parsed);
  };

  const submitManual = () => {
    const clean = String(value || '').replace(/\s+/g, '').toUpperCase();
    if (!isFlightNumber(clean)) {
      setErr(t().enterValidFlightAlt);
      return;
    }
    setErr('');
    commit({ flightNumber: clean });
  };

  const showCamera = Platform.OS !== 'web' && permission?.granted && !manual && !found;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={dismiss}
    >
      <View style={[styles.root, { backgroundColor: chromeBg }]}>
        <View style={[styles.head, { backgroundColor: chromeBg }]}>
          <TouchableOpacity
            onPress={dismiss}
            style={[styles.close, { backgroundColor: chromeCloseBg }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t().closeScanner}
          >
            <X size={22} color={chromeText} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: chromeText }]} numberOfLines={1} ellipsizeMode="tail">{t().scanBoardingPass}</Text>
            <Text style={[styles.sub, { color: chromeSub }]} numberOfLines={1} ellipsizeMode="tail">{t().scanBoardingPassHint}</Text>
          </View>
        </View>

        {Platform.OS === 'web' || (!permission?.granted && permission != null) || manual ? (
          <View style={styles.center}>
            {Platform.OS === 'web' ? (
              <Text style={[styles.hint, { color: chromeSub }]}>{t().cameraInApps}</Text>
            ) : !permission?.granted && !manual ? (
              <>
                <Text style={[styles.hint, { color: chromeSub }]}>{t().cameraAccessNeeded}</Text>
                <TouchableOpacity
                  style={[styles.permBtn, { backgroundColor: theme.accent }]}
                  onPress={() => { requestPermission().catch(() => {}); }}
                >
                  <Text style={styles.permBtnTxt}>{t().allowCamera}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.hint, { color: chromeSub }]}>{t().enterFlightManually}</Text>
                <TextInput
                  style={[styles.input, {
                    borderColor: chromeInputBorder,
                    color: chromeInputText,
                    backgroundColor: chromeInputBg,
                  }]}
                  value={value}
                  onChangeText={t => { setValue(t.toUpperCase()); setErr(''); }}
                  placeholder="TG316"
                  placeholderTextColor={chromeInputPlaceholder}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={submitManual}
                  accessibilityLabel="Flight number"
                />
                <TouchableOpacity style={[styles.permBtn, { backgroundColor: quickMode ? qm.accent : theme.accent }]} onPress={submitManual}>
                  <Text style={[styles.permBtnTxt, { color: qm.onAccent }]}>{t().trackFlight}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={dismiss} style={styles.cancelBtn} accessibilityRole="button" accessibilityLabel={t().cancel}>
              <Text style={[styles.cancelTxt, { color: chromeText }]}>{t().cancel}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.camArea}>
            {showCamera ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['pdf417', 'qr', 'aztec', 'datamatrix', 'code128'],
                }}
                onBarcodeScanned={found ? undefined : onBarcodeScanned}
              />
            ) : null}

            <Pressable style={styles.dimFlex} onPress={dismiss} accessibilityLabel={t().closeScanner} />

            <View style={styles.frameRow} pointerEvents="box-none">
              <Pressable style={styles.dimSide} onPress={dismiss} />
              <View style={styles.frame} pointerEvents="none">
                {!found ? (
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        transform: [{
                          translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [8, 168] }),
                        }],
                      },
                    ]}
                  />
                ) : null}
              </View>
              <Pressable style={styles.dimSide} onPress={dismiss} />
            </View>

            <View style={styles.bottomDim}>
              <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel={t().closeScanner} />
              {found ? (
                <View style={styles.found} pointerEvents="none">
                  <AirlineLogo iata={airlineCodeFromFlight(found.flightNumber)} size={40} />
                  <Text style={styles.foundTxt}>{boardingPassSummary(found)}</Text>
                </View>
              ) : (
                <Text style={styles.camHint} pointerEvents="none">{t().scanBoardingPassHint}</Text>
              )}
              {err ? <Text style={styles.err} pointerEvents="none">{err}</Text> : null}
              {!found ? (
                <View pointerEvents="box-none" style={styles.bottomActions}>
                  <TouchableOpacity
                    style={styles.manualBtn}
                    onPress={() => { setManual(true); setErr(''); }}
                    accessibilityRole="button"
                    accessibilityLabel={t().enterFlightManually}
                  >
                    <Text style={styles.manualTxt}>{t().enterFlightManually}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={dismiss}
                    accessibilityRole="button"
                    accessibilityLabel={t().cancel}
                  >
                    <Text style={styles.cancelTxt}>{t().cancel}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
    backgroundColor: '#05070C',
  },
  close: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  permBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  permBtnTxt: { color: '#0D1B2E', fontWeight: '800', fontSize: 14 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
  },
  camArea: { flex: 1 },
  dimFlex: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  dimSide: { flex: 1, alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.28)' },
  frameRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 188,
  },
  frame: {
    width: '78%',
    maxWidth: 340,
    height: 188,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 8, right: 8, height: 2,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  bottomDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
  },
  bottomActions: { alignItems: 'center', alignSelf: 'stretch' },
  camHint: {
    marginBottom: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  found: {
    marginHorizontal: 20,
    marginBottom: 16,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,200,83,0.92)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  foundTxt: { color: '#04210C', fontSize: 16, fontWeight: '800', textAlign: 'left', flex: 1, minWidth: 0 },
  err: { marginHorizontal: 20, marginBottom: 8, color: '#fca5a5', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  manualBtn: { alignItems: 'center', paddingVertical: 10 },
  manualTxt: { color: '#fff', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  cancelBtn: {
    minHeight: 44,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  cancelTxt: { color: 'rgba(255,255,255,0.92)', fontSize: 16, fontWeight: '800' },
});
