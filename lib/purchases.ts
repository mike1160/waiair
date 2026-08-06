import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const ENTITLEMENT_ID = 'pro';

let configured = false;

export async function initPurchases(): Promise<void> {
  if (Platform.OS === 'web' || configured) return;
  try {
    Purchases.configure({
      apiKey: Platform.OS === 'ios'
        ? 'REVENUECAT_IOS_KEY' // placeholder — user fills in later
        : 'REVENUECAT_ANDROID_KEY',
    });
    configured = true;
  } catch {
    // Expo Go / missing native module
  }
}

export async function purchasePro(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    if (!pkg) return false;
    await Purchases.purchasePackage(pkg);
    return true;
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    if (typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined') return true;
    if (info.activeSubscriptions.length > 0) return true;
    const ids = info.allPurchasedProductIdentifiers as string[] | Record<string, unknown>;
    if (Array.isArray(ids)) return ids.length > 0;
    return Object.keys(ids || {}).length > 0;
  } catch {
    return false;
  }
}

export async function checkProStatus(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
  } catch {
    return false;
  }
}
