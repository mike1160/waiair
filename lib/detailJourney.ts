/** Fixed flight-detail journey order. Pure — no i18n, no React. */

export type DetailJourneyPhase = 'pre_departure' | 'in_flight' | 'landed';

export type DetailJourneySectionId =
  | 'yourTimes'
  | 'actions'
  | 'beforeDeparture'
  | 'atDestination'
  | 'extras';

/** Flight number / route live only on RouteHero — never a second identity card. */
export const DETAIL_IDENTITY_HOST = 'hero' as const;

export function detailJourneyPhase(input: {
  status?: string;
  livePhase?: string;
}): DetailJourneyPhase {
  const status = String(input.status || '').toLowerCase();
  const live = String(input.livePhase || '');
  if (status === 'landed' || live === 'landed') return 'landed';
  if (
    status === 'en-route'
    || live === 'enRoute'
    || live === 'en-route'
    || live === 'departed'
  ) {
    return 'in_flight';
  }
  return 'pre_departure';
}

export function detailJourneySectionOrder(phase: DetailJourneyPhase): DetailJourneySectionId[] {
  if (phase === 'pre_departure') {
    return ['yourTimes', 'actions', 'beforeDeparture', 'atDestination', 'extras'];
  }
  return ['yourTimes', 'actions', 'atDestination', 'beforeDeparture', 'extras'];
}

export function beforeDepartureCollapsed(phase: DetailJourneyPhase): boolean {
  return phase === 'landed';
}

export function atDestinationLeadLanding(phase: DetailJourneyPhase): boolean {
  return phase === 'landed';
}

/** Gate + bell only — no lounge, delay, turbulence, or boarding-pass rows. */
export function beforeDeparturePlaceholderOnly(opts: {
  hasGate: boolean;
  hasOtherContent: boolean;
}): boolean {
  return !opts.hasGate && !opts.hasOtherContent;
}
