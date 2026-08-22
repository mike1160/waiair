import type { LandingCardPhase } from './landingCards';
import { isoInAirportTzToUtcMs, localHourFromIso } from './localFlightTime';
import { getImmigrationApp } from './immigrationApps';
import { behavioralScoreBonus } from './cardPreferences';
import { capAffiliateSections } from './affiliateConfig';

export type FlightStatus =
  | 'boarding'
  | 'en-route'
  | 'landed'
  | 'delayed'
  | 'scheduled'
  | 'cancelled'
  | 'unknown';

export type FlightContext = {
  status: FlightStatus;
  minutesUntilDeparture: number | null;
  minutesUntilArrival: number | null;
  minutesSinceLanding: number | null;
  isTracked: boolean;
  hasPickup: boolean;
  isArrival: boolean;
  isDeparture: boolean;
  isPro: boolean;
  destIata: string;
  originCountry: string;
  destCountry: string;
  destCity: string;
  arrIso?: string;
  airlineCode: string;
  flightDurationMs: number | null;
  showCompensation: boolean;
  gateClosesInMinutes: number | null;
  baggageBelt: string | null;
  landingPhase: LandingCardPhase;
  userPreferences: Record<string, number>;
  dismissPreferences: Record<string, number>;
  hasGateRace: boolean;
  boardingPhase: 'open' | 'closing' | 'lastCall' | null;
  hasAircraft: boolean;
  hasBoardingPass: boolean;
  showLounge: boolean;
  showFlightMemory: boolean;
};

export type CardSection = {
  id: string;
  baseScore: number;
  score: (context: FlightContext) => number;
  visible: (context: FlightContext) => boolean;
};

