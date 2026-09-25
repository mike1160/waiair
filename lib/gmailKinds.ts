/**
 * What each kind of travel mail is called and what it looks like — one definition, used by the screen that
 * finds them and by the inbox that keeps them.
 *
 * Lived in screens/GmailImportScreen.tsx until the inbox needed the same icons and the same words; two
 * copies of a list this long would have drifted the first time a category was added.
 */
import { t } from './i18n.ts';
import type { GmailItemKind } from './gmailInboxScan.ts';

export const KIND_ICON: Record<GmailItemKind, string> = {
  flight: '✈️', hotel: '🏨', carRental: '🚗', excursion: '🎟️', transport: '🚆', insurance: '🛡️',
  restaurant: '🍽️',
  // Places to sleep that are not a hotel [J/2].
  hostel: '🛌', bandB: '🍳', vacationRental: '🏡', camping: '⛺', boatRental: '⛵',
  // Getting there over water, being driven, and parking the car [J/3].
  ferry: '⛴️', cruise: '🚢', transfer: '🚙', parking: '🅿️',
  // Things to do, the paperwork to get in, and looking after yourself [J/4 + J/4b].
  event: '🎭', course: '🎓', visa: '🛂', lounge: '🛋️',
  diving: '🤿', bikeRental: '🚲', adventure: '🪂', experience: '🐪',
  wellness: '💆', sport: '⛳',
  // The extras bought on top of a flight.
  extraBaggage: '🧳', specialAssistance: '♿', mealOrder: '🍜', inflightPurchase: '🛍️',
  cabinUpgrade: '💺', petReservation: '🐾',
};

/**
 * Kinds we can find but not yet turn into anything: they are listed so you can see they were noticed, but
 * they cannot be ticked — importing them would only report mails that "could not be read".
 */
const DETECT_ONLY_KINDS: GmailItemKind[] = [
  'transport', 'insurance',
  'extraBaggage', 'specialAssistance', 'mealOrder', 'inflightPurchase', 'cabinUpgrade', 'petReservation',
  // [J/2] Nothing parses these yet, so they are shown and cannot be ticked.
  'hostel', 'bandB', 'vacationRental', 'camping', 'boatRental',
  // [J/3] Same for the new ways of getting there and parking.
  'ferry', 'cruise', 'transfer', 'parking',
  // [J/4 + J/4b] And everything booked for while you are there.
  'event', 'course', 'visa', 'lounge',
  'diving', 'bikeRental', 'adventure', 'experience', 'wellness', 'sport',
];

export function detectOnly(kind: GmailItemKind): boolean {
  return DETECT_ONLY_KINDS.includes(kind);
}

/** The name of a kind in the app's language. */
export function kindLabel(kind: GmailItemKind): string {
  if (kind === 'extraBaggage') return t().gmailExtraBaggage;
  if (kind === 'specialAssistance') return t().gmailSpecialAssistance;
  if (kind === 'mealOrder') return t().gmailMealOrder;
  if (kind === 'inflightPurchase') return t().gmailInflightPurchase;
  if (kind === 'cabinUpgrade') return t().gmailCabineUpgrade;
  if (kind === 'petReservation') return t().gmailPetReservation;
  if (kind === 'flight') return t().gmailFlights;
  if (kind === 'hotel') return t().gmailHotels;
  if (kind === 'excursion') return t().gmailExcursions;
  if (kind === 'restaurant') return t().gmailRestaurants ?? 'Restaurants';
  if (kind === 'transport') return t().gmailTransport;
  if (kind === 'insurance') return t().gmailInsurance;
  if (kind === 'hostel') return t().gmailHostel;
  if (kind === 'bandB') return t().gmailBandB;
  if (kind === 'vacationRental') return t().gmailVacationRental;
  if (kind === 'camping') return t().gmailCamping;
  if (kind === 'boatRental') return t().gmailBoatRental;
  if (kind === 'ferry') return t().gmailFerry;
  if (kind === 'cruise') return t().gmailCruise;
  if (kind === 'transfer') return t().gmailTransfer;
  if (kind === 'parking') return t().gmailParking;
  if (kind === 'event') return t().gmailEvent;
  if (kind === 'course') return t().gmailCourse;
  if (kind === 'visa') return t().gmailVisa;
  if (kind === 'lounge') return t().gmailLounge;
  if (kind === 'diving') return t().gmailDiving;
  if (kind === 'bikeRental') return t().gmailBikeRental;
  if (kind === 'adventure') return t().gmailAdventure;
  if (kind === 'experience') return t().gmailExperience;
  if (kind === 'wellness') return t().gmailWellness;
  if (kind === 'sport') return t().gmailSport;
  return t().gmailCars;
}
