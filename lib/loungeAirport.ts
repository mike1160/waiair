/**
 * Which airport's lounges the flight page shows [S/1].
 *
 * It used to show both ends of the trip: the section mapped over origin and destination and rendered a
 * LoungePanel for each. Every panel carries its own "Which lounges can I use?" header, so on a departure
 * where both airports have lounges the same question appeared twice, one under the other, with nothing
 * saying which airport either belonged to.
 *
 * A lounge is somewhere you sit *before* a flight, so the one that matters is the airport you board at. For
 * a flight followed from the arrivals side there is no departure airport to speak of, and the destination is
 * the only one there was — which is what that case already showed, and it is unchanged.
 *
 * Pure, and unit-tested in lib/loungeAirport.test.ts.
 */

/**
 * The airport whose lounges to show, or '' when neither end is known.
 *
 * `type` is the side of the board this flight is followed from: 'departure' means the traveller is leaving
 * from `origin`, 'arrival' that they are being met at `destination`.
 */
export function loungeAirportFor(
  type: 'arrival' | 'departure',
  origin: string | undefined,
  destination: string | undefined,
): string {
  const from = String(origin || '').trim().toUpperCase();
  const to = String(destination || '').trim().toUpperCase();
  if (type === 'departure') return from || to;
  return to;
}
