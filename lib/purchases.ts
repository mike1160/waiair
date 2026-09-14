import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import {
  CREDIT_PACKS,
  FREE_FLIGHT_ALLOWANCE,
  creditsForProduct,
  emptyLedger,
  freeFlightsLeft,
  markSettled,
  parseLedger,
  releaseTrack,
  reserveTrack,
  settleLocally,
  snapshotFor,
  type CreditLedger,
} from './credits';
import {
  clearCreditSession,
  deductServerCredit,
  deleteServerCreditAccount,
  fetchServerCredits,
  loadCreditSession,
  signInForCredits,
  signOutProvider,
  type CreditProvider,
  type CreditSession,
  type ServerCredits,
} from './creditAccount';

/** Public Apple SDK key (RevenueCat production) */
const RC_IOS_KEY = 'appl_asXZtuePMHepOMopPgPWahPnvVe';
/** Google Play key — set EXPO_PUBLIC_RC_GOOGLE_KEY when Android is live */
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_GOOGLE_KEY || '';

/** Must match the entitlement identifier in the RevenueCat dashboard */
export const PRO_ENTITLEMENT_ID = 'WaiAir Pro';

/** App Store Connect / Play Console subscription product IDs (live). */
export const MONTHLY_PRODUCT_ID = 'waiair_pro_monthly';
export const YEARLY_PRODUCT_ID = 'waiair_pro_yearly_sub';
/** Legacy — no longer offered in the UI; existing buyers keep Pro via the entitlement. */
export const LIFETIME_PRODUCT_ID = 'com.waiair.pro.lifetime';

export const MONTHLY_PACKAGE_ID = '$rc_monthly';
export const YEARLY_PACKAGE_ID = '$rc_annual';
export const LIFETIME_PACKAGE_ID = '$rc_lifetime';

