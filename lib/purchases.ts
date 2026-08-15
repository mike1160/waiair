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
const RC_IOS_KEY = 'appl_asXZtuePMHepOMopPgPWahPnvVe';
/** Google Play key — set EXPO_PUBLIC_RC_GOOGLE_KEY when Android is live */
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_GOOGLE_KEY || '';

/** Must match the entitlement identifier in the RevenueCat dashboard */
export const PRO_ENTITLEMENT_ID = 'WaiAir Pro';

/** App Store Connect / Play Console product IDs */
export const MONTHLY_PRODUCT_ID = 'com.waiair.pro.monthly';
export const YEARLY_PRODUCT_ID = 'com.waiair.pro.yearly';
export const LIFETIME_PRODUCT_ID = 'com.waiair.pro.lifetime';

export const MONTHLY_PACKAGE_ID = '$rc_monthly';
export const YEARLY_PACKAGE_ID = '$rc_annual';
export const LIFETIME_PACKAGE_ID = '$rc_lifetime';

/** Legacy RevenueCat identifiers still accepted */
const MONTHLY_ALIASES = ['waiair_pro_monthly', 'com.waiair.pro.monthly'];
const YEARLY_ALIASES = ['waiair_pro_yearly', 'com.waiair.pro.yearly'];
const LIFETIME_ALIASES = ['waiair_pro_lifetime', 'com.waiair.pro.lifetime'];

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
    const apiKey = Platform.OS === 'android' ? RC_ANDROID_KEY : RC_IOS_KEY;
    if (!apiKey) {
      console.warn('[RevenueCat] Missing API key for', Platform.OS);
      return;
    }
    Purchases.configure({ apiKey });
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

export type ProPlanSummary = {
  isPro: boolean;
  plan: 'monthly' | 'yearly' | 'lifetime' | 'unknown';
  expirationDate: string | null;
  willRenew: boolean;
  priceLabel: string;
  renewsLabel: string;
};

function planFromProductId(id: string): ProPlanSummary['plan'] {
  const x = id.toLowerCase();
  if (x.includes('lifetime')) return 'lifetime';
  if (x.includes('yearly') || x.includes('annual')) return 'yearly';
  if (x.includes('monthly')) return 'monthly';
  return 'unknown';
}

function priceForPlan(plan: ProPlanSummary['plan']): string {
  if (plan === 'yearly') return '€19.99/year';
  if (plan === 'lifetime') return 'Lifetime';
  if (plan === 'monthly') return '€2.99/month';
  return '';
}

function formatRenewDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export async function getProPlanSummary(): Promise<ProPlanSummary> {
  const empty: ProPlanSummary = {
    isPro: false,
    plan: 'unknown',
    expirationDate: null,
    willRenew: false,
    priceLabel: '',
    renewsLabel: '',
  };
  const info = await getCustomerInfo();
  const ent = info?.entitlements.active[PRO_ENTITLEMENT_ID];
  if (!ent) return empty;
  const plan = planFromProductId(ent.productIdentifier || '');
  const expirationDate = ent.expirationDate || null;
  const willRenew = !!ent.willRenew;
  const priceLabel = priceForPlan(plan);
  const day = formatRenewDay(expirationDate);
  let renewsLabel = '';
  if (plan === 'lifetime') renewsLabel = 'Lifetime unlock';
  else if (day && willRenew) renewsLabel = `Renews ${day}${priceLabel ? ` · ${priceLabel}` : ''}`;
  else if (day) renewsLabel = `Expires ${day}${priceLabel ? ` · ${priceLabel}` : ''}`;
  else renewsLabel = priceLabel;
  return { isPro: true, plan, expirationDate, willRenew, priceLabel, renewsLabel };
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

function matchPackage(
  offering: PurchasesOffering,
  aliases: string[],
  type: PACKAGE_TYPE,
  idHint: string,
): PurchasesPackage | null {
  const pkgs = offering.availablePackages;
  const byProduct = pkgs.find((p) =>
    aliases.some((a) => p.product.identifier.toLowerCase() === a.toLowerCase()
      || p.product.identifier.toLowerCase().includes(a.toLowerCase())),
  );
  if (byProduct) return byProduct;
  const byType = pkgs.find((p) => p.packageType === type);
  if (byType) return byType;
  const byId = pkgs.find((p) =>
    p.identifier === idHint || p.identifier.toLowerCase().includes(idHint.replace('$rc_', '')),
  );
  return byId ?? null;
}

export function findMonthlyPackage(offering: PurchasesOffering): PurchasesPackage | null {
  return matchPackage(offering, MONTHLY_ALIASES, PACKAGE_TYPE.MONTHLY, MONTHLY_PACKAGE_ID);
}

export function findYearlyPackage(offering: PurchasesOffering): PurchasesPackage | null {
  return matchPackage(offering, YEARLY_ALIASES, PACKAGE_TYPE.ANNUAL, YEARLY_PACKAGE_ID);
}

export function findLifetimePackage(offering: PurchasesOffering): PurchasesPackage | null {
  return matchPackage(offering, LIFETIME_ALIASES, PACKAGE_TYPE.LIFETIME, LIFETIME_PACKAGE_ID);
}

export type ProPlan = 'monthly' | 'yearly' | 'lifetime';

export function packageForPlan(offering: PurchasesOffering, plan: ProPlan): PurchasesPackage | null {
  if (plan === 'yearly') return findYearlyPackage(offering) || findMonthlyPackage(offering);
  if (plan === 'lifetime') return findLifetimePackage(offering) || findYearlyPackage(offering);
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
      return { ok: false, message: 'No offering available. Configure com.waiair.pro.yearly in RevenueCat.' };
    }

    const pkg = findYearlyPackage(offering) || findMonthlyPackage(offering);
    if (!pkg) {
      return { ok: false, message: 'Pro package missing from current offering. Add monthly/yearly in RevenueCat.' };
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

export async function purchasePlan(plan: ProPlan): Promise<PurchaseOutcome> {
  try {
    if (await checkProStatus()) {
      const info = await getCustomerInfo();
      if (info) return { ok: true, customerInfo: info, source: 'already_pro' };
    }
    const offering = await getCurrentOffering();
    if (!offering) {
      return { ok: false, message: 'No offering available. Configure products in RevenueCat.' };
    }
    const pkg = packageForPlan(offering, plan);
    if (!pkg) {
      return { ok: false, message: `Package for ${plan} is not in the current offering.` };
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    notifyProListeners(customerInfo);
    if (!hasProEntitlement(customerInfo)) {
      return {
        ok: false,
        message: `Purchase succeeded but entitlement "${PRO_ENTITLEMENT_ID}" is not active.`,
      };
    }
    return { ok: true, customerInfo, source: 'purchase' };
  } catch (e) {
    if (isPurchasesError(e) && e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { ok: false, cancelled: true, message: 'Purchase cancelled' };
    }
    const message = isPurchasesError(e) ? e.message : 'Purchase failed';
    console.warn('[RevenueCat] purchasePlan failed', e);
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
