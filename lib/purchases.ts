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
import RevenueCatUI from 'react-native-purchases-ui';

/** Public Apple SDK key (RevenueCat production) */
const RC_API_KEY = 'appl_asXZtuePMHepOMopPgPWahPnvVe';

/** Must match the entitlement identifier in the RevenueCat dashboard */
export const PRO_ENTITLEMENT_ID = 'WaiAir Pro';

/** Preferred package: monthly Pro (`waiair_pro_monthly`) */
export const MONTHLY_PRODUCT_ID = 'waiair_pro_monthly';
export const MONTHLY_PACKAGE_ID = '$rc_monthly';

/** @deprecated prefer MONTHLY_PRODUCT_ID */
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

/** Prefer monthly Pro package from the current offering. */
export function findMonthlyPackage(offering: PurchasesOffering): PurchasesPackage | null {
  const pkgs = offering.availablePackages;
  if (!pkgs.length) return null;

  const byProduct = pkgs.find(
    (p) =>
      p.product.identifier === MONTHLY_PRODUCT_ID ||
      p.product.identifier.toLowerCase().includes('waiair_pro_monthly'),
  );
  if (byProduct) return byProduct;

  const byType = pkgs.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);
  if (byType) return byType;

  const byId = pkgs.find(
    (p) =>
      p.identifier === MONTHLY_PACKAGE_ID ||
      p.identifier.toLowerCase().includes('monthly'),
  );
  if (byId) return byId;

  return pkgs[0] ?? null;
}

/** @deprecated use findMonthlyPackage */
export function findLifetimePackage(offering: PurchasesOffering): PurchasesPackage | null {
  return findMonthlyPackage(offering);
}

export async function purchasePro(): Promise<PurchaseOutcome> {
  try {
    if (await checkProStatus()) {
      const info = await getCustomerInfo();
      if (info) return { ok: true, customerInfo: info, source: 'already_pro' };
    }

    const offering = await getCurrentOffering();
    if (!offering) {
      return { ok: false, message: 'No offering available. Configure waiair_pro_monthly in RevenueCat.' };
    }

    const pkg = findMonthlyPackage(offering);
    if (!pkg) {
      return { ok: false, message: 'Monthly Pro package missing from current offering.' };
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
 * Check entitlement; always return `fallback` so the in-app Pro bottom sheet is shown.
 * (RevenueCat purchase/restore still runs from ProPaywallScreen.)
 */
export async function presentProPaywall(): Promise<PaywallOutcome> {
  try {
    if (await checkProStatus()) return 'unlocked';
  } catch (e) {
    console.warn('[RevenueCat] presentProPaywall status check failed', e);
  }
  return 'fallback';
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
