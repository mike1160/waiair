/**
 * Which leg of a flight the flight page shows: the arrival or the departure.
 *
 * A tracked flight knows its own side, and that always wins. The board's tab only decides for a flight opened
 * from the board itself. The page used to fall back to the tab whenever the app was not on the My-flights tab —
 * which it is not while the airport board is on — so a tracked departure opened from the home screen was read
 * as an arrival, and every flight that had taken off looked as if it had already landed.
 */

export type LegType = 'arrival' | 'departure';

export function detailLegType(trackedType: LegType | null | undefined, boardTab: LegType): LegType {
  return trackedType ?? boardTab;
}