/** Live IDs first; older identifiers still accepted when matching packages. */
const MONTHLY_ALIASES = [MONTHLY_PRODUCT_ID, 'com.waiair.pro.monthly'];
const YEARLY_ALIASES = [YEARLY_PRODUCT_ID, 'waiair_pro_yearly', 'com.waiair.pro.yearly'];
const LIFETIME_ALIASES = ['waiair_pro_lifetime', LIFETIME_PRODUCT_ID];

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
    // Signed-in credit users keep one RevenueCat customer (and credit balance) across reinstalls and devices.
    const creditSession = await loadCreditSession();
    sessionState = creditSession;
    Purchases.configure({ apiKey, appUserID: creditSession?.userId ?? null });
    configured = true;

    if (!customerInfoListenerAttached) {
      customerInfoListenerAttached = true;
      Purchases.addCustomerInfoUpdateListener((info) => {
        notifyProListeners(info);
        void refreshCredits();
      });
    }

    const info = await Purchases.getCustomerInfo();
    notifyProListeners(info);
    void refreshCredits();
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
      return { ok: false, message: `No offering available. Configure ${YEARLY_PRODUCT_ID} in RevenueCat.` };
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
    const credits = await refreshCredits();

    if (hasProEntitlement(customerInfo)) {
      return { ok: true, customerInfo, source: 'restore' };
    }
    if (credits.balance > 0) {
      return { ok: false, message: `Credits available: ${credits.balance}.` };
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

// ── Flight tracking credits (RevenueCat virtual currency via the proxy) ───────────
// Balance and free flights come from the proxy for signed-in users (Apple/Google); spending happens there too.
// AsyncStorage only caches reservations, the last server snapshot and signed-out free flights.

/** App Store Connect / Play Console consumable product IDs (units granted by RevenueCat, see credits.ts). */
export const CREDIT_PRODUCT_IDS: readonly string[] = CREDIT_PACKS.map((p) => p.productId);
/** RevenueCat offering that holds the credit packs; subscriptions stay in the current offering. */
export const CREDITS_OFFERING_ID = 'credits';
const CREDITS_LEDGER_KEY = 'waiair.credits.v2';
const SERVER_CREDITS_KEY = 'waiair.credits.server.v1';
/** A failed server charge for the same flight is retried at most this often (on later live updates). */
const SETTLE_RETRY_MS = 10 * 60 * 1000;

export type CreditState = {
  signedIn: boolean;
  provider: CreditProvider | null;
  balance: number;
  freeUsed: number;
  freeLeft: number;
};
export const EMPTY_CREDIT_STATE: CreditState = {
  signedIn: false,
  provider: null,
  balance: 0,
  freeUsed: 0,
  freeLeft: FREE_FLIGHT_ALLOWANCE,
};

type CreditListener = (state: CreditState) => void;
const creditListeners = new Set<CreditListener>();
const insufficientListeners = new Set<(flightKey: string) => void>();
const settleAttemptAt = new Map<string, number>();
let ledgerCache: CreditLedger | null = null;
let serverCache: ServerCredits | null | undefined;
let sessionState: CreditSession | null | undefined;
let creditQueue: Promise<unknown> = Promise.resolve();

/** Credit operations run one at a time (reserve / settle / refresh / sign-in can overlap). */
function serializeCredits<T>(fn: () => Promise<T>): Promise<T> {
  const run = creditQueue.then(fn);
  creditQueue = run.catch(() => {});
  return run;
}

async function readLedger(): Promise<CreditLedger> {
  if (ledgerCache) return ledgerCache;
  try {
    ledgerCache = parseLedger(await AsyncStorage.getItem(CREDITS_LEDGER_KEY));
  } catch {
    ledgerCache = emptyLedger();
  }
  return ledgerCache;
}

async function writeLedger(next: CreditLedger): Promise<void> {
  if (next === ledgerCache) return;
  ledgerCache = next;
  try {
    await AsyncStorage.setItem(CREDITS_LEDGER_KEY, JSON.stringify(next));
  } catch { /* cache only */ }
}

async function readSession(): Promise<CreditSession | null> {
  if (sessionState === undefined) sessionState = await loadCreditSession();
  return sessionState;
}

async function readServerCache(): Promise<ServerCredits | null> {
  if (serverCache !== undefined) return serverCache;
  try {
    const raw = await AsyncStorage.getItem(SERVER_CREDITS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    serverCache = parsed && typeof parsed.balance === 'number' && typeof parsed.freeUsed === 'number' ? parsed : null;
  } catch {
    serverCache = null;
  }
  return serverCache ?? null;
}

async function writeServerCache(next: ServerCredits | null): Promise<void> {
  serverCache = next;
  try {
    if (next) await AsyncStorage.setItem(SERVER_CREDITS_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(SERVER_CREDITS_KEY);
  } catch { /* cache only */ }
}

async function currentCreditState(): Promise<CreditState> {
  const [ledger, session, server] = await Promise.all([readLedger(), readSession(), readServerCache()]);
  const snap = snapshotFor(ledger, server, !!session);
  return {
    signedIn: snap.signedIn,
    provider: session?.provider ?? null,
    balance: snap.balance,
    freeUsed: snap.freeUsed,
    freeLeft: freeFlightsLeft(ledger, snap),
  };
}

async function notifyCredits(): Promise<CreditState> {
  const state = await currentCreditState();
  creditListeners.forEach((cb) => {
    try { cb(state); } catch { /* ignore listener errors */ }
  });
  return state;
}

/** Pull the signed-in user's balance (RevenueCat) and free flights (proxy); keeps the cache when offline. */
async function pullServerCredits(): Promise<void> {
  const session = await readSession();
  if (!session) return;
  try {
    await writeServerCache(await fetchServerCredits(session));
  } catch {
    // A 401/403 cleared the stored session — reflect that; otherwise keep the last snapshot.
    sessionState = await loadCreditSession();
    if (!sessionState) await writeServerCache(null);
  }
}

export function subscribeCredits(listener: CreditListener): () => void {
  creditListeners.add(listener);
  return () => { creditListeners.delete(listener); };
}

/** A tracked flight's charge was refused for lack of credits (show the paywall). */
export function subscribeInsufficientCredits(listener: (flightKey: string) => void): () => void {
  insufficientListeners.add(listener);
  return () => { insufficientListeners.delete(listener); };
}

export function getCreditState(): Promise<CreditState> {
  return currentCreditState();
}

export async function getCreditsBalance(): Promise<number> {
  return (await currentCreditState()).balance;
}

export function refreshCredits(): Promise<CreditState> {
  return serializeCredits(async () => {
    await pullServerCredits();
    return notifyCredits();
  });
}

/** Sign in with Apple / Google / LINE; the RevenueCat customer becomes the stable provider-based app_user_id. */
export function signInForCreditsWith(provider: CreditProvider): Promise<CreditState | null> {
  return serializeCredits(async () => {
    const ledger = await readLedger();
    const session = await signInForCredits(provider, ledger.freeUsed);
    if (!session) return null;
    sessionState = session;
    try {
      const { customerInfo } = await Purchases.logIn(session.userId);
      notifyProListeners(customerInfo);
    } catch (e) {
      console.warn('[RevenueCat] logIn failed', e);
    }
    await pullServerCredits();
    return notifyCredits();
  });
}

async function forgetCreditAccount(provider: CreditProvider | null): Promise<void> {
  sessionState = null;
  await clearCreditSession();
  await writeServerCache(null);
  await signOutProvider(provider);
  try {
    notifyProListeners(await Purchases.logOut());
  } catch { /* already anonymous */ }
}

export function signOutCredits(): Promise<CreditState> {
  return serializeCredits(async () => {
    const session = await readSession();
    await forgetCreditAccount(session?.provider ?? null);
    return notifyCredits();
  });
}

/** In-app account deletion: removes the proxy's credit data, then signs out. */
export function deleteCreditsAccount(): Promise<boolean> {
  return serializeCredits(async () => {
    const session = await readSession();
    if (!session) return true;
    const ok = await deleteServerCreditAccount(session).catch(() => false);
    if (ok) await forgetCreditAccount(session.provider);
    await notifyCredits();
    return ok;
  });
}

export type CreditPack = {
  productId: string;
  credits: number;
  priceString: string;
  pkg: PurchasesPackage | null;
  product: PurchasesStoreProduct | null;
};

/** Credit packs with store prices: the "credits" offering first, direct product lookup as fallback. */
export async function getCreditPacks(): Promise<CreditPack[]> {
  let packages: PurchasesPackage[] = [];
  try {
    const offerings = await Purchases.getOfferings();
    packages = offerings.all[CREDITS_OFFERING_ID]?.availablePackages ?? [];
  } catch (e) {
    console.warn('[RevenueCat] credits offering failed', e);
  }
  let products: PurchasesStoreProduct[] = [];
  const missing = CREDIT_PRODUCT_IDS.filter((id) => !packages.some((p) => p.product.identifier === id));
  if (missing.length) {
    try {
      products = await Purchases.getProducts([...missing], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    } catch (e) {
      console.warn('[RevenueCat] credit products failed', e);
    }
  }
  return CREDIT_PACKS.map((p) => {
    const pkg = packages.find((x) => x.product.identifier === p.productId) ?? null;
    const product = pkg?.product ?? products.find((x) => x.identifier === p.productId) ?? null;
    return {
      productId: p.productId,
      credits: p.credits,
      priceString: product?.priceString || p.fallbackPrice,
      pkg,
      product,
    };
  });
}

export type CreditPurchaseOutcome =
  | { ok: true; added: number; balance: number }
  | { ok: false; cancelled?: boolean; needsSignIn?: boolean; message: string };

/** Buy a credit pack. Requires sign-in so RevenueCat grants the credits to the stable customer. */
export async function purchaseCredits(productId: string): Promise<CreditPurchaseOutcome> {
  const credits = creditsForProduct(productId);
  if (!credits) return { ok: false, message: `Unknown credit product ${productId}` };
  if (!(await readSession())) return { ok: false, needsSignIn: true, message: 'Sign in to buy credits' };
  try {
    const before = (await readServerCache())?.balance ?? 0;
    const pack = (await getCreditPacks()).find((p) => p.productId === productId);
    let customerInfo: CustomerInfo;
    if (pack?.pkg) {
      ({ customerInfo } = await Purchases.purchasePackage(pack.pkg));
    } else if (pack?.product) {
      ({ customerInfo } = await Purchases.purchaseStoreProduct(pack.product));
    } else {
      return { ok: false, message: `${productId} is not available. Check the product in RevenueCat.` };
    }
    notifyProListeners(customerInfo);
    // RevenueCat grants the units server-side; give it a moment if the balance hasn't moved yet.
    let state = await refreshCredits();
    if (state.balance < before + credits) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      state = await refreshCredits();
    }
    return { ok: true, added: credits, balance: state.balance };
  } catch (e) {
    if (isPurchasesError(e) && e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { ok: false, cancelled: true, message: 'Purchase cancelled' };
    }
    const message = isPurchasesError(e) ? e.message : 'Purchase failed';
    console.warn('[RevenueCat] purchaseCredits failed', e);
    return { ok: false, message };
  }
}

/**
 * Before tracking a new flight. Pro: always allowed, nothing reserved.
 * Otherwise reserves one of the 3 lifetime free flights, else a credit (signed in); false → show the paywall.
 */
export function reserveTrackCredit(flightKey: string, isPro: boolean): Promise<boolean> {
  return serializeCredits(async () => {
    const [ledger, session, server] = await Promise.all([readLedger(), readSession(), readServerCache()]);
    const { ledger: next, allowed } = reserveTrack(ledger, snapshotFor(ledger, server, !!session), flightKey, isPro);
    if (next !== ledger) {
      await writeLedger(next);
      await notifyCredits();
    }
    return allowed;
  });
}

/** Flight untracked before its first live update — the reservation is returned. */
export function releaseTrackCredit(flightKey: string): Promise<void> {
  return serializeCredits(async () => {
    const ledger = await readLedger();
    const next = releaseTrack(ledger, flightKey);
    if (next !== ledger) {
      await writeLedger(next);
      await notifyCredits();
    }
  });
}

/**
 * First successful live status update of a tracked flight: charge it once.
 * Signed in → the proxy spends a free flight or 1 credit (RevenueCat); signed out → a free flight on the device.
 */
export function useCredit(flightKey: string, isPro: boolean): Promise<void> {
  // Called on every live poll — skip when there is nothing left to charge or a retry is not due yet.
  const cached = ledgerCache?.charges[flightKey];
  if (ledgerCache && (!cached || cached.settled)) return Promise.resolve();
  if (Date.now() - (settleAttemptAt.get(flightKey) || 0) < SETTLE_RETRY_MS) return Promise.resolve();
  settleAttemptAt.set(flightKey, Date.now());

  return serializeCredits(async () => {
    const ledger = await readLedger();
    const charge = ledger.charges[flightKey];
    if (!charge || charge.settled) return;

    const session = await readSession();
    if (isPro || !session) {
      await writeLedger(settleLocally(ledger, flightKey, isPro));
      settleAttemptAt.delete(flightKey);
      await notifyCredits();
      return;
    }

    try {
      const result = await deductServerCredit(session, flightKey);
      if (result.credits) await writeServerCache(result.credits);
      if (result.ok) {
        await writeLedger(markSettled(ledger, flightKey, result.kind));
        settleAttemptAt.delete(flightKey);
      } else if (result.insufficient) {
        insufficientListeners.forEach((cb) => {
          try { cb(flightKey); } catch { /* ignore listener errors */ }
        });
      }
    } catch { /* offline — retried on a later live update */ }
    await notifyCredits();
  });
}
