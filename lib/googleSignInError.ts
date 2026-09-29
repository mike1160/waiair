/**
 * What Google actually said when the sign-in failed [W/6].
 *
 * The Gmail connect swallowed it. `catch { return { ok: false, reason: 'error' } }` collapsed every distinct
 * failure into one, so Android's repeated bounce back to the account picker reported the same "scanning
 * failed, try again" as a lost network or a cancelled sheet — and nothing on the device could say which.
 * Diagnosing it meant a cable and logcat.
 *
 * So the native SDK's error is classified here instead of discarded. The classification matters because the
 * answers are completely different: a DEVELOPER_ERROR is a build that cannot sign in at all and no amount of
 * retrying will help, while a cancel is not a failure and a network error is worth one more go.
 *
 * The SDK's own `statusCodes` covers only four cases (SIGN_IN_CANCELLED, IN_PROGRESS,
 * PLAY_SERVICES_NOT_AVAILABLE, SIGN_IN_REQUIRED) and deliberately does not name DEVELOPER_ERROR — the one
 * that matters most on Android, because it is what an unregistered package name or a signing certificate the
 * Google Cloud project has never seen produces. It arrives as a bare `10`, or as the string, depending on
 * platform and version, so both are matched.
 *
 * This file is deliberately free of react-native imports so it can be unit-tested; the caller passes the
 * SDK's own status codes in, rather than this file importing the SDK.
 *
 * Pure, and unit-tested in lib/googleSignInError.test.ts.
 */

export type GoogleSignInFailure =
  /** The build cannot sign in: package name or signing certificate is not registered. Retrying is pointless. */
  | 'misconfigured'
  /** The traveller closed the sheet. Not a failure, and nothing should be reported. */
  | 'cancelled'
  /** Google Play services missing, disabled or too old. */
  | 'no_play_services'
  /** The request did not get through. Worth retrying. */
  | 'network'
  /** A sign-in is already running; the second call is the one to drop. */
  | 'in_progress'
  /** Anything else, which stays honestly unclassified. */
  | 'error';

/** The codes the SDK does not name, and the names different versions use for them. */
const MISCONFIGURED = new Set(['10', 'DEVELOPER_ERROR', 'developer_error']);
const NETWORK = new Set(['7', 'NETWORK_ERROR', 'network_error']);
const CANCELLED = new Set(['12501', '12502', 'SIGN_IN_CANCELLED', 'ERR_CANCELED', 'ERR_SIGN_IN_CANCELLED']);
const PLAY_SERVICES = new Set(['12500', 'PLAY_SERVICES_NOT_AVAILABLE', 'SERVICE_VERSION_UPDATE_REQUIRED']);
const IN_PROGRESS = new Set(['ASYNC_OP_IN_PROGRESS', 'IN_PROGRESS', 'ERR_IN_PROGRESS']);

/** The SDK's statusCodes, passed in by the caller so this file need not import react-native. */
export type StatusCodes = {
  SIGN_IN_CANCELLED?: string;
  IN_PROGRESS?: string;
  PLAY_SERVICES_NOT_AVAILABLE?: string;
  SIGN_IN_REQUIRED?: string;
};

/** The raw code an error carries, as a string. '' when it carries none. */
export function signInErrorCode(err: unknown): string {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = e?.code;
  if (typeof code === 'string' && code.trim()) return code.trim();
  if (typeof code === 'number' && Number.isFinite(code)) return String(code);
  // Some versions put the status only in the message: "DEVELOPER_ERROR" or "statusCode=10".
  const msg = typeof e?.message === 'string' ? e.message : '';
  const named = msg.match(/DEVELOPER_ERROR|NETWORK_ERROR|SIGN_IN_CANCELLED|PLAY_SERVICES_NOT_AVAILABLE/);
  if (named) return named[0];
  const numbered = msg.match(/statusCode[=:\s]*(\d{1,5})/i);
  return numbered ? numbered[1] : '';
}

/**
 * What went wrong, from the error the SDK threw.
 *
 * `codes` is the SDK's own statusCodes object when the caller has it — its values differ between platforms,
 * so they are compared rather than assumed.
 */
export function classifyGoogleSignInError(err: unknown, codes?: StatusCodes | null): GoogleSignInFailure {
  const code = signInErrorCode(err);
  if (!code) return 'error';
  if (codes) {
    if (code === codes.SIGN_IN_CANCELLED) return 'cancelled';
    if (code === codes.IN_PROGRESS) return 'in_progress';
    if (code === codes.PLAY_SERVICES_NOT_AVAILABLE) return 'no_play_services';
  }
  if (MISCONFIGURED.has(code)) return 'misconfigured';
  if (CANCELLED.has(code)) return 'cancelled';
  if (PLAY_SERVICES.has(code)) return 'no_play_services';
  if (NETWORK.has(code)) return 'network';
  if (IN_PROGRESS.has(code)) return 'in_progress';
  return 'error';
}

/**
 * Is this worth trying again?
 *
 * A misconfigured build is not: the retry loop the traveller was stuck in could never have succeeded, and
 * saying "try again" to someone whose build cannot sign in is the part of this bug that wasted their time.
 */
export function signInFailureIsRetryable(failure: GoogleSignInFailure): boolean {
  return failure !== 'misconfigured' && failure !== 'cancelled';
}

/** A short line for the screen: the classification plus the raw code, so a report needs no cable. */
export function signInFailureDetail(failure: GoogleSignInFailure, code: string): string {
  const raw = String(code || '').trim();
  return raw ? `${failure} · ${raw}` : failure;
}
