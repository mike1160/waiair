import { t } from './i18n';
import { walkBuffered, type RaceBand, type WalkEstimate } from './gateWalkCore';

export {
  CONNECTION_BUFFER_MIN,
  RACE_COLOR,
  airportPhone,
  arrivalExitHint,
  baggageWalkMinutes,
  connectionMissed,
  connectionWalkMinutes,
  formatMmSs,
  gateWalkMinutes,
  raceBand,
  walkBuffered,
} from './gateWalkCore';
export type {
  RaceBand,
  WalkEstimate,
} from './gateWalkCore';

export function walkLabel(walk: WalkEstimate): string {
  return walk.estimate ? t().walkMinEstimate(walk.minutes) : t().walkMin(walk.minutes);
}

export function raceStatusText(band: RaceBand): string {
  if (band === 'green') return t().gateRaceGotTime;
  if (band === 'orange') return t().gateRaceClose;
  return t().gateRaceRunNotify;
}
