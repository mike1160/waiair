import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

export const PICKUP_CONTACT_KEY = 'waiair.pickup.contact.v1';
const SENT_KEY = 'waiair.pickup.landingMsg.sent.v1';

export type PickupContact = {
  name: string;
  phone: string;
};

function digitsOnly(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export function pickupContactReady(contact: PickupContact | null | undefined): contact is PickupContact {
  if (!contact) return false;
  return !!contact.name.trim() && digitsOnly(contact.phone).length >= 6;
}

export async function loadPickupContact(): Promise<PickupContact | null> {
  try {
    const raw = await AsyncStorage.getItem(PICKUP_CONTACT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PickupContact>;
    const name = String(parsed?.name || '').trim();
    const phone = String(parsed?.phone || '').trim();
    if (!name && !phone) return null;
    return { name, phone };
  } catch {
    return null;
  }
}

export async function savePickupContact(contact: PickupContact | null): Promise<void> {
  const name = String(contact?.name || '').trim();
  const phone = String(contact?.phone || '').trim();
  if (!name && !phone) {
    await AsyncStorage.removeItem(PICKUP_CONTACT_KEY);
    return;
  }
  await AsyncStorage.setItem(PICKUP_CONTACT_KEY, JSON.stringify({ name, phone }));
}

async function loadSentKeys(): Promise<Record<string, true>> {
  try {
    const raw = await AsyncStorage.getItem(SENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function landingMessageSent(flightKey: string): Promise<boolean> {
  if (!flightKey) return false;
  const map = await loadSentKeys();
  return !!map[flightKey];
}

export async function markLandingMessageSent(flightKey: string): Promise<void> {
  if (!flightKey) return;
  const map = await loadSentKeys();
  map[flightKey] = true;
  await AsyncStorage.setItem(SENT_KEY, JSON.stringify(map));
}

/** WhatsApp first (user tap only). SMS if WhatsApp is not installed. */
export async function openPickupLandingChat(phone: string, text: string): Promise<void> {
  const digits = digitsOnly(phone);
  const encoded = encodeURIComponent(text);
  const wa = `whatsapp://send?phone=${digits}&text=${encoded}`;
  try {
    if (await Linking.canOpenURL(wa)) {
      await Linking.openURL(wa);
      return;
    }
  } catch { /* SMS fallback */ }
  const sms = Platform.OS === 'ios'
    ? `sms:${digits}&body=${encoded}`
    : `sms:${digits}?body=${encoded}`;
  await Linking.openURL(sms);
}
