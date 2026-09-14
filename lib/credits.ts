/**
 * Flight tracking credits. Pro is unlimited; everyone else gets 3 free flights ever, then 1 credit per flight.
 * A flight is reserved when tracked and charged on its first successful live status update.
 * Signed in, the balance (RevenueCat virtual currency) and free flights are server truth via the proxy;
 * the device keeps reservations and — while signed out — its own free-flight count.
 * Pure — storage, sign-in and network live in purchases.ts / creditAccount.ts.
 */

export const FREE_FLIGHT_ALLOWANCE = 3;

/** Consumables in App Store Connect / Play Console / RevenueCat (units granted by RevenueCat on purchase). */
export const CREDIT_PACKS = [
  { productId: 'com.waiair.credits.5', credits: 5, fallbackPrice: '€1.99' },
  { productId: 'com.waiair.credits.15', credits: 15, fallbackPrice: '€4.99' },
  { productId: 'com.waiair.credits.50', credits: 50, fallbackPrice: '€12.99' },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Settled charges are remembered so re-tracking the same flight doesn't ask the proxy again. */
const SETTLED_CHARGE_TTL_MS = 30 * DAY_MS;
/** A reservation that never got a live update stops blocking a free slot / credit. */
const PENDING_CHARGE_TTL_MS = 14 * DAY_MS;

export type ChargeKind = 'free' | 'credit';
export type TrackCharge = { kind: ChargeKind; settled: boolean; at: number };

/** Device cache. */
export type CreditLedger = {
  /** Free flights spent on this device while signed out. */
  freeUsed: number;
  /** Per tracked-flight key: what pays for it and whether it has been charged yet. */
  charges: Record<string, TrackCharge>;
};

/** What reservations are checked against: server truth when signed in, the device count otherwise. */
export type CreditSnapshot = { signedIn: boolean; balance: number; freeUsed: number };

export function emptyLedger(): CreditLedger {
  return { freeUsed: 0, charges: {} };
}

export function creditsForProduct(productId: string): number {
  return CREDIT_PACKS.find((p) => p.productId === productId)?.credits ?? 0;
}

export function snapshotFor(
  ledger: CreditLedger,
  server: { balance: number; freeUsed: number } | null,
  signedIn: boolean,
): CreditSnapshot {
  if (!signedIn) return { signedIn: false, balance: 0, freeUsed: ledger.freeUsed };
  return { signedIn: true, balance: server?.balance ?? 0, freeUsed: server?.freeUsed ?? ledger.freeUsed };
}

function pendingCount(ledger: CreditLedger, kind: ChargeKind): number {
  return Object.values(ledger.charges).filter((c) => c.kind === kind && !c.settled).length;
}

export function freeFlightsLeft(ledger: CreditLedger, snap: CreditSnapshot): number {
  return Math.max(0, FREE_FLIGHT_ALLOWANCE - snap.freeUsed - pendingCount(ledger, 'free'));
}

/** Credits can only be spent signed in (the proxy deducts them). */
function spendableCredits(ledger: CreditLedger, snap: CreditSnapshot): number {
  return snap.signedIn ? Math.max(0, snap.balance - pendingCount(ledger, 'credit')) : 0;
}

function withCharge(ledger: CreditLedger, key: string, charge: TrackCharge): CreditLedger {
  return { ...ledger, charges: { ...ledger.charges, [key]: charge } };
}

/**
 * Before tracking a flight. Pro, or a flight that already has a charge (re-track), is always allowed.
 * Otherwise reserve a free slot, else a credit; `allowed: false` means show the paywall.
 */
export function reserveTrack(
  ledger: CreditLedger,
  snap: CreditSnapshot,
  key: string,
  isPro: boolean,
  now = Date.now(),
): { ledger: CreditLedger; allowed: boolean } {
  if (isPro || ledger.charges[key]) return { ledger, allowed: true };
  if (freeFlightsLeft(ledger, snap) > 0) {
    return { ledger: withCharge(ledger, key, { kind: 'free', settled: false, at: now }), allowed: true };
  }
  if (spendableCredits(ledger, snap) > 0) {
    return { ledger: withCharge(ledger, key, { kind: 'credit', settled: false, at: now }), allowed: true };
  }
  return { ledger, allowed: false };
}

/** Untracked before the first live update: nothing is charged. */
export function releaseTrack(ledger: CreditLedger, key: string): CreditLedger {
  const charge = ledger.charges[key];
  if (!charge || charge.settled) return ledger;
  const charges = { ...ledger.charges };
  delete charges[key];
  return { ...ledger, charges };
}

/** Signed out: the first live update spends the reserved free flight on the device. Credits are proxy-only. */
export function settleLocally(ledger: CreditLedger, key: string, isPro: boolean, now = Date.now()): CreditLedger {
  const charge = ledger.charges[key];
  if (!charge || charge.settled) return ledger;
  if (isPro) return releaseTrack(ledger, key);
  if (charge.kind !== 'free') return ledger;
  return {
    freeUsed: ledger.freeUsed + 1,
    charges: { ...ledger.charges, [key]: { ...charge, settled: true, at: now } },
  };
}

/** Signed in: the proxy charged this flight (or had already) as `kind`. */
export function markSettled(ledger: CreditLedger, key: string, kind: ChargeKind, now = Date.now()): CreditLedger {
  if (ledger.charges[key]?.settled) return ledger;
  return withCharge(ledger, key, { kind, settled: true, at: now });
}

function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Defensive load from the AsyncStorage cache; drops expired charges. */
export function parseLedger(raw: string | null | undefined, now = Date.now()): CreditLedger {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch { /* corrupt cache → start empty */ }
  const charges: Record<string, TrackCharge> = {};
  const rawCharges = data.charges && typeof data.charges === 'object' ? data.charges as Record<string, unknown> : {};
  for (const [key, value] of Object.entries(rawCharges)) {
    const c = value as Partial<TrackCharge> | null;
    if (!c || (c.kind !== 'free' && c.kind !== 'credit')) continue;
    const at = Number(c.at) || 0;
    const ttl = c.settled ? SETTLED_CHARGE_TTL_MS : PENDING_CHARGE_TTL_MS;
    if (now - at > ttl) continue;
    charges[key] = { kind: c.kind, settled: !!c.settled, at };
  }
  return { freeUsed: count(data.freeUsed), charges };
}
