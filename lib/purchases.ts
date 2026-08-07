import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

/** Public SDK key (test) — replace with production keys before store release */
const RC_API_KEY = 'test_YpJKsknHBdVyAoBftDRVBrREIxX';

/** Must match the entitlement identifier in the RevenueCat dashboard */
export const PRO_ENTITLEMENT_ID = 'WaiAir Pro';

/** Preferred package: Lifetime ($rc_lifetime / PACKAGE_TYPE.LIFETIME) */
export const LIFETIME_PACKAGE_ID = '$rc_lifetime';

export type PurchaseOutcome =
  | { ok: true; customerInfo: CustomerInfo; source: 'purchase' | 'restore' | 'already_pro' }
  | { ok: false; cancelled?: boolean; message: string };

export type PaywallOutcome = 'unlocked' | 'dismissed' | 'fallback' | 'error';

type ProListener = (isPro: boolean, info: CustomerInfo | null) => void;

let configured = false;
let customerInfoListenerAttached = false;
const proListeners = new Set<ProListener>();

function isPurchasesError(e: unknown): e is PurchasesError {
  return !!e && typeof e === 'object' && 'code' in e;
}

export function hasProEntitlement(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  return typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
}

function notifyProListeners(info: CustomerInfo | null) {
  const isPro = hasProEntitlement(info);
  proListeners.forEach((cb) => {
    try { cb(isPro, info); } catch { /* ignore listener errors */ }
  });
}

/** Subscribe to Pro entitlement changes (CustomerInfo updates). */
export function subscribeProStatus(listener: ProListener): () => void {
  proListeners.add(listener);
  return () => { proListeners.delete(listener); };
}

export async function initPurchases(): Promise<void> {
  if (Platform.OS === 'web' || configured) return;

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO);
    Purchases.configure({ apiKey: RC_API_KEY });
    configured = true;

    if (!customerInfoListenerAttached) {
      customerInfoListenerAttached = true;
      Purchases.addCustomerInfoUpdateListener((info) => {
        notifyProListeners(info);
      });
    }

    const info = await Purchases.getCustomerInfo();
    notifyProListeners(info);
  } catch (e) {
    console.warn('[RevenueCat] init failed', e);
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('[RevenueCat] getCustomerInfo failed', e);
    return null;
  }
}

export async function checkProStatus(): Promise<boolean> {
  const info = await getCustomerInfo();
  return hasProEntitlement(info);
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.warn('[RevenueCat] getOfferings failed', e);
    return null;
  }
}

/** Prefer Lifetime package from the current offering. */
export function findLifetimePackage(offering: PurchasesOffering): PurchasesPackage | null {
  const pkgs = offering.availablePackages;
  if (!pkgs.length) return null;

  const byType = pkgs.find((p) => p.packageType === PACKAGE_TYPE.LIFETIME);
  if (byType) return byType;

  const byId = pkgs.find(
    (p) =>
      p.identifier === LIFETIME_PACKAGE_ID ||
      p.identifier.toLowerCase().includes('lifetime') ||
      p.product.identifier.toLowerCase().includes('lifetime'),
  );
  if (byId) return byId;

  return pkgs[0] ?? null;
}

export async function purchasePro(): Promise<PurchaseOutcome> {
  try {
    if (await checkProStatus()) {
      const info = await getCustomerInfo();
      if (info) return { ok: true, customerInfo: info, source: 'already_pro' };
    }

    const offering = await getCurrentOffering();
    if (!offering) {
      return { ok: false, message: 'No offering available. Configure Lifetime in RevenueCat.' };
    }

    const pkg = findLifetimePackage(offering);
    if (!pkg) {
      return { ok: false, message: 'Lifetime package missing from current offering.' };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    notifyProListeners(customerInfo);

    if (!hasProEntitlement(customerInfo)) {
      return {
        ok: false,
        message: `Purchase succeeded but entitlement "${PRO_ENTITLEMENT_ID}" is not active. Check dashboard linking.`,
      };
    }

    return { ok: true, customerInfo, source: 'purchase' };
  } catch (e) {
    if (isPurchasesError(e) && e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { ok: false, cancelled: true, message: 'Purchase cancelled' };
    }
    const message = isPurchasesError(e) ? e.message : 'Purchase failed';
    console.warn('[RevenueCat] purchasePro failed', e);
    return { ok: false, message };
  }
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    notifyProListeners(customerInfo);

    if (hasProEntitlement(customerInfo)) {
      return { ok: true, customerInfo, source: 'restore' };
    }

    const ids = customerInfo.allPurchasedProductIdentifiers;
    const hasAny = Array.isArray(ids)
      ? ids.length > 0
      : Object.keys(ids || {}).length > 0;

    if (hasAny) {
      return {
        ok: false,
        message: `Purchases found, but entitlement "${PRO_ENTITLEMENT_ID}" is not active.`,
      };
    }

    return { ok: false, message: 'No previous purchases found' };
  } catch (e) {
    const message = isPurchasesError(e) ? e.message : 'Restore failed';
    console.warn('[RevenueCat] restorePurchases failed', e);
    return { ok: false, message };
  }
}

/**
 * Present RevenueCat remote Paywall (dashboard-designed).
 * Falls back to custom in-app paywall when RC UI / offering paywall is unavailable.
 */
export async function presentProPaywall(): Promise<PaywallOutcome> {
  if (Platform.OS === 'web') return 'fallback';

  try {
    if (await checkProStatus()) return 'unlocked';

    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
      displayCloseButton: true,
    });

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED: {
        const info = await getCustomerInfo();
        notifyProListeners(info);
        return hasProEntitlement(info) ? 'unlocked' : 'error';
      }
      case PAYWALL_RESULT.NOT_PRESENTED: {
        // Already entitled, or no native paywall configured → try custom fallback
        if (await checkProStatus()) return 'unlocked';
        return 'fallback';
      }
      case PAYWALL_RESULT.CANCELLED:
        return 'dismissed';
      case PAYWALL_RESULT.ERROR:
      default:
        return 'fallback';
    }
  } catch (e) {
    console.warn('[RevenueCat] presentPaywall failed — using fallback UI', e);
    return 'fallback';
  }
}

/** Customer Center — manage / restore / refunds (Pro users). */
export async function presentCustomerCenter(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo }) => {
          notifyProListeners(customerInfo);
        },
        onRestoreFailed: ({ error }) => {
          console.warn('[RevenueCat] Customer Center restore failed', error);
        },
      },
    });
    // Refresh after dismiss
    const info = await getCustomerInfo();
    notifyProListeners(info);
  } catch (e) {
    console.warn('[RevenueCat] presentCustomerCenter failed', e);
    throw e;
  }
}
