import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const RC_KEY_IOS = 'test_YpJKsknHBdVyAoBftDRVBrREIxX';
const RC_KEY_ANDROID = 'test_YpJKsknHBdVyAoBftDRVBrREIxX'; // same for now
const ENTITLEMENT_ID = 'WaiAir Pro';

let configured = false;

export async function initPurchases() {
  if (Platform.OS === 'web' || configured) return;
  try {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    Purchases.configure({
      apiKey: Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID,
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
  } catch (e) {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    if (typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined') return true;
    return Object.keys(info.allPurchasedProductIdentifiers).length > 0;
  } catch (e) {
    return false;
  }
}

export async function checkProStatus(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
  } catch (e) {
    return false;
  }
}
