/**
 * The line a theme puts at the top of the home screen.
 *
 * Blackout, Vapor and Arctic each speak in their own voice on the flight card (lib/nowPhase.ts and the
 * focus lines in HomeTrackedScreen); the five themes added in [P/1] do the same on the way in. Mission
 * control counts down, the flight deck calls its checklist, the cosmos is navigated and the clouds are
 * floated above. Every other theme says nothing here and the rotating headline is left as it was.
 *
 * Pure: the strings come in from the caller, so this runs under `node --test`.
 */

export type HeadlineThemeId = string | null | undefined;

export interface ThemeHeadlineCopy {
  eagleCountdown: (h: number) => string;
  eagleGo: string;
  eagleLaunch: string;
  cockpitClearance: string;
  cockpitCruise: (ft: string) => string;
  cockpitApproach: string;
  cockpitArrived: string;
  spaceNavigating: string;
  spaceApproaching: string;
  spaceTouchdown: (city: string) => string;
  holoJourney: string;
  holoClouds: string;
  holoHome: string;
}

export interface ThemeHeadlineFacts {
  /** Hours until the next departure, when one is known and still ahead. */
  hoursToDeparture?: number | null;
  /** The city being flown to, for the themes that name it. */
  destinationCity?: string;
}

/** A cruising altitude to quote: the one a jet actually sits at, not a number from the flight data. */
const CRUISE_FT = '35,000';

/**
 * The extra headlines for a theme, in the order they should rotate. Empty for every theme that has none —
 * an empty list leaves the ordinary headlines untouched.
 */
export function themeHeadlines(
  themeId: HeadlineThemeId,
  copy: ThemeHeadlineCopy,
  facts: ThemeHeadlineFacts = {},
): string[] {
  const hours = Number(facts.hoursToDeparture);
  const countdown = Number.isFinite(hours) && hours > 0 ? Math.round(hours) : null;
  const city = String(facts.destinationCity || '').trim();

  switch (themeId) {
    case 'eagle':
      return [
        countdown != null ? copy.eagleCountdown(countdown) : '',
        copy.eagleGo,
        copy.eagleLaunch,
      ].filter(Boolean);
    case 'cockpit':
      return [
        copy.cockpitClearance,
        copy.cockpitCruise(CRUISE_FT),
        copy.cockpitApproach,
        copy.cockpitArrived,
      ];
    case 'deepspace':
      return [
        copy.spaceNavigating,
        copy.spaceApproaching,
        // Only when there is a planet to name: "Touchdown on planet" alone says nothing.
        city ? copy.spaceTouchdown(city) : '',
      ].filter(Boolean);
    case 'holo':
      return [copy.holoJourney, copy.holoClouds, copy.holoHome];
    default:
      return [];
  }
}
