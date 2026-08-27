import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { hotelCityName } from '../../lib/hotels';
import { saveImageToPhotos } from '../../lib/saveImage';
import { PET_STRINGS } from '../../lib/pet/petStrings';

interface Props {
  destIata?: string;
  destCity?: string;
}

type PetContact = {
  iata: string;
  city: string;
  name: string;
  phone: string;
  phoneLabel: string;
};

const PET_CONTACTS: PetContact[] = [
  { iata: 'BKK', city: 'Bangkok', name: 'DLD', phone: '+6626534444', phoneLabel: '+66-2-653-4444' },
  { iata: 'AMS', city: 'Amsterdam', name: 'Schiphol Animal Hotel', phone: '+31206012211', phoneLabel: '+31-20-601-2211' },
  { iata: 'LHR', city: 'London', name: 'DEFRA', phone: '+443702411710', phoneLabel: '+44-370-241-1710' },
  { iata: 'CDG', city: 'Paris', name: 'SIVEP Roissy', phone: '+33148626286', phoneLabel: '+33-1-48-62-62-86' },
  { iata: 'JFK', city: 'New York', name: 'USDA APHIS', phone: '+18777413690', phoneLabel: '+1-877-741-3690' },
  { iata: 'SIN', city: 'Singapore', name: 'NParks AVS', phone: '+6518004761600', phoneLabel: '+65-1800-476-1600' },
  { iata: 'DXB', city: 'Dubai', name: 'Dubai Municipality Veterinary', phone: '+971800900', phoneLabel: '+971-800-900' },
  { iata: 'FRA', city: 'Frankfurt', name: 'Veterinary Border Control', phone: '+496969070500', phoneLabel: '+49-69-690-70500' },
  { iata: 'HKG', city: 'Hong Kong', name: 'AFCD', phone: '+8521823', phoneLabel: '+852-1823' },
  { iata: 'SYD', city: 'Sydney', name: 'DAFF Biosecurity', phone: '+611800900090', phoneLabel: '+61-1800-900-090' },
];

function petHotelUrl(city: string): string {
  const ss = encodeURIComponent(city);
  return `https://www.booking.com/searchresults.html?ss=${ss}&nflt=hotelfacility%3D4&pets=1`;
}