export const CARD_SECTIONS: CardSection[] = [
  {
    id: 'gateRace',
    baseScore: 0,
    visible: ctx => ctx.hasGateRace,
    score: ctx => (ctx.minutesUntilDeparture != null && ctx.minutesUntilDeparture < 30 ? 90 : 50),
  },
  {
    id: 'boardingBanner',
    baseScore: 0,
    visible: ctx => ctx.boardingPhase != null,
    score: ctx =>
      ctx.boardingPhase === 'lastCall' || ctx.boardingPhase === 'closing' || ctx.boardingPhase === 'open'
        ? 100
        : 0,
  },
  {
    id: 'gateClosing',
    baseScore: 0,
    visible: ctx =>
      ctx.isDeparture
      && ctx.boardingPhase === 'open'
      && ctx.gateClosesInMinutes != null
      && ctx.gateClosesInMinutes > 0,
    score: ctx =>
      ctx.gateClosesInMinutes != null && ctx.gateClosesInMinutes < 15 ? 95 : 40,
  },
  {
    id: 'turbulenceForecast',
    baseScore: 0,
    visible: ctx => ctx.status === 'boarding' || ctx.status === 'en-route',
    score: ctx => ctx.status === 'en-route' ? 82 : 74,
  },
  {
    id: 'landedWeather',
    baseScore: 0,
    visible: ctx =>
      ctx.isArrival
      && ctx.isTracked
      && ctx.status === 'landed'
      && (ctx.landingPhase === 'immediate' || ctx.landingPhase === 'hotel'),
    score: ctx =>
      ctx.minutesSinceLanding != null && ctx.minutesSinceLanding < 30 ? 85 : 55,
  },
  {
    id: 'pickupMode',
    baseScore: 0,
    visible: ctx => ctx.isArrival && ctx.landingPhase !== 'hidden',
    score: ctx => (ctx.isTracked && ctx.hasPickup ? 80 : ctx.isTracked ? 70 : 20),
  },
  {
    id: 'postLandingAccordion',
    baseScore: 0,
    visible: ctx =>
      ctx.isArrival
      && ctx.status === 'landed'
      && (ctx.landingPhase === 'immediate' || ctx.landingPhase === 'hotel'),
    score: () => 76,
  },
  {
    id: 'transportCard',
    baseScore: 0,
    visible: () => false,
    score: () => 75,
  },
  {
    id: 'hotelCard',
    baseScore: 0,
    visible: () => false,
    score: () => 70,
  },
  {
    id: 'activitiesCard',
    baseScore: 0,
    visible: () => false,
    score: () => 62,
  },
  {
    id: 'rentalCarCard',
    baseScore: 0,
    visible: () => false,
    score: () => 48,
  },
  {
    id: 'insuranceBanner',
    baseScore: 0,
    visible: () => false,
    score: () => 0,
  },
  {
    id: 'immigrationTip',
    baseScore: 0,
    visible: ctx =>
      ctx.isArrival
      && ctx.status === 'landed'
      && (ctx.landingPhase === 'immediate' || ctx.landingPhase === 'hotel')
      && !!getImmigrationApp(ctx.destIata),
    score: () => 65,
  },
  {
    id: 'foodCard',
    baseScore: 0,
    visible: () => false,
    score: () => 60,
  },
  {
    id: 'delayPrediction',
    baseScore: 25,
    visible: ctx =>
      ctx.isPro && (ctx.status === 'scheduled' || ctx.status === 'delayed'),
    score: () => 30,
  },
  {
    id: 'flightProgressLine',
    baseScore: 10,
    visible: () => true,
    score: () => 45,
  },
  {
    id: 'luxuryInfoPanel',
    baseScore: 0,
    visible: () => true,
    score: ctx => {
      if (ctx.baggageBelt && ctx.status === 'landed') return 90;
      return ctx.baggageBelt ? 72 : 42;
    },
  },
  {
    id: 'loungePanel',
    baseScore: 0,
    visible: ctx =>
      ctx.isPro
      && ctx.showLounge
      && !(ctx.isArrival && ctx.status === 'landed' && (ctx.landingPhase === 'immediate' || ctx.landingPhase === 'hotel')),
    score: () => 40,
  },
  {
    id: 'aircraftInfo',
    baseScore: 0,
    visible: ctx => ctx.hasAircraft,
    score: () => 30,
  },
  {
    id: 'jetlagTips',
    baseScore: 0,
    visible: () => true,
    score: () => 35,
  },
  {
    id: 'mealInfo',
    baseScore: 0,
    visible: ctx =>
      (ctx.flightDurationMs ?? 0) > 3 * 60 * 60 * 1000
      && /^(TG|SQ|MH|EK|QR|CX)/i.test(String(ctx.airlineCode || '')),
    score: () => 33,
  },
  {
    id: 'restaurants',
    baseScore: 0,
    visible: () => false,
    score: () => 0,
  },
  {
    id: 'earlyCheckIn',
    baseScore: 0,
    visible: ctx => {
      if (!ctx.isArrival || ctx.status !== 'landed') return false;
      if (ctx.landingPhase === 'hidden') return false;
      const h = localHourFromIso(ctx.arrIso, ctx.destIata, ctx.destCountry);
      return h != null && h < 11;
    },
    score: () => 28,
  },
  {
    id: 'boardingPass',
    baseScore: 0,
    visible: ctx => ctx.hasBoardingPass,
    score: () => 22,
  },
  {
    id: 'flightMemory',
    baseScore: 0,
    visible: ctx => ctx.showFlightMemory,
    score: () => 20,
  },
];

export function sortVisibleCardSections(context: FlightContext): string[] {
  const ids = CARD_SECTIONS
    .filter(section => section.visible(context))
    .map(section => ({
      id: section.id,
      total:
        section.baseScore
        + section.score(context)
        + behavioralScoreBonus(
          section.id,
          context.userPreferences,
          context.dismissPreferences,
        ),
    }))
    .sort((a, b) => b.total - a.total)
    .map(entry => entry.id);
  return capAffiliateSections(ids, context.showCompensation);
}

/** Call once when a detail card opens; order stays fixed until it is closed and reopened. */
export function sortDetailSectionsOnOpen(context: FlightContext): string[] {
  return sortVisibleCardSections(context);
}

export function buildMinutesSinceLanding(input: {
  status?: string;
  arrIso?: string;
  landedAtMs?: number | null;
  destIata?: string;
  destCountry?: string;
}): number | null {
  if (String(input.status || '').toLowerCase() !== 'landed') return null;
  const landedMs = input.landedAtMs ?? null;
  const fromIso = isoInAirportTzToUtcMs(input.arrIso, input.destIata, input.destCountry);
  const base = landedMs ?? fromIso;
  if (base == null || !Number.isFinite(base)) return null;
  return Math.max(0, Math.floor((Date.now() - base) / 60000));
}
