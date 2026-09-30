/**
 * Did the traveller grant the Gmail scope? [W/10]
 *
 * Connecting Gmail on Android bounced back to the account picker twice before the third attempt took. No
 * error, because [W/6] — correctly — treats a cancel as a decision and closes the screen quietly. But these
 * were not cancels: the consent had been granted every time.
 *
 * The cause is a gate the codebase already knew was unreliable. connectNativeGmail asked the SDK to echo
 * back the scopes it had just granted:
 *
 *     if (!added || added.type !== 'success' || !(added.data.scopes || []).includes(SCOPE)) → cancelled
 *
 * while the comment above validToken in the same file says, of the same call:
 *
 *     "straight after the consent screen it may still answer from its cache and leave gmail.readonly out of
 *      the list. The token is then refused, the scan reports 'not connected', and the traveller is told
 *      their inbox cannot be scanned seconds after they connected it."
 *
 * That lesson was applied to validToken and left in place here. So a granted consent read as `cancelled ·
 * scope`, the attempt was thrown away, and retrying only worked once the SDK's cache caught up.
 *
 * So the echoed list is not consulted. Only an outright non-success — the traveller closing the sheet — is a
 * cancel. Gmail itself is the authority on what a token may read, and a scope that really is missing comes
 * back as a 401 or 403 on the first call, which the scan already knows how to report.
 *
 * Pure, and unit-tested in lib/googleScopeGate.test.ts.
 */

/** What @react-native-google-signin's addScopes resolves to, as much of it as matters here. */
export type ScopeGrantResponse = {
  type?: string;
  data?: { scopes?: string[] } | null;
} | null | undefined;

export type ScopeGrantOutcome =
  /** The consent screen was completed. Whether the echoed list mentions the scope is not evidence. */
  | 'granted'
  /** The traveller closed the sheet, or the SDK had no credential to add a scope to. */
  | 'cancelled';

export function scopeGrantOutcome(added: ScopeGrantResponse): ScopeGrantOutcome {
  return added && added.type === 'success' ? 'granted' : 'cancelled';
}

/**
 * Should the app ask for the Gmail scope at all, given what a sign-in reported?
 *
 * Asking when it is already there costs a consent screen nobody needed; not asking when it is missing costs
 * a failed scan. The echoed list is trusted in this direction only — it is a reason to *skip* an extra
 * prompt, never a reason to throw a completed consent away.
 */
export function needsScopePrompt(scopes: readonly string[] | null | undefined, scope: string): boolean {
  if (!scope) return false;
  return !(scopes || []).includes(scope);
}
