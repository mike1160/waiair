import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AddPassButton } from '../modules/wallet-pass';
import { haptics } from '../lib/haptics';
import { t } from '../lib/i18n';
import { addFlightPassToWallet, type WalletAddResult } from '../lib/walletPass';
import { markAdded, wasAdded } from '../lib/addedThisSession';

type Props = {
  flightNumber: string;
  /** Departure ISO of this leg: its date picks the right day's flight (a flight number repeats daily). */
  departureIso?: string | null;
  /** Departure airport of this leg: a multi-leg number's pass is cut from the leg boarded. */
  originIata?: string | null;
  isPro: boolean;
  isDark?: boolean;
  mutedColor: string;
  style?: StyleProp<ViewStyle>;
  /** Awaited before the pass is requested (the scanner waits for the barcode to be saved). */
  prepare?: () => Promise<unknown>;
  /** Outcome of Apple's add-pass sheet. */
  onResult?: (result: WalletAddResult) => void;
};

/**
 * Apple's "Add to Apple Wallet" badge (PKAddPassButton) for a flight. iOS builds with the WalletPass module only; free
 * users see what Pro adds (push updates on the lock screen).
 */
export default function AddToWalletButton({ flightNumber, departureIso, originIata, isPro, isDark = false, mutedColor, style, prepare, onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  /*
   * [S/1] The pass is already in Wallet, for as long as this session lasts. Apple's own badge has no
   * "added" state, so once it has been used it is replaced by a plain line that says so — tapping the badge
   * again only produces a second copy of the same pass.
   */
  const passKey = `${flightNumber}|${String(departureIso || '').slice(0, 10)}`;
  const [done, setDone] = useState(() => wasAdded('wallet', passKey));
  useEffect(() => { setDone(wasAdded('wallet', passKey)); }, [passKey]);
  // After the hooks, never before them: iOS-only, and only where the Wallet module is built in.
  if (Platform.OS !== 'ios' || !AddPassButton) return null;

  const add = async () => {
    if (busy) return;
    haptics.light();
    setBusy(true);
    setFailed(false);
    await prepare?.().catch(() => {});
    const result = await addFlightPassToWallet(flightNumber, { isPro, departureIso, originIata });
    setBusy(false);
    setFailed(result === 'failed');
    if (result === 'added') {
      markAdded('wallet', passKey);
      setDone(true);
    }
    onResult?.(result);
  };

  if (done) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={[styles.added, { color: mutedColor }]} numberOfLines={1}>{t().walletAdded}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.buttonBox, busy && styles.busy]} pointerEvents={busy ? 'none' : 'auto'}>
        <AddPassButton
          style={styles.button}
          buttonStyle={isDark ? 'blackOutline' : 'black'}
          onAddPassPress={() => { void add(); }}
          accessibilityLabel={t().addToAppleWallet}
        />
        {busy ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" /> : null}
      </View>
      {failed ? <Text style={[styles.note, { color: mutedColor }]}>{t().walletPassFailed}</Text> : null}
      {!isPro ? <Text style={[styles.note, { color: mutedColor }]}>{t().walletProUpsell}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  buttonBox: { width: '100%', maxWidth: 320, height: 48 },
  busy: { opacity: 0.5 },
  button: { width: '100%', height: 48 },
  note: { fontSize: 12, textAlign: 'center' },
  added: { fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 12 },
});
