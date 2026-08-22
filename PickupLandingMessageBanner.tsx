import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from './constants/theme';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';
import {
  landingMessageSent,
  loadPickupContact,
  markLandingMessageSent,
  openPickupLandingChat,
  pickupContactReady,
  type PickupContact,
} from './lib/pickupContact';

export default function PickupLandingMessageBanner({
  flightKey,
  flightNumber,
  airportLabel,
  landed,
}: {
  flightKey: string;
  flightNumber: string;
  airportLabel: string;
  landed: boolean;
}) {
  const [contact, setContact] = useState<PickupContact | null>(null);
  const [sent, setSent] = useState(true);

  useEffect(() => {
    if (!landed || !flightKey) {
      setSent(true);
      return;
    }
    let cancelled = false;
    Promise.all([loadPickupContact(), landingMessageSent(flightKey)]).then(([c, already]) => {
      if (cancelled) return;
      setContact(c);
      setSent(already);
    });
    return () => { cancelled = true; };
  }, [landed, flightKey]);

  if (!landed || sent || !pickupContactReady(contact)) return null;

  const onSend = async () => {
    const body = t().landingWhatsAppBody(flightNumber, airportLabel);
    try {
      await openPickupLandingChat(contact.phone, body);
      await markLandingMessageSent(flightKey);
      setSent(true);
      haptics.success();
    } catch {
      haptics.error();
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => { void onSend(); }}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={t().sendLandingMessageTo(contact.name)}
      >
        <Text style={styles.txt}>{t().sendLandingMessageTo(contact.name)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 6, marginBottom: 4 },
  btn: {
    backgroundColor: Theme.goldLight,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  txt: { color: Theme.gold, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
