/**
 * Which airport is *your* airport, in a city that has two [W/4].
 *
 * The home airport is guessed once, on first launch, from the nearest airport to the traveller's position. In
 * Bangkok that guess is Don Mueang, because Don Mueang is genuinely nearer to most of the city than
 * Suvarnabhumi — by 0.9 km from Asoke, which is inside GPS noise. The guess is then written down and sticks,
 * and everything keyed on the home airport quietly follows the wrong one.
 *
 * Distance cannot fix this. Measured from the city centre of 24 large cities, nearest-airport picks the
 * principal gateway in 5 of them; filtering out fields with no scheduled service and preferring large airports
 * gets that to 9. The remaining fifteen are all cities where the secondary airport is closer *and* is itself a
 * large airport with scheduled service — BKK/DMK, CDG/ORY, MXP/LIN, FCO/CIA, ICN/GMP, TPE/TSA, KUL/SZB. There
 * is no geometric answer, so this file carries the knowledge instead.
 *
 * The table is deliberately short and deliberately conservative. An entry says: this nearer airport is the
 * city's secondary field — domestic, low-cost or regional — and that one is the principal passenger gateway.
 * Cities whose airports are of comparable standing are left out on purpose, because there the nearer one is a
 * perfectly good answer and substituting would make the guess worse:
 *
 *   Washington    DCA / IAD / BWI   all three are full gateways; DCA is many residents' own airport
 *   San Francisco SFO / OAK / SJC   three metros' worth of travellers, no single primary
 *   Tokyo         HND / NRT         Haneda is nearer and the busier passenger airport; Narita is no secondary
 *   Istanbul      IST / SAW         Sabiha Gökçen is a major gateway of its own, across the Bosphorus
 *   Beijing       PEK / PKX         Daxing is a principal international hub, not an overflow field
 *   Berlin        BER               one airport since 2020
 *
 * Anything not listed falls straight through to the nearest airport, unchanged. That is what keeps this
 * additive: it can only ever swap one named code for another named code.
 *
 * Pure, and unit-tested in lib/primaryAirport.test.ts.
 */

/**
 * Secondary airport → the principal passenger gateway of the same city.
 *
 * Every line is a claim about the real world, so each is one a traveller in that city would recognise: the
 * left-hand airport is the one they would name as "the other airport".
 */
const PRIMARY_OF: Record<string, string> = {
  DMK: 'BKK', // Don Mueang (low-cost) → Suvarnabhumi
  LCY: 'LHR', // London City → Heathrow
  ORY: 'CDG', // Orly → Charles de Gaulle
  LGA: 'JFK', // LaGuardia (domestic, perimeter rule) → John F. Kennedy
  LIN: 'MXP', // Linate (short-haul) → Malpensa
  CIA: 'FCO', // Ciampino (low-cost) → Fiumicino
  GMP: 'ICN', // Gimpo (mostly domestic) → Incheon
  ITM: 'KIX', // Itami (domestic only) → Kansai
  TSA: 'TPE', // Songshan (domestic/regional) → Taoyuan
  SZB: 'KUL', // Subang (turboprop/regional) → Kuala Lumpur International
  HLP: 'CGK', // Halim Perdanakusuma → Soekarno-Hatta
  SHA: 'PVG', // Hongqiao (mostly domestic) → Pudong
  CGH: 'GRU', // Congonhas (domestic) → Guarulhos
  MDW: 'ORD', // Midway (domestic) → O'Hare
  YTZ: 'YYZ', // Billy Bishop (regional) → Pearson
  BMA: 'ARN', // Bromma (regional) → Arlanda
  XSP: 'SIN', // Seletar (general aviation) → Changi
};

const code = (raw: string | null | undefined) => String(raw || '').trim().toUpperCase();

/** The principal gateway for a secondary airport, or null when this one is not a known secondary. */
export function primaryAirportFor(iata: string | null | undefined): string | null {
  return PRIMARY_OF[code(iata)] || null;
}

/** Is this airport its city's principal passenger gateway, as far as this table knows? */
export function isSecondaryAirport(iata: string | null | undefined): boolean {
  return !!primaryAirportFor(iata);
}

/**
 * The home airport to prefer, given the nearest airports to the traveller — closest first, as the proxy
 * returns them.
 *
 * Returns the code to use, which is the nearest airport unchanged in every city this table does not know
 * about. '' when there is nothing to choose from.
 *
 * The substitution is not conditioned on the primary also being in the list. A list of three can easily miss
 * it — from central Bangkok the third result is a provincial airport 77 km away, and from Milan the next
 * airports are in other cities entirely — while the fact that the traveller is next to the secondary is
 * already proof they are in that city. The caller resolves the returned code to an airport record.
 */
export function preferredHomeAirport(nearest: readonly { iata?: string }[] | null | undefined): string {
  const list = (nearest || []).map(a => code(a?.iata)).filter(Boolean);
  if (!list.length) return '';
  const closest = list[0];
  return primaryAirportFor(closest) || closest;
}

/**
 * Was this saved home airport chosen by the old nearest-airport guess and left wrong? [W/4]
 *
 * Used once, to correct installs that guessed before this table existed. True only for a code the table knows
 * to be a secondary field — never for an airport that is somebody's reasonable choice.
 */
export function needsPrimaryCorrection(saved: string | null | undefined): string | null {
  return primaryAirportFor(saved);
}

/** Where a saved home airport came from. Absent means it was saved before this was recorded [W/4]. */
export type HomeAirportSource = 'auto' | 'manual';

/**
 * The one-time correction for installs that guessed before this table existed [W/4].
 *
 * Only an airport this table knows to be a secondary field is corrected, and only when nothing recorded where
 * the saved value came from — which is the signature of a legacy install, since every write from this build
 * onwards records a source. So:
 *
 *   no source + a known secondary   →   corrected once, and the correction records source 'auto'
 *   source 'manual'                 →   never touched, in any circumstance
 *   source 'auto'                   →   already from this build, so already preferred the primary
 *   anything not in the table       →   left exactly as it is
 *
 * The honest limit: a legacy install carries no record of *how* its airport was set, so somebody who picked
 * Don Mueang by hand before this build is corrected too. That is why the caller says so on screen — picking it
 * again records 'manual' and this never runs against it a second time.
 */
export function homeAirportCorrection(opts: {
  saved?: { iata?: string } | null;
  source?: HomeAirportSource | null;
}): string | null {
  if (opts.source) return null;
  return needsPrimaryCorrection(opts.saved?.iata);
}
