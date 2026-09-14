import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AddPassButton } from '../modules/wallet-pass';
import { haptics } from '../lib/haptics';
import { t } from '../lib/i18n';
import { addFlightPassToWallet } from '../lib/walletPass';

type Props = {
  flightNumber: string;
  isPro: boolean;
  isDark?: boolean;
  mutedColor: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Apple's "Add to Apple Wallet" badge (PKAddPassButton) for a flight. iOS builds with the WalletPass module only; free
 * users see what Pro adds (push updates on the lock screen).
 */
export default function AddToWalletButton({ flightNumber, isPro, isDark = false, mutedColor, style }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (Platform.OS !== 'ios' || !AddPassButton) return null;

  const add = async () => {
    if (busy) return;
    haptics.light();
    setBusy(true);
    setFailed(false);
    const result = await addFlightPassToWallet(flightNumber, { isPro });
    setBusy(false);
    setFailed(result === 'failed');
  };

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.buttonBox, busy && styles.busy]} pointerEvents={busy ? 'none' : 'auto'}>
        <AddPassButton
          style={styles.button}
          buttonStyle={isDark ? 'blackOutline' : 'black'}
          onPress={() => { void add(); }}
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
});
