import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { X } from 'phosphor-react-native';
import { haptics } from './lib/haptics';
import { boardingPassSummary, parseBcbp, type BoardingPassInfo } from './lib/bcbp';

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
};

function isFlightNumber(q: string): boolean {
  return /^[A-Z]{1,3}\s?\d{1,4}[A-Z]?$/i.test(q.trim());
}

export default function BoardingPassScanner({ visible, onClose, onParsed, theme }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [err, setErr] = useState('');
  const [manual, setManual] = useState(false);
  const [value, setValue] = useState('');
  const [found, setFound] = useState<BoardingPassInfo | null>(null);
  const lockRef = useRef(false);
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      lockRef.current = false;
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
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, manual, found, scanLine]);

  const commit = (parsed: BoardingPassInfo) => {
    lockRef.current = true;
    setFound(parsed);
    haptics.success();
    setTimeout(() => onParsed(parsed), 900);
  };

  const onBarcodeScanned = (scan: BarcodeScanningResult) => {
    if (lockRef.current || found) return;
    const parsed = parseBcbp(scan?.data || '');
    if (!parsed) {
      setErr('Could not read boarding pass.');
      return;
    }
    setErr('');
    commit(parsed);
  };

  const submitManual = () => {
    const clean = String(value || '').replace(/\s+/g, '').toUpperCase();
    if (!isFlightNumber(clean)) {
      setErr('Enter a valid flight number, e.g. TG316');
      return;
    }
    setErr('');
    commit({ flightNumber: clean });
  };

  const showCamera = Platform.OS !== 'web' && permission?.granted && !manual;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: '#05070C' }]}>
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

        <View style={styles.head}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <X size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Scan boarding pass</Text>
            <Text style={styles.sub}>Point camera at boarding pass barcode</Text>
          </View>
        </View>

        {Platform.OS === 'web' || (!permission?.granted && permission != null) || manual ? (
          <View style={styles.center}>
            {Platform.OS === 'web' ? (
              <Text style={styles.hint}>Camera scanning is available in the iOS and Android apps.</Text>
            ) : !permission?.granted && !manual ? (
              <>
                <Text style={styles.hint}>Camera access is needed to scan your boarding pass.</Text>
                <TouchableOpacity style={[styles.permBtn, { backgroundColor: theme.accent }]} onPress={() => requestPermission()}>
                  <Text style={styles.permBtnTxt}>Allow camera</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.hint}>Enter flight number manually</Text>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={t => { setValue(t.toUpperCase()); setErr(''); }}
                  placeholder="TG316"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={submitManual}
                  accessibilityLabel="Flight number"
                />
                <TouchableOpacity style={[styles.permBtn, { backgroundColor: theme.accent }]} onPress={submitManual}>
                  <Text style={styles.permBtnTxt}>Track flight</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={styles.frameWrap} pointerEvents="none">
            <View style={styles.frame}>
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
            </View>
            <Text style={styles.camHint}>Point camera at boarding pass barcode</Text>
          </View>
        )}

        {found ? (
          <View style={styles.found}>
            <Text style={styles.foundTxt}>{boardingPassSummary(found)}</Text>
          </View>
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        {!found ? (
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => { setManual(true); setErr(''); }}
            accessibilityRole="button"
            accessibilityLabel="Enter flight number manually"
          >
            <Text style={styles.manualTxt}>Enter flight number manually</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  close: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  permBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  permBtnTxt: { color: '#0A0F1E', fontWeight: '800', fontSize: 14 },
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
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '78%',
    height: 188,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 8, right: 8, height: 2,
    backgroundColor: '#00C853',
    shadowColor: '#00C853',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  camHint: {
    marginTop: 18,
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
    marginBottom: 12,
    backgroundColor: 'rgba(0,200,83,0.92)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  foundTxt: { color: '#04210C', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  err: { marginHorizontal: 20, marginBottom: 8, color: '#fca5a5', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  manualBtn: { alignItems: 'center', paddingVertical: 22, paddingBottom: Platform.OS === 'ios' ? 36 : 22 },
  manualTxt: { color: '#fff', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
});
