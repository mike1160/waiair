import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AirplaneTakeoff, X } from 'phosphor-react-native';
import { bookDuffelFlight, type DuffelOffer } from './lib/duffel';

const NAVY = '#1A2F5A';
const GOLD = '#C9A84C';

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type PassengerForm = {
  given_name: string;
  family_name: string;
  born_on: string;
  email: string;
  phone_number: string;
};

const EMPTY_FORM: PassengerForm = {
  given_name: '',
  family_name: '',
  born_on: '',
  email: '',
  phone_number: '',
};

export default function DuffelOffersSheet({
  visible,
  offers,
  origin,
  destination,
  onClose,
}: {
  visible: boolean;
  offers: DuffelOffer[];
  origin: string;
  destination: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<DuffelOffer | null>(null);
  const [form, setForm] = useState<PassengerForm>(EMPTY_FORM);
  const [booking, setBooking] = useState(false);

  const reset = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setBooking(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleBook = async () => {
    if (booking || !selected) return;
    if (!form.given_name || !form.family_name || !form.born_on || !form.email) {
      Alert.alert('Vul alle verplichte velden in');
      return;
    }
    setBooking(true);
    try {
      await bookDuffelFlight(selected.id, [
        {
          type: 'adult',
          title: 'mr',
          gender: 'm',
          given_name: form.given_name,
          family_name: form.family_name,
          born_on: form.born_on,
          email: form.email,
          phone_number: form.phone_number || '+31600000000',
        },
      ]);
      Alert.alert(
        'Boeking bevestigd!',
        `Je vlucht ${origin} → ${destination} met ${selected.owner.name} is geboekt.`,
        [{ text: 'OK', onPress: handleClose }],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Boeking mislukt', msg);
    } finally {
      setBooking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {origin} → {destination}
            </Text>
            <TouchableOpacity onPress={handleClose} accessibilityLabel="Sluiten">
              <X size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {selected == null ? (
            <ScrollView contentContainerStyle={styles.listContent}>
              {offers.length === 0 ? (
                <View style={styles.emptyState}>
                  <AirplaneTakeoff size={40} color={GOLD} />
                  <Text style={styles.emptyTitle}>Geen vluchten gevonden</Text>
                  <Text style={styles.emptyBody}>
                    Duffel heeft geen beschikbare vluchten gevonden voor{'\n'}
                    {origin} → {destination}.{'\n'}Probeer een andere datum.
                  </Text>
                  <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                    <Text style={styles.closeBtnText}>Sluiten</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    {offers.length} {offers.length === 1 ? 'vlucht' : 'vluchten'} gevonden
                  </Text>
                  {offers.map((offer) => {
                    const seg = offer.slices[0]?.segments[0];
                    return (
                      <TouchableOpacity
                        key={offer.id}
                        style={styles.offerCard}
                        onPress={() => setSelected(offer)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.offerRow}>
                          <Text style={styles.airline}>{offer.owner.name}</Text>
                          <Text style={styles.price}>
                            {offer.total_currency} {parseFloat(offer.total_amount).toFixed(0)}
                          </Text>
                        </View>
                        {seg ? (
                          <View style={styles.offerRow}>
                            <Text style={styles.times}>
                              {fmtTime(seg.departing_at)} → {fmtTime(seg.arriving_at)}
                            </Text>
                            <Text style={styles.route}>
                              {seg.origin} → {seg.destination}
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.selectRow}>
                          <AirplaneTakeoff size={13} color={GOLD} />
                          <Text style={styles.selectText}>Selecteer</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent}>
              <TouchableOpacity onPress={reset} style={styles.backBtn}>
                <Text style={styles.backText}>← Terug naar aanbiedingen</Text>
              </TouchableOpacity>
              <Text style={styles.subtitle}>
                {selected.owner.name} · {selected.total_currency}{' '}
                {parseFloat(selected.total_amount).toFixed(0)}
              </Text>

              <Text style={styles.label}>Voornaam *</Text>
              <TextInput
                style={styles.input}
                value={form.given_name}
                onChangeText={(v) => setForm((f) => ({ ...f, given_name: v }))}
                placeholder="Voornaam"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Achternaam *</Text>
              <TextInput
                style={styles.input}
                value={form.family_name}
                onChangeText={(v) => setForm((f) => ({ ...f, family_name: v }))}
                placeholder="Achternaam"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Geboortedatum * (JJJJ-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={form.born_on}
                onChangeText={(v) => setForm((f) => ({ ...f, born_on: v }))}
                placeholder="1990-01-01"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />

              <Text style={styles.label}>E-mailadres *</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="naam@voorbeeld.nl"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Telefoonnummer</Text>
              <TextInput
                style={styles.input}
                value={form.phone_number}
                onChangeText={(v) => setForm((f) => ({ ...f, phone_number: v }))}
                placeholder="+31612345678"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.bookBtn, booking && styles.bookBtnBusy]}
                onPress={() => { void handleBook(); }}
                disabled={booking}
              >
                {booking ? (
                  <ActivityIndicator color={NAVY} />
                ) : (
                  <Text style={styles.bookBtnText}>Bevestig boeking</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: GOLD + '44',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  listContent: { paddingBottom: 20 },
  subtitle: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  offerCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: GOLD + '33',
  },
  offerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  airline: { color: '#fff', fontSize: 15, fontWeight: '700' },
  price: { color: GOLD, fontSize: 16, fontWeight: '800' },
  times: { color: '#ccc', fontSize: 13 },
  route: { color: '#aaa', fontSize: 13 },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  selectText: { color: GOLD, fontSize: 13, fontWeight: '700' },
  backBtn: { padding: 16, paddingBottom: 4 },
  backText: { color: GOLD, fontSize: 14, fontWeight: '600' },
  label: {
    color: '#bbb',
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 15,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  bookBtn: {
    margin: 16,
    marginTop: 24,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  bookBtnBusy: { opacity: 0.7 },
  bookBtnText: { color: NAVY, fontSize: 16, fontWeight: '800' },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 20,
    gap: 12,
  },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: '#aaa', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  closeBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 28,
  },
  closeBtnText: { color: GOLD, fontSize: 15, fontWeight: '700' },
});
