import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { AddPassButton } from '../modules/wallet-pass';
import { haptics } from '../lib/haptics';
import { t } from '../lib/i18n';
import { walletPassStale } from '../lib/walletButton';
import { addFlightPassToWallet, loadWalletPassRecord } from '../lib/walletPass';

type Props = {
  flightNumber: string;
  /** Departure of the tracked (boarding) leg, compared with the pass the user added earlier. */
  departureIso?: string | null;
  originIata?: string | null;
  isPro: boolean;
  colors: { text: string; muted: string; border: string };
};

/**
 * Non-blocking line on a flight card when the Wallet pass added earlier no longer matches the flight (another date or
 * boarding airport). Tapping regenerates the pass and shows Apple's add sheet; nothing updates without that tap.
 */
export default function WalletStaleBanner({ flightNumber, departureIso, originIata, isPro, colors: c }: Props) {
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !AddPassButton) return;
    let alive = true;
    void loadWalletPassRecord(flightNumber).then(record => {
      if (alive) setStale(walletPassStale(record, departureIso, originIata));
    });
    return () => { alive = false; };
  }, [flightNumber, departureIso, originIata]);

  if (!stale) return null;

  const refresh = async () => {
    if (busy) return;
    haptics.light();
    setBusy(true);
    const result = await addFlightPassToWallet(flightNumber, { isPro, departureIso, originIata });
    setBusy(false);
    if (result === 'added') setStale(false);
  };

  return (
    <Pressable
      onPress={() => { void refresh(); }}
      style={({ pressed }) => [styles.banner, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={t().walletPassStale}
    >
      {busy ? <ActivityIndicator size="small" color={c.muted} /> : null}
      <Text style={[styles.txt, { color: c.muted }]} numberOfLines={2}>{t().walletPassStale}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  txt: { flex: 1, fontSize: 12, fontWeight: '600' },
});
