/**
 * Where the paywall may render, given what is already on screen.
 *
 * iOS presents a modal from its React ancestor's view controller, so a paywall rendered at the root is never
 * shown while a sheet is presented: the request is simply swallowed, and the half-presented state stopped the
 * add-flight sheet from opening again until the app was restarted. The paywall therefore renders inside
 * whichever sheet is in front, and only at the root when nothing else is.
 *
 * Pure, so the rule is unit-tested instead of read off the JSX.
 */

export type PaywallHost = 'addFlight' | 'detail' | 'root';

/** What is presented right now. The add-flight sheet can be opened on top of the flight page. */
export type PresentedSheets = {
  addFlightSheetOpen?: boolean;
  detailOpen?: boolean;
};

export function paywallHost(sheets: PresentedSheets): PaywallHost {
  if (sheets?.addFlightSheetOpen) return 'addFlight';
  if (sheets?.detailOpen) return 'detail';
  return 'root';
}
