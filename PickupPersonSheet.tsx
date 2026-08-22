import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';
import {
  colorForPickupName,
  initialsForPickupName,
  loadPickupPerson,
  savePickupPerson,
  type PickupPerson,
} from './lib/pickup';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  list: string;
  border: string;
  field: string;
  fieldBorder: string;
};

export default function PickupPersonSheet({
  visible,
  flightKey,
  theme,
  onClose,
  onSaved,
}: {
  visible: boolean;
  flightKey: string;
  theme: ThemeBits;
  onClose: () => void;
  onSaved: (person: PickupPerson) => void;
}) {
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !flightKey) return;
    let cancelled = false;
    loadPickupPerson(flightKey).then(p => {
      if (cancelled) return;
      setName(p?.name || '');
      setPhotoUri(p?.photoUri);
    });
    return () => { cancelled = true; };
  }, [visible, flightKey]);

  const applyAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const uri = asset.base64
      ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
      : asset.uri;
    setPhotoUri(uri);
    haptics.light();
  };

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.55,
    base64: true,
  };

  const openLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t().photos, t().photosPermission);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled || !result.assets?.[0]) return;
      applyAsset(result.assets[0]);
    } catch {
      Alert.alert(t().photo, t().couldNotOpenPhotos);
    }
  };

  const openCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t().photo, t().cameraPermission);
        return;
      }
      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      if (result.canceled || !result.assets?.[0]) return;
      applyAsset(result.assets[0]);
    } catch {
      Alert.alert(t().photo, t().couldNotOpenCamera);
    }
  };

  const showPhotoOptions = () => {
    const copy = t();
    const buttons: { text: string; onPress?: () => void; style?: 'cancel' }[] = [];
    if (Platform.OS !== 'web') {
      buttons.push({ text: copy.takePhoto, onPress: openCamera });
    }
    buttons.push({ text: copy.chooseFromLibrary, onPress: openLibrary });
    buttons.push({ text: copy.cancel, style: 'cancel' });
    Alert.alert(copy.photo, undefined, buttons);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t().name, t().enterName);
      return;
    }
    setBusy(true);
    try {
      const person: PickupPerson = { name: trimmed, photoUri };
      await savePickupPerson(flightKey, person);
      haptics.success();
      onSaved(person);
      onClose();
    } catch {
      Alert.alert(t().save, t().couldNotSaveName);
    } finally {
      setBusy(false);
    }
  };

  const copy = t();
  const initial = initialsForPickupName(name || '?');
  const tint = colorForPickupName(name || 'pickup');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.list, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>{copy.whoPickingUp}</Text>
          <Text style={[styles.hint, { color: theme.secondary }]}>
            {copy.whoPickingUpHint}
          </Text>

          <View style={styles.avatarWrap}>
            <TouchableOpacity
              style={[styles.avatarBtn, { backgroundColor: photoUri ? '#111' : tint }]}
              onPress={showPhotoOptions}
              accessibilityRole="button"
              accessibilityLabel={copy.choosePhoto}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarLetter}>{name.trim() ? initial : '+'}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.plus} pointerEvents="none">
              <Text style={styles.plusTxt}>+</Text>
            </View>
          </View>

          <Text style={[styles.label, { color: theme.muted }]}>{copy.name}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={copy.namePlaceholder}
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, backgroundColor: theme.field, borderColor: theme.fieldBorder }]}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <TouchableOpacity
            style={[styles.save, busy && { opacity: 0.6 }]}
            onPress={save}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={copy.save}
          >
            {busy ? <ActivityIndicator color="#0F1728" /> : <Text style={styles.saveTxt}>{copy.save}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={[styles.cancel, { color: theme.muted }]}>{copy.cancel}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'ios' ? 28 : 16,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  hint: { fontSize: 13, fontWeight: '600', marginBottom: 16 },
  avatarWrap: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    marginBottom: 16,
  },
  avatarBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 84, height: 84, borderRadius: 42 },
  avatarLetter: { color: '#fff', fontSize: 32, fontWeight: '800' },
  plus: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusTxt: { color: '#0F1728', fontSize: 16, fontWeight: '800', marginTop: -1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  save: {
    backgroundColor: '#C9A84C',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveTxt: { color: '#0F1728', fontSize: 15, fontWeight: '800' },
  cancel: { textAlign: 'center', fontSize: 14, fontWeight: '700', marginTop: 12 },
});