function mapsDirectionsUrl(destIata: string, destCity: string): string {
  const q = [destCity, destIata, 'Airport'].filter(Boolean).join(' ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

export function PetNextSteps({ destIata = '', destCity = '' }: Props) {
  const city = hotelCityName(destIata, destCity) || destIata || 'destination';
  const code = String(destIata || '').toUpperCase();

  const [docsOpen, setDocsOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  const contacts = useMemo(() => {
    const match = PET_CONTACTS.filter(c => c.iata === code);
    const rest = PET_CONTACTS.filter(c => c.iata !== code);
    return [...match, ...rest];
  }, [code]);

  const openHotel = () => {
    Linking.openURL(petHotelUrl(city)).catch(() => {});
  };

  const openTransfer = () => {
    Linking.openURL(mapsDirectionsUrl(code, city)).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{PET_STRINGS.nextStepsTitle}</Text>

      <ActionRow emoji="🏨" label={PET_STRINGS.actionHotel} onPress={openHotel} />
      <ActionRow emoji="🚗" label={PET_STRINGS.actionTransfer} onPress={openTransfer} />
      <ActionRow emoji="📄" label={PET_STRINGS.actionDocuments} onPress={() => setDocsOpen(true)} />
      <ActionRow emoji="📸" label={PET_STRINGS.actionScan} onPress={() => setCameraOpen(true)} />
      <ActionRow
        emoji="📞"
        label={PET_STRINGS.actionContacts}
        onPress={() => setContactsOpen(open => !open)}
      />

      {contactsOpen ? (
        <View style={styles.contactsBox}>
          <Text style={styles.contactsHint}>
            {contacts[0]?.iata === code
              ? PET_STRINGS.contactsHint
              : PET_STRINGS.contactsNoMatch}
          </Text>
          {contacts.map(c => (
            <GHTouchableOpacity
              key={c.iata}
              style={[styles.contactRow, c.iata === code && styles.contactRowActive]}
              onPress={() => Linking.openURL(`tel:${c.phone}`).catch(() => {})}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} ${c.phoneLabel}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.contactIata}>{c.iata} · {c.city}</Text>
                <Text style={styles.contactName}>{c.name}</Text>
              </View>
              <Text style={styles.contactPhone}>{c.phoneLabel}</Text>
            </GHTouchableOpacity>
          ))}
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{PET_STRINGS.hotelsSection}</Text>
      <ActionRow
        emoji="🐶"
        label={PET_STRINGS.hotelsBringFido}
        onPress={() => Linking.openURL(`https://www.bringfido.com/lodging/?destination=${encodeURIComponent(city)}`).catch(() => {})}
      />
      <ActionRow
        emoji="🐾"
        label={PET_STRINGS.hotelsPetsWelcome}
        onPress={() => Linking.openURL(`https://www.petswelcome.com/search?location=${encodeURIComponent(city)}`).catch(() => {})}
      />

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{PET_STRINGS.relocationSection}</Text>
      <ActionRow
        emoji="🌐"
        label={PET_STRINGS.relocationIpata}
        onPress={() => Linking.openURL('https://www.ipata.org/').catch(() => {})}
      />
      <ActionRow
        emoji="✈️"
        label={PET_STRINGS.relocationPetAir}
        onPress={() => Linking.openURL('https://www.petairuk.com/').catch(() => {})}
      />
      <ActionRow
        emoji="✈️"
        label={PET_STRINGS.relocationAnimalsAway}
        onPress={() => Linking.openURL('https://www.animalsaway.com/').catch(() => {})}
      />
      <ActionRow
        emoji="✈️"
        label={PET_STRINGS.relocationHappyTails}
        onPress={() => Linking.openURL('https://www.happytailstravel.com/').catch(() => {})}
      />

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{PET_STRINGS.insuranceSection}</Text>
      <ActionRow
        emoji="🛡️"
        label={PET_STRINGS.insurancePetplan}
        onPress={() => Linking.openURL('https://www.petplan.co.uk/').catch(() => {})}
      />

      <Modal visible={docsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDocsOpen(false)}>
        <View style={styles.modalRoot}>
          <Text style={styles.modalEmoji}>📄</Text>
          <Text style={styles.modalTitle}>{PET_STRINGS.documentsSoon}</Text>
          <Text style={styles.modalHint}>{PET_STRINGS.documentsSoonHint}</Text>
          <TouchableOpacity style={styles.modalClose} onPress={() => setDocsOpen(false)}>
            <Text style={styles.modalCloseTxt}>{PET_STRINGS.close}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <ScanDocumentModal visible={cameraOpen} onClose={() => setCameraOpen(false)} />
    </View>
  );
}

function ActionRow({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <GHTouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowChevron}>›</Text>
    </GHTouchableOpacity>
  );
}

function ScanDocumentModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setReady(false);
      setBusy(false);
    }
  }, [visible]);

  const capture = async () => {
    if (busy || !ready) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (!photo?.uri) {
        Alert.alert(PET_STRINGS.actionScan, PET_STRINGS.photoSaveFailed);
        return;
      }
      const ok = await saveImageToPhotos(photo.uri);
      Alert.alert(
        PET_STRINGS.actionScan,
        ok ? PET_STRINGS.photoSaved : PET_STRINGS.photoSaveFailed,
      );
      if (ok) onClose();
    } catch {
      Alert.alert(PET_STRINGS.actionScan, PET_STRINGS.photoSaveFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.camRoot}>
        <TouchableOpacity style={styles.camClose} onPress={onClose} accessibilityRole="button" accessibilityLabel={PET_STRINGS.close}>
          <Text style={styles.camCloseTxt}>{PET_STRINGS.close}</Text>
        </TouchableOpacity>

        {Platform.OS === 'web' ? (
          <View style={styles.camCenter}>
            <Text style={styles.camHint}>{PET_STRINGS.cameraInApps}</Text>
          </View>
        ) : !permission?.granted ? (
          <View style={styles.camCenter}>
            <Text style={styles.camHint}>{PET_STRINGS.cameraNeedPermission}</Text>
            <TouchableOpacity style={styles.captureBtn} onPress={() => requestPermission()}>
              <Text style={styles.captureTxt}>{PET_STRINGS.allowCamera}</Text>
            </TouchableOpacity>
          </View>
        ) : visible ? (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              onCameraReady={() => setReady(true)}
            />
            <View style={styles.camBottom} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.captureBtn, (!ready || busy) && { opacity: 0.5 }]}
                onPress={capture}
                disabled={!ready || busy}
              >
                <Text style={styles.captureTxt}>{PET_STRINGS.capturePhoto}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rowEmoji: { fontSize: 20, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#166534' },
  rowChevron: { fontSize: 22, color: '#059669', fontWeight: '300' },
  contactsBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 10,
    marginBottom: 8,
  },
  contactsHint: { fontSize: 12, color: '#166534', marginBottom: 8, lineHeight: 18 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  contactRowActive: {
    borderWidth: 1,
    borderColor: '#059669',
    backgroundColor: '#dcfce7',
  },
  contactIata: { fontSize: 13, fontWeight: '700', color: '#166534' },
  contactName: { fontSize: 12, color: '#047857', marginTop: 2 },
  contactPhone: { fontSize: 13, fontWeight: '600', color: '#059669' },
  modalRoot: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmoji: { fontSize: 40, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#166534', textAlign: 'center', marginBottom: 10 },
  modalHint: { fontSize: 14, color: '#047857', textAlign: 'center', lineHeight: 22 },
  modalClose: {
    marginTop: 28,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  modalCloseTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  camRoot: { flex: 1, backgroundColor: '#052e16' },
  camClose: { position: 'absolute', top: 56, left: 16, zIndex: 2, padding: 8 },
  camCloseTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
  camCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  camHint: { color: '#d1fae5', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  camBottom: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' },
  captureBtn: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  captureTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
