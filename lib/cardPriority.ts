import type { LandingCardPhase } from './landingCards';
import { getImmigrationApp } from './immigrationApps';
import { behavioralScoreBonus } from './cardPreferences';

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
    visible: ctx => ctx.isArrival,
    score: ctx => (ctx.isTracked && ctx.hasPickup ? 80 : ctx.isTracked ? 70 : 20),
  },
  {
    id: 'transportCard',
    baseScore: 0,
    visible: ctx =>
      ctx.isArrival
      && ctx.status === 'landed'
      && (ctx.landingPhase === 'immediate' || ctx.landingPhase === 'hotel'),
    score: () => 75,
  },
  {
    id: 'hotelCard',
    baseScore: 0,
    visible: ctx =>
      ctx.isArrival
      && ctx.status === 'landed'
      && ctx.landingPhase === 'hotel',
    score: ctx => {
      if (ctx.minutesSinceLanding == null) return 50;
      if (ctx.minutesSinceLanding >= 5 && ctx.minutesSinceLanding <= 90) return 70;
      return 45;
    },
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
    visible: ctx =>
      ctx.isArrival
      && ctx.status === 'landed'
      && (ctx.landingPhase === 'immediate' || ctx.landingPhase === 'hotel'),
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
    visible: ctx => ctx.isPro && ctx.showLounge,
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
    id: 'restaurants',
    baseScore: 0,
    visible: ctx =>
      ctx.isArrival
      && ctx.status === 'landed'
      && ctx.landingPhase === 'none',
    score: () => 32,
  },
  {
    id: 'earlyCheckIn',
    baseScore: 0,
    visible: ctx =>
      ctx.isArrival
      && ctx.status === 'landed'
      && ctx.landingPhase === 'none',
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
  return CARD_SECTIONS
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
}

/** Call once when a detail card opens; order stays fixed until it is closed and reopened. */
export function sortDetailSectionsOnOpen(context: FlightContext): string[] {
  return sortVisibleCardSections(context);
}

export function buildMinutesSinceLanding(input: {
  status?: string;
  arrIso?: string;
  landedAtMs?: number | null;
}): number | null {
  if (String(input.status || '').toLowerCase() !== 'landed') return null;
  const landedMs = input.landedAtMs ?? null;
  const fromIso = input.arrIso
    ? new Date(String(input.arrIso).replace(' ', 'T')).getTime()
    : NaN;
  const base = landedMs ?? (Number.isFinite(fromIso) ? fromIso : null);
  if (base == null || !Number.isFinite(base)) return null;
  return Math.max(0, Math.floor((Date.now() - base) / 60000));
}
