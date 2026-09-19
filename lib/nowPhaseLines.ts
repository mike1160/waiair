/** The Now card's title and subtitle in the user's language (lib/nowPhase.ts holds the ladder itself). */

import { t } from './i18n';
import { nowPhaseId, nowPhaseLines, type NowPhaseFacts, type NowPhaseId } from './nowPhase';

export function nowCardLines(opts: NowPhaseFacts & {
  boarding?: boolean;
  departed?: boolean;
  landed?: boolean;
}): { id: NowPhaseId; title: string; sub: string } {
  const id = nowPhaseId(opts);
  const c = t();
  const lines = nowPhaseLines(id, {
    nowTomorrow: c.nowTomorrow,
    nowInDays: c.nowInDays,
    nowTomorrowSub: c.nowTomorrowSub,
    nowDayAfterTomorrow: c.nowDayAfterTomorrow,
    nowInDays: c.nowInDays,
    nowCheckinOpensInDays: c.nowCheckinOpensInDays,
    nowCheckinOpen: c.nowCheckinOpen,
    nowCheckinOpenSub: c.nowCheckinOpenSub,
    nowPrepare: c.nowPrepare,
    nowPrepareSub: c.nowPrepareSub,
    nowHeadToAirport: c.nowHeadToAirport,
    nowHeadToAirportSub: c.nowHeadToAirportSub,
    nowAtAirportNow: c.nowAtAirportNow,
    nowAtAirportNowSub: c.nowAtAirportNowSub,
    nowBoardingSoon: c.nowBoardingSoon,
    nowBoardingSoonSub: c.nowBoardingSoonSub,
    nowOnYourWay: c.nowOnYourWay,
    nowOnYourWaySub: c.nowOnYourWaySub,
    nowWelcomeTo: c.nowWelcomeTo,
    nowBaggageTerminal: c.nowBaggageTerminal,
    nowBaggageClaim: c.nowBaggageClaim,
    nowCheckDetails: c.nowCheckDetails,
  }, opts);
  return { id, ...lines };
}
