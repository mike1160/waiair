/**
 * Where "Still waiting for your bag?" sends a passenger.
 *
 * There is no public WorldTracer page left to link to: the old passenger form
 * (worldtracer.aero/filenew/claim.exe) is a 404, WorldTracer Online (wtrweb.worldtracer.aero/…/pax.do) answers
 * 500, and worldtracer.aero now just forwards to SITA's product page for airlines. A delayed bag is reported to
 * the airline, which files it in WorldTracer itself — so the link goes to that airline's own baggage page.
 *
 * Airline sites move their pages around (which is how the old link broke) and several answer a missing page with
 * a normal-looking 200, so a hardcoded airline URL cannot be trusted to stay right. A search for the airline's
 * delayed-baggage page cannot 404 and puts the official page first.
 */

import { AIRLINE_IATA_NAMES } from './airlineDisplay.ts';

function airlineCode(raw?: string | null): string {
  return String(raw || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 2);
}

/** "Thai Airways delayed baggage report"; the code stands in for an airline we have no name for. */
export function lostLuggageSearchQuery(airline?: string | null): string {
  const code = airlineCode(airline);
  const name = (code && AIRLINE_IATA_NAMES[code]) || (code ? `${code} airline` : 'airline');
  return `${name} delayed baggage report`;
}

export function lostLuggageUrl(airline?: string | null): string {
  return `https://www.google.com/search?q=${encodeURIComponent(lostLuggageSearchQuery(airline))}`;
}
